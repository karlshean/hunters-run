#!/usr/bin/env pwsh
# Self-check script for photo feature flag functionality
# Tests API behavior with flag on/off and validates consistent gating

$ErrorActionPreference = "Stop"

# Color output functions
function Write-Success($msg) { Write-Host "[OK]  $msg" -ForegroundColor Green }
function Write-Error($msg) { Write-Host "[ERR] $msg" -ForegroundColor Red }
function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Step($msg) { Write-Host "[STEP] $msg" -ForegroundColor Blue }

$api = "http://localhost:3000"
$org = "00000000-0000-4000-8000-000000000001"
$headers = @{ "x-org-id" = $org; "Content-Type" = "application/json" }

function Wait-ForApiHealth {
    param([int]$MaxRetries = 30, [int]$DelaySeconds = 2)
    
    for ($i = 1; $i -le $MaxRetries; $i++) {
        try {
            $response = Invoke-RestMethod -Uri "$api/api/health" -Method GET -TimeoutSec 5
            if ($response.ok) {
                Write-Success "API health check passed (attempt $i)"
                return $true
            }
        } catch {
            Write-Info "Waiting for API health... (attempt $i/$MaxRetries)"
        }
        
        if ($i -lt $MaxRetries) {
            Start-Sleep -Seconds $DelaySeconds
        }
    }
    
    Write-Error "API failed to become healthy after $MaxRetries attempts"
    return $false
}

function Test-ApiEndpoint {
    param([string]$Method, [string]$Endpoint, [object]$Body = $null, [int]$ExpectedStatus)
    
    try {
        $requestParams = @{
            Uri = "$api$Endpoint"
            Method = $Method
            Headers = $headers
            TimeoutSec = 10
        }
        
        if ($Body) {
            $requestParams.Body = ($Body | ConvertTo-Json -Depth 10)
        }
        
        $response = Invoke-WebRequest @requestParams
        
        if ($response.StatusCode -eq $ExpectedStatus) {
            Write-Success "$Method $Endpoint returned $($response.StatusCode) (expected $ExpectedStatus)"
            return $true, $response.Content
        } else {
            Write-Error "$Method $Endpoint returned $($response.StatusCode) (expected $ExpectedStatus)"
            return $false, $null
        }
    } catch {
        $actualStatus = $_.Exception.Response.StatusCode.Value__
        if ($actualStatus -eq $ExpectedStatus) {
            Write-Success "$Method $Endpoint returned $actualStatus (expected $ExpectedStatus)"
            return $true, $_.Exception.Response
        } else {
            Write-Error "$Method $Endpoint returned $actualStatus (expected $ExpectedStatus)"
            return $false, $null
        }
    }
}

function Restart-ApiWithFlag {
    param([string]$FlagValue)
    
    Write-Step "Restarting API with TENANT_PHOTO_FLOW_ENABLED=$FlagValue..."
    
    # Kill existing API process
    try {
        Get-Process -Name "node" | Where-Object { $_.ProcessName -eq "node" } | Stop-Process -Force
        Start-Sleep -Seconds 2
    } catch {
        Write-Info "No existing node processes to kill"
    }
    
    # Set environment variable and start API
    $env:TENANT_PHOTO_FLOW_ENABLED = $FlagValue
    $env:NODE_ENV = "development"
    $env:DATABASE_URL = "postgres://postgres:postgres@localhost:5432/unified"
    $env:REDIS_URL = "redis://localhost:6379"
    $env:PORT = "3000"
    
    # Start API in background
    Start-Process -FilePath "npm" -ArgumentList "run", "dev:hr" -WorkingDirectory "." -WindowStyle Hidden
    
    # Wait for API to be healthy
    Start-Sleep -Seconds 5
    if (-not (Wait-ForApiHealth -MaxRetries 15 -DelaySeconds 3)) {
        throw "API failed to start with flag=$FlagValue"
    }
}

Write-Info "Starting photo feature flag self-check at $(Get-Date)"

