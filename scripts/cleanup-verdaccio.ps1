# Kill any Verdaccio processes and clean up locked files
Write-Host "Cleaning up Verdaccio..."

# Find and kill verdaccio processes
$verdaccioProcs = Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {
    $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)" -ErrorAction SilentlyContinue).CommandLine
    $cmd -like "*verdaccio*"
}

foreach ($proc in $verdaccioProcs) {
    Write-Host "Killing Verdaccio process $($proc.Id)"
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}

# Wait for processes to die
Start-Sleep -Seconds 2

# Clean up files
$logFile = "$env:APPDATA\verdaccio\verdaccio.log"
$pidFile = "$env:APPDATA\verdaccio\verdaccio.pid"

if (Test-Path $logFile) {
    Remove-Item $logFile -Force -ErrorAction SilentlyContinue
    Write-Host "Removed log file"
}

if (Test-Path $pidFile) {
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    Write-Host "Removed PID file"
}

Write-Host "✓ Cleanup complete"
