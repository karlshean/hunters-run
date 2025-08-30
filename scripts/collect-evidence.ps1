# === Hunters-Run • Comprehensive Evidence Collection ===
# Purpose: Collect full repository evidence for analysis/audit
# Output: Desktop bundle with categorized artifacts

param(
    [string]$OutputName = "hunters-run_evidence_$(Get-Date -Format 'yyyyMMdd_HHmmss')",
    [switch]$IncludeNodeModules = $false,
    [switch]$IncludeGitHistory = $false,
    [switch]$Verbose = $false
)

$ErrorActionPreference = "Stop"
$VerbosePreference = if ($Verbose) { "Continue" } else { "SilentlyContinue" }

# Configuration
$ROOT = $PSScriptRoot | Split-Path -Parent
$OUT = Join-Path $env:TEMP $OutputName
$ZIP = Join-Path $env:USERPROFILE\Desktop "$OutputName.zip"

# Exclusions (unless explicitly included)
$EXCLUDE_DIRS = @("node_modules", ".git", "dist", "build", ".turbo", ".next", "coverage", ".cache", "tmp", "logs", ".vscode", ".idea")
if ($IncludeNodeModules) { $EXCLUDE_DIRS = $EXCLUDE_DIRS | Where-Object { $_ -ne "node_modules" } }
if ($IncludeGitHistory) { $EXCLUDE_DIRS = $EXCLUDE_DIRS | Where-Object { $_ -ne ".git" } }

Write-Host "=== HUNTERS-RUN EVIDENCE COLLECTOR ===" -ForegroundColor Cyan
Write-Host "Root: $ROOT"
Write-Host "Output: $OUT"
Write-Host "Archive: $ZIP"
Write-Host ""

# Validate root
if (!(Test-Path $ROOT)) { throw "Root directory not found: $ROOT" }

# Clean/create output directory
if (Test-Path $OUT) { 
    Write-Verbose "Cleaning existing output directory..."
    Remove-Item $OUT -Recurse -Force 
}
New-Item -ItemType Directory -Path $OUT | Out-Null

# Helper function for safe file operations
function Copy-SafeFile {
    param($Source, $Destination)
    try {
        if (Test-Path $Source) {
            $destDir = Split-Path $Destination -Parent
            if (!(Test-Path $destDir)) {
                New-Item -ItemType Directory -Path $destDir -Force | Out-Null
            }
            Copy-Item -Path $Source -Destination $Destination -Force
            return $true
        }
    } catch {
        Write-Warning "Failed to copy: $Source - $_"
    }
    return $false
}

# === 1. PROJECT STRUCTURE ===
Write-Host "[1/10] Collecting project structure..." -ForegroundColor Yellow
$structureDir = Join-Path $OUT "01_structure"
New-Item -ItemType Directory $structureDir | Out-Null

# File inventory with metadata
$excludePattern = ($EXCLUDE_DIRS | ForEach-Object { [regex]::Escape($_) }) -join '|'
$files = Get-ChildItem -Recurse $ROOT -Force -ErrorAction SilentlyContinue |
    Where-Object { 
        $_.FullName -notmatch "\\($excludePattern)\\" -and 
        $_.Extension -notin @(".exe", ".dll", ".pdb", ".bin") 
    }

$inventory = $files | Select-Object @{
    Name = 'RelativePath'
    Expression = { $_.FullName.Substring($ROOT.Length + 1) }
}, @{
    Name = 'Type'
    Expression = { if ($_.PSIsContainer) { 'Directory' } else { 'File' } }
}, @{
    Name = 'Size'
    Expression = { if ($_.PSIsContainer) { 0 } else { $_.Length } }
}, @{
    Name = 'Extension'
    Expression = { $_.Extension }
}, LastWriteTime

$inventory | Export-Csv (Join-Path $structureDir "file_inventory.csv") -NoTypeInformation

# Directory tree
try {
    tree $ROOT /F /A | Out-File (Join-Path $structureDir "directory_tree.txt") -Encoding UTF8
} catch {
    Get-ChildItem -Recurse $ROOT -Directory | Select-Object -ExpandProperty FullName |
        Out-File (Join-Path $structureDir "directory_list.txt") -Encoding UTF8
}

