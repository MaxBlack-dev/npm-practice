#!/usr/bin/env node

/**
 * Test suite for special commands in npm-practice CLI
 * Tests: show, explain, exit, reset, retry, skip
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const TEST_WORKSPACE = path.join(__dirname, 'test-special-commands-workspace');
const PROGRESS_FILE = path.join(TEST_WORKSPACE, 'progress.json');

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName) {
  console.log(`\n${colors.bold}${colors.cyan}Testing: ${testName}${colors.reset}`);
}

function logPass(message) {
  log(`✓ ${message}`, 'green');
}

function logFail(message) {
  log(`✗ ${message}`, 'red');
}

function logSkip(message) {
  log(`⊘ ${message}`, 'yellow');
}

/**
 * Clean up test workspace
 */
function cleanupWorkspace() {
  if (fs.existsSync(TEST_WORKSPACE)) {
    fs.rmSync(TEST_WORKSPACE, { recursive: true, force: true });
  }
}

/**
 * Create fresh test workspace
 */
function setupWorkspace() {
  cleanupWorkspace();
  fs.mkdirSync(TEST_WORKSPACE, { recursive: true });
}

/**
 * Run npm-practice CLI with given inputs
 */
function runCLI(inputs, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const cliPath = path.join(__dirname, 'index.js');
    const child = spawn('node', [cliPath], {
      cwd: TEST_WORKSPACE,
      env: { 
        ...process.env, 
        NODE_ENV: 'test',
        NPM_PRACTICE_PROGRESS_FILE: PROGRESS_FILE
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let currentInputIndex = 0;
    let promptCount = 0;

    child.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      
      // Count prompts and send inputs
      const newPrompts = (output.match(/> /g) || []).length;
      promptCount += newPrompts;
      
      // Send inputs when we see the prompt
      if (newPrompts > 0 && currentInputIndex < inputs.length) {
        setTimeout(() => {
          if (currentInputIndex < inputs.length) {
            child.stdin.write(inputs[currentInputIndex] + '\n');
            currentInputIndex++;
          }
        }, 200);
      }
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ code, stdout, stderr, promptCount, inputsSent: currentInputIndex });
    });

    child.on('error', (err) => {
      reject(err);
    });

    // Timeout handling
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, 1000);
      reject(new Error(`Test timeout after ${timeout}ms. Sent ${currentInputIndex}/${inputs.length} inputs, saw ${promptCount} prompts`));
    }, timeout);

    child.on('close', () => {
      clearTimeout(timer);
    });
  });
}

/**
 * Read progress file
 */
function readProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
  }
  return null;
}

/**
 * Test 'show' command
 */
async function testShowCommand() {
  logTest("'show' command - reveals answer and increments showCount");
  
  setupWorkspace();
  
  try {
    // Run CLI: start task, use 'show', then exit
    const result = await runCLI(['show', 'exit']);
    
    // Debug output
    if (process.env.DEBUG) {
      console.log('STDOUT:', result.stdout.substring(0, 500));
      console.log('STDERR:', result.stderr.substring(0, 500));
    }
    
    // Check that answer was revealed
    if (!result.stdout.includes('💡 Answer:') && 
        !result.stdout.includes('Expected command:') && 
        !result.stdout.includes('npm help')) {
      logFail("'show' command did not reveal the answer");
      console.log('  Looked for: 💡 Answer:, Expected command:, or npm help');
      console.log('  Output preview:', result.stdout.substring(0, 300).replace(/\n/g, '\\n'));
      return false;
    }
    
    // Check progress file for showCount
    const progress = readProgress();
    if (!progress) {
      logFail("Progress file not created");
      console.log('  Expected file at:', PROGRESS_FILE);
      return false;
    }
    
    if (progress.showCount !== 1) {
      logFail(`showCount should be 1, but got ${progress.showCount}`);
      return false;
    }
    
    logPass("'show' command revealed answer and incremented showCount");
    return true;
  } catch (error) {
    logFail(`Test failed with error: ${error.message}`);
    return false;
  }
}

/**
 * Test 'explain' command
 */
