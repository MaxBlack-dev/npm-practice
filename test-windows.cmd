@echo off
REM Build and test script for Windows container

echo 🪟 Building Windows Docker image...
docker build -f Dockerfile.windows -t npm-practice-windows .

echo.
echo ✅ Windows image built successfully!
echo.
echo 📝 To test the app in Windows container:
echo    docker run -it --rm npm-practice-windows
echo.
echo Once inside the container, run:
echo    cd C:\app
echo    npm link
echo    cd C:\test-workspace
echo    npm-practice
echo.
echo To run automated tests:
echo    docker run -it --rm npm-practice-windows powershell -Command "cd C:\app; npm test"
