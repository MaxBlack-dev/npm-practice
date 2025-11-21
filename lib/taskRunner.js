const { exec, execSync, spawn } = require('child_process');
const chalk = require('chalk');
const { maybeAddSudo, validate, getExpectedCommand, getOutputIncludes } = require('./utils');
const { runAfterCommand, completeTask } = require('./taskLifecycle');

/**
 * Check if user entered the exact expected command
 */
function isExactMatch(userCommand, task) {
  const expectedCommand = getExpectedCommand(task);
  const expectedCommandWithSudo = maybeAddSudo(expectedCommand, task);
  
  return userCommand === expectedCommand || userCommand === expectedCommandWithSudo;
}

/**
 * Check if user is attempting the current task
 */
function isAttemptingTask(userCommand, task) {
  const strictMatch = task.strictCommandMatch === true;
  const userCommandWithoutSudo = userCommand.replace(/^sudo\s+/, '');
  const expectedCommand = getExpectedCommand(task);
  const expectedCommandWithSudo = maybeAddSudo(expectedCommand, task);
  
  if (strictMatch) {
    return userCommand === expectedCommand || userCommand === expectedCommandWithSudo;
  }
  
  return userCommand === expectedCommand || 
         userCommand === expectedCommandWithSudo ||
         userCommandWithoutSudo === expectedCommand ||
         expectedCommand.includes(userCommandWithoutSudo.split(' ')[0]);
}

/**
 * Check if user typed the wrong platform-specific command
 */
function isWrongPlatformCommand(userCommand, task) {
  const isWindows = process.platform === 'win32';
  const wrongCommand = isWindows ? task.expectedCommand : task.windowsExpectedCommand;
  
  if (!wrongCommand) return false;
  
  return userCommand === wrongCommand || userCommand === maybeAddSudo(wrongCommand, task);
}

/**
 * Validate if task was completed successfully
 */
