import { Component } from 'react';
import Icon from './Icon.jsx';

// Lazy More-page chunks (This week / Household / Spending) 404 after a GitHub Pages
// deploy while an old tab is still open. Without a boundary, React blanks the app.
function isChunkLoadError(error) {
  const message = String(error?.message || error || '');
  return /Failed to fetch dynamically imported module|Loading chunk|Importing a module script failed|error loading dynamically imported module/i.test(message);
}

export default class FeatureErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prevProps) {
    if (prevProps.page !== this.props.page && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    const label = this.props.label || 'This page';
    const stale = isChunkLoadError(this.state.error);
    return (
      <section className="empty-page" role="alert">
        <Icon name={this.props.icon || 'arrow'} />
        <h1>{label} couldn’t open</h1>
        <p>{stale
          ? 'Cartners was updated while this tab was open. Refresh to load the latest Household and Plans screens.'
          : 'Something went wrong loading this screen. Your Home and cart are still fine — try again, or go back.'}</p>
        <div className="preference-actions">
          {stale
            ? <button type="button" className="button primary" onClick={() => location.reload()}>Refresh Cartners<Icon name="arrow" /></button>
            : <>
              <button type="button" className="button" onClick={() => this.setState({ error: null })}>Try again</button>
              <button type="button" className="button primary" onClick={() => this.props.navigate?.('home')}>Back to Home<Icon name="arrow" /></button>
            </>}
        </div>
      </section>
    );
  }
}
