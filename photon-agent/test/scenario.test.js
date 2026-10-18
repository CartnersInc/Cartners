import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyHousehold, formatRunStarted, parseNeedItems, parseStoreName } from '../src/scenario.js';

test('dad heading to the store starts a run, roommates add items, meals stay drafts', () => {
  assert.equal(classifyHousehold('Going to QFC — what do you guys need?').type, 'start_run');
  assert.equal(classifyHousehold('Going to QFC — what do you guys need?').storeName, 'QFC');
  assert.equal(classifyHousehold('heading to the store, need anything?').type, 'start_run');
  assert.deepEqual(classifyHousehold('need milk and eggs').items, ['milk', 'eggs']);
  assert.equal(classifyHousehold('tacos for four').type, 'suggest');
  assert.equal(classifyHousehold('plan this week').type, 'suggest');
  assert.equal(classifyHousehold('done shopping').type, 'finish_run');
  assert.equal(classifyHousehold('what’s on the list').type, 'list');
  assert.equal(classifyHousehold('What is on our shopping cart').type, 'list');
  assert.equal(classifyHousehold('Whats going on').type, 'help');
  assert.equal(classifyHousehold('Hawa is going to the store').type, 'start_run');
  assert.equal(classifyHousehold('This is the sample idea go to Ibrahiim').type, 'ignore');
  assert.equal(classifyHousehold('Text cartners from your phone').type, 'help');
  assert.equal(classifyHousehold('Photon Spectrum is connected. You said: hello').type, 'ignore');
  assert.equal(classifyHousehold('add it', { hasPendingDraft: true }).type, 'confirm');
});

test('parses a short grocery ask without treating it as a meal', () => {
  assert.deepEqual(parseNeedItems('we need salsa, chips and limes'), ['salsa', 'chips', 'limes']);
  assert.equal(parseStoreName('on my way to Trader Joes, what do you guys need'), 'Trader Joes');
});

test('run start copy names the shopper and leaves the cart empty until people reply', () => {
  const workspace = {
    actors: [{ id: 'sam', name: 'Sam' }],
    items: [],
    trip: { claimedBy: 'sam', storeName: 'QFC', requestDeadlineAt: new Date(Date.now() + 10 * 60e3).toISOString(), state: 'accepting_requests' },
  };
  const text = formatRunStarted(workspace, 'sam');
  assert.match(text, /Sam is going to QFC/);
  assert.match(text, /list is empty/);
});