function validateTaskCompletion(task, stdout, stderr, err) {
  const output = stdout.trim() + stderr.trim();
  const commandSucceeded = !err;
  const nonZeroOkay = task.nonZeroOkay === true;
  const outputIncludes = getOutputIncludes(task);
  const isOutputBased = !!outputIncludes;
  const hasCheckCommand = !!task.checkCommand;
  
  // Priority 1: If task has outputIncludes, validate output
  if (isOutputBased) {
    const outputValid = outputIncludes === "" 
      ? output === "" 
      : output.includes(outputIncludes);
    return (commandSucceeded || nonZeroOkay) && outputValid;
  }
  
  // Priority 2: If task has checkCommand, validate state
  if (hasCheckCommand) {
    return validate(task);
  }
  
  // Priority 3: Check if browser command or compare outputs
  const isBrowserCommand = task.isBrowserCommand === true;
  
  if (isBrowserCommand) {
    return commandSucceeded || nonZeroOkay;
  }
  
  // Compare user output with expected output
  try {
    const expectedCommand = getExpectedCommand(task);
    const expectedResult = execSync(expectedCommand, { 
      shell: true, 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const expectedOutput = expectedResult.trim();
    const userOutput = stdout.trim();
    
    const passed = commandSucceeded && userOutput === expectedOutput;
    
    if (!passed && commandSucceeded) {
      console.log(chalk.yellow(`⚠️ Output doesn't match expected result.`));
      console.log(chalk.gray(`Expected: ${expectedOutput}`));
      console.log(chalk.gray(`Got: ${userOutput}`));
    }
    
    return passed;
  } catch (expectedErr) {
    return !commandSucceeded;
  }
}

/**
 * Execute user command and validate task completion
 */
function executeUserCommand(trimmed, context, showTaskFn, retryPromptFn, rlInstance) {
  const task = context.tasks[context.currentTaskIndex];
  const isWindows = process.platform === 'win32';
  const isLinux = process.platform === 'linux';
  
  // For tasks that don't work on Windows specifically, skip execution if exact match
  if (isWindows && task.doesntWorkOnWindows && isExactMatch(trimmed, task)) {
    console.log(chalk.yellow("⚠️  This command doesn't work on Windows."));
    console.log(chalk.gray("💡 Since you entered the correct command, you can type 'skip' to continue."));
    runAfterCommand(task);
    completeTask(context, showTaskFn, retryPromptFn);
    return;
  }
  
  // For browser commands and GUI editors on Linux (no display), validate command but don't execute
  if (isLinux && (task.isBrowserCommand || task.requiresDisplay) && isExactMatch(trimmed, task)) {
    console.log(chalk.yellow("⚠️  This command requires a graphical display (browser/editor)."));
    console.log(chalk.green("✅ Task completed successfully."));
    console.log(chalk.gray("💡 Command was validated but not executed (no display available in this environment)."));
    runAfterCommand(task);
    completeTask(context, showTaskFn, retryPromptFn);
    return;
  }
  
  exec(trimmed, { shell: true }, (err, stdout, stderr) => {
    // Show output
    if (stdout.trim()) console.log(chalk.white(stdout.trim()));
    if (stderr.trim()) console.log(chalk.yellow(stderr.trim()));

    if (isAttemptingTask(trimmed, task)) {
      const passed = validateTaskCompletion(task, stdout, stderr, err);

      if (passed) {
        runAfterCommand(task);
        completeTask(context, showTaskFn, retryPromptFn);
      } else {
        // Check if user entered the exact expected command
        const isExact = isExactMatch(trimmed, task);
        const isWindows = process.platform === 'win32';
        
        // For tasks with doesntWork flag (npm bugs), accept exact command match
        if (isExact && task.doesntWork) {
          console.log(chalk.green("✅ Task completed successfully."));
          runAfterCommand(task);
          completeTask(context, showTaskFn, retryPromptFn);
        } else if (isExact && isWindows && task.doesntWorkOnWindows) {
          // Command doesn't work on Windows specifically
          console.log(chalk.yellow("⚠️  This command doesn't work on Windows."));
          console.log(chalk.gray("💡 Type 'skip' to continue to the next task."));
          retryPromptFn();
        } else if (isExact) {
          // User entered correct command but validation failed - likely environment issue
          console.log("");
          console.log(chalk.bgYellow.black(" ⚠️  ENVIRONMENT ISSUE DETECTED "));
          console.log("");
          console.log(chalk.yellow("You entered the correct command, but the validation failed."));
          console.log(chalk.yellow("This usually means your environment is in an inconsistent state."));
          console.log("");
          console.log(chalk.cyan.bold("💡 Recommended actions:"));
          console.log(chalk.white("   • Type ") + chalk.bold.green("'retry'") + chalk.white(" to reset the environment and return to this task"));
          console.log(chalk.white("   • Type ") + chalk.bold.green("'skip'") + chalk.white(" to skip this task and continue"));
          console.log("");
          retryPromptFn();
        } else {
          if (err) {
            console.log(chalk.red(`❌ Command failed: ${stderr.trim()}`));
          } else {
            console.log(chalk.red("❌ Output did not match expected result."));
          }
          retryPromptFn();
        }
      }
    } else {
      // Check if user typed the wrong platform-specific command
      if (isWrongPlatformCommand(trimmed, task)) {
        const correctCmd = getExpectedCommand(task);
        const isWindows = process.platform === 'win32';
        console.log(chalk.yellow(`⚠️  You entered the ${isWindows ? 'Linux/Mac' : 'Windows'} version of this command.`));
        console.log(chalk.cyan(`💡 On ${isWindows ? 'Windows' : 'Linux/Mac'}, use: ${chalk.bold(correctCmd)}`));
        console.log(chalk.gray("   Type 'show' to see the correct command for your platform."));
      } else if (task.strictCommandMatch === true) {
        const expectedCmd = maybeAddSudo(getExpectedCommand(task), task);
        console.log(chalk.red(`❌ That's not the expected command. This task requires: ${chalk.bold(expectedCmd)}`));
        console.log(chalk.gray("💡 Try typing 'show' to reveal the correct command."));
      }
      rlInstance.prompt();
    }
  });
}

/**
 * Handle tasks that require user input (interactive commands)
 */
function handleUserInputTask(trimmed, context, showTaskFn, retryPromptFn, rlInstance) {
  rlInstance.pause();

  const args = trimmed.split(' ');
  const login = spawn(args[0], args.slice(1), { stdio: 'inherit', shell: true });

  login.on('exit', (code) => {
    rlInstance.resume();

    const task = context.tasks[context.currentTaskIndex];
    const stateValid = task.checkCommand ? validate(task) : true;

    if (stateValid) {
      runAfterCommand(task);
      completeTask(context, showTaskFn, retryPromptFn);
    } else {
      // Check if user entered the exact expected command
      const isExact = isExactMatch(trimmed, task);
      const isWindows = process.platform === 'win32';
      const isKnownToFail = (isWindows && task.doesntWorkOnWindows) || task.doesntWork;
      
      if (isExact && !isKnownToFail) {
        // User entered correct command but validation failed - likely environment issue
        console.log("");
        console.log(chalk.bgYellow.black(" ⚠️  ENVIRONMENT ISSUE DETECTED "));
        console.log("");
        console.log(chalk.yellow("You entered the correct command, but the validation failed."));
        console.log(chalk.yellow("This usually means your environment is in an inconsistent state."));
        console.log("");
        console.log(chalk.cyan.bold("💡 Recommended actions:"));
        console.log(chalk.white("   • Type ") + chalk.bold.green("'retry'") + chalk.white(" to reset the environment and return to this task"));
        console.log(chalk.white("   • Type ") + chalk.bold.green("'skip'") + chalk.white(" to skip this task and continue"));
        console.log("");
      } else if (isExact && isKnownToFail) {
        // Command is known not to work on this platform
        console.log(chalk.yellow("⚠️  This command doesn't work on " + (isWindows ? "Windows" : "this platform") + "."));
        console.log(chalk.gray("💡 Type 'skip' to continue to the next task."));
      } else {
        console.log(chalk.red("❌ Task failed. Try again or type 'show' for help."));
      }
      retryPromptFn();
    }
  });
}

/**
 * Handle 'cd' command specially to change process directory
 */
function handleCdCommand(targetDir, context, showTaskFn, retryPromptFn) {
  const fs = require('fs');
  const path = require('path');
  const { saveProgress } = require('./utils');
  
  const fullPath = path.resolve(process.cwd(), targetDir);

  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
    process.chdir(fullPath);
    console.log(chalk.green(`📂 Changed directory to: ${process.cwd()}`));
    
    if (context.tasks[context.currentTaskIndex]) {
      completeTask(context, showTaskFn, retryPromptFn);
    } else {
      retryPromptFn();
    }
  } else {
    console.log(chalk.red(`❌ Directory not found: ${targetDir}`));
    retryPromptFn();
  }
}

module.exports = {
  isExactMatch,
  isAttemptingTask,
  validateTaskCompletion,
  executeUserCommand,
  handleUserInputTask,
  handleCdCommand
};
