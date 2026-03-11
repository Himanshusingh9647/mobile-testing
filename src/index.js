'use strict';

/**
 * @module mobile-web-testing-framework
 * @description Internal barrel export — re-exports every public module from `src/`.
 */

const MobileDriver    = require('./core/MobileDriver');
const touchActions    = require('./utils/touchActions');
const deviceProfiles  = require('./config/deviceProfiles.json');
const TestResultStore = require('./utils/TestResultStore');

module.exports = {
  MobileDriver,
  touchActions,
  deviceProfiles,
  TestResultStore,
};
