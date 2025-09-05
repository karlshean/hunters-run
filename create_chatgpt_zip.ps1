$ErrorActionPreference = "Stop"
$OutDate = Get-Date -Format yyyyMMdd
$ZipName = "telegram-prototype_$OutDate.zip"
$Cwd = (Get-Location).Path

Write-Host "`n==> Creating ChatGPT-ready prototype ZIP" -ForegroundColor Cyan
Write-Host "    Project: $Cwd" -ForegroundColor Gray

# Create diagnostic files
Write-Host "`nCreating diagnostic files..." -ForegroundColor Yellow

# DIAG_DEPS.txt
"node: $(node -v 2>$null)`nnpm : $(npm.cmd -v 2>$null)" | Out-File -Encoding utf8 "DIAG_DEPS.txt"

# DIAG_SCRIPTS.json
if (Test-Path "package.json") {
    $pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
    ($pkg.scripts | ConvertTo-Json -Depth 10) | Out-File -Encoding utf8 "DIAG_SCRIPTS.json"
} else {
    "{}" | Out-File -Encoding utf8 "DIAG_SCRIPTS.json"
}

# DIAG_FUNCTIONS.txt
if (Test-Path "supabase\config.toml") {
    Get-Content "supabase\config.toml" | Out-File -Encoding utf8 "DIAG_FUNCTIONS.txt"
} else {
    "# supabase/config.toml not found" | Out-File -Encoding utf8 "DIAG_FUNCTIONS.txt"
}

# DIAG_WEBHOOK.txt
"# Telegram webhook (fill in; redact token)`n# Example:`n# https://api.telegram.org/bot<REDACTED>/setWebhook -> https://<your-project>.supabase.co/functions/v1/telegram-webhook" | Out-File -Encoding utf8 "DIAG_WEBHOOK.txt"

# .env.example
if (Test-Path ".env") {
    $envContent = Get-Content ".env" -Raw
    $envContent -replace '(TELEGRAM_BOT_TOKEN|SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|SENDGRID_API_KEY|DATABASE_URL)=.*', '$1=REDACTED' | Out-File -Encoding utf8 ".env.example"
}

# SCHEMA.sql
if (-not (Test-Path "SCHEMA.sql")) {
    "# Set DATABASE_URL and install pg_dump to export. Skipped." | Out-File -Encoding utf8 "SCHEMA.sql"
}

Write-Host "Diagnostic files created." -ForegroundColor Green

# Create file list
Write-Host "`nBuilding file list..." -ForegroundColor Yellow

$fileList = @()

# Add root files (safe ones)
$safeRootFiles = @(
    "*.js", "*.ts", "*.json", "*.md", "*.yml", "*.yaml", 
    "*.html", "*.css", "*.sql", "*.txt", "*.sh", "*.ps1",
    "*.example", "Dockerfile", "docker-compose.*"
)
foreach ($pattern in $safeRootFiles) {
    Get-ChildItem -Path $Cwd -File -Filter $pattern -ErrorAction SilentlyContinue | 
        Where-Object { $_.Name -notlike ".env*" -and $_.Name -ne "nul" } | 
        ForEach-Object { $fileList += $_.FullName }
}

# Add specific directories
$includeDirs = @("adhd-bot", "apps", "demo-api", "docs", "packages", "scripts", "tools", "supabase", "evidence")
foreach ($dir in $includeDirs) {
    if (Test-Path (Join-Path $Cwd $dir)) {
        $fileList += (Join-Path $Cwd $dir)
    }
}

# Remove duplicates
$fileList = $fileList | Select-Object -Unique

# Create ZIP
Write-Host "Creating ZIP archive..." -ForegroundColor Yellow

$ZipPath = Join-Path $Cwd $ZipName
if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }

try {
    # Try using 7-Zip if available
    $7zip = "C:\Program Files\7-Zip\7z.exe"
    if (Test-Path $7zip) {
        Write-Host "Using 7-Zip..." -ForegroundColor Gray
        & $7zip a -tzip $ZipPath $fileList -xr!node_modules -xr!.git -x!.env* -x!nul | Out-Null
    } else {
        # Fall back to PowerShell
        Compress-Archive -Path $fileList -DestinationPath $ZipPath -CompressionLevel Optimal -Force
    }
    
    $zipSize = [math]::Round((Get-Item $ZipPath).Length / 1MB, 2)
    Write-Host "`n==> SUCCESS!" -ForegroundColor Green
    Write-Host "    Created: $ZipName" -ForegroundColor Green
    Write-Host "    Location: $ZipPath" -ForegroundColor Green
    Write-Host "    Size: ${zipSize} MB" -ForegroundColor Green
    Write-Host "`nYou can now upload this ZIP to ChatGPT." -ForegroundColor Cyan
} catch {
    Write-Host "`nError creating ZIP: $_" -ForegroundColor Red
}