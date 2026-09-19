// Optional real-browser regression. Isolated synthetic data only; see docs/DASHBOARD_UI_AUDIT.md.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const baseURL = process.env.BROWSER_BASE_URL || 'http://localhost:5173';
const artifacts = process.env.BROWSER_ARTIFACT_DIR || 'node_modules/.cache/dashboard-browser';
fs.mkdirSync(artifacts, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
if (process.env.BROWSER_FONT_FILE) {
  const font = fs.readFileSync(process.env.BROWSER_FONT_FILE).toString('base64');
  await page.route('**/fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: `@font-face {font-family:'Noto Sans Bengali';font-style:normal;font-weight:100 900;src:url(data:font/woff2;base64,${font}) format('woff2');}` }));
}
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const assertFits = async label => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, label);
const signIn = async id => {
  await page.evaluate(id => localStorage.setItem('shopledger-session', id), id);
  await page.goto(baseURL + '/');
  await page.locator('[data-dashboard] .card').first().waitFor();
};
const snapshot = () => page.evaluate(async () => {
  const { db } = await import('/src/lib/db.ts');
  return JSON.stringify({ ledger: await db.ledgerEntries.toArray(), expenses: await db.expenses.toArray(), customers: await db.customers.toArray(), audits: await db.ledgerAudits.toArray(), orders: await db.orders.toArray() });
});
try {
  await page.goto(baseURL);
  await page.waitForURL('**/login');
  await page.evaluate(async () => {
    const { db } = await import('/src/lib/db.ts');
    const { ledgerToday } = await import('/src/lib/ledger.ts');
    const { useSalesStore } = await import('/src/stores/salesStore.ts');
    const { usePurchaseStore } = await import('/src/stores/purchaseStore.ts');
    const { useProductStore } = await import('/src/stores/productStore.ts');
    const { useStockAdjustmentStore } = await import('/src/stores/stockAdjustmentStore.ts');
    const date = ledgerToday();
    await db.branches.bulkPut(['a', 'b'].map(id => ({ id, name: `শাখা ${id}`, is_active: true, created_at: '' })));
    await db.customers.bulkPut([{ id: 'c', name: 'করিম', phone: '01711111111', branch_id: 'a', created_at: '' }, { id: 'secret', name: 'গোপন ক্রেতা', phone: '01722222222', branch_id: 'b', created_at: '' }]);
    await db.users.bulkPut([
      { id: 'owner', name: 'মালিক', role: 'owner' },
      { id: 'manager', name: 'ব্যবস্থাপক', role: 'manager', branch_id: 'a', branch_ids: ['a'] },
      { id: 'salesman', name: 'সেলস ম্যান', role: 'salesman', branch_id: 'a', branch_ids: ['a'] },
      { id: 'customer', name: 'করিম', role: 'customer', branch_id: 'a', phone: '01711111111' },
    ].map(u => ({ phone: '', password_hash: '', is_active: true, created_at: '', updated_at: '', ...u })));
    const sale = { id: 's', date, items: [{ product_id: 'p', product_name: 'চাল', quantity: 2, unit: 'কেজি', sale_price: 500, purchase_price: 350, total: 1000, profit: 300 }], total_amount: 1000, total_profit: 300, payment_type: 'বাকি', customer_id: 'c', customer_name: 'করিম', branch_id: 'a', created_by: 'owner', created_at: `${date}T09:00:00` };
    useSalesStore.setState({ sales: [sale, { ...sale, id: 's-secret', customer_id: 'secret', customer_name: 'গোপন ক্রেতা', branch_id: 'b', total_amount: 9900, total_profit: 900, created_at: `${date}T15:00:00` }] });
    usePurchaseStore.setState({ purchases: [{ id: 'buy', date, product_id: 'p', product_name: 'চাল', quantity: 10, unit: 'কেজি', total: 3500, purchase_price: 350, supplier: 'ABC Trading', payment_type: 'বাকি', branch_id: 'a', created_at: `${date}T10:00:00` }] });
    useProductStore.setState({ products: [{ id: 'p', name: 'চাল', unit: 'কেজি', purchase_price: 350, sale_price: 500, opening_stock: 5, branch_id: 'a', created_at: '', updated_at: '' }] });
    useStockAdjustmentStore.setState({ adjustments: [] });
    await db.expenses.bulkPut([
      { id: 'expense', date, category: 'পরিবহন', kind: 'shop', amount: 50, branch_id: 'a', created_at: `${date}T11:00:00` },
      { id: 'personal', date, category: 'ব্যক্তিগত', kind: 'owner', amount: 900, branch_id: 'a', created_at: `${date}T12:00:00` },
    ]);
    const payment = { id: 'payment', party_id: 'c', party_name: 'করিম', party_type: 'customer', kind: 'payment', amount: 100, date, branch_id: 'a', method: 'নগদ টাকা', reference: '', note: '', cancelled: false, created_by: 'owner', created_at: `${date}T13:00:00` };
    await db.ledgerEntries.bulkPut([payment, { ...payment, id: 'cancelled', amount: 99999, party_name: 'বাতিল লেনদেন', cancelled: true, created_at: `${date}T23:00:00` }]);
    await db.orders.bulkPut([
      { id: 'order', customer_id: 'c', customer_name: 'করিম', items: [], total_amount: 100, status: 'pending', branch_id: 'a', created_at: '', updated_at: '' },
      { id: 'secret-order', customer_id: 'secret', customer_name: 'গোপন ক্রেতা', items: [], total_amount: 9999, status: 'pending', branch_id: 'b', created_at: '', updated_at: '' },
    ]);
  });
  const before = await snapshot();
  await signIn('owner');
  assert.equal(await page.locator('[data-today-summary] .card').count(), 4);
  assert.equal(await page.locator('[data-quick-actions] a').count(), 4);
  assert.equal(await page.locator('[data-recent-activity] li').count(), 5);
  assert.equal(await page.getByText('দৈনিক রিপোর্ট (অটো)', { exact: true }).count(), 0);
  assert.equal(await page.getByRole('dialog').count(), 0, 'dashboard is not an automatic report screen');
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await assertFits(`owner dashboard at ${width}px`);
    const controls = await page.locator('[data-current-summary] a, [data-quick-actions] a, [data-recent-activity] a').evaluateAll(items => items.every(a => a.getBoundingClientRect().height >= 44));
    assert.equal(controls, true, 'touch targets >=44px');
    if ([390, 1280].includes(width)) await page.screenshot({ path: path.join(artifacts, `dashboard-owner-${width}.png`), fullPage: true });
  }
  // All four quick actions and current balances still reach existing working routes.
  for (const selector of ['[data-quick-actions] a', '[data-current-summary] a']) {
    await page.goto(baseURL);
    await page.locator(selector).first().waitFor();
    const links = await page.locator(selector).evaluateAll(as => as.map(a => a.getAttribute('href')));
    for (const href of links) {
      await page.goto(baseURL);
      await page.locator(`${selector}[href="${href}"]`).click();
      await page.waitForURL(url => url.pathname + url.search === href);
      await page.locator('[data-dashboard]').waitFor({ state: 'detached' });
      assert.equal(await page.locator('[data-dashboard]').count(), 0, `route ${href} is not denied`);
    }
  }
  await signIn('manager');
  const cards = await page.locator('[data-today-summary] .card').allTextContents();
  assert.match(cards[0], /১,০০০\.০০/);
  assert.match(cards[1], /১০০\.০০/);
  assert.match(cards[2], /৫০\.০০/);
  assert.match(cards[3], /২৫০\.০০.*নিট লাভ/);
  assert.ok(!(await page.locator('[data-dashboard]').textContent()).includes('গোপন ক্রেতা'));
  assert.ok(!(await page.locator('[data-recent-activity]').textContent()).includes('বাতিল লেনদেন'));
  await signIn('salesman');
  assert.equal(await page.locator('[data-today-summary] .card').count(), 2);
  assert.equal(await page.locator('[data-quick-actions] a').count(), 2);
  assert.equal(await page.locator('[data-month-summary] dt').count(), 1);
  assert.ok(!/মোট লাভ|মোট খরচ|Supplier Payable|ABC Trading|ব্যক্তিগত|গোপন ক্রেতা/.test(await page.locator('[data-dashboard]').textContent()));
  assert.equal(await page.getByRole('link', { name: 'সব দেখুন' }).getAttribute('href'), '/reports');
  await page.setViewportSize({ width: 320, height: 700 });
  await assertFits('salesman mobile');
  await signIn('customer');
  await page.locator('[data-dashboard="customer"]').waitFor();
  const customer = await page.locator('[data-dashboard]').textContent();
  assert.match(customer, /বর্তমান পাওনা.*৯০০\.০০/);
  assert.match(customer, /মোট ক্রয়.*১,০০০\.০০/);
  assert.match(customer, /ক্রয় হিস্ট্রি \/ Statement/);
  assert.ok(!/মোট লাভ|মোট বিক্রি|মোট খরচ|Supplier Payable|মোট স্টক মূল্য|গোপন ক্রেতা|ABC Trading/.test(customer));
  assert.deepEqual(await page.locator('[data-dashboard] a').evaluateAll(as => as.map(a => a.getAttribute('href'))), ['/my-dues']);
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await assertFits(`customer dashboard at ${width}px`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(artifacts, 'dashboard-customer-mobile.png'), fullPage: true });
  assert.equal(await snapshot(), before, 'navigation must not mutate stored records');
  assert.deepEqual(errors, []);
  console.log('REAL CHROMIUM PASS: dashboard mobile/desktop, four summaries/actions, touch targets, routing, net profit, branch/role/customer isolation, no record mutations');
} finally { await browser.close(); }
