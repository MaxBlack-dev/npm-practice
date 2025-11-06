#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { exec, execSync } = require('child_process');
const chalk = require('chalk');

const tasks = require('./tasks.json');
const progressFile = path.join(__dirname, 'progress.json');
let currentTaskIndex = 0;
let preCheckCompleted = false;

const projectFolder = path.join(process.cwd(), 'my-npm-project');

if (!fs.existsSync(projectFolder)) {
  fs.mkdirSync(projectFolder);
  console.log(chalk.green("📁 Created 'my-npm-project' folder."));
} else {
  console.log(chalk.blue("📁 Found existing 'my-npm-project' folder."));
}

process.chdir(projectFolder);
console.log(chalk.green(`📂 Working inside: ${process.cwd()}`));

// Load progress if it exists
let showCount = 0;
if (fs.existsSync(progressFile)) {
  try {
    const saved = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
    if (typeof saved.currentTaskIndex === 'number' && saved.currentTaskIndex < tasks.length) {
      currentTaskIndex = saved.currentTaskIndex;
      showCount = saved.showCount || 0;
      console.log(chalk.blue(`🔄 Resuming from Task ${currentTaskIndex + 1}`));
    }
  } catch (e) {
    console.log(chalk.red("⚠️ Couldn't read progress file. Starting from the beginning."));
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  completer: (line) => {
    const fs = require('fs');
    const path = require('path');

    const words = line.split(' ');
    const last = words[words.length - 1];
    const dir = path.resolve(process.cwd());
    const files = fs.readdirSync(dir);

    const hits = files.filter(f => f.startsWith(last));
    return [hits.length ? hits : files, last];
  }
});

function saveProgress() {
  fs.writeFileSync(progressFile, JSON.stringify({ currentTaskIndex, showCount }), 'utf8');
}

function showTask(task) {
  console.log(chalk.green.bold(`\n🧠 Task ${currentTaskIndex + 1}/${tasks.length}: ${task.description}`));

  // Run beforeCommand if defined
  if (task.beforeCommand) {
    try {
      console.log(chalk.gray(`⚙️ Preparing environment: ${task.beforeCommand}`));
      execSync(task.beforeCommand, { stdio: 'ignore', shell: true });
    } catch (e) {
      console.log(chalk.red(`❌ Failed to run beforeCommand: ${e.message}`));
    }
  }

  // Run preCheckCommand if defined
  if (task.preCheckCommand) {
    try {
      execSync(task.preCheckCommand, { stdio: 'ignore', shell: true });
      preCheckCompleted = true;
    } catch (e) {
      console.log(chalk.red(`❌ Pre-check failed: ${e.message}`));
      preCheckCompleted = false;
    }
  } else {
    preCheckCompleted = true;
  }

  if (preCheckCompleted) {
    printMessages();
    rl.prompt();
  } else {
    console.log(chalk.red("⚠️ Environment not ready. Fix the issue and try again."));
    rl.question('> ', handleInput);
  }
}

function validate(task) {
  const isWindows = process.platform === 'win32';
  const command = isWindows ? task.windowsCheckCommand : task.checkCommand;

  if (!command) {
    return true; // No system check needed
  }

  try {
    execSync(command, {
      stdio: 'ignore',
      cwd: process.cwd(), // ensure it runs in the current folder
      shell: true // required for shell built-ins like `test`
    });
    return true;
  } catch (err) {
    console.log(chalk.red(`❌ Validation failed: ${err.message}`));
    return false;
  }
}

