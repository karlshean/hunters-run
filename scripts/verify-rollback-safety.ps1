#!/usr/bin/env pwsh
# verify-rollback-safety.ps1 - Comprehensive rollback safety verification
# Tests backup/restore functionality to ensure no photo evidence is lost

param(
    [Parameter(HelpMessage="Database URL connection string")]
    [string]$DatabaseUrl = $env:DATABASE_URL,
    
    [Parameter(HelpMessage="Skip cleanup of test data")]
    [switch]$KeepTestData = $false
)

$ErrorActionPreference = "Stop"

# Color output functions
function Write-Success($msg) { Write-Host "[OK]  $msg" -ForegroundColor Green }
function Write-Error($msg) { Write-Host "[ERR] $msg" -ForegroundColor Red }
function Write-Warning($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Step($msg) { Write-Host "[STEP] $msg" -ForegroundColor Blue }

$testOrgId = "00000000-0000-4000-8000-000000000001"  # Demo org ID
$testWorkOrderId = $null
$testPhotoS3Key = "test-rollback-safety/photo-$(Get-Date -Format 'yyyyMMdd-HHmmss').jpg"
$backupDir = ".\test-backups"

Write-Info "Starting Rollback Safety Verification at $(Get-Date)"

try {
    # Validate required parameters
    if ([string]::IsNullOrEmpty($DatabaseUrl)) {
        Write-Error "DATABASE_URL environment variable not set"
        exit 1
    }

    # Test database connection using Docker
    Write-Step "Testing database connection..."
    try {
        $connectionTest = docker exec hunters-run-postgres-1 psql -U postgres -d unified -c "SELECT 1 as connected;" 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Database connection failed"
            exit 1
        }
        Write-Success "Database connection verified"
    } catch {
        Write-Error "Database connection failed - ensure Docker containers are running"
        exit 1
    }

    # Ensure migration is applied
    Write-Step "Checking for archive table..."
    $archiveTableCheck = @"
SELECT 
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'hr' 
        AND table_name = 'work_order_photos_archive'
    ) THEN 'exists' ELSE 'missing' END as status;
"@
    
    $archiveStatus = $archiveTableCheck | docker exec -i hunters-run-postgres-1 psql -U postgres -d unified -t -q
    if ($archiveStatus -ne "exists") {
        Write-Error "Archive table missing. Run migration 016_photo_rollback_safety.sql"
        exit 1
    }
    Write-Success "Archive table exists"

    # Create test backup directory
    if (-not (Test-Path $backupDir)) {
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    }

    # Step 1: Create test work order with photo data
    Write-Step "Creating test work order with photo data..."
    
    $createWorkOrderQuery = @"
INSERT INTO hr.work_orders (
    id,
    organization_id,
    ticket_id,
    title,
    description,
    status,
    priority,
    unit_id,
    tenant_id,
    tenant_photo_url,
    tenant_photo_s3_key,
    tenant_photo_uploaded_at,
    tenant_photo_size_bytes,
    tenant_photo_mime_type,
    tenant_photo_etag,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    '$testOrgId',
    'ROLLBACK-TEST-' || extract(epoch from now()),
    'Rollback Safety Test Work Order',
    'Auto-generated work order for rollback safety testing',
    'open',
    'high',
    '00000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000004',
    'https://test-bucket.s3.amazonaws.com/$testPhotoS3Key',
    '$testPhotoS3Key',
    NOW(),
    1024768,
    'image/jpeg',
    'abcd1234567890',
    NOW(),
    NOW()
) RETURNING id;
"@

    $workOrderResult = $createWorkOrderQuery | docker exec -i hunters-run-postgres-1 psql -U postgres -d unified -t -q
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to create test work order"
        exit 1
    }
    
    $testWorkOrderId = $workOrderResult.Trim()
    Write-Success "Test work order created: $testWorkOrderId"

    # Step 2: Run snapshot function to archive the photo data
    Write-Step "Running photo snapshot to create archive..."
    
    $snapshotQuery = "SELECT * FROM hr.snapshot_work_order_photos();"
    $snapshotResult = $snapshotQuery | psql $DatabaseUrl -q 2>$null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Photo snapshot completed"
        Write-Host $snapshotResult -ForegroundColor Gray
    } else {
        Write-Error "Photo snapshot failed"
        exit 1
    }

    # Step 3: Run backup script
    Write-Step "Running backup script..."
    
    $backupScriptPath = ".\scripts\backup-photos.ps1"
    if (-not (Test-Path $backupScriptPath)) {
        Write-Error "Backup script not found: $backupScriptPath"
        exit 1
    }
    
    & $backupScriptPath -DatabaseUrl $DatabaseUrl -BackupDir $backupDir -OrgId $testOrgId -NoCompress
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Backup created successfully"
        
        # Verify backup files exist
        $backupFiles = Get-ChildItem $backupDir -Filter "*photo-backup-*" | Measure-Object
        if ($backupFiles.Count -gt 0) {
            Write-Success "Backup files created: $($backupFiles.Count) files"
        } else {
            Write-Error "No backup files found"
            exit 1
        }
    } else {
        Write-Error "Backup script failed"
        exit 1
    }

    # Step 4: Simulate rollback by clearing photo data from work_orders
    Write-Step "Simulating rollback by clearing photo data..."
    
    $clearPhotoQuery = @"
