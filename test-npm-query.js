const { execSync } = require('child_process');

// Test npm query with > redirection character
const command = 'npm query ":root  >  *"';
console.log('Testing command:', command);

try {
  const output = execSync(command, {
    stdio: 'pipe',
    shell: true,
    cwd: 'C:\\Users\\husiv\\VsCodeProjects\\npm-practice\\my-npm-project',
    encoding: 'utf8'
  });
  console.log('Success! Found', (output.match(/"name":/g) || []).length, 'packages');
  if (output.includes('axios')) {
    console.log('✓ axios found in output');
  }
} catch (e) {
  console.error('Error:', e.message);
}
