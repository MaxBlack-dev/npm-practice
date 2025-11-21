#!/usr/bin/env node

const { spawn } = require('child_process');
const net = require('net');
const fs = require('fs');
const path = require('path');
const os = require('os');

(async function main(){
  try {
    const appData = process.env.APPDATA || path.join(os.homedir(), '.config');
    const cfgDir = path.join(appData, 'verdaccio');
    if (!fs.existsSync(cfgDir)) fs.mkdirSync(cfgDir, { recursive: true });

    const cfgPath = path.join(cfgDir, 'config.yaml');
    const logPath = path.join(cfgDir, 'verdaccio.log');

    // If config does not exist, write a default one
    if (!fs.existsSync(cfgPath)) {
      const config = `storage: ./storage\nauth:\n  htpasswd:\n    file: ./htpasswd\nuplinks:\n  npmjs:\n    url: https://registry.npmjs.org/\n    timeout: 1s\n    max_fails: 1\n    fail_timeout: 1s\npackages:\n  '**':\n    access: $all\n    publish: $authenticated\n    unpublish: $authenticated\nlogs: { type: stdout, format: pretty, level: warn }\n`;
      fs.writeFileSync(cfgPath, config, 'utf8');
    }

    // Start verdaccio via npx so global install isn't required.
    // Use the shell option on Windows to allow the platform to resolve npx correctly.
    const command = `npx verdaccio --listen 0.0.0.0:4873`;
    const out = fs.openSync(logPath, 'a');
    const err = fs.openSync(logPath, 'a');

    const child = spawn(command, {
      detached: true,
      stdio: ['ignore', out, err],
      shell: true
    });

    // detach so the parent can exit while Verdaccio keeps running
    child.unref();

    // Wait for port to open
    const timeoutMs = 20000;
    const start = Date.now();

    await new Promise((resolve, reject) => {
      (function check() {
        const sock = net.connect(4873, '127.0.0.1', () => {
          sock.end();
          resolve();
        });
        sock.on('error', () => {
          if (Date.now() - start > timeoutMs) return reject(new Error('Verdaccio did not start in time'));
          setTimeout(check, 500);
        });
      })();
    });

    console.log('Verdaccio started');
    process.exit(0);
  } catch (err) {
    console.error('Failed to start Verdaccio:', err.message || err);
    process.exit(1);
  }
})();
