const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');
const { maybeAddSudo, validate, saveProgress, getExpectedCommand } = require('./utils');

/**
 * Handle 'reset' command - clear all progress and workspace
 */
function handleReset(context) {
  const { tasks, progressFile } = context;
  
  try {
    const isWindows = process.platform === 'win32';
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
      
      if (isWindows) {
        // Windows: Kill node processes on port 4873
        const VERDACCIO_DIR = path.join(require('os').homedir(), 'AppData', 'Roaming', 'verdaccio');
        const PID_FILE = path.join(VERDACCIO_DIR, 'verdaccio.pid');
        
        // Try to kill using PID file first
        if (fs.existsSync(PID_FILE)) {
          try {
            const pid = fs.readFileSync(PID_FILE, 'utf8').trim();
            execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore', shell: true });
          } catch (e) {
            // Process may already be dead
          }
          fs.unlinkSync(PID_FILE);
        }
        
        // Also try netstat approach
        try {
          execSync('for /f "tokens=5" %a in (\'netstat -aon ^| findstr :4873\') do taskkill /F /PID %a', { stdio: 'ignore', shell: true });
        } catch (e) {
          // No process found
        }
        
        // Delete Verdaccio directory
        if (fs.existsSync(VERDACCIO_DIR)) {
          fs.rmSync(VERDACCIO_DIR, { recursive: true, force: true });
        }
      } else {
        // Linux/Mac
        execSync('lsof -ti :4873 | xargs kill 2>/dev/null || true', { stdio: 'ignore', shell: true });
        execSync('rm -rf ~/.config/verdaccio', { stdio: 'ignore', shell: true });
      }
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

    context.currentTaskIndex = 0;
    context.showCount = 0;
    console.log(chalk.green("\n🔄 Complete reset finished! Starting from the beginning..."));
    return { success: true, resetToTask: 0 };
  } catch (e) {
    console.log(chalk.red("⚠️ Failed to reset. You may need to delete files manually."));
    console.log(chalk.red(`Error: ${e.message}`));
    return { success: false };
  }
}

/**
 * Handle 'retry' command - reset and return to current task
 */
function handleRetry(context) {
  const { tasks, progressFile, currentTaskIndex } = context;
  const taskToRetry = currentTaskIndex + 1; // Save current task number (1-indexed)
  
  console.log(chalk.blue(`🔄 Resetting environment and returning to Task ${taskToRetry}...`));
  
  try {
    const isWindows = process.platform === 'win32';

    // 1. Reset npm registry to official registry
    try {
      console.log(chalk.gray("🌐 Resetting npm registry to official registry..."));
      execSync('npm set registry https://registry.npmjs.org/', { stdio: 'ignore', shell: true });
      console.log(chalk.gray("✅ Registry reset to official npm registry"));
    } catch (e) {
      console.log(chalk.yellow("⚠️ Failed to reset npm registry"));
    }

    // 2. Kill Verdaccio if running
    try {
      console.log(chalk.gray("🛑 Stopping Verdaccio if running..."));
      if (isWindows) {
        // Windows: Kill node processes on port 4873
        const VERDACCIO_DIR = path.join(require('os').homedir(), 'AppData', 'Roaming', 'verdaccio');
        const PID_FILE = path.join(VERDACCIO_DIR, 'verdaccio.pid');
        
        // Try to kill using PID file first
        if (fs.existsSync(PID_FILE)) {
          try {
            const pid = fs.readFileSync(PID_FILE, 'utf8').trim();
            execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore', shell: true });
          } catch (e) {
            // Process may already be dead
          }
          fs.unlinkSync(PID_FILE);
        }
        
        // Also try netstat approach to find any remaining processes
        try {
          execSync('for /f "tokens=5" %a in (\'netstat -aon ^| findstr :4873\') do taskkill /F /PID %a', { stdio: 'ignore', shell: true });
        } catch (e) {
          // No process found or already killed
        }
      } else {
        // Linux/Mac
        execSync("lsof -ti :4873 | xargs kill 2>/dev/null || true", { stdio: 'ignore', shell: true });
      }
      console.log(chalk.gray("✅ Verdaccio stopped"));
    } catch (e) {
      // Ignore errors
    }

    // 3. Delete Verdaccio directories
    try {
      console.log(chalk.gray("🗑️ Removing Verdaccio data..."));
      const verdaccioLog = path.join(process.cwd(), 'verdaccio.log');
      if (fs.existsSync(verdaccioLog)) {
        fs.unlinkSync(verdaccioLog);
      }
      
      if (isWindows) {
        // Windows: Delete Verdaccio directories
        const VERDACCIO_DIR = path.join(require('os').homedir(), 'AppData', 'Roaming', 'verdaccio');
        if (fs.existsSync(VERDACCIO_DIR)) {
          fs.rmSync(VERDACCIO_DIR, { recursive: true, force: true });
        }
      } else {
        // Linux/Mac
        execSync("rm -rf ~/.config/verdaccio ~/.local/share/verdaccio ~/.verdaccio 2>/dev/null || true", { stdio: 'ignore', shell: true });
      }
      console.log(chalk.gray("✅ Verdaccio data cleared"));
    } catch (e) {
      console.log(chalk.yellow("⚠️ Failed to clear Verdaccio data"));
    }

    // 4. Delete my-npm-project folder
    const projectDir = path.join(process.cwd(), 'my-npm-project');
    if (fs.existsSync(projectDir)) {
      console.log(chalk.gray("🗑️ Removing workspace folder..."));
      fs.rmSync(projectDir, { recursive: true, force: true });
      console.log(chalk.gray("✅ Workspace folder removed"));
    }

    // 5. Reset progress to beginning
    context.currentTaskIndex = 0;
    context.showCount = 0;
    saveProgress(progressFile, 0, 0);

    console.log(chalk.green("\n🔄 Reset complete! Now fast-forwarding to your previous task..."));
    
    // 6. Fast-forward to the saved task
    const target = taskToRetry;
    const start = 0;
    const end = target - 1;

    if (end > 0) {
      console.log(chalk.blue(`⏩ Fast-forwarding from Task 1 to Task ${target}...`));
      fastForwardTasks(tasks, start, end);
    }

    context.currentTaskIndex = end;
    saveProgress(progressFile, end, context.showCount);
    console.log(chalk.green(`\n✅ Environment restored! You're back at Task ${target} with a clean slate.`));
    return { success: true, resetToTask: end };
  } catch (e) {
    console.log(chalk.red("⚠️ Failed to retry. You may need to use 'reset' and navigate manually."));
    console.log(chalk.red(`Error: ${e.message}`));
    return { success: false };
  }
}

