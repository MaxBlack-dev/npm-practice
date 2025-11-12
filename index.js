#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { exec, execSync, spawn } = require('child_process');
const chalk = require('chalk');
const { isAIConfigured, askAI } = require('./ai-helper');
const { saveProgress, loadProgress, maybeAddSudo, validate, initializeWorkspace } = require('./lib/utils');
const { handleReset, handleRetry, handleSkip, handleShow, handleExplain, handleGo } = require('./lib/commands');

const tasks = require('./tasks.json');
const progressFile = path.join(__dirname, 'progress.json');
const projectFolder = path.join(process.cwd(), 'my-npm-project');

// Initialize workspace
initializeWorkspace(projectFolder);

// Load progress
const progress = loadProgress(progressFile, tasks.length);
let currentTaskIndex = progress.currentTaskIndex;
let showCount = progress.showCount;
let preCheckCompleted = false;

// Create context object for commands
const context = {
  tasks,
  progressFile,
  currentTaskIndex,
  showCount,
  get currentTaskIndex() { return currentTaskIndex; },
  set currentTaskIndex(val) { currentTaskIndex = val; },
  get showCount() { return showCount; },
  set showCount(val) { showCount = val; }
};

// Setup readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  completer: (line) => {
    const words = line.split(' ');
    const last = words[words.length - 1];
    const dir = path.resolve(process.cwd());
    const files = fs.readdirSync(dir);
    const hits = files.filter(f => f.startsWith(last));
    return [hits.length ? hits : files, last];
  }
});

