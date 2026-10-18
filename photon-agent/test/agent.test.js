import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyMessage, formatDraft, handleMessage, makeRequestId } from '../src/agent.js';

const draft = {
  draftId: 'draft-1', workspaceId: 'demo-family', listRevision: 3, sourceMode: 'live_ai', kind: 'recommendation',
  recommendation: {
    title: 'Black bean tacos', servings: 4, prepMinutesApprox: 25, fitReason: 'A quick shared dinner.',
    ingredients: [{ id: 'beans', name: 'Black beans', quantity: 2, unit: 'can' }],
    listPreview: [{ ingredientId: 'beans', action: 'add', deltaQuantity: 2 }],
  },
};

function fixture() {
  const sent = [];
  const suggestions = [];
  const confirmations = [];
  const state = { pendingBySpace: {}, saved: 0, async save() { this.saved++; } };
  const config = {
    projectId: 'pho_prj_demo', platform: 'imessage', agentHandle: '+15550000000', workspaceId: 'demo-family',
    allowedSenders: new Set(['+15550000001', '+15550000002']),
    actorBySender: new Map([['+15550000001', 'sam'], ['+15550000002', 'lee']]),
  };
  const photon = { projects: { async sendMessage(input) { sent.push(input); } } };
  const api = {
    async suggest(input) { suggestions.push(input); return draft; },
    async confirmDraft(input) { confirmations.push(input); return { changeSummary: 'Added 2 cans black beans.' }; },
  };
  const makeMessage = (id, text, handle = '+15550000001') => ({
    id, platform: 'imessage', status: 'received',
    sentBy: { kind: 'human', handle },
    receivedBy: { kind: 'agent', id: 'agent-user', handle: '+15550000000' },
    space: { id: 'space-group' },
    content: { type: 'text', format: 'plain', text },
  });
  return { sent, suggestions, confirmations, state, config, photon, api, makeMessage };
}

test('only recognizes a small set of explicit food prompts and pending-draft replies', () => {
  assert.equal(classifyMessage('What do you want to eat today?', false), 'suggest');
  assert.equal(classifyMessage('@Cartners, suggest a dinner', false), 'suggest');
  assert.equal(classifyMessage('add it', true), 'confirm');
  assert.equal(classifyMessage('Not now', true), 'dismiss');
  assert.equal(classifyMessage('I can pick up groceries', false), 'ignore');
  assert.equal(classifyMessage('@Cartners', false), 'ignore');
  assert.equal(classifyMessage('@Cartners what do you think about the game?', false), 'ignore');
  assert.equal(classifyMessage('@Cartners add milk', false), 'suggest');
  assert.equal(classifyMessage('@Cartners make it quicker', true), 'suggest');
});

test('draft reply shows the meal, cart preview, and one clear confirmation', () => {
  const response = formatDraft(draft);
  assert.match(response, /Black bean tacos/);
  assert.match(response, /get 2 cans Black beans/);
  assert.match(response, /Nothing has been added yet/);
  assert.match(response, /Reply “add it”/);
});

test('message-based request IDs stay stable across Photon delivery retries', () => {
  const first = makeRequestId('photon-message-1', 'suggest');
  assert.equal(first, makeRequestId('photon-message-1', 'suggest'));
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(first, makeRequestId('photon-message-2', 'suggest'));
});

test('suggestion is only confirmed after an authorized person replies add it', async () => {
  const f = fixture();
  await handleMessage({ message: f.makeMessage('incoming-1', 'What should we eat tonight?'), ...f });
  assert.equal(f.suggestions.length, 1);
  assert.equal(f.sent.length, 1);
  assert.equal(f.sent[0].body.spaceId, 'space-group');
  assert.match(f.sent[0].body.content.text, /Nothing has been added yet/);
  assert.equal(f.confirmations.length, 0);
  assert.equal(f.state.pendingBySpace['space-group'].draft.draftId, 'draft-1');

  await handleMessage({ message: f.makeMessage('incoming-2', 'Add it', '+15550000002'), ...f });
  assert.equal(f.confirmations.length, 1);
  assert.equal(f.confirmations[0].actorId, 'lee');
  assert.equal(f.confirmations[0].expectedListRevision, 3);
  assert.equal(f.confirmations[0].target, 'cart');
  assert.equal(f.sent.length, 2);
  assert.match(f.sent[1].body.content.text, /Added Black bean tacos to the shared cart/);
  assert.equal(f.state.pendingBySpace['space-group'], undefined);
});

test('messages from unapproved senders are ignored without touching Cartners', async () => {
  const f = fixture();
  const handled = await handleMessage({ message: f.makeMessage('incoming-3', '@Cartners what should we eat?', '+15559999999'), ...f });
  assert.equal(handled, false);
  assert.equal(f.suggestions.length, 0);
  assert.equal(f.sent.length, 0);
});
