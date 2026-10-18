// Browser checks for the Shopping/Groups/Spending modules against an intercepted v2 API.
// Run from frontend/: npx playwright test -c src/features/shopping/checks/playwright.config.js
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const fixture = async name => JSON.parse(await readFile(new URL(`../../../../../docs/fixtures/${name}.json`, import.meta.url)));

// The workspace fixture's sample items start purchased; price-comparison checks need them on the list.
const stillNeeded = workspace => ({ ...workspace, items: workspace.items.map(item => ({ ...item, bought: false })) });

async function serve(page, handlers, seed) {
  const base = await fixture('workspace');
  let workspace = { ...base, serverNow: new Date().toISOString(), trip: { id: 'run-0', version: 3, claimedBy: null, completedTrips: [], storeName: 'QFC', state: 'idle' } };
  if (seed) workspace = seed(workspace);
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

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cartners:membership', JSON.stringify({
    demo: true, workspaceId: 'demo-family', actorId: 'leila', name: 'Leila', householdName: 'Sample family',
  })));
});

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
  await expect(page.getByText('Shared demo', { exact: true })).toBeVisible();
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
  await page.getByRole('button', { name: /^Demo as:/ }).click();
  await page.getByRole('group', { name: 'Choose demo as' }).getByRole('button', { name: 'Sam' }).click();
  await page.getByRole('button', { name: 'Release run', exact: true }).click();
  await page.getByRole('group', { name: 'Confirm releasing the run' }).getByRole('button', { name: 'Release run' }).click();
  await expect(page.getByRole('button', { name: 'Start store run' })).toBeVisible();
  expect(calls.find(c => c.body?.action === 'release').body).toMatchObject({ expectedTripVersion: 4, actorId: 'sam' });
});

