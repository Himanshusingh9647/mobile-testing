'use strict';

const fs = require('fs');
const path = require('path');
const { expect } = require('chai');
const { MobileDriver, touchActions } = require('../index'); // Adjust path if needed
const { swipeUp, tap, scrollByPixels } = touchActions;

describe('Mobile Web Testing Framework — Wandr AI / Travel Planner on iPhone 15', function () {
  /** @type {MobileDriver} */
  let mobile;

  /** @type {import('selenium-webdriver').WebDriver} */
  let driver;
  
  // The URL of your project
  const APP_URL = 'https://ai-travel-2d8a.vercel.app/';

  // ---------------------------------------------------------------
  //  Setup — launch emulated mobile browser
  // ---------------------------------------------------------------
  before(async function () {
    // Note: You can set headless to false if you want to watch the test run visually!
    mobile = new MobileDriver('iPhone_15', { headless: false });
    driver = await mobile.start();
  });

  // ---------------------------------------------------------------
  //  Teardown — take screenshot and close the browser
  // ---------------------------------------------------------------
  after(async function () {
    try {
      if (driver && typeof driver.takeScreenshot === 'function') {
        const img = await driver.takeScreenshot();
        const out = path.join(__dirname, 'screenshot.png');
        fs.writeFileSync(out, img, 'base64');
        // eslint-disable-next-line no-console
        console.log(`Saved screenshot to ${out}`);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Failed to save screenshot:', err);
    }

    if (mobile && typeof mobile.stop === 'function') {
      await mobile.stop();
    }
  });

  // ---------------------------------------------------------------
  //  Test Cases
  // ---------------------------------------------------------------

  it('should successfully load the AI Travel app on an emulated iPhone', async function () {
    await driver.get(APP_URL);
    
    // Give the React/Next.js app a moment to hydrate
    await driver.sleep(1500); 
    
    // Fetch the title to ensure we didn't hit a 404 or blank page
    const title = await driver.getTitle();
    expect(title).to.be.a('string').that.is.not.empty;
  });

  it('should verify the user agent is correctly spoofed as an iPhone', async function () {
    const ua = await driver.executeScript('return navigator.userAgent');
    expect(ua).to.include('iPhone');
  });

  it('should perform a swipe-up gesture to scroll down the travel itinerary or landing page', async function () {
    // Ensures the app's CSS allows for native scrolling
    await swipeUp(driver, { distance: 300, duration: 400, steps: 8 });
    
    const scrollY = await driver.executeScript('return window.scrollY');
    expect(scrollY).to.be.greaterThan(0);
  });

  it('should identify and tap a primary interactive element (e.g., a button)', async function () {
    // Reset to the top of the page
    await driver.executeScript('window.scrollTo(0, 0)');
    
    // We are looking for the first button on your page (like a "Get Started" or "Generate" button)
    // You will need to change 'button' to the specific ID or Class of your target element, e.g., '#generate-btn'
    const targetSelector = 'button'; 
    
    try {
      await tap(driver, targetSelector);
      // Wait to see if a modal opens or navigation occurs
      await driver.sleep(1000); 
      expect(true).to.be.true; // If tap doesn't throw, the element was interactive
    } catch (error) {
      console.warn(`Could not find or tap the element: ${targetSelector}. Make sure the selector matches your app's UI.`);
      throw error;
    }
  });
});
