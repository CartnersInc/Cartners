import { test, expect } from '@playwright/test';

test('two browsers create, join, confirm a draft, share a cart, run, and record a purchase', async ({ browser }) => {
  test.skip(!process.env.CARTNERS_E2E, 'Start FastAPI on :8000 and set CARTNERS_E2E=1');
  test.setTimeout(120000);
  const owner = await browser.newContext();
  const guest = await browser.newContext();
  const pageA = await owner.newPage();
  const pageB = await guest.newPage();

  await pageA.goto('/');
  await pageA.getByRole('button', { name: 'Get started' }).click();
  await pageA.getByLabel('Your name', { exact: true }).fill('Avery');
  await pageA.getByRole('button', { name: 'Continue', exact: true }).click();
  await pageA.getByLabel('Roommates', { exact: true }).check();
  await pageA.getByLabel('Household name').fill('Test kitchen');
  await pageA.getByRole('button', { name: 'Continue', exact: true }).click();
  await pageA.getByRole('button', { name: 'Let’s find something to eat' }).click();
  await expect(pageA.getByRole('heading', { name: 'What sounds good today?' })).toBeVisible({ timeout: 20000 });

  await pageA.getByRole('button', { name: 'Weekend groceries' }).click();
  await expect(pageA.getByRole('button', { name: 'Add to cart' })).toBeVisible({ timeout: 30000 });
  await expect(pageA.getByText(/Sample idea|AI suggestion/)).toBeVisible();
  await pageA.getByRole('button', { name: 'Add to cart' }).click();
  await expect(pageA.getByRole('heading', { name: 'Shopping' })).toBeVisible({ timeout: 20000 });
  await expect(pageA.locator('.rm-item').first()).toBeVisible();

  await pageA.getByRole('banner').getByRole('button', { name: 'Avery', exact: true }).click();
  await pageA.getByText('Show invitation code', { exact: true }).click();
  const invite = await pageA.getByRole('textbox', { name: 'Invitation code' }).inputValue();
  expect(invite).toMatch(/^[a-f0-9]{64}$/);

  await pageB.goto('/');
  await pageB.getByRole('button', { name: 'Get started' }).click();
  await pageB.getByLabel('Your name', { exact: true }).fill('Jamie');
  await pageB.getByRole('button', { name: 'Continue', exact: true }).click();
  await pageB.getByLabel('Join with a code', { exact: true }).check();
  await pageB.getByLabel('Invitation code', { exact: true }).fill(invite);
  await pageB.getByRole('button', { name: 'Join household' }).click();
  await expect(pageB.getByRole('heading', { name: 'What sounds good today?' })).toBeVisible({ timeout: 20000 });
  await pageB.getByRole('link', { name: 'Shopping', exact: true }).click();
  await expect(pageB.locator('.rm-item').first()).toBeVisible({ timeout: 15000 });

  await pageA.getByRole('link', { name: 'Shopping', exact: true }).click();
  await pageA.getByRole('button', { name: 'Start store run' }).click();
  await expect(pageA.getByRole('heading', { name: /You're shopping/ })).toBeVisible();

  await expect(pageB.getByText(/Avery is going to the store/)).toBeVisible({ timeout: 12000 });

  await pageA.getByRole('checkbox', { name: /Mark purchased:/ }).first().check();
  await pageA.getByRole('button', { name: 'Finish run', exact: true }).click();
  await pageA.getByRole('group', { name: 'Confirm finishing the run' }).getByRole('button', { name: 'Finish run' }).click();
  await expect(pageA.getByRole('heading', { name: 'Spending' })).toBeVisible({ timeout: 15000 });
  await pageA.getByRole('textbox', { name: 'Actual total' }).fill('12.99');
  await pageA.getByRole('button', { name: /Save \$12\.99 receipt/ }).click();
  await expect(pageA.getByRole('article', { name: /Receipt for/ })).toContainText('$12.99');

  await pageB.goto('/#spending');
  await expect(pageB.getByRole('article', { name: /Receipt for/ })).toContainText('$12.99');

  await owner.close();
  await guest.close();
});
