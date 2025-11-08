const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Listen for console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('CONSOLE ERROR:', msg.text());
    }
  });
  
  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
  });
  
  try {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // Fill login form
    await page.fill('input[type="email"]', 'brana@test.cz');
    await page.fill('input[type="password"]', 'admin123');
    
    // Click login and wait for navigation
    await Promise.all([
      page.waitForNavigation({ timeout: 10000 }),
      page.click('button[type="submit"]')
    ]);
    
    // Check if we're logged in
    const currentUrl = page.url();
    console.log('Current URL after login:', currentUrl);
    
    // Take screenshot
    await page.screenshot({ path: 'debug-after-login.png', fullPage: true });
    
    // Check for admin button
    const adminButton = await page.locator('text=Admin Panel').count();
    console.log('Admin buttons found:', adminButton);
    
    // Check for user info
    const userInfo = await page.locator('text=Vítejte').count();
    console.log('User info elements found:', userInfo);
    
  } catch (error) {
    console.error('Test failed:', error.message);
    await page.screenshot({ path: 'debug-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();
