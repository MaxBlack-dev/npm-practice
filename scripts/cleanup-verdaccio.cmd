@echo off
REM Cleanup Verdaccio process and data on Windows
REM Used by Task 59 afterCommand

set VERDACCIO_DIR=%APPDATA%\verdaccio
set PID_FILE=%VERDACCIO_DIR%\verdaccio.pid
set LOG_FILE=%CD%\verdaccio.log

REM Kill Verdaccio process if PID file exists
if exist "%PID_FILE%" (
    for /f %%i in ('type "%PID_FILE%"') do (
        taskkill /F /PID %%i 2>nul
    )
    del /F /Q "%PID_FILE%" 2>nul
)

REM Also try to kill any process on port 4873
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :4873 2^>nul') do (
    taskkill /F /PID %%a 2>nul
)

REM Remove Verdaccio directory
if exist "%VERDACCIO_DIR%" (
    rmdir /S /Q "%VERDACCIO_DIR%" 2>nul
)

REM Remove log file
if exist "%LOG_FILE%" (
    del /F /Q "%LOG_FILE%" 2>nul
)

exit /b 0
