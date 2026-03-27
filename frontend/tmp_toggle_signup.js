const { chromium } = require('playwright');
(async() => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await page.goto('http://localhost:19006/login', { waitUntil: 'networkidle', timeout: 120000 });
  console.log('BEFORE');
  console.log((await page.locator('body').innerText()).slice(0, 2000));
  await page.getByText("Don't have an account? Sign Up").click();
  await page.waitForTimeout(2000);
  console.log('AFTER');
  console.log((await page.locator('body').innerText()).slice(0, 2500));
  await browser.close();
})();
