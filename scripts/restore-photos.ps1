#!/usr/bin/env pwsh
# restore-photos.ps1 - Photo evidence restore script for rollback recovery
# Restores photo data from archive table back to work_orders table

param(
    [Parameter(HelpMessage="Database URL connection string")]
    [string]$DatabaseUrl = $env:DATABASE_URL,
    
    [Parameter(HelpMessage="Backup directory containing restore files")]
    [string]$BackupDir = ".\backups",
    
    [Parameter(HelpMessage="Specific backup timestamp to restore (e.g., 2024-01-15_14-30-00)")]
    [string]$BackupTimestamp = $null,
    
    [Parameter(HelpMessage="Restore only specific work order ID")]
    [string]$WorkOrderId = $null,
    
    [Parameter(HelpMessage="Restore only photos archived since this date (ISO format)")]
    [string]$ArchivedSince = $null,
    
    [Parameter(HelpMessage="Dry run - show what would be restored without making changes")]
    [switch]$DryRun = $false,
    
    [Parameter(HelpMessage="Force restore even if target tables already have photo data")]
    [switch]$Force = $false
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
    Write-Host "Usage: .\restore-photos.ps1 [-DatabaseUrl postgres://user:pass@host:port/db] [-BackupDir ./backups] [-BackupTimestamp 2024-01-15_14-30-00] [-WorkOrderId uuid] [-ArchivedSince 2024-01-15T10:00:00Z] [-DryRun] [-Force]"
    exit 1
}

Write-Info "Starting photo evidence restoration at $(Get-Date)"
if ($DryRun) { Write-Warning "DRY RUN MODE - No changes will be made" }

try {
    # Validate database connection
    Write-Info "Testing database connection..."
    $env:PGPASSWORD = if ($DatabaseUrl -match "://[^:]+:([^@]+)@") { $Matches[1] } else { "" }
    $connectionTest = "SELECT 1 as connected;" | psql $DatabaseUrl -t -q 2>$null
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Database connection failed. Check DATABASE_URL."
        exit 1
    }
    Write-Success "Database connection verified"

    # Check if archive table exists
    Write-Info "Checking for archive table..."
    $archiveTableCheck = @"
SELECT 
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'hr' 
        AND table_name = 'work_order_photos_archive'
    ) THEN 'exists' ELSE 'missing' END as status;
"@
    
    $archiveStatus = $archiveTableCheck | psql $DatabaseUrl -t -q
    if ($archiveStatus -ne "exists") {
        Write-Error "Archive table hr.work_order_photos_archive does not exist. Run migration 016_photo_rollback_safety.sql first."
        exit 1
    }
    Write-Success "Archive table found"

    # Get count of archived photos
    $photoCountQuery = @"
SELECT 
    COUNT(*) as archive_count,
    COUNT(CASE WHEN tenant_photo_s3_key IS NOT NULL THEN 1 END) as photos_with_s3_key,
    MIN(archived_at) as oldest_archive,
    MAX(archived_at) as newest_archive
FROM hr.work_order_photos_archive
$(if ($WorkOrderId) { "WHERE work_order_id = '$WorkOrderId'" })
$(if ($ArchivedSince) { 
    if ($WorkOrderId) { "AND" } else { "WHERE" }
    " archived_at >= '$ArchivedSince'" 
});
"@

    Write-Info "Checking archived photo data..."
    $archiveStats = $photoCountQuery | psql $DatabaseUrl -t -q
    $archiveCount = ($archiveStats -split '\|')[0].Trim()
    $photosWithS3Key = ($archiveStats -split '\|')[1].Trim()
    
    if ([int]$archiveCount -eq 0) {
        Write-Warning "No archived photos found matching criteria"
        if ($WorkOrderId) { Write-Info "Work Order ID filter: $WorkOrderId" }
        if ($ArchivedSince) { Write-Info "Archived since filter: $ArchivedSince" }
        exit 0
    }
    
    Write-Success "Found $archiveCount archived photo records ($photosWithS3Key with S3 keys)"

    # Check current state of work_orders table
    $currentCountQuery = @"
SELECT 
    COUNT(*) as total_work_orders,
    COUNT(CASE WHEN tenant_photo_s3_key IS NOT NULL THEN 1 END) as current_photos
FROM hr.work_orders
$(if ($WorkOrderId) { "WHERE id = '$WorkOrderId'" });
"@

    $currentStats = $currentCountQuery | psql $DatabaseUrl -t -q
    $totalWorkOrders = ($currentStats -split '\|')[0].Trim()
    $currentPhotos = ($currentStats -split '\|')[1].Trim()
    
    Write-Info "Current work orders: $totalWorkOrders (with $currentPhotos photos)"

    # Safety check - warn if overwriting existing photos
    if ([int]$currentPhotos -gt 0 -and -not $Force) {
        Write-Warning "Work orders table already contains $currentPhotos photo records"
        Write-Warning "This restore operation will overwrite existing photo data"
        Write-Warning "Use -Force to proceed, or specify -WorkOrderId to target specific records"
        
        $confirmation = Read-Host "Continue with restore? (y/N)"
        if ($confirmation -ne "y" -and $confirmation -ne "Y") {
            Write-Info "Restore cancelled by user"
            exit 0
        }
    }

    # Build restore parameters for the stored function
    $workOrderParam = if ($WorkOrderId) { "'$WorkOrderId'::uuid" } else { "NULL" }
    $archivedSinceParam = if ($ArchivedSince) { "'$ArchivedSince'::timestamptz" } else { "NULL" }

    # Preview what will be restored
    $previewQuery = @"
