'use strict';

/**
 * @file example.test.js
 * @description Mocha + Chai integration tests for mobile-web-testing-framework.
 *
 * Covers:
 *   - Device profile loading & validation
 *   - Navigation & page interaction
 *   - Touch gestures (swipe, scroll, tap)
 *   - Screenshot capture
 *   - Viewport & responsive behaviour
 *   - Multi-device support
 *   - Error handling & edge cases
 *
 * Run with:
 *   npm test                   (standard)
 *   npm run test:report        (with stored results + HTML report)
 */

const { expect } = require('chai');
const path = require('path');
const fs = require('fs');
const { MobileDriver, touchActions, deviceProfiles } = require('../index');
const { swipeUp, swipeDown, swipeLeft, swipeRight, tap, longPress, scrollByPixels } = touchActions;

// ===================================================================
//  Suite 1 — iPhone 15 Emulation (core functionality)
// ===================================================================
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
  //  Device Profile Tests
  // ---------------------------------------------------------------
  describe('Device Profile', function () {
    it('should load the correct device profile for iPhone 15', function () {
      const profile = mobile.profile;
      expect(profile.deviceName).to.equal('iPhone 15');
      expect(profile.width).to.equal(393);
      expect(profile.height).to.equal(852);
      expect(profile.deviceScaleFactor).to.equal(3);
      expect(profile.mobile).to.be.true;
      expect(profile.userAgent).to.include('iPhone');
    });

    it('should return a copy of the profile (immutable)', function () {
      const p1 = mobile.profile;
      const p2 = mobile.profile;
      expect(p1).to.deep.equal(p2);
      p1.width = 9999;
      expect(mobile.profile.width).to.equal(393);
    });

    it('should report the correct emulated user agent', async function () {
      const ua = await driver.executeScript('return navigator.userAgent');
      expect(ua).to.include('iPhone');
      expect(ua).to.include('Safari');
    });
  });

  // ---------------------------------------------------------------
  //  Navigation Tests
  // ---------------------------------------------------------------
  describe('Navigation', function () {
    it('should navigate to example.com and verify the page title', async function () {
      await driver.get('https://example.com');
      const title = await driver.getTitle();
      expect(title).to.equal('Example Domain');
    });

    it('should return the correct current URL after navigation', async function () {
      await driver.get('https://example.com');
      const url = await driver.getCurrentUrl();
      expect(url).to.include('example.com');
    });

    it('should handle navigation via the MobileDriver API', async function () {
      await mobile.navigateTo('https://example.com');
      const title = await mobile.getTitle();
      expect(title).to.equal('Example Domain');
    });
  });

  // ---------------------------------------------------------------
  //  Touch Gesture Tests
  // ---------------------------------------------------------------
  describe('Touch Gestures', function () {
    beforeEach(async function () {
      await driver.get('https://example.com');
      // Make the page tall enough to scroll
      await driver.executeScript("document.body.style.minHeight = '3000px'");
      await driver.executeScript('window.scrollTo(0, 0)');
    });

    it('should perform a swipe-up gesture without errors', async function () {
      await swipeUp(driver, { distance: 300, duration: 400, steps: 8 });
    });

    it('should perform a swipe-down gesture without errors', async function () {
      await swipeDown(driver, { distance: 300, duration: 400, steps: 8 });
    });

    it('should perform a swipe-left gesture without errors', async function () {
      await swipeLeft(driver, { distance: 200, duration: 400, steps: 8 });
    });

    it('should perform a swipe-right gesture without errors', async function () {
      await swipeRight(driver, { distance: 200, duration: 400, steps: 8 });
    });

    it('should scroll down using scrollByPixels utility', async function () {
      await scrollByPixels(driver, 200);
      const scrollY = await driver.executeScript('return window.scrollY');
      expect(scrollY).to.be.greaterThan(0);
    });

    it('should scroll by a custom pixel amount', async function () {
      await scrollByPixels(driver, 500);
      const scrollY = await driver.executeScript('return window.scrollY');
      expect(scrollY).to.be.greaterThan(0);
    });

    it('should tap the "More information..." link and navigate', async function () {
      await tap(driver, 'a');
      await driver.sleep(2000);
      const url = await driver.getCurrentUrl();
      expect(url).to.include('iana.org');
    });
  });

  // ---------------------------------------------------------------
  //  Screenshot Tests
  // ---------------------------------------------------------------
  describe('Screenshots', function () {
    const screenshotDir = path.join(__dirname, '..', 'test-results', 'screenshots');

    it('should take a screenshot and return base64 data', async function () {
      await driver.get('https://example.com');
      const data = await mobile.takeScreenshot();
      expect(data).to.be.a('string');
      expect(data.length).to.be.greaterThan(100);
    });

    it('should save a screenshot to disk', async function () {
      await driver.get('https://example.com');
      const filePath = path.join(screenshotDir, 'test-screenshot.png');
      await mobile.saveScreenshot(filePath);
      expect(fs.existsSync(filePath)).to.be.true;
      // Clean up
      fs.unlinkSync(filePath);
    });
  });

  // ---------------------------------------------------------------
  //  Viewport & Responsive Tests
  // ---------------------------------------------------------------
  describe('Viewport & Responsive', function () {
    it('should report mobile-sized viewport dimensions', async function () {
      await driver.get('https://example.com');
      const innerWidth = await driver.executeScript('return window.innerWidth');
      // iPhone 15 viewport width is 393
      expect(innerWidth).to.be.at.most(500);
      expect(innerWidth).to.be.at.least(300);
    });

    it('should report a mobile device pixel ratio', async function () {
      const dpr = await driver.executeScript('return window.devicePixelRatio');
      expect(dpr).to.equal(3);
    });

    it('should report touch support as enabled', async function () {
      const hasTouch = await driver.executeScript(
        "return 'ontouchstart' in window || navigator.maxTouchPoints > 0"
      );
      expect(hasTouch).to.be.true;
    });
  });

  // ---------------------------------------------------------------
  //  Script Execution Tests
  // ---------------------------------------------------------------
  describe('Script Execution', function () {
    it('should execute arbitrary JavaScript and return results', async function () {
      const result = await mobile.executeScript('return 2 + 2');
      expect(result).to.equal(4);
    });

    it('should pass arguments to executed scripts', async function () {
      const result = await mobile.executeScript(
        'return arguments[0] + arguments[1]',
        10,
        20
      );
      expect(result).to.equal(30);
    });
  });
});

