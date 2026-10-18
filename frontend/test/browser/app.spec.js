import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const fixture = async name => JSON.parse(await readFile(new URL(`../../../docs/fixtures/${name}.json`, import.meta.url)));

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cartners:membership', JSON.stringify({ demo:true, workspaceId:'demo-family',actorId:'leila',name:'You',householdName:'Sample family' })));
});

test('explicit demo opens the request and empty shopping flow', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ status: 503, json: { error: { message: 'Backend not started' } } }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'What sounds good today?' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Oat milk' })).toHaveCount(0);
  await expect(page.getByText('Sample preview', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: /What do you want/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next: choose dinner' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Something new to try' })).toBeVisible();
  await expect(page.getByText('Offline · changes paused')).toBeVisible();
  await page.getByRole('link', { name: 'Shopping', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Shopping', exact: true })).toBeVisible();
  await expect(page.getByRole('banner').getByRole('link', { name: 'Home', exact: true })).toBeVisible();
  await page.getByRole('banner').getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What sounds good today?' })).toBeVisible();
  await page.getByRole('link', { name: 'Shopping', exact: true }).click();
  await page.getByRole('button', { name: 'Ask Cartners', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What sounds good today?' })).toBeVisible();
  await page.getByRole('link', { name: 'Shopping', exact: true }).click();
  await expect(page.getByText('Your list starts here.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Find a meal or groceries' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Find your groceries at Kroger' })).toHaveCount(0);
});

test('Home requests a live AI preview when the shared backend is offline', async ({ page }) => {
  const draft = await fixture('suggestions');
  draft.sourceMode = 'live_ai';
  draft.recommendation.listPreview = draft.recommendation.ingredients.map(item => ({ ingredientId: item.id, action: 'review' }));
  let request;
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/workspace') return route.fulfill({ status: 503, json: { error: { message: 'No shared backend' } } });
    if (path === '/api/ai/suggestions') {
      request = route.request().postDataJSON();
      return route.fulfill({ json: { ...draft, workspaceId: request.workspaceId, listRevision: request.listRevision, planDate: request.planDate, sampleNotice: 'AI-generated preview; cart not saved.' } });
    }
    return route.fulfill({ status: 503, json: { error: { message: 'Not available' } } });
  });
  await page.goto('/');
  await page.getByRole('textbox', { name: /What do you want/ }).fill('Something quick and vegetarian');
  await page.getByRole('button', { name: 'Find an idea', exact: true }).click();
  await expect(page.getByRole('heading', { name: draft.recommendation.title })).toBeVisible();
  await expect(page.getByText('AI idea · preview only', { exact: true })).toBeVisible();
  await expect(page.getByText('Connect the shared backend to match and save these ingredients.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cart connection needed', exact: true })).toBeDisabled();
  expect(request.message).toBe('Something quick and vegetarian');
  expect(request.preferences.restrictions).toEqual([]);
  expect(request.requestId).toBeTruthy();
});

test('live contract save retries the same action and Undo updates server state', async ({ page }) => {
  let workspace = await fixture('workspace');
  const draft = await fixture('suggestions'); draft.sourceMode = 'live_ai';
  const attempts = [];
  const previewScopes = [];
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/workspace') return route.fulfill({ json: workspace });
    if (path === '/api/suggestions') return route.fulfill({ json: draft });
    if (path === `/api/suggestions/${draft.draftId}`) {
      const requestUrl = new URL(route.request().url());
      previewScopes.push(requestUrl.searchParams.get('requestFor'));
      return route.fulfill({ json: { ...draft, recommendation: { ...draft.recommendation, listPreview: draft.recommendation.ingredients.map(item => ({ ingredientId: item.id, action: 'add', deltaQuantity: item.quantity })) } } });
    }
    if (path === '/api/drafts/confirm') {
      attempts.push(route.request().postDataJSON());
      workspace = { ...workspace, listRevision: 2, activity: [{ id: 'a1', message: 'Leila added tacos' }], plans: [{ id: 'plan-1', date: draft.planDate, title: draft.recommendation.title }] };
      if (attempts.length === 1) return route.abort('failed');
      return route.fulfill({ json: { workspace, actionId: 'action-1', changeSummary: 'Added tacos to your cart.' } });
    }
    if (path === '/api/actions/action-1/undo') {
      workspace = { ...workspace, listRevision: 3, plans: [] };
      return route.fulfill({ json: { workspace, actionId: 'undo-1', changeSummary: 'Draft additions reversed.' } });
    }
    return route.fulfill({ status: 404, json: { error: { message: 'Not implemented in test' } } });
  });
  await page.goto('/');
  await expect(page.getByText('Shared demo', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: /What do you want/ }).fill('Something fun for dinner');
  await page.getByRole('button', { name: 'Find an idea', exact: true }).click();
  await expect(page.getByRole('heading', { name: draft.recommendation.title })).toBeVisible();
  await page.getByRole('radio', { name: 'Just me' }).check();
  await expect(page.getByText(/^Add \d/).first()).toBeVisible();
  expect(previewScopes).toEqual(['leila']);
  await page.locator('.request-options > summary').click();
  const dateInput = page.getByLabel('Meal date', { exact: true });
  const previousDate = await dateInput.inputValue();
  await dateInput.fill('');
  await expect(dateInput).toHaveValue(previousDate);
  await expect(page.getByRole('heading', { name: draft.recommendation.title })).toBeVisible();
  await dateInput.fill('2026-10-19');
  await expect(page.getByText(/adding this idea keeps its original date/)).toBeVisible();
  await page.getByRole('checkbox').first().uncheck();
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Cannot reach');
  await page.reload();
  await expect(page.getByText('Shared demo', { exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox').first()).not.toBeChecked();
  await page.getByRole('button', { name: 'Retry save', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Recent cart update' }).getByText('Added tacos to your cart.')).toBeVisible();
  expect(attempts).toHaveLength(2);
  expect(attempts[0]).toEqual(attempts[1]);
  expect(attempts[0].excludedIngredientIds).toEqual(['ing-tortillas']);
  expect(attempts[0].requestFor).toBe('leila');
  await expect(page).toHaveURL(/#shopping$/);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Shared demo', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/#shopping$/);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Draft additions reversed' })).toBeVisible();
});

test('phone opens on dinner prompt and navigation fits without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ status: 503, json: { error: { message: 'Offline sample' } } }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'What sounds good today?' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('status').filter({ hasText: 'The shared list is offline.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Household', exact: true })).toBeInViewport();
  await page.getByRole('link', { name: 'Shopping', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ask Cartners', exact: true })).toBeVisible();
  await expect(page.getByRole('banner').getByRole('link', { name: 'Home', exact: true })).toBeVisible();
  for (const width of [320, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no horizontal scroll at ${width}px`).toBe(true);
  }
});

test('planning a day opens a fresh request; household preferences save without AI', async ({ page }) => {
  let workspace = await fixture('workspace');
  const preferences = [];
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/workspace') return route.fulfill({ json: workspace });
    if (path === '/api/preferences') {
      const body = route.request().postDataJSON(); preferences.push(body);
      workspace = { ...workspace, preferences: { ...workspace.preferences, ...body } };
      return route.fulfill({ json: { workspace, actionId:'prefs',changeSummary:'Saved preferences.' } });
    }
    return route.fulfill({status:404,json:{error:{message:'Unexpected call'}}});
  });
  await page.goto('/#plans');
  await expect(page.getByRole('heading',{name:'This week',exact:true})).toBeVisible();
  await page.getByLabel('Plan a meal for').fill('2026-10-25');
  await page.getByRole('button',{name:'Find an idea',exact:true}).click();
  await expect(page.getByRole('heading',{name:'What sounds good today?'})).toBeVisible();
  await page.locator('.request-options > summary').click();
  await expect(page.getByLabel('Meal date',{exact:true})).toHaveValue('2026-10-25');
  await page.getByRole('button',{name:'Edit preferences',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Your household',exact:true})).toBeVisible();
  await page.locator('.preferences').getByRole('button',{name:'Edit preferences',exact:true}).click();
  await page.getByRole('spinbutton',{name:'Servings',exact:true}).fill('6');
  await page.getByRole('button',{name:'Save preferences',exact:true}).click();
  await expect(page.getByRole('definition').filter({hasText:'6 people'})).toBeVisible();
  expect(preferences).toHaveLength(1);
});

test('AI request is the first step, and quick refinement stays one click', async ({ page }) => {
  const workspace = await fixture('workspace');
  const meal = await fixture('suggestions'); meal.sourceMode = 'live_ai';
  const quick = await fixture('refinement'); quick.sourceMode = 'live_ai';
  const requests = [];
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/workspace') return route.fulfill({ json: workspace });
    if (path === '/api/suggestions') {
      requests.push(route.request().postDataJSON());
      return route.fulfill({ json: requests.length === 1 ? meal : quick });
    }
    return route.fulfill({ status: 404, json: { error: { message: 'Not used in test' } } });
  });
  await page.goto('/');
  await expect(page.getByText('Shared demo', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What sounds good today?' })).toBeVisible();
  expect(requests).toHaveLength(0);
  await page.getByRole('button', { name: 'Surprise me', exact: true }).click();
  await expect(page.getByRole('heading', { name: meal.recommendation.title })).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0].message).toContain('Suggest a fun dinner');
  await expect(page.locator('.ingredient-list input[type="checkbox"]')).toHaveCount(meal.recommendation.ingredients.length);
  await page.getByRole('button', { name: 'Make it quicker', exact: true }).click();
  await expect(page.getByRole('heading', { name: quick.recommendation.title })).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[1].previousDraftId).toBe(meal.draftId);
  await page.getByRole('link', { name: 'This week', exact: true }).click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page.getByRole('heading', { name: quick.recommendation.title })).toBeVisible();
  expect(requests).toHaveLength(2);
});

test('all five areas are visible on desktop and reduced motion pauses discovery', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const workspace = await fixture('workspace');
  await page.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ json: workspace }));
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  for (const [name, heading] of [['Shopping', 'Shopping'], ['This week', 'This week'], ['Spending', 'Spending'], ['Household', 'Your household'], ['Home', 'What sounds good today?']]) {
    await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
    await nav.getByRole('link', { name, exact: true }).click();
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Play slideshow' })).toHaveAttribute('aria-pressed', 'true');
});

test('waiting for AI is visible in the composer and the result receives focus', async ({ page }) => {
  const workspace = await fixture('workspace');
  const draft = await fixture('suggestions'); draft.sourceMode = 'live_ai';
  let release;
  const waiting = new Promise(resolve => { release = resolve; });
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    if (new URL(route.request().url()).pathname === '/api/suggestions') {
      await waiting;
      return route.fulfill({ json: draft });
    }
    return route.fulfill({ json: workspace });
  });
  await page.goto('/');
  await expect(page.getByText('Shared demo', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: /What do you want/ }).fill('An easy dinner for four');
  await page.getByRole('button', { name: 'Find an idea', exact: true }).click();
  await expect(page.getByRole('progressbar', { name: 'Waiting for your meal or grocery idea' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /What do you want/ })).toBeDisabled();
  release();
  await expect(page.getByRole('heading', { name: draft.recommendation.title })).toBeFocused();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
});

test('recipe discovery supports dragging and every phone destination is one tap away', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/json/v1/1/random.php', route => route.abort());
  const workspace = await fixture('workspace');
  await page.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ json: workspace }));
  await page.goto('/');
  await expect(page.getByText('Showing saved picks while discovery reconnects.')).toBeVisible();
  const carousel = page.getByRole('region', { name: 'Featured recipes' });
  await carousel.scrollIntoViewIfNeeded();
  const first = await carousel.getByRole('heading', { level: 3 }).innerText();
  const box = await page.locator('.featured-media').boundingBox();
  await page.mouse.move(box.x + box.width * .8, box.y + 60);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .2, box.y + 62, { steps: 5 });
  await page.mouse.up();
  await expect(carousel.getByRole('heading', { level: 3 })).not.toHaveText(first);
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  for (const name of ['Home', 'Shopping', 'This week', 'Spending', 'Household']) {
    await expect(nav.getByRole('link', { name, exact: true })).toBeInViewport();
  }
});

test('navigation responds with motion and respects reduced motion', async ({ page }) => {
  await page.addInitScript(() => {
    window.surfaceAnimations = [];
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) {
      if (this.classList.contains('route-content')) window.surfaceAnimations.push(options.duration);
      return animate.call(this, frames, options);
    };
  });
  const workspace = await fixture('workspace');
  await page.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ json: workspace }));
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await nav.getByRole('link', { name: 'Shopping', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.surfaceAnimations)).toEqual([220]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await nav.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What sounds good today?' })).toBeVisible();
  expect(await page.evaluate(() => window.surfaceAnimations)).toEqual([220]);
});

test('notepad purchases stay visible and can be restored with the keyboard', async ({ page }) => {
  let workspace = await fixture('workspace');
  workspace.items = workspace.items.map(item => ({ ...item, bought: false }));
  const item = workspace.items[0];
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/workspace') return route.fulfill({ json: workspace });
    if (path === `/api/items/${item.id}`) {
      const body = route.request().postDataJSON();
      workspace = { ...workspace, listRevision: workspace.listRevision + 1, items: workspace.items.map(row => row.id === item.id ? { ...row, bought: body.bought, version: row.version + 1 } : row) };
      return route.fulfill({ json: { workspace } });
    }
    return route.fulfill({ status: 503, json: { error: { message: 'Provider unavailable in this test' } } });
  });
  await page.goto('/#shopping');
  const note = page.locator('.grocery-notepad');
  await expect(note.getByRole('heading', { name: 'Our grocery list' })).toBeVisible();
  const checkbox = page.getByRole('checkbox', { name: `Mark purchased: ${item.name}`, exact: true });
  await checkbox.focus();
  await page.keyboard.press('Space');
  const purchased = page.getByRole('region', { name: 'Purchased groceries' });
  await expect(purchased.getByRole('checkbox', { name: `Mark needed: ${item.name}`, exact: true })).toBeChecked();
  await expect(purchased.locator('.rm-item-name').first()).toHaveCSS('text-decoration-line', 'line-through');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(purchased.locator('.notepad-check path').first()).toHaveCSS('animation-name', 'none');
  await note.screenshot({ path: '/tmp/cartners-notepad-detail.png' });
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width !== 320) await page.screenshot({ path: `/tmp/cartners-notepad-${width}.png`, fullPage: true });
  }
  await purchased.getByRole('checkbox', { name: `Mark needed: ${item.name}`, exact: true }).uncheck();
  await expect(page.getByRole('checkbox', { name: `Mark purchased: ${item.name}`, exact: true })).not.toBeChecked();
  await expect(purchased).toHaveCount(0);
});
