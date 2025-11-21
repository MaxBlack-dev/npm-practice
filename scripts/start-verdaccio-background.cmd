@echo off
REM Start Verdaccio in background on Windows
setlocal enabledelayedexpansion

set PORT=4873
set VERDACCIO_DIR=%APPDATA%\verdaccio
set LOG_FILE=%VERDACCIO_DIR%\verdaccio.log
set PID_FILE=%VERDACCIO_DIR%\verdaccio.pid

echo === Starting Verdaccio in background ===

REM Create verdaccio directory if needed
if not exist "%VERDACCIO_DIR%" mkdir "%VERDACCIO_DIR%"

REM Kill existing process if PID file exists
if exist "%PID_FILE%" (
    set /p OLD_PID=<"%PID_FILE%"
    echo Found existing PID file: !OLD_PID!
    taskkill /PID !OLD_PID! /F >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        echo Stopped process !OLD_PID!
    ) else (
        echo Process !OLD_PID! not running
    )
    del "%PID_FILE%" >nul 2>&1
)

REM Clear old config
echo Clearing Verdaccio data at %VERDACCIO_DIR%
if exist "%VERDACCIO_DIR%\config.yaml" del "%VERDACCIO_DIR%\config.yaml" >nul 2>&1
if exist "%VERDACCIO_DIR%\storage" rd /s /q "%VERDACCIO_DIR%\storage" >nul 2>&1
if exist "%VERDACCIO_DIR%\htpasswd" del "%VERDACCIO_DIR%\htpasswd" >nul 2>&1

REM Start Verdaccio in background using START /B
echo Starting Verdaccio...
start /B verdaccio --listen 0.0.0.0:%PORT% > "%LOG_FILE%" 2>&1

REM Give it a moment to start
timeout /t 2 /nobreak >nul

REM Find the Verdaccio node process and save its PID
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq node.exe" /NH 2^>nul ^| findstr /R "node.exe"') do (
    set NODE_PID=%%a
    goto :found_pid
)

:found_pid
if defined NODE_PID (
    echo %NODE_PID%> "%PID_FILE%"
    echo Started Verdaccio with PID %NODE_PID%
) else (
    echo Warning: Could not find node.exe process
)

REM Wait for Verdaccio to be ready (max 30 seconds)
echo Waiting for Verdaccio to respond...
set /a ATTEMPTS=0
:check_loop
set /a ATTEMPTS+=1
if %ATTEMPTS% GTR 30 (
    echo ERROR: Verdaccio did not become ready in time
    echo Check log: %LOG_FILE%
    exit /b 1
)

REM Check if Verdaccio is responding
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:%PORT%' -TimeoutSec 2 -ErrorAction Stop; if ($r.Content -match 'Verdaccio') { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Verdaccio is ready!
    echo Log file: %LOG_FILE%
    if defined NODE_PID echo PID file: %PID_FILE%
    exit /b 0
)

timeout /t 1 /nobreak >nul
goto :check_loop
