const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const tasks = require('./tasks.json');
const testRootDir = path.join(__dirname, 'test-environment');
const testDir = path.join(testRootDir, 'my-npm-project');
const progressFile = path.join(testRootDir, 'progress.json');

let passedCount = 0;
let failedCount = 0;
let skippedCount = 0;

function runCommand(command, options = {}) {
    // Determine timeout based on command type
    let timeout = 10000; // Default 10 seconds
    
    // npm install/update commands need more time to download packages
    if (command.includes('npm install') || 
        command.includes('npm update') || 
        command.includes('npm ci') ||
        command.includes('npm rebuild')) {
        timeout = 60000; // 60 seconds for install operations
    }
    
    // Global operations might take longer
    if (command.includes('npm install -g') || command.includes('npm uninstall -g')) {
        timeout = 90000; // 90 seconds for global operations
    }
    
    // Cache operations can be slow
    if (command.includes('npm cache')) {
        timeout = 30000; // 30 seconds for cache operations
    }
    
    // Verdaccio startup with initialization needs more time
    if (command.includes('verdaccio') && command.includes('for i in')) {
        timeout = 30000; // 30 seconds for Verdaccio startup with wait loop
    }
    
    // Use spawnSync to capture both stdout and stderr
    // npm writes notices and warnings to stderr even on success
    const result = spawnSync('/bin/sh', ['-c', command], {
        encoding: 'utf8',
        cwd: options.cwd || process.cwd(),
        timeout: options.timeout || timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        shell: false, // We're already using /bin/sh
    });
    
    // Combine stdout and stderr since npm writes notices to stderr
    const stdout = result.stdout || '';
    const stderr = result.stderr || '';
    const combinedOutput = stdout + stderr;
    
    // Check if timeout
    if (result.signal === 'SIGTERM') {
        return {
            success: false,
            output: combinedOutput,
            error: `Command timeout (${timeout/1000}s exceeded)`,
            exitCode: -1
        };
    }
    
    // Command succeeded if exit code is 0
    if (result.status === 0) {
        return { 
            success: true, 
            output: combinedOutput, 
            error: null 
        };
    }
    
    // Command failed
    return { 
        success: false, 
        output: combinedOutput,
        error: stderr || result.error?.message || 'Command failed',
        exitCode: result.status
    };
}

function validate(command) {
    if (!command) return true;
    try {
        execSync(command, { stdio: 'ignore', cwd: process.cwd(), shell: true });
        return true;
    } catch {
        return false;
    }
}

function setup() {
    console.log('\n🔧 Setting up test environment...');
    
    // Remove test environment if it exists
    if (fs.existsSync(testRootDir)) {
        console.log('🗑️  Removing existing test environment...');
        fs.rmSync(testRootDir, { recursive: true, force: true });
    }
    
    // Clean Verdaccio data to ensure fresh state for Verdaccio tests
    const verdaccioPath = path.join(require('os').homedir(), '.config', 'verdaccio');
    if (fs.existsSync(verdaccioPath)) {
        console.log('🗑️  Cleaning Verdaccio data...');
        fs.rmSync(verdaccioPath, { recursive: true, force: true });
    }
    
    // Create fresh test environment
    fs.mkdirSync(testRootDir, { recursive: true });
    fs.mkdirSync(testDir, { recursive: true });
    
    process.chdir(testDir);
    console.log(`📂 Working directory: ${process.cwd()}`);
}

function cleanup() {
    console.log('\n🧹 Cleaning up test environment...');
    process.chdir(__dirname);
    
    // Clean up test root directory
    if (fs.existsSync(testRootDir)) {
        fs.rmSync(testRootDir, { recursive: true, force: true });
    }
}

