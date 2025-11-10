@echo off
REM Automated test script for Windows container

echo 🪟 Building Windows Docker image...
docker build -f Dockerfile.windows -t npm-practice-windows .

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to build Windows image
    exit /b 1
)

echo.
echo ✅ Windows image built successfully!
echo.
echo 🧪 Running automated tests in Windows container...
echo.

docker run --rm npm-practice-windows powershell -Command "cd C:\npm-practice-source; node test-cli.js"
