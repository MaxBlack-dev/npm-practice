const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

/**
 * Save current progress to file
 */
function saveProgress(progressFile, currentTaskIndex, showCount) {
  fs.writeFileSync(progressFile, JSON.stringify({ currentTaskIndex, showCount }), 'utf8');
}

/**
 * Load progress from file
 */
function loadProgress(progressFile, tasksLength) {
  let currentTaskIndex = 0;
  let showCount = 0;

  if (fs.existsSync(progressFile)) {
    try {
      const saved = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
      if (typeof saved.currentTaskIndex === 'number' && saved.currentTaskIndex < tasksLength) {
        currentTaskIndex = saved.currentTaskIndex;
        showCount = saved.showCount || 0;
        console.log(chalk.blue(`🔄 Resuming from Task ${currentTaskIndex + 1}`));
      }
    } catch (e) {
      console.log(chalk.red("⚠️ Couldn't read progress file. Starting from the beginning."));
    }
  }

  return { currentTaskIndex, showCount };
}

/**
 * Add sudo prefix on Linux for commands that require it
 */
function maybeAddSudo(command, task, useBeforeFlag = false) {
  const needsSudo = useBeforeFlag ? task.beforeRequiresSudo : task.requireSudo;
  if (process.platform === 'linux' && needsSudo) {
    return `sudo ${command}`;
  }
  return command;
}

/**
 * Validate task using checkCommand
 */
function validate(task) {
  const isWindows = process.platform === 'win32';
  const command = isWindows ? task.windowsCheckCommand : task.checkCommand;

  if (!command) {
    return true; // No system check needed
  }

  try {
    execSync(command, {
      stdio: 'ignore',
      cwd: process.cwd(),
      shell: true
    });
    return true;
  } catch (err) {
    console.log(chalk.red(`❌ Validation failed: ${err.message}`));
    return false;
  }
}

/**
 * Initialize project workspace
 */
function initializeWorkspace(projectFolder) {
  if (!fs.existsSync(projectFolder)) {
    fs.mkdirSync(projectFolder);
    console.log(chalk.green("📁 Created 'my-npm-project' folder."));
  } else {
    console.log(chalk.blue("📁 Found existing 'my-npm-project' folder."));
  }

  process.chdir(projectFolder);
  console.log(chalk.green(`📂 Working inside: ${process.cwd()}`));
}

module.exports = {
  saveProgress,
  loadProgress,
  maybeAddSudo,
  validate,
  initializeWorkspace
};
