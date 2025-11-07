#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { exec } = require('child_process');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.npm-practice');
const API_KEY_FILE = path.join(CONFIG_DIR, 'gemini-api-key');

console.log('\n🤖 Setting up AI Assistant (Google Gemini)');
console.log('═'.repeat(60));

// Create config directory if it doesn't exist
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// Check if API key already exists
if (fs.existsSync(API_KEY_FILE)) {
  console.log('✅ AI Assistant is already configured!');
  console.log('   If you want to reconfigure, delete:', API_KEY_FILE);
  process.exit(0);
}

console.log('\n📝 To use the AI assistant, you need a free Google AI API key.');
console.log('   This is 100% FREE with generous limits:');
console.log('   • 15 requests per minute');
console.log('   • 1,500 requests per day');
console.log('   • No credit card required!');
console.log('\n📌 Steps:');
console.log('   1. The browser will open to Google AI Studio');
console.log('   2. Sign in with your Google account');
console.log('   3. Click "Get API Key" → "Create API Key"');
console.log('   4. Copy the API key');
console.log('   5. Paste it back here');
console.log('\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Press Enter to open the browser and get your API key... ', () => {
  console.log('\n🌐 Opening Google AI Studio in your browser...');
  
  const url = 'https://aistudio.google.com/app/apikey';
  const command = process.platform === 'darwin' ? 'open' :
                  process.platform === 'win32' ? 'start' : 'xdg-open';
  
  exec(`${command} "${url}"`, (error) => {
    if (error) {
      console.log('\n⚠️  Could not open browser automatically.');
      console.log('   Please open this URL manually:', url);
    }
  });
  
  console.log('\n🔑 Once you have your API key, paste it below:');
  console.log('   (The key will be saved securely in:', API_KEY_FILE, ')');
  console.log('');
  
  rl.question('API Key: ', (apiKey) => {
    const trimmedKey = apiKey.trim();
    
    if (!trimmedKey || trimmedKey.length < 20) {
      console.log('\n❌ Invalid API key. Please run this setup again.');
      rl.close();
      process.exit(1);
    }
    
    // Save the API key
    try {
      fs.writeFileSync(API_KEY_FILE, trimmedKey, { mode: 0o600 });
      console.log('\n✅ API key saved successfully!');
      console.log('🤖 You can now use the "ai" command in npm-practice');
      console.log('   Example: ai explain npm install');
      console.log('   Example: ai what is package.json?');
      console.log('');
    } catch (error) {
      console.log('\n❌ Failed to save API key:', error.message);
      process.exit(1);
    }
    
    rl.close();
  });
});
