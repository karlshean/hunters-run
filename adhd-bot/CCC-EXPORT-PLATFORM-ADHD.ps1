# === CCC-EXPORT-PLATFORM-ADHD.ps1 ===
# Run from the ADHD bot repository root (PowerShell). Requires no admin rights.

$ErrorActionPreference = "Stop"

# 0) Config — set PLATFORM_DIR if your shared platform SQL/RLS lives elsewhere
$ROOT = (Get-Location).Path
$PLATFORM_DIR = if ($env:PLATFORM_DIR -and (Test-Path $env:PLATFORM_DIR)) { $env:PLATFORM_DIR } else { $null }

# 1) Stamp + paths
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$exportName = "adhd_platform_export_$timestamp"
$TMP = Join-Path $env:TEMP $exportName
$OUTDIR = $TMP
$OUTZIP = Join-Path ([Environment]::GetFolderPath('Desktop')) ("adhd_platform_bundle_$timestamp.zip")

# Clean temp
if (Test-Path $OUTDIR) { Remove-Item -Recurse -Force $OUTDIR }
New-Item -ItemType Directory -Force -Path $OUTDIR | Out-Null
New-Item -ItemType Directory -Force -Path "$OUTDIR\adhd" | Out-Null
New-Item -ItemType Directory -Force -Path "$OUTDIR\platform" | Out-Null
New-Item -ItemType Directory -Force -Path "$OUTDIR\docs" | Out-Null

function Copy-TreeSafe {
  param([string]$Src, [string]$Dst)
  robocopy $Src $Dst /E /NFL /NDL /NJH /NJS /NP `
    /XF "*.sqlite" "*.log" ".DS_Store" `
    /XD "node_modules" ".git" "dist" "build" ".turbo" ".next" ".cache" "coverage" | Out-Null
}

function Mask-EnvFile {
  param([string]$Src, [string]$Dst)
  $lines = Get-Content -LiteralPath $Src -Raw -ErrorAction SilentlyContinue
  if ($null -eq $lines) { return }
  $masked = ($lines -split "`n") | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
      "$($matches[1])=***REDACTED***"
    } else { $_ }
  }
  $masked | Set-Content -LiteralPath $Dst -NoNewline
}

function Mask-JsonSecrets {
  param([string]$Src, [string]$Dst)
  try {
    $obj = Get-Content -LiteralPath $Src -Raw | ConvertFrom-Json
  } catch {
    # Fallback: naive masking of common fields
    (Get-Content -LiteralPath $Src -Raw) `
      -replace '"private_key"\s*:\s*".*?"','"private_key":"***REDACTED***"' `
      -replace '"client_email"\s*:\s*".*?"','"client_email":"***REDACTED***"' `
      -replace '"private_key_id"\s*:\s*".*?"','"private_key_id":"***REDACTED***"' `
      | Set-Content -LiteralPath $Dst -NoNewline
    return
  }
  $fieldsToMask = @("private_key","client_email","private_key_id","client_id","refresh_token","api_key","token")
  foreach ($k in $fieldsToMask) { if ($obj.PSObject.Properties.Name -contains $k) { $obj.$k = "***REDACTED***" } }
  ($obj | ConvertTo-Json -Depth 20) | Set-Content -LiteralPath $Dst -NoNewline
}

Write-Host "=== Step 1: Copy ADHD repo (sources, sql, configs) ===" -ForegroundColor Cyan
# Core project files
$adhdDst = "$OUTDIR\adhd"
Copy-Item package.json,package-lock.json,yarn.lock,pnpm-lock.yaml -Destination $adhdDst -ErrorAction SilentlyContinue
Copy-Item README* -Destination $adhdDst -ErrorAction SilentlyContinue
Copy-Item Dockerfile*,docker-compose*.yml -Destination $adhdDst -ErrorAction SilentlyContinue
# Trees
foreach ($dir in @("src","scripts","sql","config","data")) {
  if (Test-Path $dir) { Copy-TreeSafe -Src (Resolve-Path $dir) -Dst (Join-Path $adhdDst $dir) }
}
# Exclude sqlite binaries
Get-ChildItem -Path "$adhdDst\data" -Filter *.sqlite -Recurse -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

# .env handling
if (Test-Path ".env.example") { Copy-Item ".env.example" -Destination "$adhdDst\.env.example" }
if (Test-Path ".env") { Mask-EnvFile -Src ".env" -Dst "$adhdDst\.env.redacted" }

# Firebase / service JSON (mask)
Get-ChildItem -Recurse -Include "*service*.json","*firebase*.json","*credentials*.json" -ErrorAction SilentlyContinue | ForEach-Object {
  $rel = $_.FullName.Substring($ROOT.Length).TrimStart('\','/')
  $dst = Join-Path $adhdDst ("redacted_" + ($rel -replace '[\\/:]','_'))
  Mask-JsonSecrets -Src $_.FullName -Dst $dst
}

Write-Host "=== Step 2: Collect Platform SQL / RLS / Audit ===" -ForegroundColor Cyan
function Copy-PlatformFrom {
  param([string]$Base)
  if (-not (Test-Path $Base)) { return }
  # Likely locations
  foreach ($dir in @("sql","db","database","migrations","policies","rls","audit")) {
    $p = Join-Path $Base $dir
    if (Test-Path $p) { Copy-TreeSafe -Src (Resolve-Path $p) -Dst (Join-Path "$OUTDIR\platform" $dir) }
  }
  # Compose/Docker + READMEs
  Copy-Item (Join-Path $Base "Dockerfile*") -Destination "$OUTDIR\platform" -ErrorAction SilentlyContinue
  Copy-Item (Join-Path $Base "docker-compose*.yml") -Destination "$OUTDIR\platform" -ErrorAction SilentlyContinue
  Get-ChildItem -Path $Base -Filter "README*" -File -ErrorAction SilentlyContinue | Copy-Item -Destination "$OUTDIR\platform"
}

if ($PLATFORM_DIR) {
  Write-Host "Using PLATFORM_DIR=$PLATFORM_DIR" -ForegroundColor Yellow
  Copy-PlatformFrom -Base $PLATFORM_DIR
} else {
  Write-Host "No PLATFORM_DIR provided. Attempting autodetect in parent folders..." -ForegroundColor Yellow
  $candidates = Get-ChildItem .. -Directory -ErrorAction SilentlyContinue |
    Where-Object { (Test-Path (Join-Path $_.FullName "sql")) -or (Test-Path (Join-Path $_.FullName "db")) }
  foreach ($cand in $candidates) { Copy-PlatformFrom -Base $cand.FullName }
}

Write-Host "=== Step 3: Docs & Evidence (optional) ===" -ForegroundColor Cyan
# Session logs / proofs if present
foreach ($f in @("SESSION_LOG_EXTRACT.md","COMPREHENSIVE_FIX_PROOF.md","DEPLOY_CHECKS.md","security-proof.md","whoami.md","proof-pack.md")) {
  if (Test-Path $f) { Copy-Item $f -Destination "$OUTDIR\docs" -ErrorAction SilentlyContinue }
}

Write-Host "=== Step 4: Create ZIP on Desktop ===" -ForegroundColor Cyan
if (Test-Path $OUTZIP) { Remove-Item $OUTZIP -Force }
Compress-Archive -Path "$OUTDIR\*" -DestinationPath $OUTZIP -Force

Write-Host ""
Write-Host "✅ Export complete:" -ForegroundColor Green
Write-Host "ZIP: $OUTZIP"
Write-Host "Temp export folder (safe to delete): $OUTDIR"