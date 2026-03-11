'use strict';

/**
 * @file example.test.js
 * @description Mocha + Chai integration test that demonstrates the
 * mobile-web-testing-framework in action.
 *
 * What this test does:
 *   1. Launches Chrome emulating an iPhone 15 via CDP.
 *   2. Navigates to https://example.com.
 *   3. Verifies the page title.
 *   4. Performs a swipe-up gesture.
 *   5. Performs a tap on the "More information..." link.
 *   6. Closes the browser.
 *
 * Run with:  npm test
 */

const { expect } = require('chai');
const { MobileDriver, touchActions } = require('../index');
const { swipeUp, tap, scrollByPixels } = touchActions;

describe('Mobile Web Testing Framework — iPhone 15 Emulation', function () {
  /** @type {MobileDriver} */
  let mobile;

  /** @type {import('selenium-webdriver').WebDriver} */
  let driver;

  // ---------------------------------------------------------------
  //  Setup — launch emulated mobile browser
  // ---------------------------------------------------------------
  before(async function () {
    mobile = new MobileDriver('iPhone_15', { headless: true });
    driver = await mobile.start();
  });

  // ---------------------------------------------------------------
  //  Teardown — close the browser no matter what
  // ---------------------------------------------------------------
  after(async function () {
    await mobile.stop();
  });

  // ---------------------------------------------------------------
  //  Test Cases
  // ---------------------------------------------------------------

  it('should load the correct device profile for iPhone 15', function () {
    const profile = mobile.profile;
    expect(profile.deviceName).to.equal('iPhone 15');
    expect(profile.width).to.equal(393);
    expect(profile.height).to.equal(852);
    expect(profile.deviceScaleFactor).to.equal(3);
    expect(profile.mobile).to.be.true;
    expect(profile.userAgent).to.include('iPhone');
  });

  it('should navigate to example.com and verify the page title', async function () {
    await driver.get('https://example.com');
    const title = await driver.getTitle();
    expect(title).to.equal('Example Domain');
  });

  it('should report the correct emulated user agent', async function () {
    const ua = await driver.executeScript('return navigator.userAgent');
    expect(ua).to.include('iPhone');
  });

  it('should perform a swipe-up gesture without errors', async function () {
    await swipeUp(driver, { distance: 300, duration: 400, steps: 8 });
    // No throw = pass. We can also verify scroll offset moved.
  });

  it('should scroll down using scrollByPixels utility', async function () {
    // Reset scroll position first
    await driver.executeScript('window.scrollTo(0, 0)');
    // Ensure the page is tall enough to allow scrolling (some test pages
    // like example.com are small and won't scroll by default).
    await driver.executeScript("document.body.style.minHeight = '2000px'");
    await scrollByPixels(driver, 200);

    const scrollY = await driver.executeScript('return window.scrollY');
    expect(scrollY).to.be.greaterThan(0);
  });

  it('should tap the "More information..." link', async function () {
    await driver.get('https://example.com');
    await tap(driver, 'a');
    // After tap, the browser may navigate — give it a moment
    await driver.sleep(2000);
    const url = await driver.getCurrentUrl();
    // The link on example.com points to IANA
    expect(url).to.include('iana.org');
  });

  it('should throw an error for an unsupported device name', function () {
    expect(() => new MobileDriver('Nokia_3310')).to.throw(
      /Unknown device "Nokia_3310"/
    );
  });
});
