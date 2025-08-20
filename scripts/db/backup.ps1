#!/usr/bin/env pwsh
# Database backup script for Windows/PowerShell
# Creates compressed PostgreSQL backup using pg_dump

$ErrorActionPreference = "Stop"

# Check if DATABASE_URL is set
if ([string]::IsNullOrEmpty($env:DATABASE_URL)) {
    Write-Host "ERROR: DATABASE_URL environment variable is not set." -ForegroundColor Red
    Write-Host "Please set it first, for example:" -ForegroundColor Yellow
    Write-Host '  $env:DATABASE_URL = "postgres://user:pass@localhost:5432/hunters_run"' -ForegroundColor Yellow
    exit 1
}

# Ensure backups directory exists
if (-not (Test-Path "backups")) {
    New-Item -ItemType Directory -Path "backups" -Force | Out-Null
}

# Generate timestamp and output filename
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$outfile = "backups/hunters_run-$ts.dump"

try {
    # Run pg_dump with compressed format
    pg_dump -Fc -f $outfile $env:DATABASE_URL
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "pg_dump failed with exit code $LASTEXITCODE"
        exit 1
    }
    
    # Verify the backup file was created
    if (-not (Test-Path $outfile)) {
        Write-Error "Backup file was not created: $outfile"
        exit 1
    }
    
    # Get absolute path for output
    $absolutePath = Resolve-Path $outfile
    Write-Host "OK Backup created: $absolutePath" -ForegroundColor Green
    
} catch {
    Write-Error "Backup failed: $($_.Exception.Message)"
    exit 1
}