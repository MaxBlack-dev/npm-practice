@echo off
echo 🔧 Making index.js executable...
REM Windows doesn't need chmod, so we skip it

echo 🔗 Linking package globally with npm...
npm link

echo ✅ Setup complete! You can now run 'npm-practice' from any terminal.
pause