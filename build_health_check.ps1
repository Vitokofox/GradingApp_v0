$process = Start-Process `
    -FilePath "backend\dist\GradingApp\GradingApp.exe" `
    -WorkingDirectory "backend\dist\GradingApp" `
    -WindowStyle Hidden `
    -PassThru

$healthy = $false
try {
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        Start-Sleep -Seconds 1
        try {
            $response = Invoke-RestMethod `
                -Uri "http://127.0.0.1:8000/health" `
                -TimeoutSec 2
            if ($response.status -eq "ok") {
                $healthy = $true
                break
            }
        }
        catch {
            # The packaged server may still be starting.
        }
    }
}
finally {
    if (-not $process.HasExited) {
        Stop-Process -Id $process.Id -Force
    }
    Wait-Process -Id $process.Id -ErrorAction SilentlyContinue
}

if (-not $healthy) {
    exit 1
}
