@echo off
cd /d "%~dp0my-npm-project"
echo Testing Verdaccio start script...
node ..\scripts\start-verdaccio-detached.js
if %ERRORLEVEL% EQU 0 (
    echo SUCCESS: Script completed with exit code 0
) else (
    echo FAILED: Script exited with code %ERRORLEVEL%
)
pause
