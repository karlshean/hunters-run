#!/usr/bin/env pwsh
# Self-check script for Supabase migration
# Validates that all components work correctly against Supabase database
# Requires DATABASE_URL to be set to a Supabase connection string

$ErrorActionPreference = "Stop"

# Color output functions
function Write-Success($msg) { Write-Host "[OK]  $msg" -ForegroundColor Green }
function Write-Error($msg) { Write-Host "[ERR] $msg" -ForegroundColor Red }
function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Step($msg) { Write-Host "[STEP] $msg" -ForegroundColor Blue }

Write-Info "Starting Supabase migration self-check at $(Get-Date)"

try {
    # Step 1: Validate environment and prerequisites
    Write-Step "Phase 1: Environment Validation"
    
    if (-not $env:DATABASE_URL) {
        throw "DATABASE_URL environment variable is required. Please set it to your Supabase connection string."
    }
    
    # Check if DATABASE_URL looks like a Supabase URL
    if (-not $env:DATABASE_URL.Contains("supabase.co")) {
        Write-Info "WARNING: DATABASE_URL does not appear to be a Supabase connection string"
        Write-Info "Expected format: postgres://postgres:[password]@db.[project-ref].supabase.co:5432/postgres?sslmode=require"
    }
    
    # Mask password in logs
    $maskedUrl = $env:DATABASE_URL -replace '(postgres://[^:]+:)[^@]+(@)', '$1***$2'
    Write-Success "DATABASE_URL configured: $maskedUrl"
    
    # Check PostgreSQL client tools
    try {
        $version = psql --version 2>$null
        Write-Success "PostgreSQL client available: $version"
    } catch {
        throw "PostgreSQL client tools not found. Please install psql and ensure it's in your PATH."
    }
    
    # Step 2: Test database connection
    Write-Step "Phase 2: Database Connection Test"
    
    Write-Info "Testing Supabase database connection..."
    $connectionTest = psql "$env:DATABASE_URL" -c "SELECT version();" 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to connect to Supabase database: $connectionTest"
    }
    Write-Success "Database connection successful"
    
    # Step 3: Run migrations
    Write-Step "Phase 3: Migration Execution"
    
    Write-Info "Running migrations against Supabase..."
    npm run migrate:supabase
    if ($LASTEXITCODE -ne 0) {
        throw "Migration failed"
    }
    Write-Success "Migrations completed successfully"
    
    # Step 4: Validate schema
    Write-Step "Phase 4: Schema Validation"
    
    Write-Info "Validating schema structure..."
    $tables = psql "$env:DATABASE_URL" -t -c "\dt hr.*" | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
    
    $requiredTables = @(
        "organizations",
        "properties", 
        "units",
        "tenants",
        "technicians", 
        "work_orders",
        "audit_events",
        "migrations"
    )
    
    foreach ($table in $requiredTables) {
        if (-not ($tables -match $table)) {
            throw "Required table 'hr.$table' not found in schema"
        }
    }
    Write-Success "All required tables present"
    
    # Validate RLS policies exist
    Write-Info "Validating Row Level Security policies..."
    $policies = psql "$env:DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'hr';"
    $policyCount = [int]($policies.Trim())
    if ($policyCount -eq 0) {
        throw "No RLS policies found for hr schema"
    }
    Write-Success "RLS policies found: $policyCount policies"
    
    # Step 5: Seed data
    Write-Step "Phase 5: Data Seeding"
    
    Write-Info "Seeding Supabase with demo data..."
    npm run seed:supabase
    if ($LASTEXITCODE -ne 0) {
        throw "Seeding failed"
    }
    Write-Success "Demo data seeded successfully"
    
    # Step 6: Validate seeded data
    Write-Info "Validating seeded data..."
    $orgCount = psql "$env:DATABASE_URL" -t -c "SELECT COUNT(*) FROM hr.organizations WHERE id = '00000000-0000-4000-8000-000000000001';"
    if ([int]($orgCount.Trim()) -ne 1) {
        throw "Demo organization not found after seeding"
    }
    
    $workOrderCount = psql "$env:DATABASE_URL" -t -c "SELECT COUNT(*) FROM hr.work_orders WHERE organization_id = '00000000-0000-4000-8000-000000000001';"
    if ([int]($workOrderCount.Trim()) -eq 0) {
        throw "No work orders found for demo organization"
    }
    Write-Success "Seeded data validation passed ($($workOrderCount.Trim()) work orders found)"
    
    # Step 7: Test API connectivity
    Write-Step "Phase 6: API Integration Test"
    
    Write-Info "Starting API server against Supabase..."
    $apiProcess = Start-Process -FilePath "npm" -ArgumentList "run", "dev:hr" -PassThru -WindowStyle Hidden
    
    # Wait for API to be ready
    $maxRetries = 30
    $retryDelay = 2
    $apiReady = $false
    
    for ($i = 1; $i -le $maxRetries; $i++) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -TimeoutSec 5 -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                $apiReady = $true
                Write-Success "API health check passed (attempt $i)"
                break
            }
        } catch {
            Write-Info "Waiting for API... (attempt $i/$maxRetries)"
        }
        
        Start-Sleep -Seconds $retryDelay
    }
    
    if (-not $apiReady) {
        throw "API failed to become healthy after $maxRetries attempts"
    }
    
    # Test API endpoints
    Write-Info "Testing API endpoints..."
    
    # Test flags endpoint (no auth required)
    $flagsResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/flags" -Method GET
    if (-not $flagsResponse) {
        throw "Flags endpoint returned empty response"
    }
    Write-Success "Flags endpoint working: photoFlowEnabled = $($flagsResponse.photoFlowEnabled)"
    
    # Test work orders endpoint (requires org header)
    $headers = @{ "x-org-id" = "00000000-0000-4000-8000-000000000001" }
    $workOrdersResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/maintenance/work-orders" -Method GET -Headers $headers
    if ($workOrdersResponse.Count -eq 0) {
        throw "No work orders returned from API"
    }
    Write-Success "Work orders endpoint working: $($workOrdersResponse.Count) work orders returned"
    
    # Step 8: CEO Validation
    Write-Step "Phase 7: CEO Validation"
    
    Write-Info "Running CEO validation against Supabase..."
    # Use the Node.js version since it has better error handling for different connection scenarios
    $ceoResult = node "scripts/ceo-validate-improved.js" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "CEO validation failed: $ceoResult"
        throw "CEO validation requirements not met"
    }
    Write-Success "CEO validation passed"
    
    # Step 9: Feature Flag Test
    Write-Step "Phase 8: Feature Flag Integration"
    
    Write-Info "Testing feature flag behavior..."
    
    # Test with flag disabled
    $env:TENANT_PHOTO_FLOW_ENABLED = "false"
    $flagsDisabled = Invoke-RestMethod -Uri "http://localhost:3000/api/flags" -Method GET
    if ($flagsDisabled.photoFlowEnabled -ne $false) {
        throw "Feature flag not working correctly (expected false, got $($flagsDisabled.photoFlowEnabled))"
    }
    
    # Test photo endpoint should return 404 when disabled
    try {
        $photoHeaders = @{ 
            "x-org-id" = "00000000-0000-4000-8000-000000000001"
            "Content-Type" = "application/json"
        }
        $photoBody = @{
            fileName = "test.jpg"
            fileSize = 1024
            mimeType = "image/jpeg"
        } | ConvertTo-Json
        
        Invoke-RestMethod -Uri "http://localhost:3000/api/files/presign-photo" -Method POST -Headers $photoHeaders -Body $photoBody
        throw "Photo endpoint should return 404 when feature flag is disabled"
    } catch {
        if ($_.Exception.Response.StatusCode -eq 404) {
            Write-Success "Photo endpoint correctly returns 404 when feature disabled"
        } else {
            throw "Unexpected error from photo endpoint: $($_.Exception.Message)"
        }
    }
    
    Write-Success "Feature flag integration working correctly"
    
    Write-Success "SUPABASE MIGRATION SELF-CHECK PASSED"
    Write-Info "All components working correctly against Supabase:"
    Write-Info "✓ Database connection and schema"
    Write-Info "✓ Migrations and seeding" 
    Write-Info "✓ RLS policies"
    Write-Info "✓ API integration"
    Write-Info "✓ CEO validation requirements"
    Write-Info "✓ Feature flag system"
    Write-Info "Self-check completed at $(Get-Date)"
    
} catch {
    Write-Error "SUPABASE MIGRATION SELF-CHECK FAILED: $($_.Exception.Message)"
    exit 1
} finally {
    # Cleanup: stop API process
    try {
        if ($apiProcess -and -not $apiProcess.HasExited) {
            $apiProcess.Kill()
            $apiProcess.WaitForExit(5000)
            Write-Info "API process stopped"
        }
    } catch {
        Write-Info "API process cleanup completed"
    }
    
    # Reset environment
    try {
        $env:TENANT_PHOTO_FLOW_ENABLED = "false"
        Write-Info "Environment reset to default"
    } catch {
        Write-Warning "Failed to reset environment variables"
    }
}

Write-Info "Supabase migration self-check completed at $(Get-Date)"