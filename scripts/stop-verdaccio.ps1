# Stop Verdaccio-related processes: processes listening on port 4873 or whose command line contains 'verdaccio'
$Port = 4873
Write-Output "Stopping Verdaccio-related processes (port $Port)"

# Gather PIDs listening on the port
$found = @()
try {
    $conns = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
} catch {
    $conns = $null
}
if ($conns) {
    $found += $conns | Select-Object -ExpandProperty OwningProcess | Where-Object { $_ -and $_ -ne 0 } | Sort-Object -Unique
}

# Also gather processes whose command line contains 'verdaccio'
try {
    # Only include processes whose command line mentions 'verdaccio' and whose executable looks like node/cmd/npm/npx
    $cands = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and ($_.CommandLine -match 'verdaccio') -and ($_.Name -match 'node(.exe)?|cmd(.exe)?|npm(.exe)?|npx(.exe)?') } | Select-Object -ExpandProperty ProcessId -ErrorAction SilentlyContinue
} catch {
    $cands = @()
}
if ($cands) { $found += $cands }

$found = $found | Sort-Object -Unique
if (-not $found -or $found.Count -eq 0) {
    Write-Output 'No Verdaccio-related processes found'
    exit 0
}

Write-Output ('Found PIDs: ' + ($found -join ', '))
foreach ($foundPid in $found) {
    try {
        $p = Get-Process -Id $foundPid -ErrorAction SilentlyContinue
        if ($p) {
            Write-Output ("Stopping PID {0} ({1})" -f $foundPid, $p.ProcessName)
            Stop-Process -Id $foundPid -Force -ErrorAction SilentlyContinue
            Start-Sleep -Milliseconds 200
            $still = Get-Process -Id $foundPid -ErrorAction SilentlyContinue
            if ($still) { Write-Output ("Failed to stop PID {0}" -f $foundPid) } else { Write-Output ("Stopped PID {0}" -f $foundPid) }
        } else {
            Write-Output ("PID {0} not running" -f $foundPid)
        }
    } catch {
        Write-Output ("Failed to stop PID {0}: {1}" -f $foundPid, $_.Exception.Message)
    }
}

exit 0
