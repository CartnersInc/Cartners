import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const fixture = async name => JSON.parse(await readFile(new URL(`../../../docs/fixtures/${name}.json`, import.meta.url)));

test('welcome → own household → return → purchase and invite; no fictional identity or checkout', async ({ page }) => {
  let workspace = { ...await fixture('workspace'), workspaceId: 'household-test', groups: [{ workspaceId:'household-test', name:'Our apartment',memberIds:['member-me'],spendingMode:'pooled' }], actors:[{id:'member-me',name:'Avery'}], items:[],plans:[],activity:[],expenses:[],balances:[],trip:null,listRevision:0,preferences:{servings:2,restrictions:[],likes:[],maxPrepMinutes:30,spendingMode:'pooled'} };
  let setup;
  const writes = [];
  await page.route(url => url.hostname === '127.0.0.1' && url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname;
    const body = route.request().method() === 'GET' ? null : route.request().postDataJSON();
    if (path === '/api/households') {
      setup = body;
      workspace.preferences = { ...workspace.preferences, servings:body.servings,restrictions:body.restrictions,likes:body.likes,maxPrepMinutes:body.maxPrepMinutes };
      return route.fulfill({json:{workspace,actorId:'member-me'}});
    }
    expect(route.request().headers().authorization).toBe(`Bearer ${setup.sessionToken}`);
    if (path === '/api/workspace') return route.fulfill({json:workspace});
    if (path === '/api/items' && body) {
      workspace = { ...workspace,listRevision:workspace.listRevision+1,items:[{id:'rice',name:body.name,quantity:1,unit:'pack',requestFor:'household',addedBy:'member-me',bought:false,removed:false,version:1}] };
    } else if (path === '/api/items/rice') {
      writes.push(body);
      workspace = { ...workspace,listRevision:workspace.listRevision+1,items:workspace.items.map(item=>({...item,...body,version:item.version+1})) };
    } else return route.fulfill({status:404,json:{error:{message:'Unexpected test request'}}});
    return route.fulfill({json:{workspace,actionId:'change',changeSummary:'Saved.'}});
  });
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Make room at your table.'})).toBeVisible();
  await expect(page.getByText('Leila',{exact:true})).toHaveCount(0);
  await page.screenshot({path:'/tmp/cartners-welcome-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Get started'}).click();
  await page.getByLabel('Your name',{exact:true}).fill('Avery');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByLabel('Roommates',{exact:true}).check();
  await page.getByLabel('Household name').fill('Our apartment');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByLabel('Usually cooking for').fill('4');
  await page.getByLabel('Dietary needs').fill('Vegetarian, no peanuts');
  await page.getByRole('button',{name:'Let’s find something to eat'}).click();
  await expect(page.getByRole('heading',{name:'What sounds good today?'})).toBeVisible();
  expect(setup.restrictions).toEqual(['Vegetarian','no peanuts']);
  expect(setup.kind).toBe('roommates');
  await expect(page.getByRole('banner').getByRole('button',{name:'Avery',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:/Demo as/})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Something new to try'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading',{name:'What sounds good today?'})).toBeVisible();
  await page.getByRole('link',{name:'Shopping',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Your list starts here.'})).toBeVisible();
  await expect(page.getByRole('button',{name:/Buy/})).toHaveCount(0);
  await page.getByRole('textbox',{name:'Add an item',exact:true}).first().fill('Rice');
  await page.getByRole('button',{name:'Add to cart',exact:true}).click();
  await expect(page.getByRole('checkbox',{name:'Mark purchased: Rice'})).not.toBeChecked();
  await expect(page.getByText('Not priced',{exact:true})).toBeVisible();
  await page.getByRole('checkbox',{name:'Mark purchased: Rice'}).check();
  await page.getByText('Purchased · 1',{exact:true}).click();
  await expect(page.getByRole('checkbox',{name:'Mark needed: Rice'})).toBeChecked();
  expect(writes[0].bought).toBe(true);
  expect(writes[0].removed).toBeUndefined();
  await page.getByRole('checkbox',{name:'Mark needed: Rice'}).uncheck();
  await expect(page.getByRole('checkbox',{name:'Mark purchased: Rice'})).toBeVisible();
  await page.getByRole('button',{name:'Empty list',exact:true}).click();
  await page.getByRole('button',{name:'Confirm remove 1',exact:true}).click();
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await expect(page.getByRole('checkbox',{name:'Mark purchased: Rice'})).toBeVisible();
  await page.getByRole('banner').getByRole('button',{name:'Avery',exact:true}).click();
  await page.getByText('Show invitation code',{exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Invitation code'})).toHaveValue(setup.inviteCode);
  await page.getByRole('link',{name:'Spending',exact:true}).click();
  await expect(page.getByRole('tab',{name:'Payments'})).toHaveCount(0);
  await page.getByRole('button',{name:'Record a purchase',exact:true}).click();
  await expect(page.getByLabel('Describe the receipt')).toBeVisible();
  await expect(page.getByRole('textbox',{name:'Actual total',exact:true})).not.toBeVisible();
});

test('mobile welcome and setup have no overflow; join uses the supplied code', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  const code = 'a'.repeat(64);
  let join;
  await page.route('**/api/households/join', async route => { join = route.request().postDataJSON(); return route.fulfill({status:404,json:{error:{message:'That invitation was not found. Check the code with your household.'}}}); });
  await page.goto('/');
  await page.screenshot({path:'/tmp/cartners-welcome-mobile.png',fullPage:true});
  for (const width of [320,390,768]) {
    await page.setViewportSize({width,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.getByRole('button',{name:'Get started'}).click();
  await page.getByLabel('Your name',{exact:true}).fill('Robin');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByLabel('Join with a code',{exact:true}).check();
  await page.getByLabel('Invitation code',{exact:true}).fill(code);
  await page.getByRole('button',{name:'Join household',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('invitation was not found');
  expect(join.name).toBe('Robin');
  expect(join.inviteCode).toBe(code);
  await expect(page.getByLabel('Invitation code')).toHaveValue(code);
});
