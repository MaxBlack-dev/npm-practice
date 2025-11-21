#!/usr/bin/env node
/**
 * Test script to verify retry command works on Windows
 */

const { handleRetry } = require('./lib/commands');
const path = require('path');

const context = {
  tasks: [],
  progressFile: path.join(__dirname, 'progress.json'),
  currentTaskIndex: 52, // Task 53 (0-indexed)
  showCount: 0
};

console.log('Testing retry command on Windows...\n');
console.log('Before retry:');
const fs = require('fs');
const VERDACCIO_DIR = path.join(require('os').homedir(), 'AppData', 'Roaming', 'verdaccio');
console.log(`Verdaccio dir exists: ${fs.existsSync(VERDACCIO_DIR)}`);
if (fs.existsSync(VERDACCIO_DIR)) {
  console.log('Contents:', fs.readdirSync(VERDACCIO_DIR));
}

console.log('\nRunning retry...\n');
const result = handleRetry(context);

console.log('\nAfter retry:');
console.log(`Verdaccio dir exists: ${fs.existsSync(VERDACCIO_DIR)}`);
if (fs.existsSync(VERDACCIO_DIR)) {
  console.log('Contents:', fs.readdirSync(VERDACCIO_DIR));
}

console.log(`\nResult: ${JSON.stringify(result, null, 2)}`);
