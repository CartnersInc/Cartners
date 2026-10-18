// Browser checks for the Shopping/Groups/Spending modules against an intercepted v2 API.
// Run from frontend/: npx playwright test -c src/features/shopping/checks/playwright.config.js
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const fixture = async name => JSON.parse(await readFile(new URL(`../../../../../docs/fixtures/${name}.json`, import.meta.url)));

async function serve(page, handlers) {
  await page.addInitScript(() => localStorage.setItem('cartners:first-use-complete', 'yes'));
  const base = await fixture('workspace');
  let workspace = { ...base, serverNow: new Date().toISOString(), trip: { id: 'run-0', version: 3, claimedBy: null, completedTrips: [], storeName: 'QFC', state: 'idle' } };
  const calls = [];
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (path === '/api/workspace') return route.fulfill({ json: { ...workspace, serverNow: new Date().toISOString() } });
    const body = route.request().postDataJSON();
    calls.push({ path, method, body });
    const handled = await handlers({ path, method, body, workspace, calls, set: next => { workspace = next; } });
    return route.fulfill(handled);
  });
  return calls;
}

test('add a Just me request, lose a start race, and release a run', async ({ page }) => {
  const calls = await serve(page, ({ path, body, workspace, calls, set }) => {
    if (path === '/api/items') {
      const item = { id: 'item-new', name: body.name, quantity: body.quantity, unit: body.unit, note: body.note, requestFor: body.requestFor, addedBy: body.actorId, bought: false, version: 1, createdAt: new Date().toISOString(), removed: false, runId: null };
      const next = { ...workspace, listRevision: workspace.listRevision + 1, items: [...workspace.items, item] };
      set(next);
      return { json: { workspace: next, actionId: 'a1', changeSummary: `Added ${body.name}.`, itemId: 'item-new' } };
    }
    if (path === '/api/trip' && body.action === 'start' && calls.filter(c => c.body?.action === 'start').length === 1) {
      const next = { ...workspace, trip: { ...workspace.trip, version: 4, claimedBy: 'sam', storeName: 'Safeway', claimedAt: new Date().toISOString(), requestDeadlineAt: new Date(Date.now() + 5 * 60e3).toISOString(), state: 'accepting_requests' } };
      set(next);
      return { status: 409, json: { error: { code: 'TRIP_CLAIMED', message: 'Sam already started a run.', retryable: false }, workspace: next } };
    }
    if (path === '/api/trip' && body.action === 'release') {
      const next = { ...workspace, trip: { ...workspace.trip, version: workspace.trip.version + 1, claimedBy: null, state: 'idle' } };
      set(next);
      return { json: { workspace: next, actionId: 'a3', changeSummary: 'Run released.' } };
    }
    return { status: 404, json: { error: { code: 'NOT_FOUND', message: 'Not in this check' } } };
  });

  await page.goto('/#shopping');
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Add an item' }).fill('Hot sauce');
  await page.getByRole('radio', { name: 'Just me' }).first().check();
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await expect(page.locator('.rm-item').filter({ hasText: 'Hot sauce' }).locator('.rm-qty-badge')).toHaveText('1');
  const add = calls.find(c => c.path === '/api/items');
  expect(add.body).toMatchObject({ workspaceId: 'demo-family', actorId: 'leila', name: 'Hot sauce', requestFor: 'leila', quantity: 1, unit: 'count' });
  expect(add.body.requestId).toMatch(/^[0-9a-f-]{36}$/);

  // Only 5/10/15 are offered; start loses the race and names the winner.
  await expect(page.locator('.rm-run-window select option')).toHaveText(['5 minutes', '10 minutes', '15 minutes']);
  await page.getByRole('button', { name: 'Start store run' }).click();
  await expect(page.getByText(/Sam started a run to Safeway/)).toBeVisible();
  await expect(page.getByRole('heading', { name: "Sam is shopping at Safeway" })).toBeVisible();
  expect(calls.find(c => c.body?.action === 'start').body).toMatchObject({ expectedTripVersion: 3, storeName: 'QFC', requestWindowMinutes: 10 });

  // As Sam, release the run.
  await page.locator('.actor-control select').selectOption('sam');
  await page.getByRole('button', { name: 'Release run', exact: true }).click();
  await page.getByRole('group', { name: 'Confirm releasing the run' }).getByRole('button', { name: 'Release run' }).click();
  await expect(page.getByRole('button', { name: 'Start store run' })).toBeVisible();
  expect(calls.find(c => c.body?.action === 'release').body).toMatchObject({ expectedTripVersion: 4, actorId: 'sam' });
});

