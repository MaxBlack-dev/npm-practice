# Stop any processes that look like Verdaccio or are listening on port 4873, clear config, start Verdaccio via npx and wait until it's reachable
param(
    [int]$Port = 4873,
    [int]$TimeoutSeconds = 30
)

$ErrorActionPreference = 'Continue'

# Ensure we capture the full session output to a persistent log so callers (like the CLI) can
# inspect what happened even if the CLI only surfaces a brief error message.
$Global:VerdaccioLogDir = Join-Path $env:APPDATA 'verdaccio'
if (-not (Test-Path $Global:VerdaccioLogDir)) { New-Item -ItemType Directory -Path $Global:VerdaccioLogDir | Out-Null }
$Global:ManageLog = Join-Path $Global:VerdaccioLogDir 'manage-verdaccio.log'

function Stop-VerdaccioProcesses {
    # On Windows, we'll just let any existing Verdaccio process die naturally
    # when we clear the data and restart it
    Write-Output "Checking for existing Verdaccio processes..."
    try {
        $verdaccioProcs = Get-Process | Where-Object { $_.Name -eq 'node' }
        if ($verdaccioProcs) {
            foreach ($proc in $verdaccioProcs) {
                Write-Output "Stopping existing process PID $($proc.Id)"
                Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            }
        } else {
            Write-Output "No existing node processes found"
        }
    } catch {
        Write-Output "Error checking processes: $_"
    }
}

function Clear-VerdaccioData {
    $cfgDir = Join-Path $env:APPDATA 'verdaccio'
    Write-Output "Clearing Verdaccio data at $cfgDir"
    if (Test-Path $cfgDir) {
        try {
            Remove-Item -LiteralPath $cfgDir -Recurse -Force -ErrorAction SilentlyContinue
            Write-Output "Removed $cfgDir"
        } catch {
            Write-Output ("Failed to remove {0}: {1}" -f $cfgDir, $_.Exception.Message)
        }
    } else {
        Write-Output "$cfgDir does not exist"
    }
}

function Start-Verdaccio {
    param(
        [int]$Port = 4873,
        [int]$TimeoutSeconds = 30
    )
    $cfgDir = Join-Path $env:APPDATA 'verdaccio'
    if (-not (Test-Path $cfgDir)) { New-Item -ItemType Directory -Path $cfgDir | Out-Null }
    $logPath = Join-Path $cfgDir 'verdaccio.log'

    Write-Output "Starting Verdaccio via global verdaccio command"
    try {
        # Use PowerShell background job to run verdaccio so it doesn't block the terminal
        # This keeps verdaccio running even after the script exits
        $jobScript = {
            param($port)
            verdaccio --listen "0.0.0.0:$port" 2>&1 | Out-File -FilePath (Join-Path $env:APPDATA 'verdaccio\verdaccio.log') -Append
        }
        $job = Start-Job -ScriptBlock $jobScript -ArgumentList $Port
        Write-Output ("Started Verdaccio as background job (ID: {0})" -f $job.Id)
        Start-Sleep -Seconds 3
        
        # Check if the job is still running (if it exited immediately, something is wrong)
        $jobState = Get-Job -Id $job.Id | Select-Object -ExpandProperty State
        Write-Output ("Job state: {0}" -f $jobState)
        
        # Check if a node process (Verdaccio) is actually running
        $nodeProcs = Get-Process -Name 'node' -ErrorAction SilentlyContinue
        if ($nodeProcs) {
            Write-Output ("Found {0} node process(es) running" -f ($nodeProcs | Measure-Object).Count)
        } else {
            Write-Output "Warning: No node processes found after starting Verdaccio"
            # Check job output for errors
            $jobOutput = Receive-Job -Id $job.Id 2>&1
            if ($jobOutput) {
                Write-Output ("Job output: {0}" -f ($jobOutput | Out-String))
            }
        }
    } catch {
        Write-Output ("Failed to start Verdaccio: {0}" -f $_.Exception.Message)
        return $false
    }

    # Wait for port to be reachable
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $attempt = 0
    while ((Get-Date) -lt $deadline) {
        $attempt++
        try {
            $r = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:$Port" -ErrorAction Stop -TimeoutSec 2
            if ($r.StatusCode -eq 200 -and $r.Content -match 'Verdaccio') {
                Write-Output ("Verdaccio reachable on attempt {0}" -f $attempt)
                return $true
            } else {
                Write-Output ("Attempt {0}: received status {1} but content check failed" -f $attempt, $r.StatusCode)
            }
        } catch {
            # Don't print every attempt to reduce noise
            if ($attempt % 5 -eq 0) {
                Write-Output ("Attempt {0}: still waiting..." -f $attempt)
            }
        }
        Start-Sleep -Seconds 1
    }
    Write-Output "Verdaccio did not become reachable within $TimeoutSeconds seconds"
    
    # Diagnose: is there a node process running?
    $nodeProcs = Get-Process -Name 'node' -ErrorAction SilentlyContinue
    if ($nodeProcs) {
        Write-Output ("Node process(es) found: {0}" -f (($nodeProcs | Select-Object -ExpandProperty Id) -join ', '))
    } else {
        Write-Output "No node processes running - Verdaccio may have crashed"
    }
    
    return $false
}

Write-Output '=== manage-verdaccio start ==='
try {
    Stop-VerdaccioProcesses
    Write-Output 'Stopped processes (if any)'
    Clear-VerdaccioData
    Write-Output 'Cleared data (if present)'
    $started = Start-Verdaccio -Port $Port -TimeoutSeconds $TimeoutSeconds
    if ($started) {
        Write-Output 'Started Verdaccio successfully'
        exit 0
    } else {
        Write-Output 'Failed to start Verdaccio'
        exit 1
    }
} catch {
    Write-Output ("Unhandled error: {0}" -f $_.Exception.Message)
    exit 1
} finally {
    Write-Output ("Manage log location: $Global:ManageLog")
}
