@echo off
echo 🔧 Install required dependencies...
npm install

echo.
echo 🤖 Would you like to set up the AI assistant? (optional)
echo    The AI can answer your npm questions while you learn.
echo    It's 100% FREE using Google AI (Gemini).
echo.
set /p AI_SETUP="Set up AI assistant now? (y/n): "

if /i "%AI_SETUP%"=="y" (
  node setup-ai.js
) else (
  echo ⏭️  Skipping AI setup. You can run 'node setup-ai.js' later to set it up.
)

echo.
echo 🔗 Linking package globally with npm...
npm link

echo ✅ Setup complete! You can now run 'npm-practice' from any terminal.
pause