test('split receipt sends personal subtotals; retry reuses the requestId', async ({ page }) => {
  let attempts = 0;
  const calls = await serve(page, ({ path, workspace, set }) => {
    if (path === '/api/preferences') {
      const next = { ...workspace, preferences: { ...workspace.preferences, spendingMode: 'split' } };
      set(next);
      return { json: { workspace: next, actionId: 'p1', changeSummary: 'Spending is now split.' } };
    }
    if (path === '/api/expenses') {
      attempts += 1;
      if (attempts === 1) return { status: 503, json: { error: { code: 'UNAVAILABLE', message: 'Server busy, try again.', retryable: true } } };
      const next = { ...workspace, expenses: [{ id: 'e1', totalCents: 2000, payerId: 'leila', mode: 'split', sharedMemberIds: ['leila', 'sam'], personalAllocations: { sam: 600 }, status: 'confirmed', allocations: { leila: 700, sam: 1300 } }], balances: [{ from: 'sam', to: 'leila', cents: 1300 }] };
      set(next);
      return { json: { workspace: next, actionId: 'e1', changeSummary: 'Receipt saved.' } };
    }
    return { status: 404, json: { error: { code: 'NOT_FOUND', message: 'Not in this check' } } };
  });

  await page.goto('/#groups');
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  await page.getByRole('radio', { name: 'Split' }).check();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(/Split: each receipt/)).toBeVisible();
  expect(calls.find(c => c.path === '/api/preferences').body).toMatchObject({ spendingMode: 'split' });

  await page.goto('/#spending');
  await page.getByRole('button', { name: 'Record a purchase' }).click();
  await page.getByLabel('Actual total').fill('20.00');
  await page.getByLabel('Add a personal amount').selectOption('sam');
  await page.getByLabel('Sam personal subtotal').fill('6');
  await page.getByRole('button', { name: /Save \$20\.00 receipt/ }).click();
  await expect(page.getByText('Server busy, try again.')).toBeVisible();
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('Sam owes you')).toBeVisible();
  const posts = calls.filter(c => c.path === '/api/expenses');
  expect(posts).toHaveLength(2);
  expect(posts[1].body.requestId).toBe(posts[0].body.requestId);
  expect(posts[0].body).toMatchObject({ totalCents: 2000, payerId: 'leila', mode: 'split', sharedMemberIds: ['leila', 'sam'], personalAllocations: { sam: 600 }, status: 'confirmed' });
});

test('AI fills a receipt draft, but the user must review and save it', async ({ page }) => {
  const calls = await serve(page, ({ path, method, body, workspace, set }) => {
    if (path === '/api/preferences') {
      const next = { ...workspace, preferences: { ...workspace.preferences, spendingMode: 'split' } };
      set(next);
      return { json: { workspace: next, actionId: 'p1', changeSummary: 'Spending is now split.' } };
    }
    if (path === '/api/ai/expense-draft') return { json: {
      totalCents: 4218, payerId: 'leila', sharedMemberIds: ['leila', 'sam'],
      personalAllocations: { sam: 800 }, missing: [], saved: false,
    } };
    if (path === '/api/expenses' && method === 'POST') {
      const next = { ...workspace, expenses: [{ id: 'e-ai', ...body, allocations: { leila: 1709, sam: 2509 } }], balances: [] };
      set(next);
      return { json: { workspace: next, actionId: 'e-ai', changeSummary: 'Receipt saved.' } };
    }
    return { status: 404, json: { error: { code: 'NOT_FOUND', message: 'Not in this check' } } };
  });

  await page.goto('/#groups');
  await page.getByRole('radio', { name: 'Split' }).check();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.goto('/#spending');
  await page.getByRole('button', { name: 'Record a purchase' }).click();
  await page.getByLabel('Describe the receipt').fill("I paid $42.18 at QFC; $8 was Sam's personal snacks, rest shared.");
  await page.getByRole('button', { name: 'Fill receipt with AI' }).click();
  await expect(page.getByLabel('Actual total')).toHaveValue('42.18');
  await expect(page.getByLabel('Sam personal subtotal')).toHaveValue('8.00');
  expect(calls.some(call => call.path === '/api/expenses')).toBe(false);
  await page.getByRole('button', { name: /Save \$42\.18 receipt/ }).click();
  await expect(page.getByText('Receipt saved.')).toBeVisible();
  const ai = calls.find(call => call.path === '/api/ai/expense-draft');
  expect(ai.body.message).toContain('$42.18');
  expect(ai.body.requestId).toMatch(/^[0-9a-f-]{36}$/);
  expect(calls.find(call => call.path === '/api/expenses').body).toMatchObject({ totalCents: 4218, payerId: 'leila', mode: 'split', personalAllocations: { sam: 800 } });
});