# File statistics
$stats = @{
    TotalFiles = ($inventory | Where-Object Type -eq 'File').Count
    TotalDirectories = ($inventory | Where-Object Type -eq 'Directory').Count
    TotalSize = ($inventory | Measure-Object Size -Sum).Sum
    FilesByExtension = $inventory | Where-Object Type -eq 'File' | 
        Group-Object Extension | 
        Select-Object Name, Count | 
        Sort-Object Count -Descending
}
$stats | ConvertTo-Json -Depth 3 | Out-File (Join-Path $structureDir "statistics.json") -Encoding UTF8

# === 2. SOURCE CODE ===
Write-Host "[2/10] Collecting source code..." -ForegroundColor Yellow
$sourceDir = Join-Path $OUT "02_source"
New-Item -ItemType Directory $sourceDir | Out-Null

# TypeScript/JavaScript source
$tsDir = Join-Path $sourceDir "typescript"
New-Item -ItemType Directory $tsDir | Out-Null
$sourcePatterns = @("*.ts", "*.tsx", "*.js", "*.jsx", "*.mjs", "*.cjs")
$sourceFiles = Get-ChildItem -Recurse $ROOT -Include $sourcePatterns -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch "\\($excludePattern)\\" }

foreach ($file in $sourceFiles) {
    $relativePath = $file.FullName.Substring($ROOT.Length + 1)
    $destPath = Join-Path $tsDir $relativePath
    Copy-SafeFile $file.FullName $destPath
}

# API controllers and services
$apiDir = Join-Path $sourceDir "api"
New-Item -ItemType Directory $apiDir | Out-Null
@("apps\hr-api\src", "packages\auth\src", "packages\db\src") | ForEach-Object {
    $sourcePath = Join-Path $ROOT $_
    if (Test-Path $sourcePath) {
        $destPath = Join-Path $apiDir $_
        Copy-Item -Path $sourcePath -Destination $destPath -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# === 3. CONFIGURATION ===
Write-Host "[3/10] Collecting configuration files..." -ForegroundColor Yellow
$configDir = Join-Path $OUT "03_configuration"
New-Item -ItemType Directory $configDir | Out-Null

# Package files
$packageFiles = @("package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "tsconfig.json", "turbo.json")
foreach ($pattern in $packageFiles) {
    Get-ChildItem -Recurse $ROOT -Filter $pattern -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch "\\($excludePattern)\\" } |
        ForEach-Object {
            $relativePath = $_.FullName.Substring($ROOT.Length + 1)
            $destPath = Join-Path $configDir "packages\$relativePath"
            Copy-SafeFile $_.FullName $destPath
        }
}

# Environment files (REDACTED)
$envDir = Join-Path $configDir "environment"
New-Item -ItemType Directory $envDir | Out-Null
$envPatterns = @("*.env", ".env*", "env.example")
Get-ChildItem -Recurse $ROOT -Include $envPatterns -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch "\\($excludePattern)\\" } |
    ForEach-Object {
        $content = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
        $redacted = ($content -split "`r?`n") | ForEach-Object {
            if ($_ -match '^([^#][A-Za-z0-9_\.]+)\s*=\s*(.+)') {
                "$($Matches[1])=***REDACTED***"
            } else { $_ }
        } | Out-String
        $destName = $_.Name + "_REDACTED.txt"
        $redacted | Out-File (Join-Path $envDir $destName) -Encoding UTF8
    }

# Build configs
$buildConfigs = @(".eslintrc*", ".prettierrc*", ".lintstagedrc*", "*.config.js", "*.config.ts", "webpack.config.*", "vite.config.*")
foreach ($pattern in $buildConfigs) {
    Get-ChildItem -Recurse $ROOT -Include $pattern -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch "\\($excludePattern)\\" } |
        ForEach-Object {
            Copy-SafeFile $_.FullName (Join-Path $configDir "build\$($_.Name)")
        }
}

# === 4. INFRASTRUCTURE ===
Write-Host "[4/10] Collecting infrastructure files..." -ForegroundColor Yellow
$infraDir = Join-Path $OUT "04_infrastructure"
New-Item -ItemType Directory $infraDir | Out-Null

# Docker files
$dockerDir = Join-Path $infraDir "docker"
New-Item -ItemType Directory $dockerDir | Out-Null
@("Dockerfile*", "docker-compose*.yml", ".dockerignore") | ForEach-Object {
    Get-ChildItem -Path $ROOT -Filter $_ -ErrorAction SilentlyContinue |
        ForEach-Object { Copy-SafeFile $_.FullName (Join-Path $dockerDir $_.Name) }
}

