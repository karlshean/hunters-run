#!/usr/bin/env pwsh
# Database backup/restore self-check script
# Tests the complete backup/restore cycle to verify functionality

$ErrorActionPreference = "Stop"

# Check prerequisites
if ([string]::IsNullOrEmpty($env:DATABASE_URL)) {
    Write-Host "ERROR: DATABASE_URL environment variable is not set." -ForegroundColor Red
    exit 1
}

# Check if required tools are available
$tools = @('pg_dump', 'pg_restore', 'psql')
foreach ($tool in $tools) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        Write-Host "ERROR: $tool is not available on PATH" -ForegroundColor Red
        exit 1
    }
}

try {
    Write-Host "Starting database backup/restore self-check..." -ForegroundColor Cyan
    
    # Step 1: Create a unique marker table
    Write-Host "Step 1: Creating marker table..." -ForegroundColor Yellow
    $createMarkerQuery = @"
create table if not exists public._selfcheck_marker (id int primary key);
insert into public._selfcheck_marker (id) values (42) on conflict do nothing;
"@
    
    $createMarkerQuery | psql $env:DATABASE_URL -q
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to create marker table"
        exit 1
    }
    
    # Step 2: Run backup and capture the output filename
    Write-Host "Step 2: Running backup..." -ForegroundColor Yellow
    $backupOutput = & ".\scripts\db\backup.ps1" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Backup failed: $backupOutput"
        exit 1
    }
    
    # Extract filename from backup output
    $backupFile = ""
    if ($backupOutput -match "OK Backup created: (.+)") {
        $backupFile = $matches[1].Trim()
    } else {
        Write-Error "Could not determine backup filename from output: $backupOutput"
        exit 1
    }
    
    Write-Host "Backup created: $backupFile" -ForegroundColor Green
    
    # Step 3: Drop the marker table
    Write-Host "Step 3: Dropping marker table..." -ForegroundColor Yellow
    $dropMarkerQuery = "drop table public._selfcheck_marker;"
    $dropMarkerQuery | psql $env:DATABASE_URL -q
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to drop marker table"
        exit 1
    }
    
    # Step 4: Run restore with the backup file and -Force
    Write-Host "Step 4: Running restore..." -ForegroundColor Yellow
    $restoreOutput = & ".\scripts\db\restore.ps1" -Path $backupFile -Force 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Restore failed: $restoreOutput"
        exit 1
    }
    
    Write-Host "Restore completed: $restoreOutput" -ForegroundColor Green
    
    # Step 5: Assert marker exists again
    Write-Host "Step 5: Verifying marker table..." -ForegroundColor Yellow
    $verifyQuery = "select count(*) from public._selfcheck_marker where id=42;"
    $markerCount = psql $env:DATABASE_URL -t -c $verifyQuery | ForEach-Object { $_.Trim() }
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to query marker table after restore"
        exit 1
    }
    
    if (($markerCount -as [int]) -eq 1) {
        Write-Host "SELF-CHECK PASSED" -ForegroundColor Green
        
        # Clean up: remove the marker table
        $cleanupQuery = "drop table if exists public._selfcheck_marker;"
        $cleanupQuery | psql $env:DATABASE_URL -q 2>$null
        
        exit 0
    } else {
        Write-Host "SELF-CHECK FAILED: Marker count = $markerCount (expected 1)" -ForegroundColor Red
        exit 1
    }
    
} catch {
    Write-Host "SELF-CHECK FAILED: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}