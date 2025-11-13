const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const tasks = require('./tasks.json');
const testRootDir = path.join(__dirname, 'test-environment');
const testDir = path.join(testRootDir, 'my-npm-project');

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

// Helper function to add sudo on Linux for commands that require it
function maybeAddSudo(command, task, useBeforeFlag = false) {
    const needsSudo = useBeforeFlag ? task.beforeRequiresSudo : task.requireSudo;
    if (process.platform === 'linux' && needsSudo) {
        return `sudo ${command}`;
    }
    return command;
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
    // Usage: node test-cli.js [start] [end] [--interactive]
    // --interactive flag enables user input prompts (old behavior)
    const args = process.argv.slice(2);
    const interactiveMode = args.includes('--interactive');
    const numericArgs = args.filter(arg => !arg.startsWith('--'));
    const startTask = numericArgs[0] ? parseInt(numericArgs[0]) - 1 : 0;
    const endTask = numericArgs[1] ? parseInt(numericArgs[1]) : tasks.length;
    
    const tasksToRun = tasks.slice(startTask, endTask);
    
    console.log('\n🧪 Running tasks from tasks.json...\n');
    console.log(`Mode: ${interactiveMode ? '🙋 INTERACTIVE (with user prompts)' : '🤖 AUTOMATED (skip user input tasks)'}\n`);
    if (numericArgs.length > 0) {
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
        
        // Skip sqlite3 tasks (28-29) on Linux due to SSL certificate issues with node-gyp
        if (process.platform === 'linux' && (taskNum === 28 || taskNum === 29)) {
            console.log(`⏭️  SKIPPED: Native module compilation has SSL certificate issues on Linux`);
            skippedCount++;
            continue;
        }
        
        // In automated mode, skip tasks marked with skipTest flag
        if (!interactiveMode && task.skipTest) {
            console.log(`\n⚠️  SKIPPED: Task requires authentication or user input (use --interactive to run)`);
            console.log(`📝 Command would be: ${task.expectedCommand}`);
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
        
        try {
            // Run beforeCommand if defined (setup must happen before pre-check)
            if (task.beforeCommand || task.windowsBeforeCommand) {
                const beforeCommandToUse = process.platform === 'win32' && task.windowsBeforeCommand
                    ? task.windowsBeforeCommand
                    : task.beforeCommand;
                    
                if (beforeCommandToUse) {
                    const beforeCmd = maybeAddSudo(beforeCommandToUse, task, true);
                    console.log(`🔧 Setup: ${beforeCmd}`);
                    const beforeResult = runCommand(beforeCmd);
                    if (!beforeResult.success) {
                        console.log(`⚠️  Before command failed: ${beforeResult.error}`);
                    }
                }
            }
            
            // Run preCheckCommand if defined (after setup)
            if (task.preCheckCommand || task.windowsPreCheckCommand) {
                const preCheckCommandToUse = process.platform === 'win32' && task.windowsPreCheckCommand
                    ? task.windowsPreCheckCommand
                    : task.preCheckCommand;
                    
                if (preCheckCommandToUse) {
                    console.log(`🔍 Pre-check: ${preCheckCommandToUse}`);
                    const preCheckPassed = validate(preCheckCommandToUse);
                    if (!preCheckPassed) {
                        console.log(`⚠️  Pre-check failed, skipping task`);
                        skippedCount++;
                        continue;
                    }
                    console.log(`✅ Pre-check passed`);
                }
            }
            
            // Run the main command
            let commandToRun = task.expectedCommand;
            
            // On Linux, prepend sudo for commands that require it
            if (process.platform === 'linux' && task.requireSudo) {
                commandToRun = `sudo ${commandToRun}`;
                console.log(`▶️  Command: ${commandToRun} (sudo required on Linux)`);
            } else {
                console.log(`▶️  Command: ${commandToRun}`);
            }
            
            // Run normally (interactive tasks are skipped earlier)
            const result = runCommand(commandToRun);
            
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
            if (taskPassed && task.outputIncludes !== undefined) {
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
            } else if (taskPassed && task.isBrowserCommand === true) {
                // Browser commands just need to succeed, no output validation
                console.log(`✅ Browser command executed successfully`);
            }
            
            // Validate checkCommand if defined (use windowsCheckCommand on Windows)
            const checkCommandToUse = process.platform === 'win32' && task.windowsCheckCommand 
                ? task.windowsCheckCommand 
                : task.checkCommand;
            
            if (taskPassed && checkCommandToUse) {
                console.log(`🔍 Validation: ${checkCommandToUse}`);
                const checkPassed = validate(checkCommandToUse);
                if (!checkPassed) {
                    console.log(`❌ Check command failed`);
                    taskPassed = false;
                } else {
                    console.log(`✅ Check command passed`);
                }
            }
            
            // Run afterCommand if defined (use windowsAfterCommand on Windows)
            const afterCommandToUse = process.platform === 'win32' && task.windowsAfterCommand
                ? task.windowsAfterCommand
                : task.afterCommand;
                
            if (afterCommandToUse) {
                const afterCmd = maybeAddSudo(afterCommandToUse, task);
                console.log(`🧹 Cleanup: ${afterCmd}`);
                const afterResult = runCommand(afterCmd);
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