async function testExplainCommand() {
  logTest("'explain' command - shows task explanation");
  
  setupWorkspace();
  
  try {
    // Run CLI: use 'explain', then exit
    const result = await runCLI(['explain', 'exit']);
    
    // Check that explanation was shown
    if (!result.stdout.includes('📘 Explanation for') && !result.stdout.includes('Explanation for')) {
      logFail("'explain' command did not show explanation");
      console.log('  Output preview:', result.stdout.substring(0, 500).replace(/\n/g, '\\n'));
      return false;
    }
    
    // First task explanation should contain something about npm help
    if (!result.stdout.toLowerCase().includes('help') && 
        !result.stdout.toLowerCase().includes('displays')) {
      logFail("Explanation content not found");
      return false;
    }
    
    logPass("'explain' command showed task explanation");
    return true;
  } catch (error) {
    logFail(`Test failed with error: ${error.message}`);
    return false;
  }
}

/**
 * Test 'skip' command
 */
async function testSkipCommand() {
  logTest("'skip' command - auto-executes and advances to next task");
  
  setupWorkspace();
  
  try {
    // Run CLI: skip first task, then exit
    const result = await runCLI(['skip', 'exit']);
    
    // Check that command was executed
    if (!result.stdout.includes('npm help') && !result.stdout.includes('Skipping')) {
      logFail("'skip' command did not execute and skip the task");
      console.log('  Output preview:', result.stdout.substring(0, 500).replace(/\n/g, '\\n'));
      return false;
    }
    
    // Check progress file to see we advanced
    const progress = readProgress();
    if (!progress) {
      logFail("Progress file not created");
      return false;
    }
    
    if (progress.currentTaskIndex < 1) {
      logFail(`currentTaskIndex should be >= 1, but got ${progress.currentTaskIndex}`);
      return false;
    }
    
    logPass("'skip' command executed task and advanced");
    return true;
  } catch (error) {
    logFail(`Test failed with error: ${error.message}`);
    return false;
  }
}

/**
 * Test 'exit' command
 */
async function testExitCommand() {
  logTest("'exit' command - exits CLI gracefully");
  
  setupWorkspace();
  
  try {
    // Run CLI: immediately exit
    const result = await runCLI(['exit']);
    
    // Check exit code is 0 (graceful exit)
    if (result.code !== 0) {
      logFail(`Exit code should be 0, but got ${result.code}`);
      return false;
    }
    
    // Check goodbye message
    if (!result.stdout.includes('Goodbye') && !result.stdout.includes('goodbye') && !result.stdout.includes('See you')) {
      logFail("No goodbye message on exit");
      console.log('  Output preview:', result.stdout.substring(0, 500).replace(/\n/g, '\\n'));
      return false;
    }
    
    logPass("'exit' command exits gracefully");
    return true;
  } catch (error) {
    logFail(`Test failed with error: ${error.message}`);
    return false;
  }
}

/**
 * Test 'reset' command
 */
async function testResetCommand() {
  logTest("'reset' command - resets workspace and progress");
  
  setupWorkspace();
  
  try {
    // First, make some progress
    await runCLI(['skip', 'exit']);
    
    // Verify we have progress
    let progress = readProgress();
    if (!progress || progress.currentTaskIndex < 1) {
      logFail("Could not establish initial progress for reset test");
      return false;
    }
    
    // Create a test file in workspace to verify cleanup
    const testFile = path.join(TEST_WORKSPACE, 'my-npm-project', 'test-file.txt');
    const myNpmProjectDir = path.join(TEST_WORKSPACE, 'my-npm-project');
    if (!fs.existsSync(myNpmProjectDir)) {
      fs.mkdirSync(myNpmProjectDir, { recursive: true });
    }
    fs.writeFileSync(testFile, 'test content');
    
    // Run reset command
    const result = await runCLI(['reset', 'y', 'exit'], 15000);
    
    // Check that reset message appeared
    if (!result.stdout.includes('reset') && !result.stdout.includes('Reset')) {
      logFail("Reset confirmation not shown");
      return false;
    }
    
    // Check progress was reset
    progress = readProgress();
    if (!progress || progress.currentTaskIndex !== 0) {
      logFail("Progress was not reset to task 0");
      return false;
    }
    
    if (progress.showCount !== 0) {
      logFail("showCount was not reset to 0");
      return false;
    }
    
    // Check test file was removed
    if (fs.existsSync(testFile)) {
      logFail("Workspace files were not cleaned up");
      return false;
    }
    
    logPass("'reset' command reset progress and cleaned workspace");
    return true;
  } catch (error) {
    logFail(`Test failed with error: ${error.message}`);
    return false;
  }
}

