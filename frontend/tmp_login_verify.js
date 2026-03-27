const { chromium } = require('playwright');

(async() => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  page.on('console', msg => console.log('BROWSER:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGEERROR:', err.message));
  const navs = [];
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) {
      navs.push(frame.url());
      console.log('NAV', frame.url());
    }
  });

  await page.goto('http://localhost:19006/login', { waitUntil: 'networkidle', timeout: 120000 });
  const inputs = page.locator('input');
  await inputs.nth(0).fill('codex_launch_1774538280@example.com');
  await inputs.nth(1).fill('Testing123');
  await page.getByText('Sign In', { exact: true }).last().click();
  await page.waitForTimeout(10000);

  console.log('FINAL_URL', page.url());
  console.log('NAV_COUNT', navs.length);
  console.log('NAVS', JSON.stringify(navs));
  console.log((await page.locator('body').innerText()).slice(0, 4000));
  await browser.close();
})();