UPDATE hr.work_orders 
SET 
    tenant_photo_url = NULL,
    tenant_photo_s3_key = NULL,
    tenant_photo_uploaded_at = NULL,
    tenant_photo_size_bytes = NULL,
    tenant_photo_mime_type = NULL,
    tenant_photo_etag = NULL
WHERE id = '$testWorkOrderId';
"@

    $clearResult = $clearPhotoQuery | psql $DatabaseUrl -q 2>$null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Photo data cleared from work_orders table (rollback simulated)"
    } else {
        Write-Error "Failed to clear photo data"
        exit 1
    }

    # Step 5: Verify data preserved in archive
    Write-Step "Verifying data preserved in archive..."
    
    $archiveCheckQuery = @"
SELECT 
    COUNT(*) as archive_count,
    COUNT(CASE WHEN tenant_photo_s3_key = '$testPhotoS3Key' THEN 1 END) as test_photo_count
FROM hr.work_order_photos_archive 
WHERE work_order_id = '$testWorkOrderId';
"@

    $archiveCheck = $archiveCheckQuery | psql $DatabaseUrl -t -q
    $archiveCount = ($archiveCheck -split '\|')[0].Trim()
    $testPhotoCount = ($archiveCheck -split '\|')[1].Trim()
    
    if ([int]$testPhotoCount -gt 0) {
        Write-Success "Data preserved in archive: $archiveCount records, test photo found"
    } else {
        Write-Error "Test photo data not found in archive"
        exit 1
    }

    # Step 6: Run restore script
    Write-Step "Running restore script..."
    
    $restoreScriptPath = ".\scripts\restore-photos.ps1"
    if (-not (Test-Path $restoreScriptPath)) {
        Write-Error "Restore script not found: $restoreScriptPath"
        exit 1
    }
    
    & $restoreScriptPath -DatabaseUrl $DatabaseUrl -BackupDir $backupDir -WorkOrderId $testWorkOrderId -Force
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Restore completed successfully"
    } else {
        Write-Error "Restore script failed"
        exit 1
    }

    # Step 7: Verify data restored correctly
    Write-Step "Verifying data restored correctly..."
    
    $restoreVerifyQuery = @"
SELECT 
    tenant_photo_s3_key,
    tenant_photo_size_bytes,
    tenant_photo_mime_type,
    tenant_photo_uploaded_at IS NOT NULL as has_timestamp
