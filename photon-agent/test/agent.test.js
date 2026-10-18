import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyMessage, formatDraft, handleMessage, makeRequestId } from '../src/agent.js';
import { handleSpectrumMessage, HELP_REPLY } from '../src/spectrum.js';

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

test('weekly drafts save to plans, not the cart', async () => {
  const week = {
    draftId: 'draft-week', workspaceId: 'demo-family', listRevision: 3, sourceMode: 'live_ai', kind: 'weekly_plan',
    days: Array.from({ length: 7 }, (_, index) => ({
      planDate: `2026-10-${12 + index}`,
      recommendation: { title: `Dinner ${index + 1}` },
    })),
  };
  assert.match(formatDraft(week), /calendar preview/);
  assert.match(formatDraft(week), /Groceries stay off the cart/);
  const f = fixture();
  f.api.suggest = async () => week;
  f.api.confirmDraft = async (input) => {
    f.confirmations.push(input);
    return { changeSummary: 'Saved the weekly plans. No groceries were added.' };
  };
  await handleMessage({ message: f.makeMessage('week-1', 'plan this week'), ...f });
  await handleMessage({ message: f.makeMessage('week-2', 'add it'), ...f });
  assert.equal(f.confirmations[0].target, 'plans');
  assert.match(f.sent[1].body.content.text, /Saved the weekly plans|No groceries/);
});

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

test('Spectrum greets without writing the cart, and treats a craving as a draft', async () => {
  const replies = [];
  const suggestions = [];
  const hello = await handleSpectrumMessage({
    space: { id: 'space-1' },
    message: {
      direction: 'inbound',
      id: 'm1',
      sender: { id: '+14155551234' },
      content: { type: 'text', text: 'Hello Photon' },
      async reply(body) { replies.push(body); },
    },
    config: { allowedSenders: new Set(), actorBySender: new Map(), workspaceId: 'demo-family' },
    api: { async suggest() { throw new Error('should not suggest'); } },
    state: { pendingBySpace: {}, async save() {} },
  });
  assert.equal(hello, true);
  assert.match(replies[0], /Mom or dad heading to the store/);

  const dinner = await handleSpectrumMessage({
    space: { id: 'space-1' },
    message: {
      direction: 'inbound',
      id: 'm2',
      sender: { id: '+14155551234' },
      content: { type: 'text', text: 'tacos for four' },
      async reply(body) { replies.push(body); },
    },
    config: { allowedSenders: new Set(), actorBySender: new Map([['+14155551234', 'leila']]), workspaceId: 'demo-family' },
    api: { async suggest(input) { suggestions.push(input); return draft; } },
    state: { pendingBySpace: {}, async save() {} },
  });
  assert.equal(dinner, true);
  assert.equal(suggestions.length, 1);
  assert.match(replies[1], /Nothing has been added yet/);
});

test('Spectrum starts a store run for dad and adds a roommate request to the same cart', async () => {
  const replies = [];
  let trip = { version: 1, claimedBy: null, state: 'idle', storeName: null };
  const items = [];
  const workspace = () => ({
    workspaceId: 'demo-family',
    trip,
    items: items.map((item) => ({ ...item })),
    actors: [{ id: 'sam', name: 'Sam' }, { id: 'lee', name: 'Lee' }],
  });
  const api = {
    async getWorkspace() { return workspace(); },
    async patchTrip(body) {
      trip = {
        version: trip.version + 1,
        claimedBy: body.actorId,
        storeName: body.storeName,
        requestDeadlineAt: new Date(Date.now() + body.requestWindowMinutes * 60e3).toISOString(),
        state: 'accepting_requests',
      };
      return { workspace: workspace(), changeSummary: 'Started a store run.' };
    },
    async addItem(body) {
      items.push({ id: `item-${items.length}`, name: body.name, quantity: 1, unit: 'count', bought: false, removed: false });
      return { workspace: workspace(), changeSummary: `Added ${body.name}.` };
    },
    async suggest() { throw new Error('should not suggest'); },
  };
  const config = {
    allowedSenders: new Set(['+15550000001', '+15550000002']),
    actorBySender: new Map([['+15550000001', 'sam'], ['+15550000002', 'lee']]),
    workspaceId: 'demo-family',
  };
  const dad = await handleSpectrumMessage({
    space: { id: 'family-thread' },
    message: {
      direction: 'inbound',
      id: 'run-1',
      sender: { id: '+15550000001' },
      content: { type: 'text', text: 'Going to QFC — what do you guys need?' },
      async reply(body) { replies.push(body); },
    },
    config,
    api,
    state: { pendingBySpace: {}, async save() {} },
  });
  const roommate = await handleSpectrumMessage({
    space: { id: 'family-thread' },
    message: {
      direction: 'inbound',
      id: 'need-1',
      sender: { id: '+15550000002' },
      content: { type: 'text', text: 'need milk and eggs' },
      async reply(body) { replies.push(body); },
    },
    config,
    api,
    state: { pendingBySpace: {}, async save() {} },
  });
  assert.equal(dad, true);
  assert.equal(roommate, true);
  assert.match(replies[0], /Sam is going to QFC/);
  assert.match(replies[1], /Added milk, eggs/);
  assert.equal(items.length, 2);
});

test('Spectrum matches a 10-digit US number to the household actor', async () => {
  const replies = [];
  const items = [];
  const handled = await handleSpectrumMessage({
    space: { id: 'family-thread' },
    message: {
      direction: 'inbound',
      id: 'need-digits',
      sender: { phoneNumber: '4255006832' },
      content: { type: 'text', text: 'milk' },
      async reply(body) { replies.push(body); },
    },
    config: {
      allowedSenders: new Set(['+14255006832']),
      actorBySender: new Map([['+14255006832', 'leila']]),
      workspaceId: 'demo-family',
    },
    api: {
      async addItem(body) {
        items.push(body.name);
        return { workspace: { items: [{ name: body.name, quantity: 1, unit: 'count', bought: false, removed: false }], trip: { claimedBy: null } } };
      },
    },
    state: { pendingBySpace: {}, async save() {} },
  });
  assert.equal(handled, true);
  assert.deepEqual(items, ['milk']);
  assert.match(replies[0], /Added milk/);
});
