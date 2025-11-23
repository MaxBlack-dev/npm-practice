const chalk = require('chalk');
const { execSync } = require('child_process');

const PACKAGE_NAME = '@max-black/npm-practice';

// Try to load latest-version, but don't crash if missing
let latestVersion;
try {
  latestVersion = require('latest-version');
} catch (error) {
  // Module not installed - user needs to run npm install
  // This can happen in development after pulling new changes
}

async function checkForUpdates(currentVersion) {
  // Skip update check if latest-version module is missing
  if (!latestVersion) {
    return;
  }
  
  try {
    const latest = await latestVersion(PACKAGE_NAME, { version: 'latest' });
    
    if (latest !== currentVersion) {
      console.log('');
      console.log(chalk.bgYellow.black(' 🔔 UPDATE AVAILABLE '));
      console.log('');
      console.log(chalk.yellow(`  A new version of ${PACKAGE_NAME} is available!`));
      console.log(chalk.gray(`  Current: ${currentVersion}`));
      console.log(chalk.green(`  Latest:  ${latest}`));
      console.log('');
      console.log(chalk.cyan(`  Run: ${chalk.bold('npm install -g ' + PACKAGE_NAME + '@latest')}`));
      console.log(chalk.gray('  to update to the latest version.'));
      console.log('');
    }
  } catch (error) {
    // Silently fail if offline or registry unreachable
    // Don't interrupt user experience with update check errors
  }
}

module.exports = { checkForUpdates };
