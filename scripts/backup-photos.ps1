#!/usr/bin/env pwsh
# backup-photos.ps1 - Photo evidence backup script for rollback safety
# Creates a comprehensive backup of all photo-related data

param(
    [Parameter(HelpMessage="Database URL connection string")]
    [string]$DatabaseUrl = $env:DATABASE_URL,
    
    [Parameter(HelpMessage="Output directory for backups")]
    [string]$BackupDir = ".\backups",
    
    [Parameter(HelpMessage="Include only specific organization ID")]
    [string]$OrgId = $null,
    
    [Parameter(HelpMessage="Skip compression (faster but larger files)")]
    [switch]$NoCompress = $false
)

$ErrorActionPreference = "Stop"

# Color output functions
function Write-Success($msg) { Write-Host "[OK]  $msg" -ForegroundColor Green }
function Write-Error($msg) { Write-Host "[ERR] $msg" -ForegroundColor Red }
function Write-Warning($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }

# Validate required parameters
if ([string]::IsNullOrEmpty($DatabaseUrl)) {
    Write-Error "DATABASE_URL environment variable not set or -DatabaseUrl parameter missing"
    Write-Host "Usage: .\backup-photos.ps1 [-DatabaseUrl postgres://user:pass@host:port/db] [-BackupDir ./backups] [-OrgId uuid] [-NoCompress] [-Verbose]"
    exit 1
}

# Create backup directory
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    Write-Info "Created backup directory: $BackupDir"
}

# Generate timestamp for backup files
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$backupPrefix = "photo-backup-$timestamp"

Write-Info "Starting photo evidence backup at $(Get-Date)"
Write-Info "Target directory: $(Resolve-Path $BackupDir)"

