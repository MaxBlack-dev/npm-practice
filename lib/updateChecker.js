const latestVersion = require('latest-version');
const chalk = require('chalk');
const { execSync } = require('child_process');

const PACKAGE_NAME = '@max-black/npm-practice';

async function checkForUpdates(currentVersion) {
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
