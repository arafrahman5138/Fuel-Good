const { chromium } = require('playwright');
(async() => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  page.on('console', msg => console.log('BROWSER:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGEERROR:', err.message));
  await page.goto('http://localhost:19006', { waitUntil: 'networkidle', timeout: 120000 });
  console.log('URL', page.url());
  const body = await page.locator('body').innerText();
  console.log(body.slice(0, 4000));
  await browser.close();
})();
