$ErrorActionPreference = "Stop"
$OutDate = Get-Date -Format yyyyMMdd
$ZipName = "telegram-prototype_$OutDate.zip"
$Cwd = (Get-Location).Path

Write-Host "==> Creating prototype ZIP for: $Cwd" -ForegroundColor Cyan
Write-Host "==> Output: $ZipName" -ForegroundColor Cyan

# Create diagnostic files
Write-Host "Creating diagnostic files..." -ForegroundColor Yellow

# DIAG_DEPS.txt
@"
node: $(node -v 2>$null)
npm : $(npm.cmd -v 2>$null)
"@ | Out-File -Encoding utf8 (Join-Path $Cwd "DIAG_DEPS.txt")

# DIAG_SCRIPTS.json
if (Test-Path (Join-Path $Cwd "package.json")) {
    $pkg = Get-Content (Join-Path $Cwd "package.json") -Raw | ConvertFrom-Json
    if ($pkg.scripts) {
        $pkg.scripts | ConvertTo-Json -Depth 10 | Out-File -Encoding utf8 (Join-Path $Cwd "DIAG_SCRIPTS.json")
    } else {
        "{}" | Out-File -Encoding utf8 (Join-Path $Cwd "DIAG_SCRIPTS.json")
    }
} else {
    "{}" | Out-File -Encoding utf8 (Join-Path $Cwd "DIAG_SCRIPTS.json")
}

# DIAG_FUNCTIONS.txt
if (Test-Path (Join-Path $Cwd "supabase\config.toml")) {
    Get-Content (Join-Path $Cwd "supabase\config.toml") | Out-File -Encoding utf8 (Join-Path $Cwd "DIAG_FUNCTIONS.txt")
} else {
    "# supabase/config.toml not found" | Out-File -Encoding utf8 (Join-Path $Cwd "DIAG_FUNCTIONS.txt")
}

# DIAG_WEBHOOK.txt
@"
# Telegram webhook (fill in; redact token)
# Example:
# https://api.telegram.org/bot<REDACTED>/setWebhook -> https://<your-project>.supabase.co/functions/v1/telegram-webhook
"@ | Out-File -Encoding utf8 (Join-Path $Cwd "DIAG_WEBHOOK.txt")

# .env.example
$EnvPath = Join-Path $Cwd ".env"
$EnvExPath = Join-Path $Cwd ".env.example"
if (Test-Path $EnvPath) {
    $envContent = Get-Content $EnvPath -Raw
    $envContent = $envContent -replace '(TELEGRAM_BOT_TOKEN|SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|SENDGRID_API_KEY|DATABASE_URL)=.*', '$1=REDACTED'
    $envContent | Out-File -Encoding utf8 $EnvExPath
} elseif (-not (Test-Path $EnvExPath)) {
    @"
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_ANON_KEY=REDACTED
SUPABASE_SERVICE_ROLE_KEY=REDACTED
TELEGRAM_BOT_TOKEN=REDACTED
ANTHROPIC_API_KEY=REDACTED
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=REDACTED
STORAGE_BUCKET=mb-evidence
# Optional:
# DATABASE_URL=postgresql://user:pass@host:5432/dbname
"@ | Out-File -Encoding utf8 $EnvExPath
}

# SCHEMA.sql
if (-not (Test-Path (Join-Path $Cwd "SCHEMA.sql"))) {
    "# Set DATABASE_URL and install pg_dump to export schema. Skipped." | Out-File -Encoding utf8 (Join-Path $Cwd "SCHEMA.sql")
}

Write-Host "Diagnostic files created." -ForegroundColor Green

# Create ZIP using PowerShell native commands
Write-Host "Creating ZIP archive..." -ForegroundColor Yellow

# Get all items to include
$items = @()
$items += Get-ChildItem -Path $Cwd -File | Where-Object { 
    $_.Name -notmatch '^\.env' -and 
    $_.Extension -ne '.zip' -and
    $_.Name -ne '.DS_Store'
}
$items += Get-ChildItem -Path $Cwd -Directory | Where-Object { 
    $_.Name -notin @('node_modules', '.git', 'dist', '.next', 'tmp', 'build', '__pycache__')
}

# Remove old zip if exists
if (Test-Path (Join-Path $Cwd $ZipName)) {
    Remove-Item (Join-Path $Cwd $ZipName) -Force
}

# Create the zip
try {
    Compress-Archive -Path $items.FullName -DestinationPath (Join-Path $Cwd $ZipName) -CompressionLevel Optimal -Force
    Write-Host "==> Created $ZipName in $Cwd" -ForegroundColor Green
    Write-Host "    Size: $((Get-Item (Join-Path $Cwd $ZipName)).Length / 1MB) MB" -ForegroundColor Green
} catch {
    Write-Host "Error creating ZIP: $_" -ForegroundColor Red
}