FROM hr.work_orders 
WHERE id = '$testWorkOrderId';
"@

    $restoreCheck = $restoreVerifyQuery | psql $DatabaseUrl -t -q
    $restoredS3Key = ($restoreCheck -split '\|')[0].Trim()
    $restoredSize = ($restoreCheck -split '\|')[1].Trim()
    $restoredMimeType = ($restoreCheck -split '\|')[2].Trim()
    $hasTimestamp = ($restoreCheck -split '\|')[3].Trim()
    
    if ($restoredS3Key -eq $testPhotoS3Key -and $restoredSize -eq "1024768" -and $restoredMimeType -eq "image/jpeg" -and $hasTimestamp -eq "t") {
        Write-Success "Data restored correctly - all fields match original"
    } else {
        Write-Error "Data restoration incomplete or incorrect"
        Write-Host "Expected S3 Key: $testPhotoS3Key, Got: $restoredS3Key" -ForegroundColor Red
        Write-Host "Expected Size: 1024768, Got: $restoredSize" -ForegroundColor Red
        Write-Host "Expected MIME: image/jpeg, Got: $restoredMimeType" -ForegroundColor Red
        Write-Host "Has Timestamp: $hasTimestamp" -ForegroundColor Red
        exit 1
    }

    # Step 8: Test environment flag protection (optional)
    Write-Step "Testing environment flag protection..."
    
    # Try to update photo with flag disabled
    $flagTestQuery = @"
SET app.tenant_photo_flow_enabled = 'false';
UPDATE hr.work_orders 
SET tenant_photo_s3_key = 'should-fail.jpg'
WHERE id = '$testWorkOrderId';
"@

    $flagTest = $flagTestQuery | psql $DatabaseUrl -q 2>&1
    
    if ($flagTest -match "Photo field updates are disabled") {
        Write-Success "Environment flag protection working correctly"
    } else {
        Write-Warning "Environment flag protection may not be working (trigger might not be active)"
    }

    # Final verification - comprehensive data integrity check
    Write-Step "Running final data integrity check..."
    
    $integrityQuery = @"
SELECT 
    'work_orders' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN tenant_photo_s3_key IS NOT NULL THEN 1 END) as photos_count
FROM hr.work_orders 
WHERE organization_id = '$testOrgId'
UNION ALL
SELECT 
    'photos_archive' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN tenant_photo_s3_key IS NOT NULL THEN 1 END) as photos_count
FROM hr.work_order_photos_archive 
WHERE organization_id = '$testOrgId';
"@

    $integrityCheck = $integrityQuery | psql $DatabaseUrl -q
    Write-Success "Final integrity check completed"
    Write-Host $integrityCheck -ForegroundColor Gray

    Write-Success "All rollback safety tests PASSED!"
    Write-Info "Backup created"
    Write-Info "Data preserved in archive"  
    Write-Info "Data restored correctly"
    Write-Info "Verification completed successfully at $(Get-Date)"

} catch {
    Write-Error "Rollback safety verification failed: $($_.Exception.Message)"
    
    Write-Host "Full error details:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    exit 1
} finally {
    # Cleanup test data (unless KeepTestData is specified)
    if (-not $KeepTestData -and $testWorkOrderId) {
        Write-Step "Cleaning up test data..."
        
        try {
            # Remove test work order
            $cleanupQuery = "DELETE FROM hr.work_orders WHERE id = '$testWorkOrderId';"
            $cleanupQuery | psql $DatabaseUrl -q 2>$null
            
            # Remove test archive entries
            $cleanupArchiveQuery = "DELETE FROM hr.work_order_photos_archive WHERE work_order_id = '$testWorkOrderId';"
            $cleanupArchiveQuery | psql $DatabaseUrl -q 2>$null
            
            Write-Success "Test data cleaned up"
        } catch {
            Write-Warning "Failed to clean up test data: $($_.Exception.Message)"
        }
    }

    # Clean up test backup directory
    if (Test-Path $backupDir) {
        try {
            Remove-Item $backupDir -Recurse -Force
            Write-Info "Test backup directory removed"
        } catch {
            Write-Warning "Failed to remove test backup directory"
        }
    }

    # Clean up environment
    if ($env:PGPASSWORD) {
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    }
}

Write-Info "Rollback safety verification completed at $(Get-Date)"