/**
 * Handle 'skip' command - execute and move to next task
 */
function handleSkip(context) {
  const { tasks, currentTaskIndex, progressFile } = context;
  const task = tasks[currentTaskIndex];
  
  console.log(chalk.yellow(`⏭️ Skipping Task ${currentTaskIndex + 1}...`));
  let cmd = getExpectedCommand(task);
  cmd = maybeAddSudo(cmd, task);

  try {
    console.log(chalk.gray(`▶ Running ${currentTaskIndex + 1}: ${cmd}`));
    execSync(cmd, { stdio: 'inherit', shell: true });
  } catch (e) {
    const nonZeroOkay = task.nonZeroOkay === true;

    if (nonZeroOkay) {
      console.log(chalk.gray(`ℹ️ Task ${currentTaskIndex + 1} exited with code ${e.status}, but that's expected.`));
    } else {
      console.log(chalk.red(`⚠️ Skipped Task ${currentTaskIndex + 1} due to error: ${e.message}`));
    }
  }

  context.currentTaskIndex++;
  saveProgress(progressFile, context.currentTaskIndex, context.showCount);

  if (context.currentTaskIndex < tasks.length) {
    return { success: true, nextTask: context.currentTaskIndex };
  } else {
    console.log(chalk.green.bold("\n🎉 Congratulations! You've completed all tasks."));
    console.log(chalk.blue("You can use 'reset' to start over, or 'exit' to quit."));
    context.currentTaskIndex = tasks.length - 1; // Stay at the last task
    saveProgress(progressFile, context.currentTaskIndex, context.showCount);
    return { success: true, completed: true };
  }
}

/**
 * Handle 'show' command - reveal the correct answer
 */
function handleShow(context) {
  const { tasks, currentTaskIndex, progressFile } = context;
  const task = tasks[currentTaskIndex];
  
  context.showCount++;
  saveProgress(progressFile, context.currentTaskIndex, context.showCount);
  
  const cmdToShow = maybeAddSudo(getExpectedCommand(task), task);
  console.log(chalk.cyan(`💡 The correct command is: ${chalk.bold(cmdToShow)}`));
  console.log(chalk.yellow("Now try running it below:"));
  
  return { success: true };
}

/**
 * Handle 'explain' command - show explanation
 */
function handleExplain(context) {
  const { tasks, currentTaskIndex } = context;
  const task = tasks[currentTaskIndex];
  
  if (task.explanation) {
    console.log(chalk.cyan(`📘 Explanation for '${getExpectedCommand(task)}':`));
    console.log(chalk.white(task.explanation));
  } else {
    console.log(chalk.yellow("⚠️ No explanation available for this task yet."));
  }
  
  return { success: true };
}

