'use strict';

const fs = require('fs');
const path = require('path');

/**
 * TestResultStore — Collects, stores, and exports test results in
 * JSON and HTML formats.
 *
 * Works seamlessly as a Mocha root-hook plugin or can be used
 * standalone via its API.
 *
 * @example
 * // As a Mocha root hook (register with --require):
 * //   mocha --require ./src/utils/TestResultStore.js
 *
 * // Or use programmatically:
 * const store = new TestResultStore({ outputDir: './test-results' });
 * store.addResult({ title: 'my test', status: 'passed', duration: 42 });
 * store.save();
 */
class TestResultStore {
  /**
   * @param {Object}  [options={}]
   * @param {string}  [options.outputDir='./test-results'] - Directory for result files.
   * @param {boolean} [options.saveJson=true]   - Write a JSON report.
   * @param {boolean} [options.saveHtml=true]   - Write an HTML report.
   * @param {string}  [options.suiteName='Mobile Web Tests'] - Top-level suite name.
   */
  constructor(options = {}) {
    const {
      outputDir = './test-results',
      saveJson = true,
      saveHtml = true,
      suiteName = 'Mobile Web Tests',
    } = options;

    this._outputDir = path.resolve(outputDir);
    this._saveJson = saveJson;
    this._saveHtml = saveHtml;
    this._suiteName = suiteName;

    /** @type {Array<TestResult>} */
    this._results = [];
    this._startTime = null;
    this._endTime = null;
  }

  // ----------------------------------------------------------------
  //  Public API
  // ----------------------------------------------------------------

  /** Start the timer for the overall run. */
  start() {
    this._startTime = new Date();
  }

  /** Stop the timer for the overall run. */
  finish() {
    this._endTime = new Date();
  }

  /**
   * Record a single test result.
   *
   * @param {Object} result
   * @param {string} result.title    - Test title.
   * @param {string} result.suite    - Parent suite name.
   * @param {string} result.status   - 'passed' | 'failed' | 'skipped'.
   * @param {number} result.duration - Duration in milliseconds.
   * @param {string} [result.error]  - Error message (for failed tests).
   * @param {string} [result.stack]  - Stack trace (for failed tests).
   */
  addResult(result) {
    this._results.push({
      title: result.title,
      suite: result.suite || this._suiteName,
      status: result.status,
      duration: result.duration || 0,
      error: result.error || null,
      stack: result.stack || null,
      timestamp: new Date().toISOString(),
    });
  }

  /** @returns {Array} The collected results so far. */
  get results() {
    return [...this._results];
  }

  /** @returns {{ total: number, passed: number, failed: number, skipped: number, duration: number }} */
  get summary() {
    const passed = this._results.filter((r) => r.status === 'passed').length;
    const failed = this._results.filter((r) => r.status === 'failed').length;
    const skipped = this._results.filter((r) => r.status === 'skipped').length;
    const duration =
      this._startTime && this._endTime
        ? this._endTime - this._startTime
        : this._results.reduce((sum, r) => sum + r.duration, 0);

    return {
      total: this._results.length,
      passed,
      failed,
      skipped,
      duration,
    };
  }

  /**
   * Persist results to disk (JSON and/or HTML based on options).
   * Creates the output directory if it doesn't exist.
   *
   * @returns {{ jsonPath?: string, htmlPath?: string }} Paths of written files.
   */
  save() {
    if (!fs.existsSync(this._outputDir)) {
      fs.mkdirSync(this._outputDir, { recursive: true });
    }

    const timestamp = (this._startTime || new Date())
      .toISOString()
      .replace(/[:.]/g, '-');
    const written = {};

    if (this._saveJson) {
      const jsonPath = path.join(this._outputDir, `results-${timestamp}.json`);
      const payload = {
        suiteName: this._suiteName,
        startTime: this._startTime ? this._startTime.toISOString() : null,
        endTime: this._endTime ? this._endTime.toISOString() : null,
        summary: this.summary,
        results: this._results,
      };
      fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf-8');
      written.jsonPath = jsonPath;
      console.log(`[TestResultStore] JSON report saved → ${jsonPath}`);
    }

    if (this._saveHtml) {
      const htmlPath = path.join(this._outputDir, `report-${timestamp}.html`);
      fs.writeFileSync(htmlPath, this._buildHtml(), 'utf-8');
      written.htmlPath = htmlPath;
      console.log(`[TestResultStore] HTML report saved → ${htmlPath}`);
    }

    return written;
  }

