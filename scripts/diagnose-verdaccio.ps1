try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:4873' -ErrorAction Stop
    Write-Output "Status:$($r.StatusCode)"
    $c = $r.Content
    Write-Output "Length:$($c.Length)"
    Write-Output '---BODY-START---'
    if ($c.Length -gt 1000) { $c = $c.Substring(0,1000) }
    Write-Output $c
    Write-Output '---BODY-END---'
} catch {
    Write-Output "ERROR: $($_.Exception.Message)"
}

Write-Output '---NETSTAT---'
netstat -ano | findstr :4873

Write-Output '---TCPCONN---'
Get-NetTCPConnection -LocalPort 4873 -ErrorAction SilentlyContinue | Format-List | Out-String | Write-Output

try {
    $c = Get-NetTCPConnection -LocalPort 4873 -ErrorAction SilentlyContinue
    if ($c) {
        try {
            Get-Process -Id $c.OwningProcess | Format-List -Property Id,ProcessName,Path | Out-String | Write-Output
        } catch {
            Write-Output 'Process info not available'
        }
    }
} catch {}

Write-Output '---LOGTAIL---'
Get-Content "$env:APPDATA\verdaccio\verdaccio.log" -Tail 200 -ErrorAction SilentlyContinue | Write-Output