# CI/CD
$ciDir = Join-Path $infraDir "ci-cd"
if (Test-Path "$ROOT\.github") {
    Copy-Item -Path "$ROOT\.github" -Destination $ciDir -Recurse -Force
}
if (Test-Path "$ROOT\.husky") {
    Copy-Item -Path "$ROOT\.husky" -Destination (Join-Path $infraDir "husky") -Recurse -Force
}

# Database
$dbDir = Join-Path $infraDir "database"
New-Item -ItemType Directory $dbDir | Out-Null
@("supabase", "migrations", "prisma") | ForEach-Object {
    $sourcePath = Join-Path $ROOT $_
    if (Test-Path $sourcePath) {
        Copy-Item -Path $sourcePath -Destination (Join-Path $dbDir $_) -Recurse -Force
    }
}

# SQL files
Get-ChildItem -Recurse $ROOT -Filter "*.sql" -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch "\\($excludePattern)\\" } |
    ForEach-Object {
        $relativePath = $_.FullName.Substring($ROOT.Length + 1)
        $destPath = Join-Path $dbDir "sql\$relativePath"
        Copy-SafeFile $_.FullName $destPath
    }

# === 5. DOCUMENTATION ===
Write-Host "[5/10] Collecting documentation..." -ForegroundColor Yellow
$docsDir = Join-Path $OUT "05_documentation"
New-Item -ItemType Directory $docsDir | Out-Null

# Copy docs directory
if (Test-Path "$ROOT\docs") {
    Copy-Item -Path "$ROOT\docs" -Destination $docsDir -Recurse -Force
}

# Root documentation
@("README.md", "DEPLOY_CHECKS.md", "deploy-brief.md", "CONTRIBUTING.md", "LICENSE*", "CHANGELOG*") | ForEach-Object {
    Get-ChildItem -Path $ROOT -Filter $_ -ErrorAction SilentlyContinue |
        ForEach-Object { Copy-SafeFile $_.FullName (Join-Path $docsDir $_.Name) }
}

# API documentation
if (Test-Path "$ROOT\apps\hr-api\openapi.yaml") {
    Copy-SafeFile "$ROOT\apps\hr-api\openapi.yaml" (Join-Path $docsDir "openapi.yaml")
}

# === 6. SCRIPTS ===
Write-Host "[6/10] Collecting scripts..." -ForegroundColor Yellow
$scriptsDir = Join-Path $OUT "06_scripts"
if (Test-Path "$ROOT\scripts") {
    Copy-Item -Path "$ROOT\scripts" -Destination $scriptsDir -Recurse -Force
}

# === 7. TESTS ===
Write-Host "[7/10] Collecting test files..." -ForegroundColor Yellow
$testsDir = Join-Path $OUT "07_tests"
New-Item -ItemType Directory $testsDir | Out-Null

$testPatterns = @("*.test.ts", "*.test.tsx", "*.test.js", "*.spec.ts", "*.spec.tsx", "*.spec.js", "*.e2e.ts")
Get-ChildItem -Recurse $ROOT -Include $testPatterns -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch "\\($excludePattern)\\" } |
    ForEach-Object {
        $relativePath = $_.FullName.Substring($ROOT.Length + 1)
        $destPath = Join-Path $testsDir $relativePath
        Copy-SafeFile $_.FullName $destPath
    }

# Test configurations
@("jest.config.*", "vitest.config.*", "playwright.config.*", "cypress.config.*") | ForEach-Object {
    Get-ChildItem -Recurse $ROOT -Filter $_ -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch "\\($excludePattern)\\" } |
        ForEach-Object { Copy-SafeFile $_.FullName (Join-Path $testsDir "config\$($_.Name)") }
}

# === 8. GIT INFORMATION ===
Write-Host "[8/10] Collecting Git information..." -ForegroundColor Yellow
$gitDir = Join-Path $OUT "08_git"
New-Item -ItemType Directory $gitDir | Out-Null