test('a needs-review receipt can be filled in and confirmed', async ({ page }) => {
  const review = {
    id: 'e-review', runId: null, totalCents: 2000, currency: 'USD', payerId: 'leila', mode: 'split',
    sharedMemberIds: ['leila', 'sam'], personalAllocations: { sam: null }, allocations: {},
    status: 'needs_review', createdAt: '2026-10-18T08:00:00Z',
  };
  const calls = await serve(page, ({ path, method, body, workspace, set }) => {
    if (path === '/api/preferences') {
      const next = { ...workspace, preferences: { ...workspace.preferences, spendingMode: 'split' }, expenses: [review] };
      set(next);
      return { json: { workspace: next, actionId: 'p1', changeSummary: 'Spending is now split.' } };
    }
    if (method === 'PATCH' && path === '/api/expenses/e-review') {
      const next = {
        ...workspace,
        expenses: [{ ...review, personalAllocations: body.personalAllocations, status: 'confirmed', allocations: { leila: 700, sam: 1300 } }],
        balances: [{ from: 'sam', to: 'leila', cents: 1300 }],
      };
      set(next);
      return { json: { workspace: next, actionId: 'e-review', changeSummary: 'Receipt confirmed. Balances now include it.', expenseId: 'e-review' } };
    }
    return { status: 404, json: { error: { code: 'NOT_FOUND', message: 'Not in this check' } } };
  });

  await page.goto('/#groups');
  await page.getByRole('radio', { name: 'Split' }).check();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.goto('/#spending');
  await page.getByRole('button', { name: 'Fill in the missing amount' }).click();
  await expect(page.getByRole('heading', { name: 'Resolve this receipt' })).toBeVisible();
  await page.getByRole('checkbox', { name: /Don.t know/ }).uncheck();
  await page.getByLabel('Sam personal subtotal').fill('6');
  await page.getByRole('button', { name: /Confirm \$20\.00 receipt/ }).click();
  await expect(page.getByText('Sam owes you')).toBeVisible();
  const update = calls.find(call => call.method === 'PATCH' && call.path === '/api/expenses/e-review');
  expect(update.body).toMatchObject({ totalCents: 2000, payerId: 'leila', personalAllocations: { sam: 600 }, status: 'confirmed' });
});

test('nearby Kroger prices are prominent and compare every open cart item on request', async ({ page }) => {
  const pricing = await fixture('pricing');
  pricing.sourceMode = 'live_api';
  pricing.baskets = [pricing.baskets[0]];
  Object.assign(pricing.baskets[0].items[0], { productName: 'Kroger Flour Tortillas', brand: 'Kroger', productSize: '8 count', pricePerPackageCents: 250, stockLevel: 'HIGH', imageUrl: 'https://www.kroger.com/product/images/medium/front/0001111041700' });
  const calls = await serve(page, ({ path, body }) => path === '/api/baskets/compare'
    ? { json: { ...pricing, requestPostalCode: body.postalCode } }
    : { status: 404, json: { error: { code: 'NOT_FOUND', message: 'Not in this check' } } });

  await page.goto('/#shopping');
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Find your groceries at Kroger' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Kroger' }).first()).toBeVisible();
  await page.getByRole('textbox', { name: 'ZIP or postal code' }).fill('98105');
  await page.getByRole('button', { name: 'Compare my list' }).click();
  await expect(page.getByText('Kroger Flour Tortillas')).toBeVisible();

  const compare = calls.find(call => call.path === '/api/baskets/compare');
  expect(compare.body).toMatchObject({ workspaceId: 'demo-family', actorId: 'leila', postalCode: '98105' });
  expect(compare.body.requestId).toMatch(/^[0-9a-f-]{36}$/);
  expect(compare.body.itemIds).toEqual(['item-tortillas', 'item-milk']);
  await expect(page.locator('.rm-item').first().locator('.rm-item-price')).toHaveText('$2.50');
  await expect(page.locator('.rm-item').first().locator('.rm-qty-badge')).toHaveText('6');
});

