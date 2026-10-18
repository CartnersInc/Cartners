import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const fixture = async name => JSON.parse(await readFile(new URL(`../../../docs/fixtures/${name}.json`, import.meta.url)));

test('sample meal, refinement, grocery, clarification, and draft restoration are honest', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ status: 503, json: { error: { message: 'Backend not started' } } }));
  await page.goto('/');
  await expect(page.getByText('Sample preview', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Something fun for dinner', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Build-your-own black bean tacos' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add to cart', exact: true })).toBeDisabled();
  await page.getByRole('link', { name: 'Shopping', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Shopping', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Build-your-own black bean tacos' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Build-your-own black bean tacos' })).toBeVisible();
  await page.getByRole('button', { name: 'Make it quicker', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Quick black bean wraps' })).toBeVisible();
  await page.getByRole('button', { name: 'Previous idea', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Build-your-own black bean tacos' })).toBeVisible();
  await page.getByRole('button', { name: 'Milk for Sam & paper plates', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your grocery requests' })).toBeVisible();
  await expect(page.getByText('1 pack · Sam · Unsweetened')).toBeVisible();
  await page.getByRole('button', { name: 'Chicken for dinner', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'One thing to check' })).toBeVisible();
  await expect(page.getByText(/saved restriction is vegetarian/)).toBeVisible();
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
      if (attempts.length === 1) return route.abort('failed');
      workspace = { ...workspace, listRevision: 2, activity: [{ id: 'a1', message: 'Leila added tacos' }], plans: [{ id: 'plan-1', date: draft.planDate, title: draft.recommendation.title }] };
      return route.fulfill({ json: { workspace, actionId: 'action-1', changeSummary: 'Added tacos to your cart.' } });
    }
    if (path === '/api/actions/action-1/undo') {
      workspace = { ...workspace, listRevision: 3, plans: [] };
      return route.fulfill({ json: { workspace, actionId: 'undo-1', changeSummary: 'Draft additions reversed.' } });
    }
    return route.fulfill({ status: 404, json: { error: { message: 'Not implemented in test' } } });
  });
  await page.goto('/');
  await expect(page.getByText('Demo backend connected', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: /What do you want/ }).fill('Something fun for dinner');
  await page.getByRole('button', { name: 'Find an idea', exact: true }).click();
  await expect(page.getByRole('heading', { name: draft.recommendation.title })).toBeVisible();
  await page.getByRole('checkbox').first().uncheck();
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Cannot reach');
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await expect(page.getByText('Added tacos to your cart.', { exact: true })).toBeVisible();
  expect(attempts).toHaveLength(2);
  expect(attempts[0]).toEqual(attempts[1]);
  expect(attempts[0].excludedIngredientIds).toEqual(['ing-tortillas']);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Draft additions reversed');
});

test('phone navigation and sample drafts fit without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ status: 503, json: { error: { message: 'Offline sample' } } }));
  await page.goto('/');
  await expect(page.getByText('Sample preview', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Something fun for dinner', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Build-your-own black bean tacos' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('link', { name: 'Groups', exact: true })).toBeInViewport();
});
