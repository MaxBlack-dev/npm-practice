#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { exec, execSync } = require('child_process');
const chalk = require('chalk');

const tasks = require('./tasks.json');
const progressFile = path.join(__dirname, 'progress.json');
let currentTaskIndex = 0;

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
if (fs.existsSync(progressFile)) {
  try {
    const saved = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
    if (typeof saved.currentTaskIndex === 'number' && saved.currentTaskIndex < tasks.length) {
      currentTaskIndex = saved.currentTaskIndex;
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
  fs.writeFileSync(progressFile, JSON.stringify({ currentTaskIndex }), 'utf8');
}

function showTask(task) {
  console.log(chalk.green.bold(`\n🧠 Task ${currentTaskIndex + 1}/${tasks.length}: ${task.description}`));
  printMessages();
  rl.prompt();
}

function validate(task) {
  const command = task.checkCommand;

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
      const files = fs.readdirSync(process.cwd());
      for (const file of files) {
        const filePath = path.join(process.cwd(), file);
        fs.rmSync(filePath, { recursive: true, force: true });
      }
      console.log(chalk.red("🧹 Cleared all files in current directory."));

      if (fs.existsSync(progressFile)) {
        fs.unlinkSync(progressFile);
        console.log(chalk.red("🧼 Progress reset."));
      }

      currentTaskIndex = 0;
      console.log(chalk.blue("\n🔄 All data cleared. Starting from the beginning..."));
      showTask(tasks[currentTaskIndex]);
    } catch (e) {
      console.log(chalk.red("⚠️ Failed to reset. You may need to delete files manually."));
      showTask(tasks[currentTaskIndex]);
    }
    return;
  }

  if (lower === 'show') {
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
      const task = tasks[i];
      const nonZeroOkay = task.nonZeroOkay === true;

      if (nonZeroOkay) {
        console.log(chalk.gray(`ℹ️ Task ${i + 1} exited with code ${e.status}, but that's expected.`));
      } else {
        console.log(chalk.red(`⚠️ Skipped Task ${i + 1} due to error: ${e.message}`));
      }
    }

    currentTaskIndex++;
    saveProgress();

    if (currentTaskIndex < tasks.length) {
      showTask(tasks[currentTaskIndex]);
    } else {
      console.log(chalk.green.bold("\n🎉 Congratulations! You've completed all tasks."));
      fs.unlinkSync(progressFile);
      rl.close();
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
          fs.unlinkSync(progressFile);
          rl.close();
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
    const target = parseInt(trimmed.split(' ')[1], 10);
    if (isNaN(target) || target < 1 || target > tasks.length) {
      console.log(chalk.red("❌ Invalid task number. Use: go 4"));
      retryPrompt();
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
        execSync(cmd, { stdio: 'ignore', shell: true });
      } catch (e) {
        const nonZeroOkay = task.nonZeroOkay === true;
        if (nonZeroOkay) {
          console.log(chalk.gray(`ℹ️ Task ${i + 1} exited with code ${e.status}, but that's expected.`));
        } else {
          console.log(chalk.red(`⚠️ Skipped Task ${i + 1} due to error: ${e.message}`));
        }
      }
    }

    currentTaskIndex = end;
    saveProgress();
    showTask(tasks[currentTaskIndex]);
    return;
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
      const passed =
          (isOutputBased && (commandSucceeded || nonZeroOkay) && outputValid) ||
          (!isOutputBased && stateValid);

      if (passed) {
        console.log(chalk.green("✅ Task completed successfully."));
        currentTaskIndex++;
        saveProgress();
        if (currentTaskIndex < tasks.length) {
          showTask(tasks[currentTaskIndex]);
        } else {
          console.log(chalk.green.bold("\n🎉 Congratulations! You've completed all tasks."));
          fs.unlinkSync(progressFile);
          rl.close();
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
  console.log(chalk.gray("💡 Type 'show' to reveal the correct command."));
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