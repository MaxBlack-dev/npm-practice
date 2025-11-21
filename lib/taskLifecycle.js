const { execSync } = require('child_process');
const chalk = require('chalk');
const { maybeAddSudo, saveProgress } = require('./utils');

/**
 * Execute task's beforeCommand
 */
function runBeforeCommand(task) {
  const isWindows = process.platform === 'win32';
  const beforeCommand = isWindows && task.windowsBeforeCommand 
    ? task.windowsBeforeCommand 
    : task.beforeCommand;
    
  if (!beforeCommand) return;

  try {
    let beforeCmd = maybeAddSudo(beforeCommand, task, true);
    console.log(chalk.gray(`⚙️ Preparing environment: ${beforeCmd}`));
    execSync(beforeCmd, { stdio: 'inherit', shell: true });
  } catch (e) {
    let errorDetail = e.stderr ? e.stderr.toString() : (e.stdout ? e.stdout.toString() : e.message);
    console.log(chalk.red(`❌ Failed to run beforeCommand: ${errorDetail}`));
  }
}

/**
 * Execute task's preCheckCommand
 */
function runPreCheckCommand(task) {
  const isWindows = process.platform === 'win32';
  const preCheckCommand = isWindows && task.windowsPreCheckCommand 
    ? task.windowsPreCheckCommand 
    : task.preCheckCommand;
    
  if (!preCheckCommand) {
    return true;
  }

  try {
    execSync(preCheckCommand, { stdio: 'inherit', shell: true });
    return true;
  } catch (e) {
    let errorDetail = e.stderr ? e.stderr.toString() : (e.stdout ? e.stdout.toString() : e.message);
    console.log(chalk.red(`❌ Pre-check failed: ${errorDetail}`));
    return false;
  }
}

/**
 * Execute task's afterCommand
 */
function runAfterCommand(task) {
  const isWindows = process.platform === 'win32';
  const afterCommand = isWindows && task.windowsAfterCommand 
    ? task.windowsAfterCommand 
    : task.afterCommand;
    
  if (!afterCommand) return;

  try {
    let afterCmd = maybeAddSudo(afterCommand, task);
    console.log(chalk.gray(`🧹 Cleaning up: ${afterCmd}`));
    execSync(afterCmd, { stdio: 'ignore', shell: true });
  } catch (e) {
    console.log(chalk.red(`❌ Failed to run afterCommand: ${e.message}`));
  }
}

/**
 * Handle task completion and progression
 */
function completeTask(context, showTaskFn, retryPromptFn) {
  const { tasks, progressFile } = context;
  
  console.log(chalk.green("✅ Task completed successfully."));
  context.currentTaskIndex++;
  saveProgress(progressFile, context.currentTaskIndex, context.showCount);
  
  if (context.currentTaskIndex < tasks.length) {
    showTaskFn(tasks[context.currentTaskIndex]);
  } else {
    handleAllTasksCompleted(context, retryPromptFn);
  }
}

/**
 * Handle completion of all tasks
 */
function handleAllTasksCompleted(context, retryPromptFn) {
  const { progressFile } = context;
  
  console.log(chalk.green.bold("\n🎉 Congratulations! You've completed all tasks."));
  console.log(chalk.blue("You can use 'reset' to start over, or 'exit' to quit."));
  context.currentTaskIndex = context.tasks.length - 1;
  saveProgress(progressFile, context.currentTaskIndex, context.showCount);
  retryPromptFn();
}

module.exports = {
  runBeforeCommand,
  runPreCheckCommand,
  runAfterCommand,
  completeTask,
  handleAllTasksCompleted
};
