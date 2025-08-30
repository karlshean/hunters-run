# === Hunters-Run • Fast Evidence Collection ===
# Optimized version for quick collection

param(
    [string]$OutputName = "hr_evidence_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
)

$ErrorActionPreference = "Stop"
$ROOT = $PSScriptRoot | Split-Path -Parent
$OUT = Join-Path $env:TEMP $OutputName
$ZIP = Join-Path $env:USERPROFILE\Desktop "$OutputName.zip"

Write-Host "=== FAST EVIDENCE COLLECTOR ===" -ForegroundColor Cyan
Write-Host "Collecting from: $ROOT"
Write-Host "Output to: $ZIP"
Write-Host ""

# Clean/create output
if (Test-Path $OUT) { Remove-Item $OUT -Recurse -Force }
New-Item -ItemType Directory -Path $OUT | Out-Null

# Progress counter
$step = 0
$totalSteps = 8

# 1. Core source files
$step++
Write-Progress -Activity "Collecting evidence" -Status "Step $step/$totalSteps : Source code" -PercentComplete (($step/$totalSteps)*100)
$sourceDir = Join-Path $OUT "source"
New-Item -ItemType Directory $sourceDir | Out-Null

# Copy main source directories (avoiding node_modules)
@("apps", "packages", "scripts", "tools") | ForEach-Object {
    $src = Join-Path $ROOT $_
    if (Test-Path $src) {
        $dest = Join-Path $sourceDir $_
        robocopy $src $dest /E /XD node_modules .git dist build .turbo .next /XF *.exe *.dll *.pdb /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
    }
}

# 2. Configuration files
$step++
Write-Progress -Activity "Collecting evidence" -Status "Step $step/$totalSteps : Configuration" -PercentComplete (($step/$totalSteps)*100)
$configDir = Join-Path $OUT "config"
New-Item -ItemType Directory $configDir | Out-Null

# Root config files
Get-ChildItem $ROOT -File | Where-Object {
    $_.Name -match '\.(json|yml|yaml|toml|js|ts|md)$' -or
    $_.Name -like ".*rc*" -or
    $_.Name -like ".env*" -or
    $_.Name -in @("Dockerfile", "docker-compose.yml")
} | ForEach-Object {
    if ($_.Name -like "*.env*") {
        # Redact env files
        $content = Get-Content $_.FullName -Raw
        $redacted = ($content -split "`n") | ForEach-Object {
            if ($_ -match '^([^#]\S+)\s*=\s*(.+)') {
                "$($Matches[1])=REDACTED"
            } else { $_ }
        } | Out-String
        $redacted | Out-File (Join-Path $configDir "$($_.Name).redacted") -Encoding UTF8
    } else {
        Copy-Item $_.FullName (Join-Path $configDir $_.Name)
    }
}

# 3. Documentation
$step++
Write-Progress -Activity "Collecting evidence" -Status "Step $step/$totalSteps : Documentation" -PercentComplete (($step/$totalSteps)*100)
if (Test-Path "$ROOT\docs") {
    robocopy "$ROOT\docs" "$OUT\docs" /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
}

# 4. GitHub/CI
$step++
Write-Progress -Activity "Collecting evidence" -Status "Step $step/$totalSteps : CI/CD" -PercentComplete (($step/$totalSteps)*100)
if (Test-Path "$ROOT\.github") {
    robocopy "$ROOT\.github" "$OUT\github" /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
}
if (Test-Path "$ROOT\.husky") {
    robocopy "$ROOT\.husky" "$OUT\husky" /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
}

# 5. Database schemas
$step++
Write-Progress -Activity "Collecting evidence" -Status "Step $step/$totalSteps : Database" -PercentComplete (($step/$totalSteps)*100)
$dbDir = Join-Path $OUT "database"
New-Item -ItemType Directory $dbDir | Out-Null

if (Test-Path "$ROOT\supabase") {
    robocopy "$ROOT\supabase" "$dbDir\supabase" /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
}

# Collect SQL files
Get-ChildItem -Path $ROOT -Filter "*.sql" -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch "node_modules|\.git" } |
    ForEach-Object { Copy-Item $_.FullName "$dbDir\$($_.Name)" }

# 6. Git info
$step++
Write-Progress -Activity "Collecting evidence" -Status "Step $step/$totalSteps : Git info" -PercentComplete (($step/$totalSteps)*100)
$gitDir = Join-Path $OUT "git"
New-Item -ItemType Directory $gitDir | Out-Null

Push-Location $ROOT
git status --short > "$gitDir\status.txt" 2>$null
git log --oneline -n 50 > "$gitDir\recent_commits.txt" 2>$null
git branch -a > "$gitDir\branches.txt" 2>$null
git remote -v > "$gitDir\remotes.txt" 2>$null
Pop-Location

# 7. File inventory
$step++
Write-Progress -Activity "Collecting evidence" -Status "Step $step/$totalSteps : Creating inventory" -PercentComplete (($step/$totalSteps)*100)
Get-ChildItem -Recurse $ROOT -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch "node_modules|\.git|dist|build" } |
    Select-Object @{N='Path';E={$_.FullName.Substring($ROOT.Length+1)}}, 
                  @{N='Type';E={if($_.PSIsContainer){'Dir'}else{'File'}}},
                  Length, LastWriteTime |
    Export-Csv "$OUT\file_inventory.csv" -NoTypeInformation

# 8. Create manifest
$step++
Write-Progress -Activity "Collecting evidence" -Status "Step $step/$totalSteps : Creating archive" -PercentComplete (($step/$totalSteps)*100)
@{
    CollectedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Root = $ROOT
    Machine = $env:COMPUTERNAME
    User = $env:USERNAME
    Categories = @(
        "source - Source code files",
        "config - Configuration files", 
        "docs - Documentation",
        "github - CI/CD workflows",
        "database - Database schemas",
        "git - Git repository info",
        "file_inventory.csv - Complete file listing"
    )
} | ConvertTo-Json | Out-File "$OUT\manifest.json" -Encoding UTF8

# Create ZIP
Write-Progress -Activity "Collecting evidence" -Status "Creating archive..." -PercentComplete 95
Compress-Archive -Path "$OUT\*" -DestinationPath $ZIP -Force

# Cleanup
Write-Progress -Activity "Collecting evidence" -Status "Cleaning up..." -PercentComplete 98
Remove-Item $OUT -Recurse -Force

Write-Progress -Activity "Collecting evidence" -Completed

# Results
$zipSize = (Get-Item $ZIP).Length
Write-Host ""
Write-Host "=== COLLECTION COMPLETE ===" -ForegroundColor Green
Write-Host "Archive: $ZIP" -ForegroundColor Yellow
Write-Host "Size: $([math]::Round($zipSize/1MB, 2)) MB" -ForegroundColor Yellow
Write-Host ""

# Open in Explorer
explorer.exe /select,$ZIP