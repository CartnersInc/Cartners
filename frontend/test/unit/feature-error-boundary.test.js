import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// Mirrors FeatureErrorBoundary chunk-load detection without mounting React.
function isChunkLoadError(error) {
  const message = String(error?.message || error || '');
  return /Failed to fetch dynamically imported module|Loading chunk|Importing a module script failed|error loading dynamically imported module/i.test(message);
}

describe('More-page chunk load recovery', () => {
  it('recognizes GitHub Pages stale-tab import failures', () => {
    assert.equal(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://cartnersinc.github.io/Cartners/assets/Groups-old.js')), true);
    assert.equal(isChunkLoadError(new Error('error loading dynamically imported module')), true);
    assert.equal(isChunkLoadError(new Error('prefs.restrictions.join is not a function')), false);
  });
});
