'use strict';

const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const path = require('path');
const fs = require('fs');

/**
 * Default path to the built-in device profiles JSON shipped with the package.
 * @type {string}
 */
const DEFAULT_PROFILES_PATH = path.resolve(__dirname, '..', 'config', 'deviceProfiles.json');

/**
 * MobileDriver — Core wrapper around Selenium WebDriver 4+ that provides
 * frictionless mobile-web emulation via Chrome DevTools Protocol (CDP).
 *
 * Features:
 *  - Reads device metrics (viewport, DPR, user-agent) from a JSON profile.
 *  - Applies CDP `Emulation.setDeviceMetricsOverride` & `Emulation.setUserAgentOverride`.
 *  - Exposes the underlying WebDriver instance for advanced usage.
 *  - Designed to be imported as part of the `mobile-web-testing-framework` NPM package.
 *
 * @example
 * const { MobileDriver } = require('mobile-web-testing-framework');
 *
 * (async () => {
 *   const mobile = new MobileDriver('iPhone_15');
 *   const driver = await mobile.start();
 *   await driver.get('https://example.com');
 *   await mobile.stop();
 * })();
 */
class MobileDriver {
  /**
   * Creates a new MobileDriver instance.
   *
   * @param {string}  deviceName            - Key that matches an entry in the device profiles JSON
   *                                           (e.g. "iPhone_15", "Pixel_8", "iPad_Air").
   * @param {Object}  [options={}]          - Optional configuration overrides.
   * @param {string}  [options.profilesPath] - Absolute path to a custom device-profiles JSON file.
   *                                           Defaults to the built-in `deviceProfiles.json`.
   * @param {boolean} [options.headless=false] - Run Chrome in headless mode.
   * @param {string[]} [options.additionalArgs=[]] - Extra Chrome CLI arguments
   *                                                  (e.g. `['--disable-gpu']`).
   * @throws {Error} If the `deviceName` is not found in the profiles file.
   */
  constructor(deviceName, options = {}) {
    const {
      profilesPath = DEFAULT_PROFILES_PATH,
      headless = false,
      additionalArgs = [],
    } = options;

    /** @private */
    this._deviceName = deviceName;
    /** @private */
    this._headless = headless;
    /** @private */
    this._additionalArgs = additionalArgs;
    /** @private */
    this._driver = null;
    /** @private */
    this._cdpConnection = null;

    // --------------- Load & validate device profile ---------------
    if (!fs.existsSync(profilesPath)) {
      throw new Error(
        `[MobileDriver] Device profiles file not found at: ${profilesPath}`
      );
    }

    const profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'));

    if (!profiles[deviceName]) {
      const available = Object.keys(profiles).join(', ');
      throw new Error(
        `[MobileDriver] Unknown device "${deviceName}". ` +
        `Available devices: ${available}`
      );
    }

    /** @private @type {{ deviceName: string, width: number, height: number, deviceScaleFactor: number, mobile: boolean, userAgent: string }} */
    this._profile = profiles[deviceName];
  }

  // ----------------------------------------------------------------
  //  Public API
  // ----------------------------------------------------------------

  /**
   * The loaded device profile object (read-only).
   *
   * @returns {{ deviceName: string, width: number, height: number, deviceScaleFactor: number, mobile: boolean, userAgent: string }}
   */
  get profile() {
    return { ...this._profile };
  }

  /**
   * The underlying Selenium WebDriver instance.
   * Available only after {@link MobileDriver#start} has been called.
   *
   * @returns {import('selenium-webdriver').WebDriver | null}
   */
  get driver() {
    return this._driver;
  }

