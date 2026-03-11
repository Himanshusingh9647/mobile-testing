'use strict';

/**
 * @file dashboard/server.js
 * @description Lightweight Node.js HTTP server that serves the testing
 * dashboard UI. No external dependencies — uses only Node built-ins.
 *
 * Endpoints:
 *   GET  /                — Dashboard HTML
 *   GET  /api/devices     — Available device profiles
 *   GET  /api/results     — All stored test results (JSON files)
 *   GET  /api/results/:file — A single result file
 *   POST /api/run         — Trigger a test run (spawns mocha child process)
 *   GET  /api/run/status  — Poll the current run status
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const url = require('url');

const PORT = process.env.PORT || 3000;
const ROOT = path.resolve(__dirname, '..');
const RESULTS_DIR = path.join(ROOT, 'test-results');
const DEVICE_PROFILES = path.join(ROOT, 'src', 'config', 'deviceProfiles.json');
const MOCHA_CLI = path.join(ROOT, 'node_modules', 'mocha', 'bin', 'mocha.js');

// ---- Run state (one run at a time) ----
let currentRun = null; // { proc, log, status, startTime, exitCode }

// ---- Helpers ----
function jsonResponse(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 1e6) { req.destroy(); reject(new Error('Payload too large')); }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

// ---- Server ----
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // --- Static: Dashboard HTML ---
  if (req.method === 'GET' && pathname === '/') {
    const htmlPath = path.join(__dirname, 'index.html');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(htmlPath).pipe(res);
    return;
  }

  // --- API: Device Profiles ---
  if (req.method === 'GET' && pathname === '/api/devices') {
    try {
      const profiles = JSON.parse(fs.readFileSync(DEVICE_PROFILES, 'utf-8'));
      jsonResponse(res, 200, profiles);
    } catch {
      jsonResponse(res, 500, { error: 'Cannot read device profiles' });
    }
    return;
  }

  // --- API: List Results ---
  if (req.method === 'GET' && pathname === '/api/results') {
    try {
      if (!fs.existsSync(RESULTS_DIR)) {
        return jsonResponse(res, 200, []);
      }
      const files = fs.readdirSync(RESULTS_DIR)
        .filter((f) => f.endsWith('.json'))
        .sort()
        .reverse();

      const results = files.map((f) => {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, f), 'utf-8'));
          return { file: f, ...data };
        } catch {
          return { file: f, error: 'Failed to parse' };
        }
      });
      jsonResponse(res, 200, results);
    } catch {
      jsonResponse(res, 500, { error: 'Cannot read results directory' });
    }
    return;
  }

  // --- API: Single Result ---
  if (req.method === 'GET' && pathname.startsWith('/api/results/')) {
    const fileName = path.basename(pathname.slice('/api/results/'.length));
    if (!fileName || fileName.includes('..')) {
      return jsonResponse(res, 400, { error: 'Invalid file name' });
    }
    const filePath = path.join(RESULTS_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      return jsonResponse(res, 404, { error: 'Not found' });
    }
    // Serve HTML reports as HTML, JSON as JSON
    if (fileName.endsWith('.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(filePath).pipe(res);
    } else {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      jsonResponse(res, 200, data);
    }
    return;
  }

  // --- API: Trigger Test Run ---
  if (req.method === 'POST' && pathname === '/api/run') {
    if (currentRun && currentRun.status === 'running') {
      return jsonResponse(res, 409, { error: 'A test run is already in progress' });
    }

    let body = {};
    try {
      const raw = await readBody(req);
      if (raw) body = JSON.parse(raw);
    } catch {
      // empty body is fine
    }

    const suite = body.suite || 'tests/**/*.test.js';
    // Validate suite path - only allow test file patterns
    if (suite.includes('..') || suite.includes(';') || suite.includes('&') || suite.includes('|')) {
      return jsonResponse(res, 400, { error: 'Invalid suite path' });
    }

    const args = [
      MOCHA_CLI,
      suite,
      '--timeout', '30000',
      '--require', './src/utils/mochaReporterHook.js',
      '--reporter', 'spec',
    ];

    if (!fs.existsSync(MOCHA_CLI)) {
      return jsonResponse(res, 500, {
        error: 'Mocha CLI not found. Run "npm install" first.',
      });
    }

    currentRun = {
      log: '',
      status: 'running',
      startTime: new Date().toISOString(),
      exitCode: null,
      suite,
    };

    const proc = spawn(process.execPath, args, { cwd: ROOT, shell: false });

    proc.stdout.on('data', (d) => { currentRun.log += d.toString(); });
    proc.stderr.on('data', (d) => { currentRun.log += d.toString(); });
    proc.on('close', (code) => {
      currentRun.status = code === 0 ? 'passed' : 'failed';
      currentRun.exitCode = code;
      currentRun.endTime = new Date().toISOString();
    });
    proc.on('error', (err) => {
      currentRun.status = 'error';
      currentRun.log += `\nProcess error: ${err.message}`;
    });

    jsonResponse(res, 202, { message: 'Test run started', suite });
    return;
  }

  // --- API: Run Status ---
  if (req.method === 'GET' && pathname === '/api/run/status') {
    if (!currentRun) {
      return jsonResponse(res, 200, { status: 'idle', message: 'No test run has been started yet' });
    }
    jsonResponse(res, 200, {
      status: currentRun.status,
      startTime: currentRun.startTime,
      endTime: currentRun.endTime || null,
      exitCode: currentRun.exitCode,
      suite: currentRun.suite,
      log: currentRun.log,
    });
    return;
  }

  // --- 404 ---
  jsonResponse(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`\n  Testing Dashboard running at http://localhost:${PORT}\n`);
});
