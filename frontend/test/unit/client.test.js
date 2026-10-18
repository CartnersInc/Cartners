import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi, isWorkspace, isDraft } from '../../src/api/client.js';
import { readFile } from 'node:fs/promises';

test('writes preserve the caller action ID and structured conflicts', async () => {
  const body = { requestId: 'same-action', workspaceId: 'demo-family' };
  const calls = [];
  const api = createApi({ baseUrl: 'https://example.test/', fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ error: { code: 'LIST_CHANGED', message: 'Review the updated cart.' }, workspace: { listRevision: 2 } }), { status: 409 });
  } });
  for (let i = 0; i < 2; i++) await assert.rejects(api.request('/api/drafts/confirm', { method: 'POST', body }), error => error.status === 409 && error.code === 'LIST_CHANGED' && error.payload.workspace.listRevision === 2);
  assert.equal(calls[0].url, 'https://example.test/api/drafts/confirm');
  assert.equal(calls[0].options.body, calls[1].options.body);
  assert.equal(JSON.parse(calls[1].options.body).requestId, 'same-action');
});
test('HTML fallback and connection failure never count as success', async () => {
  const htmlApi = createApi({ fetchImpl: async () => new Response('<html>Vite</html>') });
  await assert.rejects(htmlApi.request('/api/workspace'), error => error.code === 'INVALID_RESPONSE' && error.message.includes('backend to be deployed and connected'));
  const offline = createApi({ fetchImpl: async () => { throw new TypeError('offline'); } });
  await assert.rejects(offline.request('/api/workspace'), /Cannot reach/);
});
test('snapshot boundary rejects another group and non-snapshots', async () => {
  const sample = JSON.parse(await readFile(new URL('../../../docs/fixtures/workspace.json', import.meta.url)));
  assert.ok(isWorkspace(sample, 'demo-family'));
  assert.ok(!isWorkspace(sample, 'demo-roommates'));
  assert.ok(!isWorkspace({ workspaceId: 'demo-family' }, 'demo-family'));
});

test('draft boundary accepts contract variants and rejects malformed recipes', async () => {
  for (const name of ['suggestions', 'refinement', 'groceries', 'clarification']) {
    const draft = JSON.parse(await readFile(new URL(`../../../docs/fixtures/${name}.json`, import.meta.url)));
    assert.ok(isDraft(draft, 'demo-family'), name);
    assert.ok(!isDraft(draft, 'another-group'));
  }
  assert.ok(!isDraft({ kind: 'recommendation', draftId: 'broken', workspaceId: 'demo-family', sourceMode: 'live_ai', listRevision: 1 }, 'demo-family'));
});
