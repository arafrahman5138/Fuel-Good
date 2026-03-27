const { chromium } = require('playwright');

(async() => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  page.on('console', msg => console.log('BROWSER:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGEERROR:', err.message));
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) console.log('NAV', frame.url()); });

  const email = `codex_${Date.now()}@example.com`;
  const password = 'Testing123';

  await page.goto('http://localhost:19006/login', { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByText('Sign Up', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('Full Name'), null, { timeout: 15000 });
  const inputs = page.locator('input');
  await inputs.nth(0).fill('Codex Test');
  await inputs.nth(1).fill(email);
  await inputs.nth(2).fill(password);
  await page.getByText('Create Account', { exact: true }).last().click();
  await page.waitForTimeout(8000);
  console.log('FINAL_URL', page.url());
  console.log((await page.locator('body').innerText()).slice(0, 5000));
  await browser.close();
})();
