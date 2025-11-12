const fs = require('fs');
const path = require('path');
const os = require('os');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const CONFIG_DIR = path.join(os.homedir(), '.npm-practice');
const API_KEY_FILE = path.join(CONFIG_DIR, 'gemini-api-key');

let genAI = null;
let model = null;

function isAIConfigured() {
  return fs.existsSync(API_KEY_FILE);
}

function initializeAI() {
  if (!isAIConfigured()) {
    return false;
  }
  
  try {
    const apiKey = fs.readFileSync(API_KEY_FILE, 'utf8').trim();
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    
    // Log initialization (only in debug mode)
    if (process.env.DEBUG_AI) {
      const timestamp = new Date().toISOString();
      const logFile = path.join(CONFIG_DIR, 'ai-usage.log');
      fs.appendFileSync(logFile, `${timestamp} - AI initialized\n`);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to initialize AI:', error.message);
    return false;
  }
}

async function askAI(question, currentTask = null) {
  if (!model && !initializeAI()) {
    return 'AI is not configured. Please run the setup script first.';
  }
  
  // Log AI usage
  if (process.env.DEBUG_AI) {
    const timestamp = new Date().toISOString();
    const logFile = path.join(CONFIG_DIR, 'ai-usage.log');
    fs.appendFileSync(logFile, `${timestamp} - AI request: "${question.substring(0, 50)}..."\n`);
  }
  
  try {
    // Build context-aware prompt
    let prompt = '';
    
    if (currentTask) {
      prompt = `You are an expert npm and Node.js tutor helping a beginner learn npm commands.

Current Task: ${currentTask.description}
Expected Command: ${currentTask.expectedCommand}
${currentTask.explanation ? `Explanation: ${currentTask.explanation}` : ''}

User Question: ${question}

Provide a clear, concise, and beginner-friendly answer. Focus on:
1. Answering the specific question
2. Relating it to the current task if relevant
3. Providing practical examples
4. Keeping it under 200 words

Answer:`;
    } else {
      prompt = `You are an expert npm and Node.js tutor helping a beginner learn npm commands.

User Question: ${question}

Provide a clear, concise, and beginner-friendly answer with practical examples. Keep it under 200 words.

Answer:`;
    }
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    return text.trim();
  } catch (error) {
    if (error.message && error.message.includes('API_KEY_INVALID')) {
      return 'Invalid API key. Please run setup-ai.js again to reconfigure.';
    }
    return `AI Error: ${error.message || 'Unable to get response. Please try again.'}`;
  }
}

module.exports = {
  isAIConfigured,
  initializeAI,
  askAI
};