test.skip('split receipt sends personal subtotals; retry reuses the requestId', async ({ page }) => {
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
  await expect(page.getByText('Shared demo', { exact: true })).toBeVisible();
  await page.getByText('Default for purchase records').click();
  await page.getByRole('radio', { name: 'Split' }).check();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(/Split: each receipt/)).toBeVisible();
  expect(calls.find(c => c.path === '/api/preferences').body).toMatchObject({ spendingMode: 'split' });

  await page.goto('/#spending');
  await page.getByText('Enter the total yourself').click();
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

test('payment logos sit next to names and opening one does not mark paid', async ({ page }) => {
  const expense = {
    id: 'e-split', runId: null, totalCents: 2000, currency: 'USD', payerId: 'leila', mode: 'split',
    sharedMemberIds: ['leila', 'sam', 'casey'], personalAllocations: {},
    allocations: { leila: 667, sam: 667, casey: 666 }, status: 'confirmed', createdAt: '2026-10-18T08:00:00Z',
  };
  const calls = await serve(page, () => ({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Not in this check' } } }), workspace => ({
    ...workspace,
    preferences: { ...workspace.preferences, spendingMode: 'split' },
    actors: [
      { id: 'leila', name: 'Leila', payLinks: { venmo: 'leila-p', paypal: 'leilap', zelle: 'leila@example.com' } },
      { id: 'sam', name: 'Sam', payLinks: { venmo: 'sam-k', cashapp: 'samk' } },
      { id: 'casey', name: 'Casey' },
    ],
    groups: [{ ...workspace.groups[0], memberIds: ['leila', 'sam', 'casey'], spendingMode: 'split' }],
    expenses: [expense],
    balances: [{ from: 'sam', to: 'leila', cents: 667 }],
  }));

  await page.goto('/#groups');
  await expect(page.getByRole('heading', { name: 'Your household' })).toBeVisible();
  const samRow = page.locator('.rm-members li').filter({ hasText: 'Sam' });
  await expect(samRow.getByRole('link', { name: /Venmo @sam-k/ })).toHaveAttribute('href', 'https://venmo.com/u/sam-k');
  await expect(samRow.getByRole('link', { name: /Cash App \$samk/ })).toBeVisible();
  await expect(samRow.getByRole('link', { name: /PayPal/ })).toHaveCount(0);
  const caseyRow = page.locator('.rm-members li').filter({ hasText: 'Casey' });
  await expect(caseyRow.getByRole('link', { name: /Venmo|Cash App|PayPal/ })).toHaveCount(0);
  await expect(caseyRow.getByRole('button', { name: /Zelle/ })).toHaveCount(0);

  await page.goto('/#spending');
  await expect(page.getByRole('heading', { name: 'Spending' })).toBeVisible();
  const receipt = page.getByRole('article', { name: /Receipt for/ });
  await expect(receipt.getByRole('link', { name: /Venmo @leila-p/ }).first()).toBeVisible();
  await expect(page.locator('#rm-paid').locator('..').getByRole('link', { name: /Venmo @leila-p/ })).toBeVisible();
  await expect(page.getByText('Sam owes you')).toBeVisible();
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('link', { name: /Venmo @sam-k/ }).first().click();
  const popup = await popupPromise;
  expect(popup.url()).toContain('venmo.com');
  await popup.close();
  expect(calls.filter(call => call.path.includes('/api/expenses'))).toHaveLength(0);
  await expect(page.getByText('Sam owes you')).toBeVisible();
  await expect(page.getByRole('link', { name: /Does not send money or mark paid/ }).first()).toBeVisible();
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
  }, workspace => ({
    ...workspace,
    preferences: { ...workspace.preferences, spendingMode: 'split' },
    groups: workspace.groups.map(group => ({ ...group, spendingMode: 'split' })),
  }));

  await page.goto('/#spending');
  await expect(page.getByText('Enter the total yourself')).toBeVisible();
  await expect(page.getByLabel('Actual total')).toBeHidden();
  await page.getByRole('form', { name: 'Record a purchase' }).getByRole('textbox').fill("I paid $42.18 at QFC; $8 was Sam's personal snacks, rest shared.");
  await expect(page.getByText('$42.18')).toBeVisible();
  expect(calls.some(call => call.path === '/api/expenses')).toBe(false);
  await page.getByText('Adjust details').click();
  await expect(page.getByLabel('Actual total')).toHaveValue('42.18');
  await expect(page.getByLabel('Sam personal subtotal')).toHaveValue('8.00');
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
  }, workspace => ({
    ...workspace,
    preferences: { ...workspace.preferences, spendingMode: 'split' },
    groups: workspace.groups.map(group => ({ ...group, spendingMode: 'split' })),
    expenses: [review],
  }));

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
    : { status: 404, json: { error: { code: 'NOT_FOUND', message: 'Not in this check' } } }, stillNeeded);

  await page.goto('/#shopping');
  await expect(page.getByText('Shared demo', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Find cheapest groceries nearby' })).toBeVisible();
  const logo = page.getByRole('img', { name: 'Kroger' }).first();
  await expect(logo).toBeVisible();
  await expect.poll(() => logo.evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  // A five-digit ZIP starts the comparison by itself.
  await page.getByRole('textbox', { name: 'ZIP or postal code' }).fill('98105');
  await expect(page.getByText('Kroger Flour Tortillas')).toBeVisible();

  const compare = calls.find(call => call.path === '/api/baskets/compare');
  expect(compare.body).toMatchObject({ workspaceId: 'demo-family', actorId: 'leila', postalCode: '98105' });
  expect(compare.body.requestId).toMatch(/^[0-9a-f-]{36}$/);
  expect(compare.body.itemIds).toEqual(['item-tortillas', 'item-milk']);
  await expect(page.locator('.rm-item').first().locator('.rm-item-price')).toHaveText(''); // no prices until a store is chosen
  await page.getByRole('button', { name: 'Shop here', exact: true }).click();
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
  await serve(page, ({ path }) => path === '/api/baskets/compare' ? { json: pricing } : { status: 404, json: { error: { message: 'Not in this check' } } }, stillNeeded);
  await page.goto('/#shopping');
  // A five-digit ZIP starts the comparison by itself.
  await page.getByRole('textbox', { name: 'ZIP or postal code' }).fill('98105');
  await expect(page.getByAltText('Kroger', { exact: true })).toBeVisible();
  await expect(page.getByText('Kroger Flour Tortillas')).toBeVisible();
  await expect(page.getByText('Kroger · 8 count')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Store' })).toHaveValue('QFC University Village');
});

test.skip('clear list removes all cart requests after one clear confirmation', async ({ page }) => {
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
  await page.getByRole('button', { name: 'Empty list' }).click();
  await expect(page.getByText('Remove all 2 unpurchased items?')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm remove 2' }).click();
  await expect(page.getByRole('heading', { name: 'Your list starts here.' })).toBeVisible();
  expect(calls.filter(call => call.body?.removed)).toHaveLength(2);
});

test.skip('cart items start checked with price and buy opens spending checkout', async ({ page }) => {
  const base = await fixture('workspace');
  const workspace = {
    ...base,
    serverNow: new Date().toISOString(),
    trip: null,
    items: base.items.map(item => ({ ...item, bought: true, runId: null })),
  };
  await page.route(url => url.pathname.startsWith('/api/'), route => route.fulfill(
    new URL(route.request().url()).pathname === '/api/workspace'
      ? { json: workspace }
      : { status: 404, json: { error: { message: 'Not in this check' } } },
  ));

  await page.goto('/#shopping');
  const cart = page.locator('section[aria-labelledby="rm-cart"]');
  await expect(cart.locator('.rm-h2')).toContainText('Your cart');
  await expect(cart.getByText('Tortillas')).toBeVisible();
  await expect(cart.getByText('Oat milk')).toBeVisible();
  await expect(cart.locator('.rm-bought-label').first()).toHaveText('In cart');
  await expect(cart.locator('.rm-item-price').first()).toBeVisible();
  await page.getByRole('button', { name: /^Buy/ }).first().click();
  await expect(page).toHaveURL(/#spending/);
  await expect(page.getByRole('heading', { name: 'Buy this cart' })).toBeVisible();
  await expect(page.getByText('Tortillas')).toBeVisible();
});

test.skip('phone shopping makes the store-run action easy to find without covering the cart', async ({ page }) => {
  await serve(page, () => ({ status: 404, json: { error: { message: 'Not in this check' } } }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#shopping');
  await expect(page.getByRole('button', { name: 'Start store run' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Store' })).toBeVisible();
});

test('cart rows name the saved recipes each request is for', async ({ page }) => {
  const base = await fixture('workspace');
  const item = (id, name, extra = {}) => ({ id, name, quantity: 1, unit: 'count', note: '', requestFor: 'household', addedBy: 'leila', bought: false, version: 1, createdAt: '2026-10-17T18:00:00Z', removed: false, runId: null, ...extra });
  const workspace = {
    ...base, serverNow: new Date().toISOString(), trip: null,
    plans: [
      { id: 'plan-tacos', date: '2026-10-18', title: 'Black bean tacos', recommendation: { requestFor: 'household', ingredients: [{ name: 'Lime', unit: 'count' }, { name: 'Black beans', unit: 'can' }] } },
      { id: 'plan-pad-thai', date: '2026-10-19', title: 'Pad Thai', recommendation: { requestFor: 'household', ingredients: [{ name: 'lime', unit: 'count' }, { name: 'Rice noodles', unit: 'pack' }] } },
    ],
    items: [
      item('i-beans', 'Black beans', { reservedPlanId: 'plan-tacos' }),
      item('i-lime', 'Lime', { reservedPlanId: 'plan-tacos' }),
      item('i-milk', 'Oat milk'),
    ],
  };
  await page.route(url => url.pathname.startsWith('/api/'), route => route.fulfill(new URL(route.request().url()).pathname === '/api/workspace' ? { json: workspace } : { status: 404, json: { error: { code: 'NOT_FOUND', message: 'Not in this check' } } }));
  await page.goto('/#shopping');
  await expect(page.getByText('Shared demo', { exact: true })).toBeVisible();
  const recipesOf = name => page.locator('.rm-item').filter({ hasText: name }).locator('.rm-item-recipes');
  await expect(recipesOf('Black beans')).toHaveText('Black bean tacos');
  await expect(recipesOf('Lime')).toHaveText('Black bean tacos, Pad Thai');
  await expect(recipesOf('Oat milk')).toHaveCount(0);
});

test('the list splits into My items and Everyone else; only your items can be edited', async ({ page }) => {
  const base = await fixture('workspace');
  const item = (id, name, requestFor, addedBy) => ({ id, name, quantity: 1, unit: 'count', note: '', requestFor, addedBy, bought: false, version: 1, createdAt: '2026-10-17T18:00:00Z', removed: false, runId: null });
  const workspace = { ...base, serverNow: new Date().toISOString(), trip: null, items: [item('i-1', 'Paper plates', 'household', 'leila'), item('i-2', 'Hot sauce', 'leila', 'leila'), item('i-3', 'Oat milk', 'sam', 'sam'), item('i-4', 'Rice', 'household', 'sam')] };
  await page.route(url => url.pathname.startsWith('/api/'), route => route.fulfill(new URL(route.request().url()).pathname === '/api/workspace' ? { json: workspace } : { status: 404, json: { error: { code: 'NOT_FOUND', message: 'Not in this check' } } }));
  await page.goto('/#shopping');
  const mine = page.getByRole('region', { name: 'My items' });
  const rowOf = (list, name) => list.locator('.rm-item').filter({ has: page.locator('.rm-item-name', { hasText: new RegExp(`^${name}`) }) });
  const others = page.getByRole('region', { name: 'Everyone else' });
  await expect(mine.locator('.rm-item-name')).toHaveText([/Paper plates/, /Hot sauce/]);
  await expect(others.locator('.rm-item-name')).toHaveText([/Oat milk/, /Rice/]);
  await expect(rowOf(mine, 'Hot sauce').locator('.rm-item-meta')).toHaveText('Not shared · added by you');
  await expect(rowOf(others, 'Oat milk').locator('.rm-item-meta')).toHaveText('Not shared · added by Sam');
  await expect(rowOf(others, 'Rice').locator('.rm-item-meta')).toHaveText('Shared · added by Sam');
  await expect(mine.getByRole('button', { name: /More options/ })).toHaveCount(2);
  await expect(others.getByRole('button', { name: /More options/ })).toHaveCount(0);
  await expect(page.getByRole('checkbox')).toHaveCount(0); // nobody is shopping
});

test('cart prices appear after Shop here and stay while the shopper checks items off', async ({ page }) => {
  const pricing = await fixture('pricing');
  pricing.sourceMode = 'live_api';
  pricing.baskets = [pricing.baskets[0]];
  pricing.baskets[0].storeName = 'QFC University Village';
  const shopping = workspace => ({ ...stillNeeded(workspace), trip: { id: 'run-1', version: 4, claimedBy: 'leila', storeName: 'QFC', state: 'accepting_requests', claimedAt: new Date().toISOString(), requestDeadlineAt: new Date(Date.now() + 10 * 60e3).toISOString(), completedTrips: [] } });
  const calls = await serve(page, ({ path, body, workspace, set }) => {
    if (path === '/api/baskets/compare') return { json: pricing };
    if (path.startsWith('/api/items/')) {
      const id = decodeURIComponent(path.split('/').pop());
      const next = { ...workspace, listRevision: workspace.listRevision + 1, items: workspace.items.map(item => item.id === id ? { ...item, bought: body.bought, version: item.version + 1 } : item) };
      set(next);
      return { json: { workspace: next, actionId: `buy-${id}` } };
    }
    return { status: 404, json: { error: { message: 'Not in this check' } } };
  }, shopping);
  await page.goto('/#shopping');
  await page.getByRole('textbox', { name: 'ZIP or postal code' }).fill('98105');
  const store = page.locator('.rm-store-result').filter({ hasText: 'QFC University Village' });
  await expect(store.getByRole('button', { name: 'Shop here', exact: true })).toBeVisible();
  const tortillas = page.locator('.rm-item').filter({ has: page.locator('.rm-item-name', { hasText: /^Tortillas/ }) });
  await expect(tortillas.locator('.rm-item-price')).toHaveText('');

  await store.getByRole('button', { name: 'Shop here', exact: true }).click();
  await expect(tortillas.locator('.rm-item-price')).toHaveText('$2.50');
  await expect(page.getByText(/prices from QFC University Village/)).toBeVisible();

  await page.getByRole('checkbox', { name: 'Mark purchased: Tortillas' }).check();
  const bought = page.getByRole('region', { name: 'Purchased groceries' }).locator('.rm-item').filter({ hasText: 'Tortillas' });
  await expect(bought.locator('.rm-item-price')).toHaveText('$2.50');
  await page.waitForTimeout(500);
  await expect(bought.locator('.rm-item-price')).toHaveText('$2.50');
  expect(calls.filter(call => call.path === '/api/baskets/compare')).toHaveLength(1); // checking off never re-compares
});
