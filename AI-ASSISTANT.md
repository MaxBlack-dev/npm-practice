# AI Assistant Feature

## Overview
The npm-practice CLI now includes an optional AI assistant powered by Google AI (Gemini) that can answer your npm and Node.js questions while you learn.

## Features
- **100% Free**: Uses Google AI's free tier (15 requests/min, 1500/day)
- **Context-Aware**: Understands your current task and provides relevant answers
- **No Credit Card**: Just sign in with your Google account
- **Privacy**: API key stored locally in `~/.npm-practice/gemini-api-key`

## Setup

### During Installation
When you run `run-me.sh` (Mac/Linux) or `run-me.cmd` (Windows), you'll be asked:
```
🤖 Would you like to set up the AI assistant? (optional)
Set up AI assistant now? (y/n):
```

If you choose **Yes**:
1. Browser opens to Google AI Studio
2. Sign in with your Google account
3. Click "Get API Key" → "Create API Key"
4. Copy the API key
5. Paste it in the terminal
6. Done! AI is ready to use

### Manual Setup Later
If you skipped setup, run:
```bash
node setup-ai.js
```

## Usage

### In the npm-practice CLI:

```bash
# Ask any npm question
> ai what is npm install?

# Get help with current task
> ai explain this task

# Ask about npm concepts
> ai what's the difference between npm install and npm ci?

# Get command examples
> ai show me examples of npm version

# Troubleshooting help
> ai why did my npm install fail?
```

### Examples:

**Question**: `ai what is package.json?`

**AI Response**:
```
package.json is the heart of your Node.js project. It's a JSON file that contains:

1. Project metadata (name, version, description)
2. Dependencies your project needs
3. Scripts you can run (like 'npm start', 'npm test')
4. Other configuration

Think of it as your project's ID card and instruction manual combined!
```

**Question**: `ai what does npm install do?`

**AI Response**:
```
npm install does three things:

1. Reads your package.json file
2. Downloads all listed dependencies from npm registry
3. Installs them into the node_modules folder

Example: If package.json lists "axios": "^1.0.0", 
running npm install will download axios and put it in node_modules/axios

You can also use it to install specific packages:
npm install lodash
```

## Privacy & Security

- **API Key Storage**: Stored locally in `~/.npm-practice/gemini-api-key`
- **File Permissions**: Key file is chmod 600 (read/write by owner only)
- **No Data Collection**: Your questions go directly to Google AI, not stored by npm-practice
- **Google AI Privacy**: Follow Google's AI terms: https://ai.google.dev/terms

## Limits (Free Tier)

- **15 requests per minute**
- **1,500 requests per day**
- **No credit card required**

These limits are MORE than enough for learning npm!

## Troubleshooting

### "AI is not configured"
Run `node setup-ai.js` to set up your API key.

### "Invalid API key"
1. Delete old key: `rm ~/.npm-practice/gemini-api-key`
2. Run `node setup-ai.js` again
3. Get a fresh API key from https://aistudio.google.com/app/apikey

### Browser doesn't open automatically
Manually visit: https://aistudio.google.com/app/apikey

### Rate limit exceeded
Wait a minute or come back tomorrow. The free tier resets daily.

## Disable AI

To remove AI assistant:
```bash
rm -rf ~/.npm-practice
```

Then reinstall dependencies:
```bash
npm install
```

## Cost

**Completely FREE!** ✅

Google AI (Gemini) offers a generous free tier with no credit card required.

---

**Happy Learning!** 🚀
