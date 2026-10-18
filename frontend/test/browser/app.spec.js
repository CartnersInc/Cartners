import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const fixture = async name => JSON.parse(await readFile(new URL(`../../../docs/fixtures/${name}.json`, import.meta.url)));

test('first visit starts with preferences and a clean, non-sample workspace', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ status: 503, json: { error: { message: 'Backend not started' } } }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Let’s set the table.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Oat milk' })).toHaveCount(0);
  await expect(page.getByText('Sample preview', { exact: true })).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Vegetarian' }).check();
  await page.getByRole('textbox', { name: /What do you like/ }).fill('Tacos');
  await page.getByRole('button', { name: 'Next: choose dinner' }).click();
  await expect(page.getByRole('heading', { name: 'What are we eating?' })).toBeVisible();
  await expect(page.locator('.request-options > summary')).toContainText('vegetarian');
  await expect(page.getByRole('heading', { name: 'Something new to try' })).toBeVisible();
  await expect(page.getByText('Offline · changes paused')).toBeVisible();
  await page.getByRole('link', { name: 'Shopping', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Shopping', exact: true })).toBeVisible();
  await expect(page.getByText('Your cart is empty.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Find dinner with Cartners' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Find your groceries at Kroger' })).toBeVisible();
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
  await page.getByRole('checkbox', { name: 'Vegetarian' }).check();
  await page.getByRole('button', { name: 'Next: choose dinner' }).click();
  await page.getByRole('textbox', { name: /What do you want/ }).fill('Something quick and vegetarian');
  await page.getByRole('button', { name: 'Find an idea', exact: true }).click();
  await expect(page.getByRole('heading', { name: draft.recommendation.title })).toBeVisible();
  await expect(page.getByText('AI idea · preview only', { exact: true })).toBeVisible();
  await expect(page.getByText('AI generated this idea; cart matching and saving need the shared backend.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cart connection needed', exact: true })).toBeDisabled();
  expect(request.message).toBe('Something quick and vegetarian');
  expect(request.preferences.restrictions).toEqual(['vegetarian']);
  expect(request.requestId).toBeTruthy();
});

test('live contract save retries the same action and Undo updates server state', async ({ page }) => {
  let workspace = await fixture('workspace');
  const draft = await fixture('suggestions'); draft.sourceMode = 'live_ai';
  const attempts = [];
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/workspace') return route.fulfill({ json: workspace });
    if (path === '/api/suggestions') return route.fulfill({ json: draft });
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
  await page.addInitScript(() => localStorage.setItem('cartners:first-use-complete', 'yes'));
  await page.goto('/');
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: /What do you want/ }).fill('Something fun for dinner');
  await page.getByRole('button', { name: 'Find an idea', exact: true }).click();
  await expect(page.getByRole('heading', { name: draft.recommendation.title })).toBeVisible();
  await page.locator('.request-options > summary').click();
  const dateInput = page.getByLabel('Meal date', { exact: true });
  const previousDate = await dateInput.inputValue();
  await dateInput.fill('');
  await expect(dateInput).toHaveValue(previousDate);
  await expect(page.getByRole('heading', { name: draft.recommendation.title })).toBeVisible();
  await dateInput.fill('2026-10-19');
  await expect(page.getByText(/adding this idea keeps its original date/)).toBeVisible();
  await page.getByText('Review 5 ingredients and requests', { exact: true }).click();
  await page.getByRole('checkbox').first().uncheck();
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Cannot reach');
  await page.reload();
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  await page.getByText('Review 5 ingredients and requests', { exact: true }).click();
  await expect(page.getByRole('checkbox').first()).not.toBeChecked();
  await page.getByRole('button', { name: 'Retry save', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Recent cart update' }).getByText('Added tacos to your cart.')).toBeVisible();
  expect(attempts).toHaveLength(2);
  expect(attempts[0]).toEqual(attempts[1]);
  expect(attempts[0].excludedIngredientIds).toEqual(['ing-tortillas']);
  await expect(page).toHaveURL(/#shopping$/);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/#shopping$/);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Draft additions reversed' })).toBeVisible();
});

test('phone first-use and navigation fit without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ status: 503, json: { error: { message: 'Offline sample' } } }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Let’s set the table.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Next: choose dinner' }).click();
  await expect(page.getByRole('heading', { name: 'What are we eating?' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByText('More', { exact: true }).click();
  await expect(page.getByRole('link', { name: 'Household', exact: true })).toBeInViewport();
});

test('Plans returns to the AI request with the chosen day; preferences save without an AI call', async ({ page }) => {
  let workspace = await fixture('workspace');
  let suggestions = 0;
  const preferences = [];
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/workspace') return route.fulfill({ json: new URL(route.request().url()).searchParams.get('workspaceId') === 'demo-roommates' ? { ...workspace, workspaceId: 'demo-roommates', preferences: { ...workspace.preferences, servings: 2 } } : workspace });
    if (path === '/api/preferences') {
      const body = route.request().postDataJSON(); preferences.push(body);
      workspace = { ...workspace, preferences: { ...workspace.preferences, servings: body.servings, restrictions: body.restrictions, likes: body.likes, maxPrepMinutes: body.maxPrepMinutes } };
      return route.fulfill({ json: { workspace, actionId: 'prefs-1', changeSummary: 'Preferences saved.' } });
    }
    if (path === '/api/suggestions') suggestions++;
    return route.fulfill({ status: 404, json: { error: { message: 'Not implemented in test' } } });
  });
  await page.addInitScript(() => localStorage.setItem('cartners:first-use-complete', 'yes'));
  await page.goto('/');
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  await page.getByText('More', { exact: true }).click();
  await page.getByRole('link', { name: 'Plans', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A place for dinner plans.' })).toBeVisible();
  const dayButton = page.getByRole('button', { name: /Plan a meal for / }).first();
  const targetDate = (await dayButton.getAttribute('aria-label')).replace('Plan a meal for ', '');
  await dayButton.click();
  await expect(page.getByRole('heading', { name: 'What are we eating?' })).toBeVisible();
  await page.locator('.request-options > summary').click();
  await expect(page.getByLabel('Meal date', { exact: true })).toHaveValue(targetDate);
  await page.getByText('More', { exact: true }).click();
  await page.getByRole('link', { name: 'Plans', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A place for dinner plans.' })).toBeVisible();
  await page.getByRole('complementary', { name: 'Your usuals' }).getByRole('button', { name: 'Edit preferences', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Servings', exact: true }).fill('6');
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
  await expect(page.getByRole('definition').filter({ hasText: '6 servings' })).toBeVisible();
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What are we eating?' })).toBeVisible();
  await expect(page.locator('.request-options > summary')).toContainText('6 servings');
  expect(preferences).toHaveLength(1);
  expect(preferences[0].workspaceId).toBe('demo-family');
  expect(preferences[0].requestId).toBeTruthy();
  expect(suggestions).toBe(0);
  await page.getByText('More', { exact: true }).click();
  await page.getByRole('link', { name: 'Plans', exact: true }).click();
  await page.getByRole('complementary', { name: 'Your usuals' }).getByRole('button', { name: 'Edit preferences', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Servings', exact: true }).fill('9');
  await page.getByRole('combobox', { name: 'Active group', exact: true }).selectOption('demo-roommates');
  await expect(page.getByRole('definition').filter({ hasText: '2 servings' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save preferences', exact: true })).toHaveCount(0);
  expect(preferences).toHaveLength(1);
});

test('first-use saves preferences before asking AI, and quick refinement stays one click', async ({ page }) => {
  const workspace = await fixture('workspace');
  const meal = await fixture('suggestions'); meal.sourceMode = 'live_ai';
  const quick = await fixture('refinement'); quick.sourceMode = 'live_ai';
  const requests = [];
  const preferences = [];
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/workspace') return route.fulfill({ json: workspace });
    if (path === '/api/preferences') {
      const body = route.request().postDataJSON(); preferences.push(body);
      const next = { ...workspace, preferences: { ...workspace.preferences, ...body } };
      return route.fulfill({ json: { workspace: next, actionId: 'prefs-1' } });
    }
    if (path === '/api/suggestions') {
      requests.push(route.request().postDataJSON());
      return route.fulfill({ json: requests.length === 1 ? meal : quick });
    }
    return route.fulfill({ status: 404, json: { error: { message: 'Not used in test' } } });
  });
  await page.goto('/');
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  await page.getByRole('spinbutton', { name: 'How many are eating?' }).fill('5');
  await page.getByRole('checkbox', { name: 'Vegetarian' }).check();
  await page.getByRole('textbox', { name: /What do you like/ }).fill('Tacos');
  await page.getByRole('button', { name: 'Next: choose dinner' }).click();
  await expect(page.getByRole('heading', { name: 'What are we eating?' })).toBeVisible();
  expect(preferences).toHaveLength(1);
  expect(preferences[0]).toMatchObject({ servings: 5, restrictions: ['vegetarian'], likes: ['Tacos'] });
  expect(requests).toHaveLength(0);
  await page.getByRole('button', { name: 'Surprise me', exact: true }).click();
  await expect(page.getByRole('heading', { name: meal.recommendation.title })).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0].message).toContain('Suggest a fun dinner');
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await page.getByRole('button', { name: 'Make it quicker', exact: true }).click();
  await expect(page.getByRole('heading', { name: quick.recommendation.title })).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[1].previousDraftId).toBe(meal.draftId);
  await page.getByText('More', { exact: true }).click();
  await page.getByRole('link', { name: 'Plans', exact: true }).click();
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page.getByRole('heading', { name: quick.recommendation.title })).toBeVisible();
  expect(requests).toHaveLength(2);
});