// ===================================================================
//  Suite 2 — Multi-Device Profile Validation
// ===================================================================
describe('Multi-Device Profile Validation', function () {
  const deviceNames = Object.keys(deviceProfiles);

  deviceNames.forEach((deviceName) => {
    const profile = deviceProfiles[deviceName];

    describe(`${profile.deviceName}`, function () {
      it('should have valid viewport dimensions', function () {
        expect(profile.width).to.be.a('number').and.greaterThan(0);
        expect(profile.height).to.be.a('number').and.greaterThan(0);
      });

      it('should have a valid device scale factor', function () {
        expect(profile.deviceScaleFactor).to.be.a('number').and.greaterThan(0);
      });

      it('should have a mobile flag', function () {
        expect(profile.mobile).to.be.a('boolean');
      });

      it('should have a non-empty user agent', function () {
        expect(profile.userAgent).to.be.a('string').and.have.length.greaterThan(10);
      });

      it('should construct a MobileDriver without error', function () {
        const m = new MobileDriver(deviceName, { headless: true });
        expect(m.profile.deviceName).to.equal(profile.deviceName);
      });
    });
  });
});

// ===================================================================
//  Suite 3 — Error Handling & Edge Cases
// ===================================================================
describe('Error Handling & Edge Cases', function () {
  it('should throw for an unsupported device name', function () {
    expect(() => new MobileDriver('Nokia_3310')).to.throw(
      /Unknown device "Nokia_3310"/
    );
  });

  it('should throw for an empty device name', function () {
    expect(() => new MobileDriver('')).to.throw(/Unknown device/);
  });

  it('should throw for a non-existent profiles file', function () {
    expect(
      () => new MobileDriver('iPhone_15', { profilesPath: '/no/such/file.json' })
    ).to.throw(/not found/);
  });

  it('should throw when calling getTitle before start()', async function () {
    const m = new MobileDriver('iPhone_15', { headless: true });
    try {
      await m.getTitle();
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.message).to.include('not running');
    }
  });

  it('should throw when calling navigateTo before start()', async function () {
    const m = new MobileDriver('iPhone_15', { headless: true });
    try {
      await m.navigateTo('https://example.com');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.message).to.include('not running');
    }
  });

  it('should handle stop() when driver was never started', async function () {
    const m = new MobileDriver('iPhone_15', { headless: true });
    // Should not throw
    await m.stop();
  });
});