Push-Location $ROOT
try {
    if ((git rev-parse --is-inside-work-tree 2>$null) -eq "true") {
        # Current state
        git status --porcelain=v1 | Out-File (Join-Path $gitDir "status.txt") -Encoding UTF8
        git rev-parse --abbrev-ref HEAD | Out-File (Join-Path $gitDir "current_branch.txt") -Encoding UTF8
        git remote -v | Out-File (Join-Path $gitDir "remotes.txt") -Encoding UTF8
        
        # History
        git log --oneline --graph --decorate --all -n 100 | Out-File (Join-Path $gitDir "commit_graph.txt") -Encoding UTF8
        git log --pretty=format:"%h|%an|%ae|%ad|%s" --date=iso -n 50 | Out-File (Join-Path $gitDir "recent_commits.csv") -Encoding UTF8
        
        # File tracking
        git ls-files | Out-File (Join-Path $gitDir "tracked_files.txt") -Encoding UTF8
        git ls-files --others --ignored --exclude-standard | Out-File (Join-Path $gitDir "ignored_files.txt") -Encoding UTF8
        
        # Branches
        git branch -a | Out-File (Join-Path $gitDir "branches.txt") -Encoding UTF8
        
        # Tags
        git tag -l | Out-File (Join-Path $gitDir "tags.txt") -Encoding UTF8
        
        # Contributors
        git shortlog -sn | Out-File (Join-Path $gitDir "contributors.txt") -Encoding UTF8
        
        if ($IncludeGitHistory) {
            Write-Verbose "Including full git history..."
            $gitHistoryDir = Join-Path $gitDir "history"
            Copy-Item -Path "$ROOT\.git" -Destination $gitHistoryDir -Recurse -Force
        }
    } else {
        "Not a git repository" | Out-File (Join-Path $gitDir "no_git.txt") -Encoding UTF8
    }
} catch {
    "Error collecting git information: $_" | Out-File (Join-Path $gitDir "error.txt") -Encoding UTF8
}
Pop-Location

# === 9. SECURITY SCAN ===
Write-Host "[9/10] Performing security scan..." -ForegroundColor Yellow
$securityDir = Join-Path $OUT "09_security"
New-Item -ItemType Directory $securityDir | Out-Null

# Scan for potential secrets (patterns only, no actual values)
$secretPatterns = @(
    @{Pattern = 'api[_-]?key'; Description = 'API Key references'},
    @{Pattern = 'secret'; Description = 'Secret references'},
    @{Pattern = 'password'; Description = 'Password references'},
    @{Pattern = 'token'; Description = 'Token references'},
    @{Pattern = 'private[_-]?key'; Description = 'Private key references'},
    @{Pattern = 'aws[_-]?access'; Description = 'AWS credentials'},
    @{Pattern = 'firebase'; Description = 'Firebase references'}
)

$findings = @()
foreach ($pattern in $secretPatterns) {
    $matches = Get-ChildItem -Recurse $ROOT -Include "*.ts", "*.js", "*.json", "*.yml", "*.yaml", "*.env*" -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch "\\($excludePattern)\\" } |
        Select-String -Pattern $pattern.Pattern -CaseSensitive:$false |
        Select-Object -First 10

    if ($matches) {
        $findings += @{
            Pattern = $pattern.Description
            Count = $matches.Count
            Files = ($matches | Select-Object -ExpandProperty Path -Unique | ForEach-Object { $_.Substring($ROOT.Length + 1) })
        }
    }
}
$findings | ConvertTo-Json -Depth 3 | Out-File (Join-Path $securityDir "secret_scan.json") -Encoding UTF8

# Permission files
@(".npmrc", ".yarnrc*", ".gitignore", ".dockerignore") | ForEach-Object {
    Get-ChildItem -Path $ROOT -Filter $_ -ErrorAction SilentlyContinue |
        ForEach-Object { Copy-SafeFile $_.FullName (Join-Path $securityDir $_.Name) }
}

# === 10. METADATA ===
Write-Host "[10/10] Creating metadata..." -ForegroundColor Yellow
$metaDir = Join-Path $OUT "00_metadata"
New-Item -ItemType Directory $metaDir | Out-Null

