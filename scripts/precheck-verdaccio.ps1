try {
    $c = (Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:4873' -ErrorAction Stop -TimeoutSec 2).Content
    if ($c -match 'Verdaccio') { 
        exit 0 
    } else { 
        exit 1 
    }
} catch {
    exit 1
}
