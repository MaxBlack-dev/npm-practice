const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const tasks = require('./tasks.json');
const testDir = path.join(__dirname, 'test-npm-project');
const progressFile = path.join(__dirname, 'progress.json');

function run(command, expectSuccess = true) {
    try {
        const output = execSync(command, { stdio: 'pipe', encoding: 'utf8', shell: true });
        console.log(`✅ ${command}`);
        if (!expectSuccess) {
            console.error(`❌ Expected failure but succeeded: ${command}`);
        }
        return output;
    } catch (err) {
        console.log(`❌ ${command}`);
        if (expectSuccess) {
            console.error(`❌ Expected success but failed: ${command}`);
        }
        return err.message;
    }
}

function validate(command) {
    try {
        execSync(command, { stdio: 'ignore', cwd: process.cwd(), shell: true });
        return true;
    } catch {
        return false;
    }
}

function setup() {
    console.log('\n🔧 Setting up test environment...');
    if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir);
    }
    process.chdir(testDir);
}

function cleanup() {
    console.log('\n🧹 Cleaning up test environment...');
    process.chdir(__dirname);
    if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
    }
    if (fs.existsSync(progressFile)) {
        fs.unlinkSync(progressFile);
    }
}

function runTests() {
    setup();

    console.log('\n🧪 Running all tasks from tasks.json...');
    tasks.forEach((task, index) => {
        console.log(`\n🔹 Task ${index + 1}: ${task.description}`);

        // Run expected command
        run(task.expectedCommand);

        // Validate result
        const passed = validate(task.checkCommand);
        if (passed) {
            console.log(`✅ Validation passed for task ${index + 1}`);
        } else {
            console.error(`❌ Validation failed for task ${index + 1}`);
        }
    });

    cleanup();
}

runTests();