/**
 * Handle 'go' command - fast forward to specific task
 */
function handleGo(context, input) {
  const { tasks, currentTaskIndex, progressFile } = context;
  const parts = input.trim().split(' ');
  const target = parseInt(parts[1], 10);
  const hasSkipFlag = parts.includes('--skip') || parts.includes('-skip') || parts.includes('skip');
  
  if (isNaN(target) || target < 1 || target > tasks.length) {
    console.log(chalk.red("❌ Invalid task number. Use: go 4"));
    return { success: false };
  }

  // Skip mode: just jump to the task without running anything
  if (hasSkipFlag) {
    context.currentTaskIndex = target - 1;
    saveProgress(progressFile, context.currentTaskIndex, context.showCount);
    return { success: true, jumpToTask: target - 1 };
  }

  const start = currentTaskIndex;
  const end = target - 1;

  if (start >= end) {
    console.log(chalk.yellow(`⚠️ You're already at or past Task ${target}.`));
    return { success: false };
  }

  console.log(chalk.blue(`⏩ Fast-forwarding from Task ${start + 1} to Task ${target}...`));
  fastForwardTasks(tasks, start, end);

  context.currentTaskIndex = end;
  saveProgress(progressFile, context.currentTaskIndex, context.showCount);
  return { success: true, jumpToTask: end };
}

/**
 * Fast forward through multiple tasks
 */
function fastForwardTasks(tasks, start, end) {
  for (let i = start; i < end; i++) {
    const task = tasks[i];
    let cmd = getExpectedCommand(task);
    cmd = maybeAddSudo(cmd, task);
    const isWindows = process.platform === 'win32';
    const isLinux = process.platform === 'linux';
    
    // Skip tasks that don't work on current platform
    if (task.doesntWork) {
      console.log(chalk.yellow(`⏭️ Skipped ${i + 1}: Task marked as not working`));
      continue;
    }
    
    if (isWindows && task.doesntWorkOnWindows) {
      console.log(chalk.yellow(`⏭️ Skipped ${i + 1}: Task doesn't work on Windows`));
      continue;
    }
    
    // Skip browser commands and GUI editors on Linux (no display in Docker containers)
    // These would fail because there's no graphical environment
    if (isLinux && (task.isBrowserCommand || task.requiresDisplay)) {
      console.log(chalk.yellow(`⏭️ Skipped ${i + 1}: Requires display - not available in headless environment`));
      continue;
    }
    
    try {
      console.log(chalk.gray(`▶ Running ${i + 1}: ${cmd}`));
      
      // Execute beforeCommand (or windowsBeforeCommand on Windows) if available
      const beforeCommandToUse = isWindows && task.windowsBeforeCommand
        ? task.windowsBeforeCommand
        : task.beforeCommand;

      if (beforeCommandToUse) {
        try {
          let beforeCmd = maybeAddSudo(beforeCommandToUse, task, true);
          console.log(chalk.gray(`🔧 Setting up with: ${beforeCmd}`));
          execSync(beforeCmd, { stdio: 'ignore', shell: true });
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
      
      // Execute afterCommand (or windowsAfterCommand on Windows) if available
      const afterCommandToUse = isWindows && task.windowsAfterCommand
        ? task.windowsAfterCommand
        : task.afterCommand;

      if (afterCommandToUse) {
        try {
          let afterCmd = maybeAddSudo(afterCommandToUse, task);
          console.log(chalk.gray(`🧹 Cleaning up with: ${afterCmd}`));
          execSync(afterCmd, { stdio: 'ignore', shell: true });
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
      
      // Still execute afterCommand (or windowsAfterCommand on Windows) even if main command failed
      const afterCommandToUseOnError = isWindows && task.windowsAfterCommand
        ? task.windowsAfterCommand
        : task.afterCommand;

      if (afterCommandToUseOnError) {
        try {
          let afterCmdErr = maybeAddSudo(afterCommandToUseOnError, task);
          console.log(chalk.gray(`🧹 Cleaning up with: ${afterCmdErr}`));
          execSync(afterCmdErr, { stdio: 'ignore', shell: true });
          console.log(chalk.gray("🧼 Cleanup completed."));
        } catch (e) {
          console.log(chalk.red(`⚠️ Failed to run afterCommand: ${e.message}`));
        }
      }
    }
  }
}

module.exports = {
  handleReset,
  handleRetry,
  handleSkip,
  handleShow,
  handleExplain,
  handleGo
};
