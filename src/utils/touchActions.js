'use strict';

/**
 * @module touchActions
 * @description Utility module that provides mobile-style touch interactions
 * on top of a Selenium WebDriver session with CDP emulation enabled.
 *
 * All methods accept a Selenium WebDriver instance (the same one created by
 * {@link MobileDriver#start}) and translate standard interactions into
 * touch-appropriate equivalents using JavaScript injection and/or CDP
 * Input.dispatchTouchEvent commands.
 *
 * @example
 * const { MobileDriver }  = require('mobile-web-testing-framework');
 * const { tap, swipeUp }  = require('mobile-web-testing-framework/src/utils/touchActions');
 *
 * const mobile = new MobileDriver('iPhone_15');
 * const driver = await mobile.start();
 * await driver.get('https://example.com');
 * await tap(driver, 'a.nav-link');
 * await swipeUp(driver);
 * await mobile.stop();
 */

const { By, until } = require('selenium-webdriver');

// ----------------------------------------------------------------
//  Constants
// ----------------------------------------------------------------

/** Default duration (ms) for swipe animations. */
const DEFAULT_SWIPE_DURATION = 600;

/** Default pause (ms) between touch-start and touch-move steps. */
const DEFAULT_STEP_PAUSE = 50;

/** Default timeout (ms) when waiting for an element to be located. */
const DEFAULT_WAIT_TIMEOUT = 10000;

// ----------------------------------------------------------------
//  Public API
// ----------------------------------------------------------------

/**
 * Performs a *tap* (touch-click) on the element identified by `selector`.
 *
 * Under the hood this:
 *  1. Waits for the element to be present in the DOM.
 *  2. Scrolls it into view.
 *  3. Dispatches a synthetic `touchstart` → `touchend` → `click` sequence
 *     via JavaScript injection so that mobile event listeners fire correctly.
 *
 * @param {import('selenium-webdriver').WebDriver} driver
 *   An active WebDriver instance (from {@link MobileDriver#start}).
 * @param {string} selector
 *   A CSS selector that uniquely identifies the target element.
 * @param {Object} [options={}]
 * @param {number} [options.timeout=10000] - Max ms to wait for the element.
 * @returns {Promise<void>}
 * @throws {Error} If the element cannot be found within the timeout.
 */
async function tap(driver, selector, { timeout = DEFAULT_WAIT_TIMEOUT } = {}) {
  _assertDriver(driver);

  // Wait for element
  const el = await driver.wait(
    until.elementLocated(By.css(selector)),
    timeout,
    `[touchActions.tap] Element not found: "${selector}" within ${timeout}ms`
  );

  // Scroll into view + synthetic touch sequence
  await driver.executeScript(`
    const el = document.querySelector(arguments[0]);
    if (!el) throw new Error('Element not found: ' + arguments[0]);

    el.scrollIntoView({ block: 'center', behavior: 'instant' });

    const rect  = el.getBoundingClientRect();
    const cx    = rect.left + rect.width  / 2;
    const cy    = rect.top  + rect.height / 2;
    const touch = new Touch({
      identifier : Date.now(),
      target     : el,
      clientX    : cx,
      clientY    : cy,
    });

    el.dispatchEvent(new TouchEvent('touchstart', {
      bubbles: true, cancelable: true, touches: [touch], targetTouches: [touch], changedTouches: [touch]
    }));
    el.dispatchEvent(new TouchEvent('touchend', {
      bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: [touch]
    }));
    el.click();
  `, selector);
}

/**
 * Performs a *long press* (touch-and-hold) on the element matching `selector`.
 *
 * @param {import('selenium-webdriver').WebDriver} driver
 * @param {string} selector - CSS selector.
 * @param {Object} [options={}]
 * @param {number} [options.holdTime=1000] - Duration in ms to hold before release.
 * @param {number} [options.timeout=10000] - Max ms to wait for the element.
 * @returns {Promise<void>}
 */
async function longPress(driver, selector, { holdTime = 1000, timeout = DEFAULT_WAIT_TIMEOUT } = {}) {
  _assertDriver(driver);

  const el = await driver.wait(
    until.elementLocated(By.css(selector)),
    timeout,
    `[touchActions.longPress] Element not found: "${selector}" within ${timeout}ms`
  );

  // Scroll into view, then dispatch touchstart, hold for holdTime, then touchend
  await driver.executeScript(`
    const el = document.querySelector(arguments[0]);
    if (!el) throw new Error('Element not found: ' + arguments[0]);
    el.scrollIntoView({ block: 'center', behavior: 'instant' });

    const rect  = el.getBoundingClientRect();
    const cx    = rect.left + rect.width  / 2;
    const cy    = rect.top  + rect.height / 2;
    const touch = new Touch({ identifier: Date.now(), target: el, clientX: cx, clientY: cy });

    el.dispatchEvent(new TouchEvent('touchstart', {
      bubbles: true, cancelable: true, touches: [touch], targetTouches: [touch], changedTouches: [touch]
    }));
  `, selector);

  // Hold for the specified duration outside the script context
  await _sleep(holdTime);

  await driver.executeScript(`
    const el = document.querySelector(arguments[0]);
    if (!el) return;
    const rect  = el.getBoundingClientRect();
    const cx    = rect.left + rect.width  / 2;
    const cy    = rect.top  + rect.height / 2;
    const touch = new Touch({ identifier: Date.now(), target: el, clientX: cx, clientY: cy });
    el.dispatchEvent(new TouchEvent('touchend', {
      bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: [touch]
    }));
  `, selector);
}