  /** Remove all stored results and reset timers. */
  reset() {
    this._results = [];
    this._startTime = null;
    this._endTime = null;
  }

  // ----------------------------------------------------------------
  //  Private helpers
  // ----------------------------------------------------------------

  /**
   * Build a self-contained HTML report string.
   * @private
   * @returns {string}
   */
  _buildHtml() {
    const { total, passed, failed, skipped, duration } = this.summary;
    const statusClass = failed > 0 ? 'fail' : 'pass';

    const rows = this._results
      .map(
        (r) => `
      <tr class="row-${r.status}">
        <td>${this._escapeHtml(r.suite)}</td>
        <td>${this._escapeHtml(r.title)}</td>
        <td class="status-${r.status}">${r.status.toUpperCase()}</td>
        <td>${r.duration} ms</td>
        <td class="error-cell">${r.error ? this._escapeHtml(r.error) : '—'}</td>
      </tr>`
      )
      .join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Test Report — ${this._escapeHtml(this._suiteName)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
         background: #0d1117; color: #c9d1d9; padding: 2rem; }
  h1 { margin-bottom: 0.5rem; color: #f0f6fc; }
  .meta { color: #8b949e; margin-bottom: 1.5rem; font-size: 0.9rem; }
  .summary { display: flex; gap: 1rem; margin-bottom: 2rem; flex-wrap: wrap; }
  .badge { padding: 0.5rem 1.2rem; border-radius: 6px; font-weight: 600; font-size: 0.95rem; }
  .badge-total    { background: #161b22; border: 1px solid #30363d; }
  .badge-passed   { background: #0d1f0d; border: 1px solid #238636; color: #3fb950; }
  .badge-failed   { background: #1f0d0d; border: 1px solid #da3633; color: #f85149; }
  .badge-skipped  { background: #1f1a0d; border: 1px solid #9e6a03; color: #d29922; }
  .badge-duration { background: #161b22; border: 1px solid #30363d; color: #8b949e; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 2rem; }
  th { text-align: left; padding: 0.75rem 1rem; background: #161b22;
       border-bottom: 2px solid #30363d; color: #8b949e; font-size: 0.85rem;
       text-transform: uppercase; letter-spacing: 0.05em; }
  td { padding: 0.65rem 1rem; border-bottom: 1px solid #21262d; font-size: 0.9rem; }
  .status-passed { color: #3fb950; font-weight: 600; }
  .status-failed { color: #f85149; font-weight: 600; }
  .status-skipped { color: #d29922; font-weight: 600; }
  .row-failed { background: rgba(248,81,73,0.05); }
  .error-cell { font-family: 'SF Mono', monospace; font-size: 0.8rem; color: #f85149;
                max-width: 400px; word-break: break-word; }
  .banner { padding: 1rem; border-radius: 6px; text-align: center; font-size: 1.1rem; font-weight: 600; }
  .banner.pass { background: #0d1f0d; border: 1px solid #238636; color: #3fb950; }
  .banner.fail { background: #1f0d0d; border: 1px solid #da3633; color: #f85149; }
</style>
</head>
<body>
  <h1>Test Report</h1>
  <p class="meta">${this._escapeHtml(this._suiteName)} &mdash; ${this._startTime ? this._startTime.toLocaleString() : 'N/A'}</p>

  <div class="summary">
    <span class="badge badge-total">Total: ${total}</span>
    <span class="badge badge-passed">Passed: ${passed}</span>
    <span class="badge badge-failed">Failed: ${failed}</span>
    <span class="badge badge-skipped">Skipped: ${skipped}</span>
    <span class="badge badge-duration">Duration: ${(duration / 1000).toFixed(2)}s</span>
  </div>

  <table>
    <thead>
      <tr><th>Suite</th><th>Test</th><th>Status</th><th>Duration</th><th>Error</th></tr>
    </thead>
    <tbody>${rows}
    </tbody>
  </table>

  <div class="banner ${statusClass}">
    ${failed === 0 ? 'ALL TESTS PASSED' : `${failed} TEST(S) FAILED`}
  </div>
</body>
</html>`;
  }

  /**
   * Escape HTML special characters to prevent XSS in the report.
   * @private
   * @param {string} str
   * @returns {string}
   */
  _escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

module.exports = TestResultStore;