// ===================================================================
//  Suite 4 — TestResultStore Unit Tests
// ===================================================================
describe('TestResultStore', function () {
  const TestResultStore = require('../src/utils/TestResultStore');
  const testOutputDir = path.join(__dirname, '..', 'test-results', 'unit-test');

  afterEach(function () {
    // Clean up generated files
    if (fs.existsSync(testOutputDir)) {
      const files = fs.readdirSync(testOutputDir);
      for (const file of files) {
        fs.unlinkSync(path.join(testOutputDir, file));
      }
      fs.rmdirSync(testOutputDir);
    }
  });

  it('should record and retrieve test results', function () {
    const store = new TestResultStore({ outputDir: testOutputDir, saveJson: false, saveHtml: false });
    store.addResult({ title: 'test A', status: 'passed', duration: 50 });
    store.addResult({ title: 'test B', status: 'failed', duration: 120, error: 'oops' });

    expect(store.results).to.have.length(2);
    expect(store.results[0].status).to.equal('passed');
    expect(store.results[1].error).to.equal('oops');
  });

  it('should compute a correct summary', function () {
    const store = new TestResultStore({ outputDir: testOutputDir, saveJson: false, saveHtml: false });
    store.addResult({ title: 'A', status: 'passed', duration: 10 });
    store.addResult({ title: 'B', status: 'passed', duration: 20 });
    store.addResult({ title: 'C', status: 'failed', duration: 30, error: 'fail' });
    store.addResult({ title: 'D', status: 'skipped', duration: 0 });

    const s = store.summary;
    expect(s.total).to.equal(4);
    expect(s.passed).to.equal(2);
    expect(s.failed).to.equal(1);
    expect(s.skipped).to.equal(1);
  });

  it('should save a JSON report to disk', function () {
    const store = new TestResultStore({ outputDir: testOutputDir, saveJson: true, saveHtml: false });
    store.start();
    store.addResult({ title: 'test', status: 'passed', duration: 42 });
    store.finish();

    const { jsonPath } = store.save();
    expect(fs.existsSync(jsonPath)).to.be.true;

    const report = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    expect(report.summary.total).to.equal(1);
    expect(report.summary.passed).to.equal(1);
  });

  it('should save an HTML report to disk', function () {
    const store = new TestResultStore({ outputDir: testOutputDir, saveJson: false, saveHtml: true });
    store.start();
    store.addResult({ title: 'test', status: 'passed', duration: 42 });
    store.finish();

    const { htmlPath } = store.save();
    expect(fs.existsSync(htmlPath)).to.be.true;

    const html = fs.readFileSync(htmlPath, 'utf-8');
    expect(html).to.include('ALL TESTS PASSED');
  });

  it('should reset state correctly', function () {
    const store = new TestResultStore({ outputDir: testOutputDir, saveJson: false, saveHtml: false });
    store.start();
    store.addResult({ title: 'test', status: 'passed', duration: 10 });
    store.finish();

    store.reset();
    expect(store.results).to.have.length(0);
    expect(store.summary.total).to.equal(0);
  });

  it('should escape HTML entities in the report', function () {
    const store = new TestResultStore({
      outputDir: testOutputDir,
      saveJson: false,
      saveHtml: true,
      suiteName: 'Test <script>alert(1)</script>',
    });
    store.start();
    store.addResult({
      title: '<img onerror=alert(1)>',
      status: 'failed',
      duration: 10,
      error: 'Error with <html> chars & "quotes"',
    });
    store.finish();

    const { htmlPath } = store.save();
    const html = fs.readFileSync(htmlPath, 'utf-8');
    expect(html).to.not.include('<script>alert');
    expect(html).to.not.include('<img onerror');
    expect(html).to.include('&lt;script&gt;');
  });
});
