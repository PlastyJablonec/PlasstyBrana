const { chromium } = require('playwright');

async function testRealFirebaseAuth() {
  console.log('🚀 Starting Real Firebase Auth test...');
  
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
    await page.waitForTimeout(3000);
    
    // Take initial screenshot
    console.log('📸 Taking initial screenshot...');
    await page.screenshot({ path: 'real-firebase-initial.png', fullPage: true });
    
    // Check if Firebase is properly configured
    console.log('🔍 Checking Firebase configuration...');
    
    // Look for login form
    const loginForm = await page.locator('form').first();
    if (!(await loginForm.isVisible())) {
      console.log('❌ Login form not found - checking for errors...');
      
      // Check for Firebase errors
      const errorElements = await page.locator('text=/Firebase|Error|auth/').all();
      for (const element of errorElements) {
        if (await element.isVisible()) {
          const text = await element.textContent();
          console.log(`⚠️ Firebase Error: ${text}`);
        }
      }
      
      await page.screenshot({ path: 'firebase-error.png', fullPage: true });
      return;
    }
    
    console.log('✅ Login form detected - Firebase appears to be configured');
    
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
    await page.screenshot({ path: 'real-firebase-filled.png', fullPage: true });
    
    // Find and click login button
    console.log('🎯 Clicking login button...');
    const loginButton = await page.locator('button[type="submit"], button:has-text("Přihlásit"), button:has-text("Login")').first();
    await loginButton.click();
    
    // Wait for Firebase authentication
    console.log('⏳ Waiting for Firebase authentication...');
    await page.waitForTimeout(5000);
    
    // Check authentication result
    console.log('🔍 Checking authentication result...');
    
    // Look for dashboard or error
    const dashboard = await page.locator('.dashboard, main, [class*="dashboard"]').first();
    const loginFormStill = await page.locator('form').first();
    const errorElements = await page.locator('[class*="error"], [class*="alert"], .text-red-600').all();
    
    if (await dashboard.isVisible() && !(await loginFormStill.isVisible())) {
      console.log('✅ Firebase authentication successful!');
      
      // Take screenshot of dashboard
      await page.screenshot({ path: 'real-firebase-success.png', fullPage: true });
      
      // Check for MQTT status
      const statusElements = await page.locator('text=/Připojeno|Odpojeno|Connected|Disconnected/').all();
      for (const element of statusElements) {
        if (await element.isVisible()) {
          const text = await element.textContent();
          console.log(`📡 MQTT Status: ${text}`);
        }
      }
      
      // Look for user info
      const userElements = await page.locator('text=/brana@test.cz|Admin|User/').all();
      for (const element of userElements) {
        if (await element.isVisible()) {
          const text = await element.textContent();
          console.log(`👤 User info: ${text}`);
        }
      }
      
      // Look for control buttons
      const controlButtons = await page.locator('button:has-text("Ovládat"), button:has-text("Gate"), button:has-text("Garage")').all();
      console.log(`🎮 Found ${controlButtons.length} control buttons`);
      
    } else {
      console.log('❌ Firebase authentication failed');
      
      // Check for specific Firebase errors
      for (let i = 0; i < Math.min(errorElements.length, 3); i++) {
        const text = await errorElements[i].textContent();
        console.log(`⚠️ Error ${i + 1}: ${text}`);
      }
      
      await page.screenshot({ path: 'real-firebase-failed.png', fullPage: true });
    }
    
    console.log('✅ Test completed!');
    console.log('📁 Screenshots saved:');
    console.log('   - real-firebase-initial.png (before login)');
    console.log('   - real-firebase-filled.png (form filled)');
    console.log('   - real-firebase-success.png (after successful login)');
    console.log('   - real-firebase-failed.png (if login failed)');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    // Try to capture error state
    try {
      await page.screenshot({ path: 'real-firebase-error.png', fullPage: true });
      console.log('📸 Error screenshot saved as real-firebase-error.png');
    } catch (screenshotError) {
      console.log('Could not capture error screenshot');
    }
  } finally {
    await browser.close();
  }
}

// Run the test
testRealFirebaseAuth().catch(console.error);
