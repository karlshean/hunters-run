$ErrorActionPreference = "Stop"
$OutDate = Get-Date -Format yyyyMMdd
$TimeStamp = Get-Date -Format HHmmss
$ZipName = "telegram-prototype_$OutDate.zip"
$Cwd     = (Get-Location).Path
$Stage   = Join-Path $env:TEMP "proto_stage_${OutDate}_${TimeStamp}"

Write-Host "==> Project root: $Cwd"
Write-Host "==> Staging dir : $Stage"
Write-Host "==> Output zip  : $ZipName"

if (Test-Path $Stage) { Remove-Item -Recurse -Force $Stage }
New-Item -ItemType Directory -Path $Stage | Out-Null

# DIAG_DEPS.txt
"node: $(node -v 2>$null)"            | Out-File -Encoding utf8 (Join-Path $Cwd "DIAG_DEPS.txt")
"npm : $(npm.cmd -v 2>$null)"         | Out-File -Encoding utf8 -Append (Join-Path $Cwd "DIAG_DEPS.txt")

# DIAG_SCRIPTS.json
if (Test-Path (Join-Path $Cwd "package.json")) {
  node -e "try{const fs=require('fs');const j=JSON.parse(fs.readFileSync('package.json','utf8'));console.log(JSON.stringify(j.scripts||{},null,2))}catch(e){console.log('{}')}" `
    | Out-File -Encoding utf8 (Join-Path $Cwd "DIAG_SCRIPTS.json")
} else {
  "{}" | Out-File -Encoding utf8 (Join-Path $Cwd "DIAG_SCRIPTS.json")
}

# DIAG_FUNCTIONS.txt
if (Test-Path (Join-Path $Cwd "supabase\config.toml")) {
  Get-Content (Join-Path $Cwd "supabase\config.toml") | Out-File -Encoding utf8 (Join-Path $Cwd "DIAG_FUNCTIONS.txt")
} else {
  "# supabase/config.toml not found" | Out-File -Encoding utf8 (Join-Path $Cwd "DIAG_FUNCTIONS.txt")
}

# DIAG_WEBHOOK.txt placeholder
@"
# Telegram webhook (fill in; redact token)
# Example:
# https://api.telegram.org/bot<REDACTED>/setWebhook -> https://<your-project>.supabase.co/functions/v1/telegram-webhook
"@ | Out-File -Encoding utf8 (Join-Path $Cwd "DIAG_WEBHOOK.txt")

# .env.example redact/create
$EnvPath = Join-Path $Cwd ".env"
$EnvExPath = Join-Path $Cwd ".env.example"
if (Test-Path $EnvPath) {
  Copy-Item $EnvPath $EnvExPath -Force
  (Get-Content $EnvExPath -Raw) `
    -replace '(TELEGRAM_BOT_TOKEN|SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|SENDGRID_API_KEY|DATABASE_URL)=.*', '$1=REDACTED' `
    | Set-Content -Encoding utf8 $EnvExPath
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

# SCHEMA.sql export if possible
$DbUrl = $env:DATABASE_URL
if ($DbUrl -and (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
  try {
    & pg_dump --schema-only --no-owner --no-privileges "$DbUrl" | Out-File -Encoding utf8 (Join-Path $Cwd "SCHEMA.sql")
  } catch {
    "# pg_dump failed: $($_.Exception.Message)" | Out-File -Encoding utf8 (Join-Path $Cwd "SCHEMA.sql")
  }
} elseif (-not (Test-Path (Join-Path $Cwd "SCHEMA.sql"))) {
  "# Set DATABASE_URL and install pg_dump to export. Skipped." | Out-File -Encoding utf8 (Join-Path $Cwd "SCHEMA.sql")
}

# Stage copy with exclusions via robocopy
$excludeDirs = @("node_modules",".git","dist",".next","tmp",".DS_Store")
$excludeFiles = @(".env",".env.*")
if (Test-Path $Stage) { Remove-Item -Recurse -Force $Stage }
New-Item -ItemType Directory -Path $Stage | Out-Null

# Build exclude arguments for robocopy
$XD = @()
foreach ($d in $excludeDirs) { 
  $dirPath = Join-Path $Cwd $d
  if (Test-Path $dirPath) { $XD += "/XD"; $XD += $dirPath }
}

$XF = @()
foreach ($f in $excludeFiles) { $XF += "/XF"; $XF += $f }

# Run robocopy
$roboArgs = @($Cwd, $Stage, "/E", "/COPY:DAT", "/R:1", "/W:1", "/XO", "/XJ", "/NFL", "/NDL", "/NJH", "/NJS") + $XD + $XF
& robocopy @roboArgs | Out-Null

# Zip stage -> repo root
$ZipPath = Join-Path $Cwd $ZipName
if (Test-Path $ZipPath) { Remove-Item -Force $ZipPath }
if ((Get-ChildItem $Stage -Recurse -File).Count -gt 0) {
  Compress-Archive -Path "$Stage\*" -DestinationPath $ZipPath -Force
} else {
  Write-Host "Warning: No files to zip!" -ForegroundColor Yellow
}

Write-Host "==> Created $ZipName in $Cwd"
try { Remove-Item -Recurse -Force $Stage } catch {}