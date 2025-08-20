#!/usr/bin/env pwsh
# Database restore script for Windows/PowerShell
# Restores PostgreSQL backup using pg_restore

param(
    [Parameter(HelpMessage="Path to backup file to restore")]
    [string]$Path,
    
    [Parameter(HelpMessage="Force restore even if database is not empty")]
    [switch]$Force
)

$ErrorActionPreference = "Stop"

# Check if DATABASE_URL is set
if ([string]::IsNullOrEmpty($env:DATABASE_URL)) {
    Write-Host "ERROR: DATABASE_URL environment variable is not set." -ForegroundColor Red
    Write-Host "Please set it first, for example:" -ForegroundColor Yellow
    Write-Host '  $env:DATABASE_URL = "postgres://user:pass@localhost:5432/hunters_run"' -ForegroundColor Yellow
    exit 1
}

# If -Path not provided, pick the latest backups/*.dump
if ([string]::IsNullOrEmpty($Path)) {
    $backupFiles = Get-ChildItem -Path "backups" -Filter "*.dump" | Sort-Object LastWriteTime -Descending
    
    if ($backupFiles.Count -eq 0) {
        Write-Error "No backup files found in backups/ directory and no -Path specified"
        exit 1
    }
    
    $Path = $backupFiles[0].FullName
    Write-Host "Using latest backup: $Path" -ForegroundColor Yellow
}

# Verify backup file exists
if (-not (Test-Path $Path)) {
    Write-Error "Backup file not found: $Path"
    exit 1
}

try {
    # Safety guard: check if database is empty (unless -Force is used)
    if (-not $Force) {
        $count = psql $env:DATABASE_URL -t -c "select count(*) from information_schema.tables where table_schema not in ('pg_catalog','information_schema');" | ForEach-Object { $_.Trim() }
        
        if (($count -as [int]) -gt 0) {
            Write-Host "ERROR: Database is not empty (contains $count tables). Use -Force to proceed." -ForegroundColor Red
            exit 1
        }
    }
    
    # Run pg_restore
    pg_restore --clean --if-exists --no-owner -d $env:DATABASE_URL $Path
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "pg_restore failed with exit code $LASTEXITCODE"
        exit 1
    }
    
    # Get absolute path for output
    $absolutePath = Resolve-Path $Path
    Write-Host "OK Restore from: $absolutePath" -ForegroundColor Green
    
} catch {
    Write-Error "Restore failed: $($_.Exception.Message)"
    exit 1
}