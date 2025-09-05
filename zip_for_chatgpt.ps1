# Simple ZIP creator for ChatGPT upload
$date = Get-Date -Format yyyyMMdd
$zipName = "telegram-prototype_$date.zip"

Write-Host "Creating $zipName..." -ForegroundColor Cyan

# Get all items to include
$items = Get-ChildItem -Path . | Where-Object {
    $_.Name -ne 'node_modules' -and
    $_.Name -ne '.git' -and
    $_.Name -ne '.local' -and
    $_.Name -ne '.localsecure' -and
    $_.Name -ne 'nul' -and
    $_.Extension -ne '.zip' -and
    !$_.Name.StartsWith('.env')
}

# Create the ZIP
try {
    Compress-Archive -Path $items.FullName -DestinationPath $zipName -CompressionLevel Optimal -Force
    $size = [math]::Round((Get-Item $zipName).Length / 1MB, 2)
    Write-Host "SUCCESS! Created $zipName ($size MB)" -ForegroundColor Green
    Write-Host "Location: $PWD\$zipName" -ForegroundColor Cyan
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}