try {
    # Phase 1: Test with flag OFF (disabled)
    Write-Step "Phase 1: Testing with TENANT_PHOTO_FLOW_ENABLED=false"
    Restart-ApiWithFlag "false"
    
    # Test /api/flags endpoint
    Write-Step "Testing /api/flags endpoint (flag off)..."
    $success, $flagsResponse = Test-ApiEndpoint "GET" "/api/flags" $null 200
    if (-not $success) { throw "Flags endpoint failed" }
    
    $flagsData = $flagsResponse | ConvertFrom-Json
    if (-not $flagsData.photoFlowEnabled -eq $false) {
        throw "Flags endpoint returned photoFlowEnabled=$($flagsData.photoFlowEnabled), expected false"
    }
    Write-Success "Flags endpoint correctly returned photoFlowEnabled=false"
    
    # Test photo presign endpoint (should return 404)
    Write-Step "Testing photo presign endpoint (flag off)..."
    $presignBody = @{
        fileName = "test.jpg"
        fileSize = 1024
        mimeType = "image/jpeg"
    }
    $success, $_ = Test-ApiEndpoint "POST" "/api/files/presign-photo" $presignBody 404
    if (-not $success) { throw "Presign endpoint should return 404 when flag is off" }
    
    # Test work order creation with photoMetadata (should return 400)
    Write-Step "Testing work order creation with photoMetadata (flag off)..."
    $workOrderBody = @{
        title = "Test Work Order"
        description = "Test description"
        unitId = "00000000-0000-4000-8000-000000000003"
        tenantId = "00000000-0000-4000-8000-000000000004"
        priority = "normal"
        photoMetadata = @{
            s3Key = "test-key.jpg"
            sizeBytes = 1024
            mimeType = "image/jpeg"
        }
    }
    $success, $_ = Test-ApiEndpoint "POST" "/api/maintenance/work-orders" $workOrderBody 400
    if (-not $success) { throw "Work order creation should return 400 when photoMetadata provided with flag off" }
    
    # Test work order creation without photoMetadata (should succeed)
    Write-Step "Testing work order creation without photoMetadata (flag off)..."
    $cleanWorkOrderBody = @{
        title = "Test Work Order"
        description = "Test description"
        unitId = "00000000-0000-4000-8000-000000000003"
        tenantId = "00000000-0000-4000-8000-000000000004"
        priority = "normal"
    }
    $success, $_ = Test-ApiEndpoint "POST" "/api/maintenance/work-orders" $cleanWorkOrderBody 200
    if (-not $success) { throw "Work order creation should succeed without photoMetadata when flag is off" }
    
    Write-Success "Phase 1 completed: Flag OFF behavior verified"
    
    # Phase 2: Test with flag ON (enabled)
    Write-Step "Phase 2: Testing with TENANT_PHOTO_FLOW_ENABLED=true"
    Restart-ApiWithFlag "true"
    
    # Test /api/flags endpoint
    Write-Step "Testing /api/flags endpoint (flag on)..."
    $success, $flagsResponse = Test-ApiEndpoint "GET" "/api/flags" $null 200
    if (-not $success) { throw "Flags endpoint failed" }
    
    $flagsData = $flagsResponse | ConvertFrom-Json
    if (-not $flagsData.photoFlowEnabled -eq $true) {
        throw "Flags endpoint returned photoFlowEnabled=$($flagsData.photoFlowEnabled), expected true"
    }
    Write-Success "Flags endpoint correctly returned photoFlowEnabled=true"
    
    # Test photo presign endpoint (should return 200)
    Write-Step "Testing photo presign endpoint (flag on)..."
    $success, $presignResponse = Test-ApiEndpoint "POST" "/api/files/presign-photo" $presignBody 200
    if (-not $success) { throw "Presign endpoint should return 200 when flag is on" }
    
    $presignData = $presignResponse | ConvertFrom-Json
    if (-not $presignData.s3Key) {
        throw "Presign response missing s3Key"
    }
    Write-Success "Presign endpoint returned valid response with s3Key"
    
    # Test work order creation with photoMetadata (should succeed)
    Write-Step "Testing work order creation with photoMetadata (flag on)..."
    $success, $_ = Test-ApiEndpoint "POST" "/api/maintenance/work-orders" $workOrderBody 200
    if (-not $success) { throw "Work order creation should succeed with photoMetadata when flag is on" }
    
    Write-Success "Phase 2 completed: Flag ON behavior verified"
    
    Write-Success "PHOTO FEATURE FLAG SELF-CHECK PASSED"
    Write-Info "All endpoints behaved correctly with flag on/off"
    Write-Info "Self-check completed at $(Get-Date)"
    
} catch {
    Write-Error "PHOTO FEATURE FLAG SELF-CHECK FAILED: $($_.Exception.Message)"
    exit 1
} finally {
    # Cleanup: restore default environment
    try {
        $env:TENANT_PHOTO_FLOW_ENABLED = "false"
        Write-Info "Environment reset to default (flag=false)"
    } catch {
        Write-Warning "Failed to reset environment"
    }
}

Write-Info "Photo feature flag self-check completed at $(Get-Date)"