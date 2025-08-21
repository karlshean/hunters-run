param([string]$BaseUrl = "http://localhost:3000")
$ErrorActionPreference = "Stop"

Write-Host "Work Orders API Selfcheck" -ForegroundColor Cyan

$headers = @{
    'Content-Type' = 'application/json'
    'x-org-id' = '00000000-0000-4000-8000-000000000001'
}

try {
    # Test 1: GET /api/lookups/units
    Write-Host "Testing units lookup..." -ForegroundColor Yellow
    $unitsRes = Invoke-RestMethod -Uri "$BaseUrl/api/lookups/units" -Method GET -Headers @{'x-org-id' = '00000000-0000-4000-8000-000000000001'} -TimeoutSec 10
    
    if (-not $unitsRes -or $unitsRes.Count -eq 0) {
        throw "Units lookup returned no units"
    }
    
    $firstUnit = $unitsRes[0]
    if (-not $firstUnit.id -or -not $firstUnit.unitNumber) {
        throw "Unit missing required fields (id, unitNumber)"
    }
    
    Write-Host "SUCCESS: Units lookup returned $($unitsRes.Count) units" -ForegroundColor Green

    # Test 2: POST /api/maintenance/work-orders
    Write-Host "Testing work order creation..." -ForegroundColor Yellow
    $workOrderPayload = @{
        unitId = $firstUnit.id
        description = "Test work order from selfcheck script"
    } | ConvertTo-Json

    $workOrderRes = Invoke-RestMethod -Uri "$BaseUrl/api/maintenance/work-orders" -Method POST -Headers $headers -Body $workOrderPayload -TimeoutSec 10

    # Validate response structure
    $requiredFields = @("id", "ticketId", "unitId", "status", "createdAt")
    foreach ($field in $requiredFields) {
        if (-not $workOrderRes.$field) {
            throw "Work order response missing required field: $field"
        }
    }

    # Validate ticketId format (WO-YYYY-####)
    if ($workOrderRes.ticketId -notmatch "^WO-\d{4}-\d{4}$") {
        throw "Invalid ticketId format: $($workOrderRes.ticketId). Expected WO-YYYY-####"
    }

    # Validate status is 'open'
    if ($workOrderRes.status -ne "open") {
        throw "Expected status 'open', got '$($workOrderRes.status)'"
    }

    # Validate unitId matches
    if ($workOrderRes.unitId -ne $firstUnit.id) {
        throw "UnitId mismatch. Expected $($firstUnit.id), got $($workOrderRes.unitId)"
    }

    Write-Host "SUCCESS: Work order created" -ForegroundColor Green
    Write-Host "   ID: $($workOrderRes.id)" -ForegroundColor White
    Write-Host "   Ticket: $($workOrderRes.ticketId)" -ForegroundColor White
    Write-Host "   Unit: $($workOrderRes.unitId)" -ForegroundColor White
    Write-Host "   Status: $($workOrderRes.status)" -ForegroundColor White

    Write-Host "SUCCESS: All work orders API tests passed!" -ForegroundColor Green
    exit 0

} catch {
    Write-Host "ERROR: Work orders API test failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}