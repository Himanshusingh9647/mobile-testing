'use strict';

/**
 * @file mochaReporterHook.js
 * @description Mocha root-hook plugin that automatically wires every test
 * result into a {@link TestResultStore} and writes JSON + HTML reports
 * when the suite finishes.
 *
 * Usage:
 *   mocha --require ./src/utils/mochaReporterHook.js tests/**\/*.test.js
 *
 * Or specify it in .mocharc.yml:
 *   require:
 *     - ./src/utils/mochaReporterHook.js
 */

const TestResultStore = require('./TestResultStore');

const store = new TestResultStore({
  outputDir: './test-results',
  saveJson: true,
  saveHtml: true,
  suiteName: 'Mobile Web Testing Framework',
});

module.exports = {
  mochaHooks: {
    beforeAll() {
      store.start();
    },

    afterEach() {
      const test = this.currentTest;
      store.addResult({
        title: test.title,
        suite: test.parent ? test.parent.title : 'Unknown Suite',
        status: test.state === 'passed' ? 'passed' : test.pending ? 'skipped' : 'failed',
        duration: test.duration || 0,
        error: test.err ? test.err.message : null,
        stack: test.err ? test.err.stack : null,
      });
    },

    afterAll() {
      store.finish();
      const { jsonPath, htmlPath } = store.save();
      const { total, passed, failed, skipped, duration } = store.summary;

      console.log('\n┌─────────────────────────────────────');
      console.log('│  Test Results Summary');
      console.log('├─────────────────────────────────────');
      console.log(`│  Total:    ${total}`);
      console.log(`│  Passed:   ${passed}`);
      console.log(`│  Failed:   ${failed}`);
      console.log(`│  Skipped:  ${skipped}`);
      console.log(`│  Duration: ${(duration / 1000).toFixed(2)}s`);
      console.log('├─────────────────────────────────────');
      if (jsonPath) console.log(`│  JSON → ${jsonPath}`);
      if (htmlPath) console.log(`│  HTML → ${htmlPath}`);
      console.log('└─────────────────────────────────────\n');
    },
  },
};
