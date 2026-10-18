import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi, isWorkspace, isDraft } from '../../src/api/client.js';
import { householdKind, isFamilyTable, splitsCosts } from '../../src/household.js';
import { allocateSplit, rememberedSharers, unrecordedRuns } from '../../src/features/spending/lib/remember.js';
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
  const week = {
    kind: 'weekly_plan', draftId: 'draft-week', workspaceId: 'demo-family', sourceMode: 'sample', listRevision: 1,
    days: Array.from({ length: 7 }, (_, index) => ({
      planDate: `2026-10-${12 + index}`,
      recommendation: { title: `Meal ${index}`, servings: 4, ingredients: [{ id: `ing-${index}`, name: 'Beans', quantity: 1, unit: 'can' }] },
    })),
  };
  assert.ok(isDraft(week, 'demo-family'));
  assert.ok(!isDraft({ ...week, days: week.days.slice(0, 6) }, 'demo-family'));
});

test('family tables stay pooled; roommate tables split costs', () => {
  assert.equal(householdKind({ workspaceId: 'demo-family', preferences: { spendingMode: 'pooled' } }), 'family');
  assert.equal(householdKind({ workspaceId: 'demo-roommates', preferences: { spendingMode: 'split' } }), 'roommates');
  assert.ok(isFamilyTable({ preferences: { householdKind: 'family', spendingMode: 'pooled' } }));
  assert.equal(householdKind({ workspaceId: 'household-1', preferences: { householdKind: 'other', spendingMode: 'pooled' } }, { kind: 'roommates', workspaceId: 'household-1' }), 'roommates');
  assert.ok(!isFamilyTable({ workspaceId: 'household-1', preferences: { spendingMode: 'pooled' } }, { kind: 'roommates', workspaceId: 'household-1' }));
  assert.ok(splitsCosts({ preferences: { spendingMode: 'split' } }));
  assert.ok(!splitsCosts({ preferences: { spendingMode: 'pooled' } }));
});

test('roommate receipts reuse the last split and even-split leftover cents', () => {
  const workspace = {
    expenses: [
      { status: 'confirmed', mode: 'split', payerId: 'leila', sharedMemberIds: ['leila', 'sam'], runId: 'run-1' },
    ],
  };
  assert.deepEqual(rememberedSharers(workspace, ['leila', 'sam', 'jordan']), ['leila', 'sam']);
  const alloc = allocateSplit(1001, ['a', 'b', 'c'], {});
  assert.deepEqual(alloc, { a: 334, b: 334, c: 333 });
  const withPersonal = allocateSplit(2000, ['leila', 'sam'], { sam: 600 });
  assert.equal(withPersonal.sam, 1300);
  assert.equal(withPersonal.leila, 700);
  assert.deepEqual(unrecordedRuns([{ id: 'run-1' }, { id: 'run-2' }], workspace.expenses).map(run => run.id), ['run-2']);
});
