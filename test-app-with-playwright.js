const { chromium } = require('playwright');

async function testGateControlApp() {
  console.log('🚀 Starting Gate Control App test...');
  
  // Launch browser
  const browser = await chromium.launch({ 
    headless: false,  // Show browser for debugging
    slowMo: 1000      // Slow down for visibility
  });
  
  try {
    const page = await browser.newPage();
    
    // Navigate to app
    console.log('📍 Opening http://localhost:3001...');
    await page.goto('http://localhost:3001');
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Take screenshot
    console.log('📸 Taking screenshot...');
    await page.screenshot({ path: 'gate-control-app.png', fullPage: true });
    
    // Check page title
    const title = await page.title();
    console.log(`📄 Page title: ${title}`);
    
    // Look for login form or main content
    const loginForm = await page.locator('form').first();
    const mainContent = await page.locator('main, .container, .dashboard').first();
    
    if (await loginForm.isVisible()) {
      console.log('🔐 Login form detected');
      
      // Check for email input
      const emailInput = await page.locator('input[type="email"], input[name="email"]').first();
      if (await emailInput.isVisible()) {
        console.log('📧 Email input found');
        await emailInput.fill('test@example.com');
      }
      
      // Check for password input
      const passwordInput = await page.locator('input[type="password"], input[name="password"]').first();
      if (await passwordInput.isVisible()) {
        console.log('🔑 Password input found');
        await passwordInput.fill('testpassword123');
      }
      
      // Look for login button
      const loginButton = await page.locator('button[type="submit"], button:has-text("Přihlásit"), button:has-text("Login")').first();
      if (await loginButton.isVisible()) {
        console.log('🎯 Login button found');
        // Don't click - just take screenshot of login state
        await page.screenshot({ path: 'gate-control-login.png', fullPage: true });
      }
    } else if (await mainContent.isVisible()) {
      console.log('📊 Main content detected - possibly already logged in');
      
      // Look for MQTT status
      const statusElements = await page.locator('[class*="status"], [class*="connection"], [class*="mqtt"]').all();
      console.log(`📡 Found ${statusElements.length} status elements`);
      
      // Look for control buttons
      const controlButtons = await page.locator('button:has-text("Ovládat"), button:has-text("Control"), button:has-text("Gate"), button:has-text("Garage")').all();
      console.log(`🎮 Found ${controlButtons.length} control buttons`);
      
      // Check connection status
      const connectionText = await page.locator('text=/Odpojeno|Připojeno|Connected|Disconnected/').first();
      if (await connectionText.isVisible()) {
        const text = await connectionText.textContent();
        console.log(`🔌 Connection status: ${text}`);
      }
    }
    
    // Check for any error messages
    const errorElements = await page.locator('[class*="error"], [class*="alert"], .text-red-600').all();
    if (errorElements.length > 0) {
      console.log(`⚠️ Found ${errorElements.length} potential error elements`);
      for (let i = 0; i < Math.min(errorElements.length, 3); i++) {
        const text = await errorElements[i].textContent();
        console.log(`   Error ${i + 1}: ${text}`);
      }
    }
    
    // Wait a bit more to see any dynamic content
    await page.waitForTimeout(3000);
    
    // Final screenshot
    await page.screenshot({ path: 'gate-control-final.png', fullPage: true });
    
    console.log('✅ Test completed successfully!');
    console.log('📁 Screenshots saved:');
    console.log('   - gate-control-app.png (initial state)');
    console.log('   - gate-control-login.png (if login form found)');
    console.log('   - gate-control-final.png (final state)');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    // Try to capture error state
    try {
      await page.screenshot({ path: 'gate-control-error.png', fullPage: true });
      console.log('📸 Error screenshot saved as gate-control-error.png');
    } catch (screenshotError) {
      console.log('Could not capture error screenshot');
    }
  } finally {
    await browser.close();
  }
}

// Run the test
testGateControlApp().catch(console.error);