function showTask(task) {
  console.log(chalk.green.bold(`\n🧠 Task ${currentTaskIndex + 1}/${tasks.length}: ${task.description}`));

  // Run beforeCommand if defined
  if (task.beforeCommand) {
    try {
      let beforeCmd = maybeAddSudo(task.beforeCommand, task, true);
      console.log(chalk.gray(`⚙️ Preparing environment: ${beforeCmd}`));
      execSync(beforeCmd, { stdio: 'ignore', shell: true });
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

function handleInput(input) {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();
  const task = tasks[currentTaskIndex];

  // Update context
  context.currentTaskIndex = currentTaskIndex;
  context.showCount = showCount;

  // Handle exit
  if (lower === 'exit') {
    console.log(chalk.blue("\n👋 Progress saved. See you next time!"));
    saveProgress(progressFile, currentTaskIndex, showCount);
    rl.close();
    return;
  }

  // Handle reset
  if (lower === 'reset') {
    const result = handleReset(context);
    currentTaskIndex = context.currentTaskIndex;
    showCount = context.showCount;
    if (result.success) {
      showTask(tasks[currentTaskIndex]);
    } else {
      showTask(tasks[currentTaskIndex]);
    }
    return;
  }

  // Handle retry
  if (lower === 'retry') {
    const result = handleRetry(context);
    currentTaskIndex = context.currentTaskIndex;
    showCount = context.showCount;
    if (result.success) {
      showTask(tasks[currentTaskIndex]);
    } else {
      showTask(tasks[currentTaskIndex]);
    }
    return;
  }

  // Handle show
  if (lower === 'show') {
    handleShow(context);
    showCount = context.showCount;
    printMessages();
    rl.question('> ', handleInput);
    return;
  }

  // Handle skip
  if (lower === 'skip') {
    const result = handleSkip(context);
    currentTaskIndex = context.currentTaskIndex;
    showCount = context.showCount;
    
    if (result.completed) {
      retryPrompt();
    } else if (result.success) {
      showTask(tasks[currentTaskIndex]);
    }
    return;
  }

  // Handle explain
  if (lower === 'explain') {
    handleExplain(context);
    rl.prompt();
    return;
  }

  // Handle 'ai' command for AI assistant
  if (lower === 'ai' || lower.startsWith('ai ')) {
    if (!isAIConfigured()) {
      console.log(chalk.yellow("🤖 AI assistant is not configured yet."));
      console.log(chalk.gray("   Run 'node setup-ai.js' to set it up (it's free!)."));
      rl.prompt();
      return;
    }

    const question = trimmed.slice(2).trim();
    if (!question) {
      console.log(chalk.yellow("🤖 Please ask a question after 'ai'."));
      console.log(chalk.gray("   Example: ai what is npm install?"));
      console.log(chalk.gray("   Example: ai explain the current task"));
      rl.prompt();
      return;
    }

    console.log(chalk.cyan("🤖 Thinking..."));
    
    askAI(question, tasks[currentTaskIndex])
      .then(response => {
        console.log(chalk.cyan("\n🤖 AI Assistant:"));
        console.log(chalk.white(response));
        console.log('');
        rl.prompt();
      })
      .catch(error => {
        console.log(chalk.red(`❌ AI Error: ${error.message}`));
        rl.prompt();
      });
    
    return;
  }

  // Handle 'cd' manually
  if (trimmed.startsWith('cd ')) {
    const targetDir = trimmed.slice(3).trim();
    const fullPath = path.resolve(process.cwd(), targetDir);

    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      process.chdir(fullPath);
      console.log(chalk.green(`📂 Changed directory to: ${process.cwd()}`));
      if (task) {
        console.log(chalk.green("✅ Task completed successfully."));
        currentTaskIndex++;
        saveProgress(progressFile, currentTaskIndex, showCount);
        if (currentTaskIndex < tasks.length) {
          showTask(tasks[currentTaskIndex]);
        } else {
          console.log(chalk.green.bold("\n🎉 Congratulations! You've completed all tasks."));
          console.log(chalk.blue("You can use 'reset' to start over, or 'exit' to quit."));
          currentTaskIndex = tasks.length - 1;
          saveProgress(progressFile, currentTaskIndex, showCount);
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

  // Handle 'go' command
  if (lower.startsWith('go ')) {
    const result = handleGo(context, input);
    currentTaskIndex = context.currentTaskIndex;
    showCount = context.showCount;
    
    if (result.success && (result.jumpToTask !== undefined)) {
      showTask(tasks[currentTaskIndex]);
    } else {
      retryPrompt();
    }
    return;
  }

  // Handle tasks requiring user input
  if (tasks[currentTaskIndex].requiresUserInput === true) {
    rl.pause();

    const args = trimmed.split(' ');
    const login = spawn(args[0], args.slice(1), { stdio: 'inherit', shell: true });

    login.on('exit', (code) => {
      rl.resume();

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
        saveProgress(progressFile, currentTaskIndex, showCount);
        if (currentTaskIndex < tasks.length) {
          showTask(tasks[currentTaskIndex]);
        } else {
          console.log(chalk.green.bold("\n🎉 Congratulations! You've completed all tasks."));
          console.log(chalk.blue("You can use 'reset' to start over, or 'exit' to quit."));
          currentTaskIndex = tasks.length - 1;
          saveProgress(progressFile, currentTaskIndex, showCount);
          retryPrompt();
        }
      } else {
        console.log(chalk.red("❌ Task failed. Try again or type 'show' for help."));
        retryPrompt();
      }
    });

    return;
  }

  // Execute general commands
  exec(trimmed, { shell: true }, (err, stdout, stderr) => {
    const output = stdout.trim() + stderr.trim();
    const outputValid = task.outputIncludes !== undefined
        ? task.outputIncludes === "" ? output === "" : output.includes(task.outputIncludes)
        : false;

    const commandSucceeded = !err;
    const isOutputBased = !!task.outputIncludes;
    const strictMatch = task.strictCommandMatch === true;
    
    let userCommand = trimmed;
    let userCommandWithoutSudo = userCommand.replace(/^sudo\s+/, '');
    let expectedCommand = task.expectedCommand;
    let expectedCommandWithSudo = maybeAddSudo(task.expectedCommand, task);
    
    const isAttemptingTask = strictMatch
        ? (userCommand === expectedCommand || userCommand === expectedCommandWithSudo)
        : (userCommand === expectedCommand || 
           userCommand === expectedCommandWithSudo ||
           userCommandWithoutSudo === expectedCommand ||
           expectedCommand.includes(userCommandWithoutSudo.split(' ')[0]));

    // Show output
    if (stdout.trim()) console.log(chalk.white(stdout.trim()));
    if (stderr.trim()) console.log(chalk.yellow(stderr.trim()));

    if (isAttemptingTask) {
      const stateValid = task.checkCommand ? validate(task) : true;
      const nonZeroOkay = task.nonZeroOkay === true;
      const hasCheckCommand = !!task.checkCommand;
      
      let passed = false;
      
      if (isOutputBased) {
        passed = (commandSucceeded || nonZeroOkay) && outputValid;
      } else if (hasCheckCommand) {
        passed = stateValid;
      } else {
        const isBrowserCommand = task.isBrowserCommand === true;
        
        if (isBrowserCommand) {
          passed = commandSucceeded || nonZeroOkay;
        } else {
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
            passed = !commandSucceeded;
          }
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
        saveProgress(progressFile, currentTaskIndex, showCount);
        if (currentTaskIndex < tasks.length) {
          showTask(tasks[currentTaskIndex]);
        } else {
          console.log(chalk.green.bold("\n🎉 Congratulations! You've completed all tasks."));
          console.log(chalk.blue("You can use 'reset' to start over, or 'exit' to quit."));
          currentTaskIndex = tasks.length - 1;
          saveProgress(progressFile, currentTaskIndex, showCount);
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
      if (strictMatch) {
        const expectedCmd = maybeAddSudo(task.expectedCommand, task);
        console.log(chalk.red(`❌ That's not the expected command. This task requires: ${chalk.bold(expectedCmd)}`));
        console.log(chalk.gray("�� Try typing 'show' to reveal the correct command."));
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
  
  if (isAIConfigured()) {
    console.log(chalk.gray("🤖 Type 'ai <question>' to ask the AI assistant anything about npm."));
    console.log(chalk.gray("   Example: ai what is npm install?"));
  }
  
  console.log(chalk.gray("💡 Type 'exit' anytime to quit."));
  console.log(chalk.gray("💡 Type 'reset' to clear all progress and start fresh."));
  console.log(chalk.gray("💡 Type 'retry' to reset environment and return to current task."));
  console.log(chalk.gray("💡 Type 'skip' to skip the current task."));
  console.log(chalk.gray("💡 You can also run any terminal command to inspect your environment (e.g., view files, check your location, or read contents)."));
  console.log(chalk.gray("📘 New to npm or want a deeper dive? Check out the guide: https://www.amazon.com/dp/B0FSX9TZZ1"));
}

// Start the flow
showTask(tasks[currentTaskIndex]);
rl.on('line', handleInput);
