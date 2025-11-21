#!/usr/bin/env node
/**
 * Start Verdaccio as a detached background process that survives after this script exits.
 * Used by windowsBeforeCommand in tasks.json for Verdaccio-related tasks.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const PORT = process.env.VERDACCIO_PORT || 4873;
const TIMEOUT_SECONDS = 30;
const VERDACCIO_DIR = path.join(require('os').homedir(), 'AppData', 'Roaming', 'verdaccio');
const LOG_FILE = path.join(VERDACCIO_DIR, 'verdaccio.log');
const PID_FILE = path.join(VERDACCIO_DIR, 'verdaccio.pid');

// Check for --force flag to force restart even if running
const forceRestart = process.argv.includes('--force');

// Ensure verdaccio directory exists
if (!fs.existsSync(VERDACCIO_DIR)) {
  fs.mkdirSync(VERDACCIO_DIR, { recursive: true });
}

console.log('=== Starting Verdaccio in detached mode ===');

// Check if Verdaccio is already running
function checkIfRunning(callback) {
  http.get(`http://localhost:${PORT}/`, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      if (res.statusCode === 200 && data.includes('Verdaccio')) {
        callback(true);
      } else {
        callback(false);
      }
    });
  }).on('error', () => {
    callback(false);
  });
}

checkIfRunning((isRunning) => {
  if (isRunning && !forceRestart) {
    console.log('✓ Verdaccio is already running!');
    process.exit(0);
  }

  if (isRunning && forceRestart) {
    console.log('🔄 Forcing restart of Verdaccio...');
  }

  // If not running (or force restart), proceed with startup
  startVerdaccio();
});

function startVerdaccio() {
// Kill any existing Verdaccio processes
try {
  if (fs.existsSync(PID_FILE)) {
    const oldPid = fs.readFileSync(PID_FILE, 'utf8').trim();
    console.log(`Found existing PID file: ${oldPid}`);
    try {
      process.kill(oldPid, 0); // Check if process exists
      console.log(`Stopping process ${oldPid}...`);
      process.kill(oldPid, 'SIGTERM');
      // Give it a moment to die
      setTimeout(() => {}, 1000);
    } catch (e) {
      console.log(`Process ${oldPid} not running`);
    }
    fs.unlinkSync(PID_FILE);
  }
} catch (err) {
  console.log(`Error checking for existing process: ${err.message}`);
}

// Clear old config
console.log(`Clearing Verdaccio data at ${VERDACCIO_DIR}`);
const filesToRemove = ['config.yaml', 'storage', 'htpasswd'];
filesToRemove.forEach(f => {
  const fullPath = path.join(VERDACCIO_DIR, f);
  if (fs.existsSync(fullPath)) {
    if (fs.statSync(fullPath).isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(fullPath);
    }
    console.log(`Removed ${f}`);
  }
});

// Start Verdaccio in detached mode
const logFd = fs.openSync(LOG_FILE, 'a');

const child = spawn('verdaccio', ['--listen', `0.0.0.0:${PORT}`], {
  detached: true,
  stdio: ['ignore', logFd, logFd],
  windowsHide: true,
  shell: true
});

// Save PID so we can kill it later
fs.writeFileSync(PID_FILE, String(child.pid));
console.log(`Started Verdaccio with PID ${child.pid}`);

// Unref so parent can exit
child.unref();

// Wait for Verdaccio to be ready
function checkReady(attemptsLeft) {
  http.get(`http://localhost:${PORT}/`, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      if (res.statusCode === 200 && data.includes('Verdaccio')) {
        console.log('✓ Verdaccio is ready!');
        console.log(`Log file: ${LOG_FILE}`);
        console.log(`PID file: ${PID_FILE}`);
        process.exit(0);
      } else {
        retry(attemptsLeft);
      }
    });
  }).on('error', () => {
    retry(attemptsLeft);
  });
}

function retry(attemptsLeft) {
  if (attemptsLeft <= 0) {
    console.error('✗ Verdaccio did not become ready in time');
    console.error(`Check log: ${LOG_FILE}`);
    process.exit(1);
  }
  setTimeout(() => checkReady(attemptsLeft - 1), 1000);
}

// Start checking after a short delay
setTimeout(() => checkReady(TIMEOUT_SECONDS), 2000);
}