async function runTests() {
    setup();

    // Allow running specific range of tests via command line args
    // Usage: node test-cli.js [start] [end]
    const args = process.argv.slice(2);
    const startTask = args[0] ? parseInt(args[0]) - 1 : 0;
    const endTask = args[1] ? parseInt(args[1]) : tasks.length;
    
    const tasksToRun = tasks.slice(startTask, endTask);
    
    console.log('\n🧪 Running tasks from tasks.json...\n');
    if (args.length > 0) {
        console.log(`Running tasks ${startTask + 1} to ${endTask} (${tasksToRun.length} tasks)\n`);
    } else {
        console.log(`Total tasks: ${tasks.length}\n`);
    }
    
    const startTime = Date.now();
    
    for (let i = 0; i < tasksToRun.length; i++) {
        const task = tasksToRun[i];
        const taskNum = startTask + i + 1;
        
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n${'='.repeat(80)}`);
        console.log(`📋 Task ${taskNum}/${tasks.length} [${elapsed}s elapsed]: ${task.description}`);
        console.log(`${'='.repeat(80)}`);
        
        // Skip tasks marked as doesn't work
        if (task.doesntWork) {
            console.log(`⏭️  SKIPPED: Task marked as doesn't work`);
            skippedCount++;
            continue;
        }
        
        // Special handling for Task 46 (npm login) - ensure registry points to official npm
        // This prevents issues when running tests after Verdaccio tasks that change the registry
        if (taskNum === 46) {
            console.log(`🔧 Ensuring registry is set to official npm registry...`);
            runCommand('npm set registry https://registry.npmjs.org/');
        }
        
        let taskPassed = true;
        
        // Check if this task requires user input
        if (task.requiresUserInput) {
            console.log(`\n⚠️  This task requires USER INPUT`);
            console.log(`📝 Please interact with the terminal to complete this command`);
            console.log(`▶️  Command: ${task.expectedCommand}`);
            console.log(`\nPress Enter when you're ready to run this command...`);
            
            // Wait for user to press Enter
            const readline = require('readline');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            await new Promise((resolve) => {
                rl.question('', () => {
                    rl.close();
                    resolve();
                });
            });
        }
        
        try {
            // Run beforeCommand if defined (setup must happen before pre-check)
            if (task.beforeCommand) {
                console.log(`� Setup: ${task.beforeCommand}`);
                const beforeResult = runCommand(task.beforeCommand);
                if (!beforeResult.success) {
                    console.log(`⚠️  Before command failed: ${beforeResult.error}`);
                }
            }
            
            // Run preCheckCommand if defined (after setup)
            if (task.preCheckCommand) {
                console.log(`� Pre-check: ${task.preCheckCommand}`);
                const preCheckPassed = validate(task.preCheckCommand);
                if (!preCheckPassed) {
                    console.log(`⚠️  Pre-check failed, skipping task`);
                    skippedCount++;
                    continue;
                }
                console.log(`✅ Pre-check passed`);
            }
            
            // Run the main command
            console.log(`▶️  Command: ${task.expectedCommand}`);
            
            let result;
            if (task.requiresUserInput) {
                // Use spawn for interactive commands so user can interact
                console.log(`\n🔄 Running interactive command...`);
                const { spawnSync } = require('child_process');
                const spawnResult = spawnSync(task.expectedCommand, {
                    stdio: 'inherit', // This allows user to interact with the terminal
                    shell: true,
                    cwd: process.cwd(),
                    timeout: 120000 // 2 minutes for user input
                });
                
                result = {
                    success: spawnResult.status === 0,
                    output: '', // No output captured with inherit
                    error: spawnResult.status !== 0 ? `Exit code: ${spawnResult.status}` : null,
                    exitCode: spawnResult.status
                };
            } else {
                // Run normally
                result = runCommand(task.expectedCommand);
            }
            
            const nonZeroOkay = task.nonZeroOkay === true;
            
            // Check if command succeeded (or failed as expected)
            if (!result.success && !nonZeroOkay) {
                console.log(`❌ Command failed: ${result.error}`);
                taskPassed = false;
            } else if (!result.success && nonZeroOkay) {
                console.log(`ℹ️  Command exited with error (expected)`);
            } else {
                console.log(`✅ Command executed successfully`);
            }
            
            // Validate outputIncludes if defined
            if (taskPassed && task.outputIncludes !== undefined && !task.requiresUserInput) {
                // Empty string means "command succeeded, don't validate output content"
                // (used for commands that open browsers/editors with no text output)
                if (task.outputIncludes === "") {
                    console.log(`✅ Output validation passed (empty string = success only)`);
                } else {
                    const output = result.output + result.error;
                    const expectedOutput = task.outputIncludes;
                    
                    const outputValid = output.includes(expectedOutput);
                    
                    if (!outputValid) {
                        console.log(`❌ Output validation failed`);
                        console.log(`   Expected to include: "${expectedOutput}"`);
                        console.log(`   Got: "${output.trim().substring(0, 200)}${output.length > 200 ? '...' : ''}"`);
                        taskPassed = false;
                    } else {
                        console.log(`✅ Output validation passed`);
                    }
                }
            } else if (taskPassed && task.outputIncludes !== undefined && task.requiresUserInput) {
                console.log(`ℹ️  Output validation skipped for interactive command`);
            }
            
            // Validate checkCommand if defined
            if (taskPassed && task.checkCommand) {
                console.log(`🔍 Validation: ${task.checkCommand}`);
                const checkPassed = validate(task.checkCommand);
                if (!checkPassed) {
                    console.log(`❌ Check command failed`);
                    taskPassed = false;
                } else {
                    console.log(`✅ Check command passed`);
                }
            }
            
            // Run afterCommand if defined
            if (task.afterCommand) {
                console.log(`🧹 Cleanup: ${task.afterCommand}`);
                const afterResult = runCommand(task.afterCommand);
                if (!afterResult.success) {
                    console.log(`⚠️  After command failed: ${afterResult.error}`);
                }
            }
            
            // Report task result
            if (taskPassed) {
                console.log(`\n✅ PASSED: Task ${taskNum}`);
                passedCount++;
            } else {
                console.log(`\n❌ FAILED: Task ${taskNum}`);
                failedCount++;
            }
            
        } catch (error) {
            console.log(`\n❌ FAILED: Task ${taskNum} - Unexpected error: ${error.message}`);
            failedCount++;
        }
    }
    
    // Summary
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 TEST SUMMARY`);
    console.log(`${'='.repeat(80)}`);
    console.log(`✅ Passed:  ${passedCount}`);
    console.log(`❌ Failed:  ${failedCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`📝 Total:   ${tasks.length}`);
    console.log(`⏱️  Time:    ${totalTime}s`);
    console.log(`${'='.repeat(80)}\n`);
    
    cleanup();
    
    // Exit with error code if any tests failed
    if (failedCount > 0) {
        process.exit(1);
    }
}

// Run tests and handle async
runTests().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});