/**
 * Simulates a vertical **swipe up** gesture (scroll down) using CDP
 * `Input.dispatchTouchEvent`.
 *
 * Dispatches a `touchStart` in the lower half of the viewport, then a series
 * of `touchMove` events progressing upward, followed by `touchEnd`.
 *
 * @param {import('selenium-webdriver').WebDriver} driver
 * @param {Object} [options={}]
 * @param {number} [options.distance=400]  - Pixels to swipe.
 * @param {number} [options.duration=600]  - Total swipe time in ms.
 * @param {number} [options.steps=10]      - Number of intermediate move events.
 * @returns {Promise<void>}
 */
async function swipeUp(driver, { distance = 400, duration = DEFAULT_SWIPE_DURATION, steps = 10 } = {}) {
  _assertDriver(driver);
  await _cdpSwipe(driver, { startX: 200, startY: 600, endX: 200, endY: 600 - distance, duration, steps });
}

/**
 * Simulates a vertical **swipe down** gesture (scroll up) using CDP.
 *
 * @param {import('selenium-webdriver').WebDriver} driver
 * @param {Object} [options={}]
 * @param {number} [options.distance=400]
 * @param {number} [options.duration=600]
 * @param {number} [options.steps=10]
 * @returns {Promise<void>}
 */
async function swipeDown(driver, { distance = 400, duration = DEFAULT_SWIPE_DURATION, steps = 10 } = {}) {
  _assertDriver(driver);
  await _cdpSwipe(driver, { startX: 200, startY: 200, endX: 200, endY: 200 + distance, duration, steps });
}

/**
 * Simulates a horizontal **swipe left** gesture using CDP.
 *
 * @param {import('selenium-webdriver').WebDriver} driver
 * @param {Object} [options={}]
 * @param {number} [options.distance=300]
 * @param {number} [options.duration=600]
 * @param {number} [options.steps=10]
 * @returns {Promise<void>}
 */
async function swipeLeft(driver, { distance = 300, duration = DEFAULT_SWIPE_DURATION, steps = 10 } = {}) {
  _assertDriver(driver);
  await _cdpSwipe(driver, { startX: 350, startY: 400, endX: 350 - distance, endY: 400, duration, steps });
}

/**
 * Simulates a horizontal **swipe right** gesture using CDP.
 *
 * @param {import('selenium-webdriver').WebDriver} driver
 * @param {Object} [options={}]
 * @param {number} [options.distance=300]
 * @param {number} [options.duration=600]
 * @param {number} [options.steps=10]
 * @returns {Promise<void>}
 */
async function swipeRight(driver, { distance = 300, duration = DEFAULT_SWIPE_DURATION, steps = 10 } = {}) {
  _assertDriver(driver);
  await _cdpSwipe(driver, { startX: 50, startY: 400, endX: 50 + distance, endY: 400, duration, steps });
}

/**
 * Scrolls the page by a given vertical pixel amount using `window.scrollBy`.
 * Useful as a simpler alternative to swipe when you just need content movement.
 *
 * @param {import('selenium-webdriver').WebDriver} driver
 * @param {number} [pixels=500] - Positive = scroll down, negative = scroll up.
 * @returns {Promise<void>}
 */
async function scrollByPixels(driver, pixels = 500) {
  _assertDriver(driver);
  await driver.executeScript(`window.scrollBy({ top: ${pixels}, behavior: 'smooth' })`);
  // Allow the smooth scroll animation to settle
  await _sleep(400);
}

// ----------------------------------------------------------------
//  Private helpers
// ----------------------------------------------------------------

/**
 * Simulates a pointer-based swipe from (startX, startY) → (endX, endY) using
 * Selenium's W3C Actions API.
 *
 * This approach works with Chrome's mobileEmulation mode and does not require
 * a raw CDP connection (`executeCdpCommand` / `sendDevToolsCommand`).
 *
 * @private
 * @param {import('selenium-webdriver').WebDriver} driver
 * @param {Object} coords
 * @param {number} coords.startX
 * @param {number} coords.startY
 * @param {number} coords.endX
 * @param {number} coords.endY
 * @param {number} coords.duration - Swipe duration in ms.
 * @param {number} coords.steps   - Intermediate move steps (unused; Selenium interpolates).
 * @returns {Promise<void>}
 */
async function _cdpSwipe(driver, { startX, startY, endX, endY, duration }) {
  const actions = driver.actions({ async: true });

  await actions
    .move({ origin: 'viewport', x: Math.round(startX), y: Math.round(startY) })
    .press()
    .move({ origin: 'viewport', x: Math.round(endX), y: Math.round(endY), duration })
    .release()
    .perform();
}

/**
 * Promise-based sleep helper.
 *
 * @private
 * @param {number} ms - Milliseconds to wait.
 * @returns {Promise<void>}
 */
function _sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Validates that a WebDriver instance was provided.
 *
 * @private
 * @param {*} driver
 * @throws {Error} If `driver` is falsy.
 */
function _assertDriver(driver) {
  if (!driver) {
    throw new Error(
      '[touchActions] A valid WebDriver instance is required. ' +
      'Pass the driver returned by MobileDriver.start().'
    );
  }
}

// ----------------------------------------------------------------
//  Exports
// ----------------------------------------------------------------

module.exports = {
  tap,
  longPress,
  swipeUp,
  swipeDown,
  swipeLeft,
  swipeRight,
  scrollByPixels,
};