/**
 * Test 'retry' command
 */
async function testRetryCommand() {
  logTest("'retry' command - resets and reruns from start");
  
  setupWorkspace();
  
  try {
    // Make some progress first
    await runCLI(['skip', 'exit']);
    
    // Verify we have progress
    let progress = readProgress();
    const initialTaskIndex = progress.currentTaskIndex;
    
    if (initialTaskIndex < 1) {
      logFail("Could not establish initial progress for retry test");
      return false;
    }
    
    // Run retry command (it should reset and restart)
    const result = await runCLI(['retry', 'y', 'exit'], 15000);
    
    // Check that retry/reset message appeared
    if (!result.stdout.includes('reset') && !result.stdout.includes('Reset') && 
        !result.stdout.includes('retry') && !result.stdout.includes('Retry')) {
      logFail("Retry/reset confirmation not shown");
      return false;
    }
    
    // Check progress was reset
    progress = readProgress();
    if (!progress || progress.currentTaskIndex > 1) {
      logFail(`Progress was not reset - currentTaskIndex is ${progress?.currentTaskIndex}`);
      console.log('  Expected currentTaskIndex to be 0 or 1 after retry');
      return false;
    }
    
    logPass("'retry' command reset progress and workspace");
    return true;
  } catch (error) {
    logFail(`Test failed with error: ${error.message}`);
    return false;
  }
}

/**
 * Test 'show' command multiple times to verify showCount tracking
 */
async function testShowCountTracking() {
  logTest("'show' command - tracks multiple uses in showCount");
  
  setupWorkspace();
  
  try {
    // Use show twice
    await runCLI(['show', 'exit']);
    await runCLI(['show', 'exit']);
    await runCLI(['show', 'exit']);
    
    // Check showCount is 3
    const progress = readProgress();
    if (!progress) {
      logFail("Progress file not found");
      return false;
    }
    
    if (progress.showCount !== 3) {
      logFail(`showCount should be 3, but got ${progress.showCount}`);
      return false;
    }
    
    logPass("showCount correctly tracks multiple 'show' uses");
    return true;
  } catch (error) {
    logFail(`Test failed with error: ${error.message}`);
    return false;
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log(`${colors.bold}${colors.cyan}========================================`);
  console.log(`Special Commands Test Suite`);
  console.log(`========================================${colors.reset}\n`);
  
  const tests = [
    { name: "'show' command", fn: testShowCommand },
    { name: "'explain' command", fn: testExplainCommand },
    { name: "'skip' command", fn: testSkipCommand },
    { name: "'exit' command", fn: testExitCommand },
    { name: "'reset' command", fn: testResetCommand },
    { name: "'retry' command", fn: testRetryCommand },
    { name: "showCount tracking", fn: testShowCountTracking }
  ];
  
  let passed = 0;
  let failed = 0;
  const failedTests = [];
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passed++;
      } else {
        failed++;
        failedTests.push(test.name);
      }
    } catch (error) {
      failed++;
      failedTests.push(test.name);
      logFail(`${test.name} threw an error: ${error.message}`);
    }
  }
  
  // Cleanup
  cleanupWorkspace();
  
  // Summary
  console.log(`\n${colors.bold}${colors.cyan}========================================`);
  console.log(`Test Summary`);
  console.log(`========================================${colors.reset}`);
  console.log(`Total: ${tests.length} tests`);
  log(`Passed: ${passed}`, 'green');
  
  if (failed > 0) {
    log(`Failed: ${failed}`, 'red');
    console.log('\nFailed tests:');
    failedTests.forEach(name => {
      log(`  - ${name}`, 'red');
    });
  }
  
  console.log('');
  
  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('Fatal error running tests:', error);
    process.exit(1);
  });
}

module.exports = { runAllTests };
