#!/usr/bin/env node

/**
 * Run all test suites and display aggregate results
 */

const { spawnSync } = require('child_process');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const os = require('os');

const tests = [
  { name: 'Special Commands', script: 'npm run test-special-commands', color: 'cyan' },
  { name: 'Environment Issue Detection', script: 'npm run test-env-issue', color: 'yellow' },
  { name: 'Main CLI Tasks', script: 'node test-cli.js', color: 'green' }
];

const results = [];
let totalPassed = 0;
let totalFailed = 0;
let totalSkipped = 0;
let totalTests = 0;

console.log(chalk.bold.cyan('\n========================================'));
console.log(chalk.bold.cyan('Running All Test Suites'));
console.log(chalk.bold.cyan('========================================\n'));

for (const test of tests) {
  console.log(chalk.bold[test.color](`\n▶ Running: ${test.name}...`));
  console.log(chalk.gray('─'.repeat(60)) + '\n');
  
  // Create temporary file to capture output for parsing
  const tempFile = path.join(os.tmpdir(), `test-output-${Date.now()}.txt`);
  
  try {
    // Use tee to show output in real-time AND capture it
    const teeCommand = process.platform === 'win32' 
      ? `${test.script} 2>&1 | tee ${tempFile}`
      : `${test.script} 2>&1 | tee ${tempFile}`;
    
    const result = spawnSync(teeCommand, {
      shell: true,
      stdio: 'inherit',
      encoding: 'utf8'
    });
    
    // Read captured output for parsing
    let output = '';
    try {
      output = fs.readFileSync(tempFile, 'utf8');
      fs.unlinkSync(tempFile); // Clean up
    } catch (e) {
      // If tee not available, fall back to direct execution
    }
    
    // Parse results from output
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    let total = 0;
    
    // Match different test output formats
    const passedMatch = output.match(/(?:Passed|✅ Passed):\s*(\d+)/i);
    const failedMatch = output.match(/(?:Failed|❌ Failed):\s*(\d+)/i);
    const skippedMatch = output.match(/(?:Skipped|⏭️\s*Skipped):\s*(\d+)/i);
    const totalMatch = output.match(/(?:Total|📝 Total):\s*(\d+)/i);
    
    if (passedMatch) passed = parseInt(passedMatch[1]);
    if (failedMatch) failed = parseInt(failedMatch[1]);
    if (skippedMatch) skipped = parseInt(skippedMatch[1]);
    if (totalMatch) total = parseInt(totalMatch[1]);
    
    // If no explicit total, calculate it
    if (!total && (passed || failed || skipped)) {
      total = passed + failed + skipped;
    }
    
    const success = result.status === 0 && failed === 0;
    
    results.push({
      name: test.name,
      passed,
      failed,
      skipped,
      total,
      success
    });
    
    totalPassed += passed;
    totalFailed += failed;
    totalSkipped += skipped;
    totalTests += total;
    
  } catch (error) {
    // Test suite failed - this shouldn't happen with spawnSync but just in case
    console.error(chalk.red(`Error running ${test.name}: ${error.message}`));
    
    results.push({
      name: test.name,
      passed: 0,
      failed: 1,
      skipped: 0,
      total: 1,
      success: false
    });
    
    totalFailed += 1;
    totalTests += 1;
  }
}

// Display aggregate summary
console.log('\n');
console.log(chalk.bold.cyan('========================================'));
console.log(chalk.bold.cyan('AGGREGATE TEST RESULTS'));
console.log(chalk.bold.cyan('========================================\n'));

// Individual suite results
results.forEach(result => {
  const icon = result.success ? '✓' : '✗';
  const color = result.success ? 'green' : 'red';
  console.log(chalk[color].bold(`${icon} ${result.name}`));
  console.log(chalk.gray(`  Total: ${result.total} | Passed: ${chalk.green(result.passed)} | Failed: ${chalk.red(result.failed)} | Skipped: ${chalk.yellow(result.skipped)}`));
});

console.log('\n' + chalk.gray('─'.repeat(60)));

// Overall totals
console.log(chalk.bold('\n📊 Overall Results:'));
console.log(chalk.gray(`  Total Tests:  ${totalTests}`));
console.log(chalk.green(`  ✓ Passed:     ${totalPassed}`));
console.log(chalk.red(`  ✗ Failed:     ${totalFailed}`));
console.log(chalk.yellow(`  ⊘ Skipped:    ${totalSkipped}`));

// Success rate
const successRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : 0;
console.log(chalk.cyan(`  Success Rate: ${successRate}%`));

console.log('\n' + chalk.bold.cyan('========================================\n'));

// Exit with appropriate code
const exitCode = totalFailed > 0 ? 1 : 0;
process.exit(exitCode);
