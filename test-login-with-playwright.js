const { chromium } = require('playwright');

async function testGateControlLogin() {
  console.log('🚀 Starting Gate Control Login test...');
  
  // Launch browser
  const browser = await chromium.launch({ 
    headless: false,  // Show browser for debugging
    slowMo: 500      // Slow down for visibility
  });
  
  try {
    const page = await browser.newPage();
    
    // Navigate to app
    console.log('📍 Opening http://localhost:3001...');
    await page.goto('http://localhost:3001');
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Take initial screenshot
    console.log('📸 Taking initial screenshot...');
    await page.screenshot({ path: 'login-initial.png', fullPage: true });
    
    // Fill in login form
    console.log('🔐 Filling login credentials...');
    
    // Find and fill email input
    const emailInput = await page.locator('input[type="email"], input[name="email"], input[placeholder*="email"]').first();
    await emailInput.fill('brana@test.cz');
    console.log('📧 Email filled: brana@test.cz');
    
    // Find and fill password input
    const passwordInput = await page.locator('input[type="password"], input[name="password"], input[placeholder*="password"]').first();
    await passwordInput.fill('admin123');
    console.log('🔑 Password filled: admin123');
    
    // Take screenshot after filling form
    await page.screenshot({ path: 'login-filled.png', fullPage: true });
    
    // Find and click login button
    console.log('🎯 Clicking login button...');
    const loginButton = await page.locator('button[type="submit"], button:has-text("Přihlásit"), button:has-text("Login"), button:has-text("Sign in")').first();
    await loginButton.click();
    
    // Wait for login process
    console.log('⏳ Waiting for login process...');
    await page.waitForTimeout(3000);
    
    // Check if login was successful
    console.log('🔍 Checking login result...');
    
    // Look for dashboard or main content
    const dashboard = await page.locator('.dashboard, main, [class*="dashboard"]').first();
    const loginForm = await page.locator('form').first();
    
    if (await dashboard.isVisible() && !(await loginForm.isVisible())) {
      console.log('✅ Login successful! Dashboard detected.');
      
      // Take screenshot of dashboard
      await page.screenshot({ path: 'dashboard-success.png', fullPage: true });
      
      // Check for MQTT status
      const statusElements = await page.locator('text=/Připojeno|Odpojeno|Connected|Disconnected/').all();
      for (const element of statusElements) {
        if (await element.isVisible()) {
          const text = await element.textContent();
          console.log(`📡 MQTT Status: ${text}`);
        }
      }
      
      // Look for control buttons
      const controlButtons = await page.locator('button:has-text("Ovládat"), button:has-text("Gate"), button:has-text("Garage")').all();
      console.log(`🎮 Found ${controlButtons.length} control buttons`);
      
      // Try to click one control button to test functionality
      if (controlButtons.length > 0) {
        console.log('🎯 Testing control button...');
        await controlButtons[0].click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'control-test.png', fullPage: true });
        console.log('✅ Control button test completed');
      }
      
    } else if (await loginForm.isVisible()) {
      console.log('❌ Login failed - still on login page');
      
      // Check for error messages
      const errorElements = await page.locator('[class*="error"], [class*="alert"], .text-red-600').all();
      if (errorElements.length > 0) {
        for (let i = 0; i < errorElements.length; i++) {
          const text = await errorElements[i].textContent();
          console.log(`⚠️ Error ${i + 1}: ${text}`);
        }
      }
      
      await page.screenshot({ path: 'login-failed.png', fullPage: true });
    } else {
      console.log('❓ Unknown page state');
      await page.screenshot({ path: 'unknown-state.png', fullPage: true });
    }
    
    console.log('✅ Test completed!');
    console.log('📁 Screenshots saved:');
    console.log('   - login-initial.png (before login)');
    console.log('   - login-filled.png (form filled)');
    console.log('   - dashboard-success.png (after successful login)');
    console.log('   - control-test.png (after control test)');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    // Try to capture error state
    try {
      const page = await browser.newPage();
      await page.goto('http://localhost:3001');
      await page.screenshot({ path: 'error-state.png', fullPage: true });
      console.log('📸 Error screenshot saved as error-state.png');
    } catch (screenshotError) {
      console.log('Could not capture error screenshot');
    }
  } finally {
    await browser.close();
  }
}

// Run the test
testGateControlLogin().catch(console.error);