  /**
   * Builds a Chrome WebDriver session and applies mobile device emulation
   * via Chrome's native `mobileEmulation` capability (no CDP required).
   *
   * @returns {Promise<import('selenium-webdriver').WebDriver>} The ready-to-use WebDriver instance.
   * @throws {Error} If the driver fails to initialise.
   */
  async start() {
    try {
      const { width, height, deviceScaleFactor, mobile, userAgent } = this._profile;

      // ---------- Chrome Options ----------
      const chromeOptions = new chrome.Options();

      // Apply mobile emulation using Chrome's native capability —
      // this is the official, version-stable API and requires no raw CDP calls.
      chromeOptions.setMobileEmulation({
        deviceMetrics: {
          width,
          height,
          pixelRatio: deviceScaleFactor,
          touch: mobile,
        },
        userAgent,
      });

      if (this._headless) {
        chromeOptions.addArguments('--headless=new');
      }

      // Common stability flags
      chromeOptions.addArguments(
        '--disable-extensions',
        '--disable-infobars',
        '--no-sandbox',
        '--disable-dev-shm-usage',
      );

      if (this._additionalArgs.length) {
        chromeOptions.addArguments(...this._additionalArgs);
      }

      // ---------- Build WebDriver ----------
      this._driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(chromeOptions)
        .build();

      console.log(
        `[MobileDriver] Session started — emulating "${this._profile.deviceName}" ` +
        `(${this._profile.width}×${this._profile.height} @${this._profile.deviceScaleFactor}x)`
      );

      return this._driver;
    } catch (err) {
      // Clean-up on failure so we don't leave zombie browser processes
      await this.stop();
      throw new Error(`[MobileDriver] Failed to start session: ${err.message}`);
    }
  }

  /**
   * Gracefully closes the browser and cleans up the WebDriver session.
   *
   * @returns {Promise<void>}
   */
  async stop() {
    try {
      if (this._driver) {
        await this._driver.quit();
        console.log('[MobileDriver] Session closed.');
      }
    } catch (err) {
      console.warn(`[MobileDriver] Error while stopping: ${err.message}`);
    } finally {
      this._driver = null;
    }
  }

  /**
   * Retrieves the current page title from the emulated browser.
   *
   * @returns {Promise<string>} The page title.
   */
  async getTitle() {
    this._ensureRunning();
    return this._driver.getTitle();
  }

  /**
   * Navigates the emulated browser to the given URL.
   *
   * @param {string} url - The target URL.
   * @returns {Promise<void>}
   */
  async navigateTo(url) {
    this._ensureRunning();
    await this._driver.get(url);
  }

  /**
   * Takes a screenshot and returns it as a Base64-encoded PNG string.
   *
   * @returns {Promise<string>} Base64 screenshot data.
   */
  async takeScreenshot() {
    this._ensureRunning();
    return this._driver.takeScreenshot();
  }

  /**
   * Saves a screenshot to disk at the given file path.
   *
   * @param {string} filePath - Destination path for the PNG file.
   * @returns {Promise<void>}
   */
  async saveScreenshot(filePath) {
    const data = await this.takeScreenshot();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, data, 'base64');
    console.log(`[MobileDriver] Screenshot saved to ${filePath}`);
  }

  /**
   * Executes arbitrary JavaScript in the context of the current page.
   *
   * @param {string | Function} script - The script to execute.
   * @param {...*} args - Arguments passed to the script.
   * @returns {Promise<*>} The script's return value.
   */
  async executeScript(script, ...args) {
    this._ensureRunning();
    return this._driver.executeScript(script, ...args);
  }

  /**
   * Sends a raw CDP command via the `sendDevToolsCommand` bridge available
   * on Chrome-based sessions (Selenium 4.6+).
   *
   * Note: This is an advanced escape-hatch. Device emulation is already
   * applied automatically via `setMobileEmulation` in {@link MobileDriver#start}.
   *
   * @param {string} method - CDP method name (e.g. "Network.enable").
   * @param {Object} [params={}] - CDP method parameters.
   * @returns {Promise<*>} The CDP response.
   * @throws {Error} If CDP is not supported by the current WebDriver build.
   */
  async sendCdpCommand(method, params = {}) {
    this._ensureRunning();
    const send =
      this._driver.sendDevToolsCommand ||
      this._driver.executeCdpCommand;
    if (typeof send !== 'function') {
      throw new Error(
        '[MobileDriver] sendCdpCommand is not supported by the current ' +
        'WebDriver / Chrome combination. Upgrade selenium-webdriver or use executeScript instead.'
      );
    }
    return send.call(this._driver, method, params);
  }

  // ----------------------------------------------------------------
  //  Private helpers
  // ----------------------------------------------------------------

  // NOTE: Device metrics and user-agent are now applied directly via
  // chromeOptions.setMobileEmulation() inside start(), which is the
  // recommended stable API and does not require any post-launch CDP calls.

  /**
   * Guard that throws if the driver has not been started.
   *
   * @private
   * @throws {Error} If the driver is `null`.
   */
  _ensureRunning() {
    if (!this._driver) {
      throw new Error(
        '[MobileDriver] Driver is not running. Call start() first.'
      );
    }
  }
}

module.exports = MobileDriver;
