$ErrorActionPreference = "Stop"
$OutDate = Get-Date -Format yyyyMMdd
$ZipName = "telegram-prototype_$OutDate.zip"
$Cwd = (Get-Location).Path

Write-Host "`n==> Creating ChatGPT-ready prototype ZIP" -ForegroundColor Cyan
Write-Host "    Project: $Cwd" -ForegroundColor Gray
Write-Host "    Output : $ZipName" -ForegroundColor Gray

# Create diagnostic files
Write-Host "`nCreating diagnostic files..." -ForegroundColor Yellow

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

# Create ZIP
Write-Host "`nCreating ZIP archive..." -ForegroundColor Yellow

# Collect items to include
$excludeDirs = @('node_modules', '.git', 'dist', '.next', 'tmp', 'build', '__pycache__', 'coverage', '.nuxt', '.local', '.localsecure')
$excludeFiles = @('nul', '.DS_Store', 'Thumbs.db')
$excludePatterns = @('*.zip', '.env', '.env.*')

$items = @()

# Add files
Get-ChildItem -Path $Cwd -File -ErrorAction SilentlyContinue | ForEach-Object {
    $include = $true
    
    # Check explicit excludes
    if ($_.Name -in $excludeFiles) { $include = $false }
    
    # Check patterns
    foreach ($pattern in $excludePatterns) {
        if ($_.Name -like $pattern) { $include = $false; break }
    }
    
    if ($include) { $items += $_ }
}

# Add directories (skip hidden and system folders)
Get-ChildItem -Path $Cwd -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_.Name -notin $excludeDirs -and !$_.Name.StartsWith('.')) { 
        $items += $_ 
    }
}

# Remove old zip if exists
$ZipPath = Join-Path $Cwd $ZipName
if (Test-Path $ZipPath) {
    Remove-Item $ZipPath -Force
}

# Create the zip
if ($items.Count -gt 0) {
    try {
        Compress-Archive -Path $items.FullName -DestinationPath $ZipPath -CompressionLevel Optimal -Force
        $zipSize = [math]::Round((Get-Item $ZipPath).Length / 1MB, 2)
        Write-Host "`n==> SUCCESS!" -ForegroundColor Green
        Write-Host "    Created: $ZipName" -ForegroundColor Green
        Write-Host "    Location: $ZipPath" -ForegroundColor Green
        Write-Host "    Size: ${zipSize} MB" -ForegroundColor Green
        Write-Host "`nYou can now upload this ZIP to ChatGPT." -ForegroundColor Cyan
    } catch {
        Write-Host "`nError creating ZIP: $_" -ForegroundColor Red
    }
} else {
    Write-Host "`nWarning: No files to include in ZIP!" -ForegroundColor Yellow
}