SELECT 
    wopa.work_order_id,
    wopa.organization_id,
    wopa.tenant_photo_s3_key,
    wopa.tenant_photo_size_bytes,
    wopa.tenant_photo_mime_type,
    wopa.archived_at,
    wopa.archived_reason,
    wo.ticket_id,
    wo.title
FROM hr.work_order_photos_archive wopa
JOIN hr.work_orders wo ON wo.id = wopa.work_order_id
WHERE 1=1
$(if ($WorkOrderId) { "AND wopa.work_order_id = '$WorkOrderId'" })
$(if ($ArchivedSince) { "AND wopa.archived_at >= '$ArchivedSince'" })
ORDER BY wopa.archived_at DESC;
"@

    Write-Info "Photos to be restored:"
    $preview = $previewQuery | psql $DatabaseUrl -q 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host $preview -ForegroundColor Gray
    } else {
        Write-Warning "Could not generate preview"
    }

    if ($DryRun) {
        Write-Success "DRY RUN: Would restore photos using function hr.restore_photos_from_archive($workOrderParam, $archivedSinceParam)"
        Write-Info "Run without -DryRun to execute the restore"
        exit 0
    }

    # Execute restore using the database function
    Write-Info "Executing restore using hr.restore_photos_from_archive($workOrderParam, $archivedSinceParam)..."
    
    $restoreQuery = @"
DO `$`$
DECLARE
    restore_result RECORD;
    total_restored integer := 0;
BEGIN
    -- Call the restore function
    FOR restore_result IN 
        SELECT * FROM hr.restore_photos_from_archive($workOrderParam, $archivedSinceParam)
    LOOP
        IF restore_result.restored_count > 0 THEN
            total_restored := total_restored + restore_result.restored_count;
            RAISE NOTICE 'Restored photos for work order: %', restore_result.work_order_id;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Total photos restored: %', total_restored;
    
    IF total_restored = 0 THEN
        RAISE NOTICE 'No photos were restored - check filter criteria or existing data';
    END IF;
END`$`$;
"@

    $restoreResult = $restoreQuery | psql $DatabaseUrl -q
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Restore operation completed"
        Write-Host $restoreResult -ForegroundColor Gray
    } else {
        Write-Error "Restore operation failed"
        exit 1
    }

    # Verify restoration
    Write-Info "Verifying restoration..."
    $verifyQuery = @"
SELECT 
    COUNT(*) as total_photos,
    COUNT(CASE WHEN tenant_photo_s3_key IS NOT NULL THEN 1 END) as photos_with_s3_key,
    COUNT(CASE WHEN tenant_photo_uploaded_at IS NOT NULL THEN 1 END) as photos_with_timestamp
FROM hr.work_orders
$(if ($WorkOrderId) { "WHERE id = '$WorkOrderId'" })
$(if (-not $WorkOrderId -and $ArchivedSince) { "WHERE updated_at >= '$ArchivedSince'" });
"@

    $verifyStats = $verifyQuery | psql $DatabaseUrl -t -q
    $finalPhotos = ($verifyStats -split '\|')[1].Trim()
    
    Write-Success "Verification complete: $finalPhotos photos now in work_orders table"

    # Create restoration log
    $logEntry = @{
        restore_timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ"
        database_host = if ($DatabaseUrl -match "://[^@]+@([^:/]+)") { $Matches[1] } else { "unknown" }
        work_order_filter = if ($WorkOrderId) { $WorkOrderId } else { "ALL" }
        archived_since_filter = if ($ArchivedSince) { $ArchivedSince } else { "ALL" }
        photos_restored = $finalPhotos
        dry_run = $DryRun.IsPresent
        forced = $Force.IsPresent
    }
    
    $logFile = Join-Path $BackupDir "restore-log-$(Get-Date -Format 'yyyy-MM-dd_HH-mm-ss').json"
    $logEntry | ConvertTo-Json -Depth 10 | Out-File -FilePath $logFile -Encoding UTF8
    Write-Success "Restoration log created: $logFile"

    Write-Success "Photo restoration completed successfully!"
    Write-Info "Restored photos: $finalPhotos"
    Write-Info "Restoration timestamp: $(Get-Date)"

} catch {
    Write-Error "Restore failed: $($_.Exception.Message)"
    
    Write-Host "Full error details:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    exit 1
} finally {
    # Clean up environment
    if ($env:PGPASSWORD) {
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    }
}

Write-Info "Restore process completed at $(Get-Date)"