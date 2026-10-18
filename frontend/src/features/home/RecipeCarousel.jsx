import { useEffect, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { fallbackRecipes, loadRandomRecipes } from '../../api/discovery.js';

function validRecipe(item) {
  try { return item && typeof item.id === 'string' && typeof item.title === 'string' && new URL(item.thumbnailUrl).protocol === 'https:' && new URL(item.sourceUrl).protocol === 'https:'; }
  catch { return false; }
}

export default function RecipeCarousel({ active, pending, onTry }) {
  const [recipes, setRecipes] = useState(fallbackRecipes);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(() => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const [interacting, setInteracting] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [status, setStatus] = useState('loading');
  const [retry, setRetry] = useState(0);
  const recipe = recipes[index];

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    setStatus('loading');
    loadRandomRecipes({ signal: controller.signal }).then(items => {
      const clean = items.filter(validRecipe).slice(0, 8);
      if (!clean.length) throw new Error('No recipes found');
      setRecipes(clean); setIndex(0); setImageFailed(false); setStatus('ready');
    }).catch(() => { if (!controller.signal.aborted) setStatus('fallback'); });
    return () => controller.abort();
  }, [active, retry]);

  useEffect(() => {
    if (!active || paused || interacting || recipes.length < 2) return;
    const timer = setInterval(() => { setIndex(value => (value + 1) % recipes.length); setImageFailed(false); }, 12000);
    return () => clearInterval(timer);
  }, [active, paused, interacting, recipes.length]);

  function move(direction) { setIndex(value => (value + direction + recipes.length) % recipes.length); setImageFailed(false); }

  return <section className="featured-recipes" aria-label="Featured recipes" aria-roledescription="carousel"
    onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(false)}
    onFocusCapture={() => setInteracting(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setInteracting(false); }}>
    <div className="featured-heading"><h2>Something new to try</h2><span>{index + 1} of {recipes.length}</span></div>
    {recipe ? <article key={recipe.id} className="featured-slide" aria-roledescription="slide" aria-label={`${index + 1} of ${recipes.length}: ${recipe.title}`}>
      <div className="featured-media">{!imageFailed ? <img src={recipe.thumbnailUrl} alt={`Recipe for ${recipe.title}`} loading="lazy" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} /> : <div className="featured-image-fallback"><Icon name="leaf" /><span>{recipe.title}</span></div>}<span className="featured-badge">{recipe.sourceType === 'article' ? 'Recipe find' : 'Video find'}</span></div>
      <div className="featured-copy"><p className="featured-source">{[recipe.cuisine, recipe.sourceName].filter(Boolean).join(' · ')}</p><h3>{recipe.title}</h3>
        <div className="featured-actions"><button className="button primary" disabled={pending} onClick={() => onTry(recipe.prompt)}>{pending ? 'Thinking…' : 'Make this tonight'}<Icon name="arrow" /></button><a className="featured-link" href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer">{recipe.sourceType === 'article' ? 'Open recipe' : 'Watch video'}<Icon name="arrow" /></a></div>
      </div>
    </article> : <div className="featured-empty" aria-live="polite" aria-busy="true"><h3>Finding a fresh idea…</h3><p>Recipes and cooking videos from around the table.</p></div>}
    {recipes.length > 1 && <div className="featured-controls"><button className="text-button" onClick={() => move(-1)} aria-label="Previous recipe">Previous</button><button className="text-button" onClick={() => setPaused(value => !value)} aria-pressed={paused}>{paused ? 'Play slideshow' : 'Pause slideshow'}</button><button className="text-button" onClick={() => move(1)} aria-label="Next recipe">Next</button></div>}
    <div className="featured-refresh"><span>{status === 'loading' ? 'Finding fresh picks…' : status === 'fallback' ? 'Showing saved picks while discovery reconnects.' : 'Recipe data by TheMealDB'}</span><button className="text-button" disabled={status === 'loading'} onClick={() => setRetry(value => value + 1)}>Surprise us<Icon name="arrow" /></button></div>
  </section>;
}