test('live Kroger matches show the product and prefill the store run', async ({ page }) => {
  const pricing = await fixture('pricing');
  pricing.sourceMode = 'live_api';
  pricing.baskets = [pricing.baskets[0]];
  pricing.baskets[0].storeName = 'QFC University Village';
  Object.assign(pricing.baskets[0].items[0], {
    productName: 'Kroger Flour Tortillas', brand: 'Kroger', productSize: '8 count',
    stockLevel: 'HIGH', aisle: '8', imageUrl: 'https://www.kroger.com/product/images/medium/front/0001111041700',
  });
  await serve(page, ({ path }) => path === '/api/baskets/compare' ? { json: pricing } : { status: 404, json: { error: { message: 'Not in this check' } } });
  await page.goto('/#shopping');
  await page.getByRole('textbox', { name: 'ZIP or postal code' }).fill('98105');
  await page.getByRole('button', { name: 'Compare my list' }).click();
  await expect(page.getByAltText('Kroger', { exact: true })).toBeVisible();
  await expect(page.getByText('Kroger Flour Tortillas')).toBeVisible();
  await expect(page.getByText('Kroger · 8 count')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Store' })).toHaveValue('QFC University Village');
});

test('clear list removes all needed requests after one clear confirmation', async ({ page }) => {
  const calls = await serve(page, ({ path, body, workspace, set }) => {
    if (path.startsWith('/api/items/') && body.removed) {
      const id = decodeURIComponent(path.split('/').pop());
      const next = { ...workspace, listRevision: workspace.listRevision + 1, items: workspace.items.map(item => item.id === id ? { ...item, removed: true, version: item.version + 1 } : item) };
      set(next);
      return { json: { workspace: next, actionId: `remove-${id}` } };
    }
    return { status: 404, json: { error: { message: 'Not in this check' } } };
  });
  await page.goto('/#shopping');
  await page.getByRole('button', { name: 'Empty cart' }).click();
  await expect(page.getByText('Remove all 2 items that still need buying?')).toBeVisible();
  await page.getByRole('button', { name: 'Remove all 2' }).click();
  await expect(page.getByText('Your cart is empty.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Find dinner with Cartners' })).toBeVisible();
  expect(calls.filter(call => call.body?.removed)).toHaveLength(2);
  await expect(page.locator('p.rm-ok[role="status"]')).toHaveText('Removed 2 items from the list.');
});

test('phone shopping makes the store-run action easy to find without covering the cart', async ({ page }) => {
  await serve(page, () => ({ status: 404, json: { error: { message: 'Not in this check' } } }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#shopping');
  const startShortcut = page.getByRole('button', { name: 'Start a store run', exact: true });
  await expect(startShortcut).toBeVisible();
  await startShortcut.click();
  await expect(page.getByRole('textbox', { name: 'Store' })).toBeFocused();
});

test('cart rows name the saved recipes each request is for', async ({ page }) => {
  const base = await fixture('workspace');
  const item = (id, name, extra = {}) => ({ id, name, quantity: 1, unit: 'count', note: '', requestFor: 'household', addedBy: 'leila', bought: false, version: 1, createdAt: '2026-10-17T18:00:00Z', removed: false, runId: null, ...extra });
  const workspace = {
    ...base, serverNow: new Date().toISOString(), trip: null,
    plans: [
      { id: 'plan-tacos', date: '2026-10-18', title: 'Black bean tacos', recommendation: { ingredients: [{ name: 'Lime' }, { name: 'Black beans' }] } },
      { id: 'plan-pad-thai', date: '2026-10-19', title: 'Pad Thai', recommendation: { ingredients: [{ name: 'lime' }, { name: 'Rice noodles' }] } },
    ],
    items: [
      item('i-beans', 'Black beans', { reservedPlanId: 'plan-tacos' }),
      item('i-lime', 'Lime'),
      item('i-milk', 'Oat milk'),
    ],
  };
  await page.route(url => url.pathname.startsWith('/api/'), route => route.fulfill(new URL(route.request().url()).pathname === '/api/workspace' ? { json: workspace } : { status: 404, json: { error: { code: 'NOT_FOUND', message: 'Not in this check' } } }));
  await page.goto('/#shopping');
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  const recipesOf = name => page.locator('.rm-item').filter({ hasText: name }).locator('.rm-item-recipes');
  await expect(recipesOf('Black beans')).toHaveText('Black bean tacos');
  await expect(recipesOf('Lime')).toHaveText('Black bean tacos, Pad Thai');
  await expect(recipesOf('Oat milk')).toHaveCount(0);
});
