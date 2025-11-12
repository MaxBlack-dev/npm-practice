const { execSync } = require('child_process');
const chalk = require('chalk');
const { maybeAddSudo, saveProgress } = require('./utils');

/**
 * Execute task's beforeCommand
 */
function runBeforeCommand(task) {
  if (!task.beforeCommand) return;

  try {
    let beforeCmd = maybeAddSudo(task.beforeCommand, task, true);
    console.log(chalk.gray(`⚙️ Preparing environment: ${beforeCmd}`));
    execSync(beforeCmd, { stdio: 'ignore', shell: true });
  } catch (e) {
    console.log(chalk.red(`❌ Failed to run beforeCommand: ${e.message}`));
  }
}

/**
 * Execute task's preCheckCommand
 */
function runPreCheckCommand(task) {
  if (!task.preCheckCommand) {
    return true;
  }

  try {
    execSync(task.preCheckCommand, { stdio: 'ignore', shell: true });
    return true;
  } catch (e) {
    console.log(chalk.red(`❌ Pre-check failed: ${e.message}`));
    return false;
  }
}

/**
 * Execute task's afterCommand
 */
function runAfterCommand(task) {
  if (!task.afterCommand) return;

  try {
    console.log(chalk.gray(`🧹 Cleaning up with: ${task.afterCommand}`));
    execSync(task.afterCommand, { stdio: 'ignore', shell: true });
    console.log(chalk.gray("🧼 Cleanup completed."));
  } catch (e) {
    console.log(chalk.red(`⚠️ Failed to run afterCommand: ${e.message}`));
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