try {
    # 1. Backup current photo data from work_orders table
    $currentPhotosFile = Join-Path $BackupDir "$backupPrefix-current-photos.sql"
    Write-Info "Backing up current photo data to: $currentPhotosFile"
    
    $photoColumns = @(
        "id",
        "organization_id", 
        "ticket_id",
        "title",
        "tenant_photo_url",
        "tenant_photo_s3_key", 
        "tenant_photo_uploaded_at",
        "tenant_photo_size_bytes",
        "tenant_photo_mime_type", 
        "tenant_photo_etag",
        "created_at",
        "updated_at"
    ) -join ","
    
    $whereClause = if ($OrgId) { "WHERE organization_id = '$OrgId'" } else { "" }
    
    $currentQuery = @"
-- Photo Evidence Backup - Current Data
-- Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss UTC")
-- Source: hr.work_orders (current photo fields)
$(if ($OrgId) { "-- Organization: $OrgId" } else { "-- Organization: ALL" })

COPY (
    SELECT $photoColumns
    FROM hr.work_orders 
    $whereClause
    AND (
        tenant_photo_url IS NOT NULL 
        OR tenant_photo_s3_key IS NOT NULL
        OR tenant_photo_uploaded_at IS NOT NULL
        OR tenant_photo_size_bytes IS NOT NULL
        OR tenant_photo_mime_type IS NOT NULL
        OR tenant_photo_etag IS NOT NULL
    )
    ORDER BY created_at DESC
) TO STDOUT WITH (FORMAT CSV, HEADER true, DELIMITER ',', QUOTE '"', ESCAPE '"');
"@

    # Execute current photos backup
    $env:PGPASSWORD = if ($DatabaseUrl -match "://[^:]+:([^@]+)@") { $Matches[1] } else { "" }
    $currentResult = $currentQuery | psql $DatabaseUrl -f - --output=$currentPhotosFile --quiet
    
    if ($LASTEXITCODE -eq 0) {
        $currentSize = (Get-Item $currentPhotosFile).Length
        Write-Success "Current photos backup completed ($([math]::Round($currentSize/1KB, 2)) KB)"
    } else {
        Write-Error "Current photos backup failed"
        exit 1
    }

    # 2. Backup archive data from work_order_photos_archive table
    $archivePhotosFile = Join-Path $BackupDir "$backupPrefix-archive-photos.sql"
    Write-Info "Backing up archive photo data to: $archivePhotosFile"
    
    $archiveQuery = @"
-- Photo Evidence Backup - Archive Data  
-- Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss UTC")
-- Source: hr.work_order_photos_archive (historical photo data)
$(if ($OrgId) { "-- Organization: $OrgId" } else { "-- Organization: ALL" })

COPY (
    SELECT 
        id,
        work_order_id,
        organization_id,
        tenant_photo_url,
        tenant_photo_s3_key,
        tenant_photo_uploaded_at, 
        tenant_photo_size_bytes,
        tenant_photo_mime_type,
        tenant_photo_etag,
        archived_at,
        archived_reason,
        source_table
    FROM hr.work_order_photos_archive
    $(if ($OrgId) { "WHERE organization_id = '$OrgId'" } else { "" })
    ORDER BY archived_at DESC
) TO STDOUT WITH (FORMAT CSV, HEADER true, DELIMITER ',', QUOTE '"', ESCAPE '"');
"@

    $archiveResult = $archiveQuery | psql $DatabaseUrl -f - --output=$archivePhotosFile --quiet
    
    if ($LASTEXITCODE -eq 0) {
        $archiveSize = (Get-Item $archivePhotosFile).Length  
        Write-Success "Archive photos backup completed ($([math]::Round($archiveSize/1KB, 2)) KB)"
    } else {
        Write-Warning "Archive photos backup failed (table may not exist yet)"
        # Create empty archive file for completeness
        "-- No archive data available" | Out-File -FilePath $archivePhotosFile -Encoding UTF8
    }

    # 3. Create restore script
    $restoreScriptFile = Join-Path $BackupDir "$backupPrefix-restore.sql"
    Write-Info "Generating restore script: $restoreScriptFile"
    
    $restoreScript = @"
-- Photo Evidence Restore Script
-- Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss UTC")
-- 
-- This script can be used to restore photo data after a rollback
-- Run with: psql `$DATABASE_URL -f $backupPrefix-restore.sql
--
-- IMPORTANT: Review and test in a development environment first!

-- Step 1: Ensure archive table exists
CREATE TABLE IF NOT EXISTS hr.work_order_photos_archive (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    tenant_photo_url text,
    tenant_photo_s3_key text,
    tenant_photo_uploaded_at timestamptz,
    tenant_photo_size_bytes integer,
    tenant_photo_mime_type text,
    tenant_photo_etag text,
    archived_at timestamptz NOT NULL DEFAULT NOW(),
    archived_reason text NOT NULL DEFAULT 'restore',
    source_table text NOT NULL DEFAULT 'backup'
);

-- Step 2: Import current photo data back to archive
-- \copy hr.work_order_photos_archive(id,work_order_id,organization_id,tenant_photo_url,tenant_photo_s3_key,tenant_photo_uploaded_at,tenant_photo_size_bytes,tenant_photo_mime_type,tenant_photo_etag,archived_at,archived_reason,source_table) FROM '$backupPrefix-current-photos.csv' WITH (FORMAT CSV, HEADER true);

-- Step 3: Use the restore function to copy back to work_orders table
-- SELECT hr.restore_photos_from_archive();

-- Step 4: Verify restoration
-- SELECT COUNT(*) as restored_photos FROM hr.work_orders WHERE tenant_photo_s3_key IS NOT NULL;

SELECT 'Restore script generated. Review and uncomment steps above to execute.' as message;
"@

    $restoreScript | Out-File -FilePath $restoreScriptFile -Encoding UTF8
    Write-Success "Restore script generated"

    # 4. Generate backup manifest
    $manifestFile = Join-Path $BackupDir "$backupPrefix-manifest.json"
    
    $manifest = @{
        backup_timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ"
        backup_version = "1.0"
        database_url_host = if ($DatabaseUrl -match "://[^@]+@([^:/]+)") { $Matches[1] } else { "unknown" }
        organization_filter = if ($OrgId) { $OrgId } else { "ALL" }
        files = @{
            current_photos = @{
                filename = "$backupPrefix-current-photos.sql"
                size_bytes = (Get-Item $currentPhotosFile).Length
                description = "Current photo fields from hr.work_orders table"
            }
            archive_photos = @{
                filename = "$backupPrefix-archive-photos.sql" 
                size_bytes = (Get-Item $archivePhotosFile).Length
                description = "Historical photo data from hr.work_order_photos_archive table"
            }
            restore_script = @{
                filename = "$backupPrefix-restore.sql"
                size_bytes = (Get-Item $restoreScriptFile).Length
                description = "Script to restore photo data after rollback"
            }
        }
        instructions = @(
            "1. Keep these backup files in a safe location",
            "2. Before rolling back photo features, run db:photo:snapshot to create archive",
            "3. After rollback, use $backupPrefix-restore.sql to restore data if needed",
            "4. Test restore in development environment first"
        )
    }
    
    $manifest | ConvertTo-Json -Depth 10 | Out-File -FilePath $manifestFile -Encoding UTF8
    Write-Success "Backup manifest created: $manifestFile"

    # 5. Optional compression
    if (-not $NoCompress) {
        Write-Info "Compressing backup files..."
        
        $zipFile = Join-Path $BackupDir "$backupPrefix.zip"
        
        # Use .NET compression if available
        try {
            Add-Type -AssemblyName System.IO.Compression.FileSystem
            $compression = [System.IO.Compression.CompressionLevel]::Optimal
            
            $zip = [System.IO.Compression.ZipFile]::Open($zipFile, [System.IO.Compression.ZipArchiveMode]::Create)
            
            # Add files to zip
            $filesToZip = @($currentPhotosFile, $archivePhotosFile, $restoreScriptFile, $manifestFile)
            foreach ($file in $filesToZip) {
                if (Test-Path $file) {
                    $fileName = Split-Path $file -Leaf
                    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file, $fileName, $compression) | Out-Null
                }
            }
            
            $zip.Dispose()
            
            $zipSize = (Get-Item $zipFile).Length
            Write-Success "Backup compressed to: $zipFile ($([math]::Round($zipSize/1KB, 2)) KB)"
            
            # Clean up individual files
            Remove-Item $currentPhotosFile, $archivePhotosFile, $restoreScriptFile, $manifestFile -Force
            Write-Info "Individual files removed, backup available in ZIP"
            
        } catch {
            Write-Warning "Compression failed: $($_.Exception.Message)"
            Write-Info "Individual files preserved"
        }
    }

    # 6. Summary
    Write-Success "Photo backup completed successfully!"
    Write-Info "Backup location: $(Resolve-Path $BackupDir)"
    Write-Info "Backup timestamp: $timestamp"
    
    if ($OrgId) {
        Write-Info "Organization filter: $OrgId"
    } else {
        Write-Info "Organization filter: ALL"
    }
    
    # Display backup statistics
    if (Test-Path $zipFile) {
        Write-Info "Total backup size: $([math]::Round((Get-Item $zipFile).Length/1KB, 2)) KB (compressed)"
    } else {
        $totalSize = (Get-ChildItem $BackupDir -Filter "$backupPrefix*" | Measure-Object -Property Length -Sum).Sum
        Write-Info "Total backup size: $([math]::Round($totalSize/1KB, 2)) KB (uncompressed)"
    }

} catch {
    Write-Error "Backup failed: $($_.Exception.Message)"
    
    Write-Host "Full error details:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    exit 1
} finally {
    # Clean up environment
    if ($env:PGPASSWORD) {
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    }
}

Write-Info "Backup process completed at $(Get-Date)"