# Collection manifest
$manifest = @{
    CollectionId = [Guid]::NewGuid().ToString()
    CollectionDate = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    CollectionDateUtc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd HH:mm:ss")
    MachineName = $env:COMPUTERNAME
    UserName = $env:USERNAME
    RootDirectory = $ROOT
    OutputDirectory = $OUT
    ArchivePath = $ZIP
    Parameters = @{
        IncludeNodeModules = $IncludeNodeModules.IsPresent
        IncludeGitHistory = $IncludeGitHistory.IsPresent
        Verbose = $Verbose.IsPresent
    }
    ExcludedDirectories = $EXCLUDE_DIRS
    Statistics = @{
        TotalFilesCollected = (Get-ChildItem -Recurse $OUT -File).Count
        TotalDirectoriesCreated = (Get-ChildItem -Recurse $OUT -Directory).Count
        TotalSizeBytes = (Get-ChildItem -Recurse $OUT -File | Measure-Object Length -Sum).Sum
    }
    Categories = @(
        "01_structure - Project structure and file inventory",
        "02_source - Source code files",
        "03_configuration - Configuration files",
        "04_infrastructure - Infrastructure and deployment",
        "05_documentation - Documentation files",
        "06_scripts - Utility scripts",
        "07_tests - Test files and configurations",
        "08_git - Git repository information",
        "09_security - Security scan results",
        "00_metadata - Collection metadata"
    )
}
$manifest | ConvertTo-Json -Depth 5 | Out-File (Join-Path $metaDir "manifest.json") -Encoding UTF8

# System information
$sysInfo = @{
    OSVersion = [System.Environment]::OSVersion.ToString()
    PSVersion = $PSVersionTable.PSVersion.ToString()
    DotNetVersion = [System.Runtime.InteropServices.RuntimeInformation]::FrameworkDescription
    TimeZone = [System.TimeZoneInfo]::Local.DisplayName
    Culture = [System.Globalization.CultureInfo]::CurrentCulture.Name
}
$sysInfo | ConvertTo-Json | Out-File (Join-Path $metaDir "system_info.json") -Encoding UTF8

# Collection log
$logContent = @"
HUNTERS-RUN EVIDENCE COLLECTION LOG
====================================
Collection ID: $($manifest.CollectionId)
Started: $($manifest.CollectionDate)
Machine: $($manifest.MachineName)
User: $($manifest.UserName)

Parameters:
- Include Node Modules: $($IncludeNodeModules.IsPresent)
- Include Git History: $($IncludeGitHistory.IsPresent)
- Verbose Output: $($Verbose.IsPresent)

Excluded Directories:
$($EXCLUDE_DIRS | ForEach-Object { "- $_" } | Out-String)

Results:
- Files Collected: $($manifest.Statistics.TotalFilesCollected)
- Directories Created: $($manifest.Statistics.TotalDirectoriesCreated)
- Total Size: $([math]::Round($manifest.Statistics.TotalSizeBytes / 1MB, 2)) MB

Categories Collected:
$($manifest.Categories | ForEach-Object { "- $_" } | Out-String)
"@
$logContent | Out-File (Join-Path $metaDir "collection.log") -Encoding UTF8

# === CREATE ARCHIVE ===
Write-Host ""
Write-Host "Creating archive..." -ForegroundColor Cyan

if (Test-Path $ZIP) { 
    Remove-Item $ZIP -Force 
}

try {
    # Use .NET compression for better performance
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::CreateFromDirectory($OUT, $ZIP, [System.IO.Compression.CompressionLevel]::Optimal, $false)
    
    $zipSize = (Get-Item $ZIP).Length
    
    Write-Host ""
    Write-Host "=== COLLECTION COMPLETE ===" -ForegroundColor Green
    Write-Host "Archive created: $ZIP" -ForegroundColor Green
    Write-Host "Archive size: $([math]::Round($zipSize / 1MB, 2)) MB" -ForegroundColor Green
    Write-Host ""
    Write-Host "Categories included:" -ForegroundColor Yellow
    $manifest.Categories | ForEach-Object { Write-Host "  $_" }
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Review the archive contents"
    Write-Host "2. Verify sensitive data is properly redacted"
    Write-Host "3. Share the archive as needed"
    
    # Open Explorer to show the file
    explorer.exe /select,$ZIP
    
} catch {
    Write-Error "Failed to create archive: $_"
    Write-Host "Evidence collected but not archived. Files available at: $OUT" -ForegroundColor Yellow
}

# Cleanup temp directory (optional)
$cleanup = Read-Host "Clean up temporary files? (y/n)"
if ($cleanup -eq 'y') {
    Remove-Item $OUT -Recurse -Force
    Write-Host "Temporary files cleaned." -ForegroundColor Gray
}