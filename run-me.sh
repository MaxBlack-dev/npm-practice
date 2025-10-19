#!/bin/bash

echo "🔧 Making index.js executable..."
chmod +x index.js

echo "🔧 Install required dependencies..."
npm install

echo "🔗 Linking package globally with npm..."
npm link

echo "✅ Setup complete! You can now run 'npm-practice' from any terminal."