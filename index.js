#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const chalk = require('chalk');
const { isAIConfigured, askAI } = require('./ai-helper');
const { saveProgress, loadProgress, initializeWorkspace } = require('./lib/utils');
const { handleReset, handleRetry, handleSkip, handleShow, handleExplain, handleGo } = require('./lib/commands');
const { runBeforeCommand, runPreCheckCommand } = require('./lib/taskLifecycle');
const { executeUserCommand, handleUserInputTask, handleCdCommand } = require('./lib/taskRunner');
const { checkForUpdates } = require('./lib/updateChecker');

const tasks = require('./tasks.json');
const packageJson = require('./package.json');
const progressFile = process.env.NPM_PRACTICE_PROGRESS_FILE || path.join(__dirname, 'progress.json');
const projectFolder = path.join(process.cwd(), 'my-npm-project');

// Initialize workspace
initializeWorkspace(projectFolder);

// Check for updates (non-blocking)
checkForUpdates(packageJson.version);

// Load progress
const progress = loadProgress(progressFile, tasks.length);
let currentTaskIndex = progress.currentTaskIndex;
let showCount = progress.showCount;
let preCheckCompleted = false;

// Create context object
const context = {
  tasks,
  progressFile,
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

  // Run beforeCommand and preCheckCommand
  if (task.beforeCommand) {
    runBeforeCommand(task);
  }

  if (task.preCheckCommand) {
    preCheckCompleted = runPreCheckCommand(task);
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
    process.exit(0);
  }

  // Handle reset
  if (lower === 'reset') {
    handleReset(context);
    currentTaskIndex = context.currentTaskIndex;
    showCount = context.showCount;
    showTask(tasks[currentTaskIndex]);
    return;
  }

  // Handle retry
  if (lower === 'retry') {
    handleRetry(context);
    currentTaskIndex = context.currentTaskIndex;
    showCount = context.showCount;
    showTask(tasks[currentTaskIndex]);
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

  // Handle AI command
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

  // Handle 'cd' command
  if (trimmed.startsWith('cd ')) {
    const targetDir = trimmed.slice(3).trim();
    handleCdCommand(targetDir, context, showTask, retryPrompt);
    return;
  }

  // Handle 'open' command - open book URL or other URLs
  if (lower === 'open' || (trimmed.startsWith('open ') && trimmed.includes('http'))) {
    const { execSync } = require('child_process');
    const url = lower === 'open' ? 'https://www.amazon.com/dp/B0FSX9TZZ1' : trimmed.slice(5).trim();
    try {
      const openCommand = process.platform === 'win32' ? 'start' : 'open';
      execSync(`${openCommand} ${url}`, { stdio: 'ignore', shell: true });
      console.log(chalk.green("✓ Opening in browser..."));
    } catch (error) {
      console.log(chalk.red(`❌ Could not open URL: ${error.message}`));
    }
    rl.prompt();
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
  if (task.requiresUserInput === true) {
    handleUserInputTask(trimmed, context, showTask, retryPrompt, rl);
    return;
  }

  // Execute general commands
  executeUserCommand(trimmed, context, showTask, retryPrompt, rl);
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
  console.log(chalk.gray("📘 New to npm or want a deeper dive? Check out the NPM Book:"));
  console.log(chalk.cyan.underline("   https://www.amazon.com/dp/B0FSX9TZZ1"));
  console.log(chalk.gray("💡 Type 'open' to open the NPM Book in your browser."));
}

// Start the flow
showTask(tasks[currentTaskIndex]);
rl.on('line', handleInput);
