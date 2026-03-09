'use strict';

/**
 * @module mobile-web-testing-framework
 * @description Public entry point for the mobile-web-testing-framework NPM package.
 *
 * Exports:
 *  - {@link MobileDriver}  — Core Selenium + CDP emulation wrapper.
 *  - {@link touchActions}   — Mobile touch interaction utilities.
 *  - {@link deviceProfiles} — Built-in device profiles (JSON).
 *
 * @example
 * const { MobileDriver, touchActions } = require('mobile-web-testing-framework');
 */

module.exports = require('./src');
