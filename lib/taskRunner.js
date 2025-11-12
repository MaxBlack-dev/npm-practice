const { exec, execSync, spawn } = require('child_process');
const chalk = require('chalk');
const { maybeAddSudo, validate } = require('./utils');
const { runAfterCommand, completeTask } = require('./taskLifecycle');

/**
 * Check if user entered the exact expected command
 */
function isExactMatch(userCommand, task) {
  const expectedCommand = task.expectedCommand;
  const expectedCommandWithSudo = maybeAddSudo(task.expectedCommand, task);
  
  return userCommand === expectedCommand || userCommand === expectedCommandWithSudo;
}

/**
 * Check if user is attempting the current task
 */
function isAttemptingTask(userCommand, task) {
  const strictMatch = task.strictCommandMatch === true;
  const userCommandWithoutSudo = userCommand.replace(/^sudo\s+/, '');
  const expectedCommand = task.expectedCommand;
  const expectedCommandWithSudo = maybeAddSudo(task.expectedCommand, task);
  
  if (strictMatch) {
    return userCommand === expectedCommand || userCommand === expectedCommandWithSudo;
  }
  
  return userCommand === expectedCommand || 
         userCommand === expectedCommandWithSudo ||
         userCommandWithoutSudo === expectedCommand ||
         expectedCommand.includes(userCommandWithoutSudo.split(' ')[0]);
}

/**
 * Validate if task was completed successfully
 */
function validateTaskCompletion(task, stdout, stderr, err) {
  const output = stdout.trim() + stderr.trim();
  const commandSucceeded = !err;
  const nonZeroOkay = task.nonZeroOkay === true;
  const isOutputBased = !!task.outputIncludes;
  const hasCheckCommand = !!task.checkCommand;
  
  // Priority 1: If task has outputIncludes, validate output
  if (isOutputBased) {
    const outputValid = task.outputIncludes === "" 
      ? output === "" 
      : output.includes(task.outputIncludes);
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
    const expectedResult = execSync(task.expectedCommand, { 
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
        
        if (isExact) {
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
        } else {
          if (err) {
            console.log(chalk.red(`❌ Command failed: ${stderr.trim()}`));
          } else {
            console.log(chalk.red("❌ Output did not match expected result."));
          }
        }
        retryPromptFn();
      }
    } else {
      if (task.strictCommandMatch === true) {
        const expectedCmd = maybeAddSudo(task.expectedCommand, task);
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
      
      if (isExact) {
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