function handleInput(input) {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();
  const task = tasks[currentTaskIndex];

  if (lower === 'exit') {
    console.log(chalk.blue("\n👋 Progress saved. See you next time!"));
    saveProgress();
    rl.close();
    return;
  }

  if (lower === 'reset') {
    try {
      console.log(chalk.blue("🔄 Starting comprehensive reset..."));
      
      // 1. Reset npm registry to official registry
      try {
        console.log(chalk.gray("🌐 Resetting npm registry to official registry..."));
        execSync('npm set registry https://registry.npmjs.org/', { stdio: 'ignore', shell: true });
        console.log(chalk.gray("✅ Registry reset to official npm registry"));
      } catch (e) {
        console.log(chalk.yellow("⚠️ Failed to reset npm registry"));
      }
      
      // 2. Stop verdaccio and clean its data
      try {
        console.log(chalk.gray("🛑 Stopping verdaccio and cleaning data..."));
        execSync('lsof -ti :4873 | xargs kill 2>/dev/null || true', { stdio: 'ignore', shell: true });
        execSync('rm -rf ~/.config/verdaccio', { stdio: 'ignore', shell: true });
        console.log(chalk.gray("✅ Verdaccio stopped and data cleaned"));
      } catch (e) {
        console.log(chalk.gray("ℹ️ Verdaccio cleanup completed"));
      }
      
      // 3. Remove verdaccio global package if installed
      try {
        console.log(chalk.gray("🗑️ Removing verdaccio global package..."));
        execSync('npm uninstall -g verdaccio', { stdio: 'ignore', shell: true });
        console.log(chalk.gray("✅ Verdaccio global package removed"));
      } catch (e) {
        console.log(chalk.gray("ℹ️ Verdaccio was not installed globally"));
      }
      
      // 4. Clear all files in current directory
      const files = fs.readdirSync(process.cwd());
      for (const file of files) {
        const filePath = path.join(process.cwd(), file);
        fs.rmSync(filePath, { recursive: true, force: true });
      }
      console.log(chalk.red("🧹 Cleared all files in current directory."));

      // 5. Reset progress file
      if (fs.existsSync(progressFile)) {
        fs.unlinkSync(progressFile);
        console.log(chalk.red("🧼 Progress reset."));
      }

      currentTaskIndex = 0;
      showCount = 0;
      console.log(chalk.green("\n🔄 Complete reset finished! Starting from the beginning..."));
      showTask(tasks[currentTaskIndex]);
    } catch (e) {
      console.log(chalk.red("⚠️ Failed to reset. You may need to delete files manually."));
      console.log(chalk.red(`Error: ${e.message}`));
      showTask(tasks[currentTaskIndex]);
    }
    return;
  }

  if (lower === 'show') {
    showCount++;
    saveProgress();
    console.log(chalk.cyan(`💡 The correct command is: ${chalk.bold(task.expectedCommand)}`));
    console.log(chalk.yellow("Now try running it below:"));
    printMessages();
    rl.question('> ', handleInput);
    return;
  }

  if (lower === 'skip') {
    console.log(chalk.yellow(`⏭️ Skipping Task ${currentTaskIndex + 1}...`));
    const cmd = task.expectedCommand;

    try {
      console.log(chalk.gray(`▶ Running: ${cmd}`));
      execSync(cmd, { stdio: 'inherit', shell: true });
    } catch (e) {
      const nonZeroOkay = task.nonZeroOkay === true;

      if (nonZeroOkay) {
        console.log(chalk.gray(`ℹ️ Task ${currentTaskIndex + 1} exited with code ${e.status}, but that's expected.`));
      } else {
        console.log(chalk.red(`⚠️ Skipped Task ${currentTaskIndex + 1} due to error: ${e.message}`));
      }
    }

    currentTaskIndex++;
    saveProgress();

    if (currentTaskIndex < tasks.length) {
      showTask(tasks[currentTaskIndex]);
    } else {
      console.log(chalk.green.bold("\n🎉 Congratulations! You've completed all tasks."));
      console.log(chalk.blue("You can use 'reset' to start over, or 'exit' to quit."));
      currentTaskIndex = tasks.length - 1; // Stay at the last task
      saveProgress();
      retryPrompt();
    }
    return;
  }

  if (lower === 'explain') {
    const task = tasks[currentTaskIndex];
    if (task.explanation) {
      console.log(chalk.cyan(`📘 Explanation for '${task.expectedCommand}':`));
      console.log(chalk.white(task.explanation));
    } else {
      console.log(chalk.yellow("⚠️ No explanation available for this task yet."));
    }
    rl.prompt();
    return;
  }

  // Handle 'cd' manually so it affects the current process
  if (trimmed.startsWith('cd ')) {
    const targetDir = trimmed.slice(3).trim();
    const fullPath = path.resolve(process.cwd(), targetDir);

    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      process.chdir(fullPath);
      console.log(chalk.green(`📂 Changed directory to: ${process.cwd()}`));
      if (task) {
        console.log(chalk.green("✅ Task completed successfully."));
        currentTaskIndex++;
        saveProgress();
        if (currentTaskIndex < tasks.length) {
          showTask(tasks[currentTaskIndex]);
        } else {
          console.log(chalk.green.bold("\n🎉 Congratulations! You've completed all tasks."));
          console.log(chalk.blue("You can use 'reset' to start over, or 'exit' to quit."));
          currentTaskIndex = tasks.length - 1; // Stay at the last task
          saveProgress();
          retryPrompt();
        }
      } else {
        retryPrompt();
      }
    } else {
      console.log(chalk.red(`❌ Directory not found: ${targetDir}`));
      retryPrompt();
    }
    return;
  }

  if (lower.startsWith('go ')) {
    const parts = trimmed.split(' ');
    const target = parseInt(parts[1], 10);
    const hasSkipFlag = parts.includes('--skip') || parts.includes('-skip') || parts.includes('skip');
    
    if (isNaN(target) || target < 1 || target > tasks.length) {
      console.log(chalk.red("❌ Invalid task number. Use: go 4"));
      retryPrompt();
      return;
    }

    // Skip mode: just jump to the task without running anything
    if (hasSkipFlag) {
      currentTaskIndex = target - 1;
      saveProgress();
      showTask(tasks[currentTaskIndex]);
      return;
    }

    const start = currentTaskIndex;
    const end = target - 1;

    if (start >= end) {
      console.log(chalk.yellow(`⚠️ You're already at or past Task ${target}.`));
      retryPrompt();
      return;
    }

    console.log(chalk.blue(`⏩ Fast-forwarding from Task ${start + 1} to Task ${target}...`));

    for (let i = start; i < end; i++) {
      const task = tasks[i];
      const cmd = task.expectedCommand;
      try {
        console.log(chalk.gray(`▶ Running: ${cmd}`));
        
        // Execute beforeCommand if available
        if (task.beforeCommand) {
          try {
            console.log(chalk.gray(`🔧 Setting up with: ${task.beforeCommand}`));
            execSync(task.beforeCommand, { stdio: 'ignore', shell: true });
            console.log(chalk.gray("🔧 Setup completed."));
          } catch (e) {
            console.log(chalk.red(`⚠️ Failed to run beforeCommand: ${e.message}`));
          }
        }
        
        // Handle commands that require user input
        if (task.requiresUserInput === true) {
          console.log(chalk.yellow(`⚠️ Task ${i + 1} requires user input. Please interact with the command:`));
          execSync(cmd, { stdio: 'inherit', shell: true });
        } else {
          execSync(cmd, { stdio: 'ignore', shell: true });
        }
        
        // Execute afterCommand if available
        if (task.afterCommand) {
          try {
            console.log(chalk.gray(`🧹 Cleaning up with: ${task.afterCommand}`));
            execSync(task.afterCommand, { stdio: 'ignore', shell: true });
            console.log(chalk.gray("🧼 Cleanup completed."));
          } catch (e) {
            console.log(chalk.red(`⚠️ Failed to run afterCommand: ${e.message}`));
          }
        }
      } catch (e) {
        const nonZeroOkay = task.nonZeroOkay === true;
        if (nonZeroOkay) {
          console.log(chalk.gray(`ℹ️ Task ${i + 1} exited with code ${e.status}, but that's expected.`));
        } else {
          console.log(chalk.red(`⚠️ Skipped Task ${i + 1} due to error: ${e.message}`));
        }
        
        // Still execute afterCommand even if main command failed
        if (task.afterCommand) {
          try {
            console.log(chalk.gray(`🧹 Cleaning up with: ${task.afterCommand}`));
            execSync(task.afterCommand, { stdio: 'ignore', shell: true });
            console.log(chalk.gray("🧼 Cleanup completed."));
          } catch (e) {
            console.log(chalk.red(`⚠️ Failed to run afterCommand: ${e.message}`));
          }
        }
      }
    }

    currentTaskIndex = end;
    saveProgress();
    showTask(tasks[currentTaskIndex]);
    return;
  }

  if (tasks[currentTaskIndex].requiresUserInput === true) {
    rl.pause(); // ⏸️ Stop intercepting input

    const { spawn } = require('child_process');
      const args = trimmed.split(' ');
      const login = spawn(args[0], args.slice(1), { stdio: 'inherit', shell: true });

    login.on('exit', (code) => {
      rl.resume(); // ▶️ Resume input after login completes

      const task = tasks[currentTaskIndex];
      const stateValid = task.checkCommand ? validate(task) : true;
      const passed = stateValid;

      if (passed) {
        if (task.afterCommand) {
          try {
            console.log(chalk.gray(`🧹 Cleaning up with: ${task.afterCommand}`));
            execSync(task.afterCommand, { stdio: 'ignore', shell: true });
            console.log(chalk.gray("🧼 Cleanup completed."));
          } catch (e) {
            console.log(chalk.red(`⚠️ Failed to run afterCommand: ${e.message}`));
          }
        }

        console.log(chalk.green("✅ Task completed successfully."));
        currentTaskIndex++;
        saveProgress();
        if (currentTaskIndex < tasks.length) {
          showTask(tasks[currentTaskIndex]);
        } else {
          console.log(chalk.green.bold("\n🎉 Congratulations! You've completed all tasks."));
          console.log(chalk.blue("You can use 'reset' to start over, or 'exit' to quit."));
          currentTaskIndex = tasks.length - 1; // Stay at the last task
          saveProgress();
          retryPrompt();
        }
      } else {
        console.log(chalk.red("❌ Task failed. Try again or type 'show' for help."));
        retryPrompt();
      }
    });

    return; // ⛔ Prevent fallback logic from running
  }

  exec(trimmed, { shell: true }, (err, stdout, stderr) => {
    const output = stdout.trim() + stderr.trim();
    const outputValid = task.outputIncludes !== undefined
        ? task.outputIncludes === "" ? output === "" : output.includes(task.outputIncludes)
        : false;

    const commandSucceeded = !err;
    const isOutputBased = !!task.outputIncludes;

    const strictMatch = task.strictCommandMatch === true;
    const isAttemptingTask = strictMatch
        ? trimmed === task.expectedCommand
        : trimmed === task.expectedCommand || task.expectedCommand.includes(trimmed.split(' ')[0]);

    // Always show output first
    if (stdout.trim()) console.log(chalk.white(stdout.trim()));
    if (stderr.trim()) console.log(chalk.yellow(stderr.trim()));

    if (isAttemptingTask) {
      const stateValid = task.checkCommand ? validate(task) : true;
      const nonZeroOkay = task.nonZeroOkay === true;
      const hasCheckCommand = !!task.checkCommand;
      
      let passed = false;
      
      // Priority 1: If task has outputIncludes, validate output
      if (isOutputBased) {
        passed = (commandSucceeded || nonZeroOkay) && outputValid;
      }
      // Priority 2: If task has checkCommand, validate state
      else if (hasCheckCommand) {
        passed = stateValid;
      }
      // Priority 3: If task has neither, compare output with expectedCommand output
      else {
        try {
          const expectedResult = execSync(task.expectedCommand, { 
            shell: true, 
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe']
          });
          const expectedOutput = expectedResult.trim();
          const userOutput = stdout.trim();
          
          passed = commandSucceeded && userOutput === expectedOutput;
          
          if (!passed && commandSucceeded) {
            console.log(chalk.yellow(`⚠️ Output doesn't match expected result.`));
            console.log(chalk.gray(`Expected: ${expectedOutput}`));
            console.log(chalk.gray(`Got: ${userOutput}`));
          }
        } catch (expectedErr) {
          // If expected command fails, user command should also fail
          passed = !commandSucceeded;
        }
      }

      if (passed) {
        if (task.afterCommand) {
          try {
            console.log(chalk.gray(`🧹 Cleaning up with: ${task.afterCommand}`));
            execSync(task.afterCommand, { stdio: 'ignore', shell: true });
            console.log(chalk.gray("🧼 Cleanup completed."));
          } catch (e) {
            console.log(chalk.red(`⚠️ Failed to run afterCommand: ${e.message}`));
          }
        }

        console.log(chalk.green("✅ Task completed successfully."));
        currentTaskIndex++;
        saveProgress();
        if (currentTaskIndex < tasks.length) {
          showTask(tasks[currentTaskIndex]);
        } else {
          console.log(chalk.green.bold("\n🎉 Congratulations! You've completed all tasks."));
          console.log(chalk.blue("You can use 'reset' to start over, or 'exit' to quit."));
          currentTaskIndex = tasks.length - 1; // Stay at the last task
          saveProgress();
          retryPrompt();
        }
      } else {
        if (err) {
          console.log(chalk.red(`❌ Command failed: ${stderr.trim()}`));
        } else {
          console.log(chalk.red("❌ Output did not match expected result."));
        }
        retryPrompt();
      }
    } else {
      const strictMatch = task.strictCommandMatch === true;
      if (strictMatch) {
        console.log(chalk.red(`❌ That’s not the expected command. This task requires: ${chalk.bold(task.expectedCommand)}`));
        console.log(chalk.gray("💡 Try typing 'show' to reveal the correct command."));
      }
      rl.prompt();
    }
  });
}

function retryPrompt() {
  console.log(chalk.yellow("\n🔁 Try again:"));
  printMessages();
  rl.question('> ', handleInput);
}

function printMessages() {
  console.log(chalk.yellow("Type your command below and press Enter."));
  let showHint = "💡 Type 'show' to reveal the correct command.";
  if (showCount > 0) {
    showHint += ` (used ${showCount} time${showCount > 1 ? 's' : ''})`;
  }
  console.log(chalk.gray(showHint));
  console.log(chalk.gray("💡 Type 'explain' to learn what the current command does and why it's useful."));
  console.log(chalk.gray("💡 Type 'exit' anytime to quit."));
  console.log(chalk.gray("💡 Type 'reset' to clear all progress and start fresh."));
  console.log(chalk.gray("💡 Type 'skip' to skip the current task."));
  console.log(chalk.gray("💡 You can also run any terminal command to inspect your environment (e.g., view files, check your location, or read contents)."));
  console.log(chalk.gray("📘 New to npm or want a deeper dive? Check out the guide: https://www.amazon.com/dp/B0FSX9TZZ1"));
}

// Start the flow
showTask(tasks[currentTaskIndex]);
rl.on('line', handleInput);