# Performance Test Runner for Hunters Run
# Runs k6 load tests and generates reports

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("smoke", "load", "both")]
    [string]$TestType,
    
    [string]$BaseUrl = "http://localhost:3000",
    [string]$OutputDir = "reports/perf",
    [switch]$SkipSetup,
    [switch]$Quiet
)

function Write-Status {
    param([string]$Message, [string]$Color = "White")
    if (-not $Quiet) {
        Write-Host $Message -ForegroundColor $Color
    }
}

function Test-K6Available {
    try {
        $k6Version = k6 version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Status "k6 found: $k6Version" "Green"
            return $true
        }
    }
    catch {}
    
    Write-Status "ERROR: k6 not found. Please install k6:" "Red"
    Write-Status "  Windows: choco install k6" "Yellow"
    Write-Status "  macOS: brew install k6" "Yellow"
    Write-Status "  Linux: https://k6.io/docs/getting-started/installation/" "Yellow"
    return $false
}

function Test-ServiceHealth {
    param([string]$Url)
    
    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 10 -ErrorAction Stop
        return $response.StatusCode -eq 200
    }
    catch {
        return $false
    }
}

function Wait-ForService {
    param([string]$Url, [int]$TimeoutSeconds = 60)
    
    Write-Status "Waiting for service at $Url..." "Blue"
    $attempts = 0
    $maxAttempts = $TimeoutSeconds / 2
    
    do {
        if (Test-ServiceHealth $Url) {
            Write-Status "Service is ready!" "Green"
            return $true
        }
        Start-Sleep -Seconds 2
        $attempts++
        Write-Status "Attempt $attempts/$maxAttempts..." "Yellow"
    } while ($attempts -lt $maxAttempts)
    
    Write-Status "Service failed to become ready within $TimeoutSeconds seconds" "Red"
    return $false
}

function Run-K6Test {
    param(
        [string]$TestScript,
        [string]$Scenario,
        [string]$OutputFile,
        [string]$TestName
    )
    
    Write-Status "`n=== Running $TestName ($Scenario) ===" "Cyan"
    
    $env:K6_SCENARIO = $Scenario
    $env:BASE_URL = $BaseUrl
    
    $k6Args = @(
        "run"
        "--out", "json=$OutputFile"
        $TestScript
    )
    
    Write-Status "Command: k6 $($k6Args -join ' ')" "Blue"
    
    try {
        & k6 @k6Args
        
        if ($LASTEXITCODE -eq 0) {
            Write-Status "$TestName completed successfully" "Green"
            return $true
        } else {
            Write-Status "$TestName failed with exit code $LASTEXITCODE" "Red"
            return $false
        }
    }
    catch {
        Write-Status "Error running $TestName : $($_.Exception.Message)" "Red"
        return $false
    }
}

function Generate-Report {
    param([string]$OutputDir, [string]$TestType)
    
    $reportFile = Join-Path $OutputDir "summary-$TestType.md"
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    
    $content = @"
# Performance Test Report - $TestType

**Generated:** $timestamp  
**Base URL:** $BaseUrl  
**Test Type:** $TestType  

## Test Results

"@

    if ($TestType -eq "smoke" -or $TestType -eq "both") {
        $content += @"

### Smoke Tests
- **Work Order Reads**: 10 RPS, 30 seconds
- **Work Order Creates**: 5 RPS, 30 seconds

"@
    }

    if ($TestType -eq "load" -or $TestType -eq "both") {
        $content += @"

### Load Tests  
- **Work Order Reads**: 100 RPS, 5 minutes (p95 < 150ms target)
- **Work Order Creates**: 20 RPS, 5 minutes (error rate < 1% target)

"@
    }

    $content += @"

## Files Generated
"@

    Get-ChildItem $OutputDir -Filter "*.json" | ForEach-Object {
        $content += "`n- $($_.Name)"
    }

    $content | Set-Content $reportFile
    Write-Status "Report generated: $reportFile" "Green"
}

# Main execution
Write-Status "=== Hunters Run Performance Test Runner ===" "Cyan"
Write-Status "Test Type: $TestType" "Yellow"
Write-Status "Base URL: $BaseUrl" "Yellow"
Write-Status "Output Directory: $OutputDir" "Yellow"

# Check prerequisites
if (-not (Test-K6Available)) {
    exit 1
}

# Create output directory
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
    Write-Status "Created output directory: $OutputDir" "Blue"
}

# Setup services if not skipped
if (-not $SkipSetup) {
    Write-Status "`nChecking if services need to be started..." "Blue"
    
    if (-not (Test-ServiceHealth "$BaseUrl/api/health")) {
        Write-Status "Services not running. Starting stack..." "Yellow"
        
        try {
            docker-compose up -d
            
            if (-not (Wait-ForService "$BaseUrl/api/health")) {
                Write-Status "Failed to start services. Exiting." "Red"
                exit 1
            }
        }
        catch {
            Write-Status "Error starting services: $($_.Exception.Message)" "Red"
            exit 1
        }
    } else {
        Write-Status "Services already running" "Green"
    }
}

# Run tests based on type
$success = $true

if ($TestType -eq "smoke" -or $TestType -eq "both") {
    Write-Status "`n=== Running Smoke Tests ===" "Cyan"
    
    $readsSuccess = Run-K6Test "tests/load/work-order-reads.js" "smoke" "$OutputDir/reads-smoke.json" "Work Order Reads (Smoke)"
    $createsSuccess = Run-K6Test "tests/load/work-order-creates.js" "smoke" "$OutputDir/creates-smoke.json" "Work Order Creates (Smoke)"
    
    $success = $success -and $readsSuccess -and $createsSuccess
}

if ($TestType -eq "load" -or $TestType -eq "both") {
    Write-Status "`n=== Running Load Tests ===" "Cyan"
    
    $readsSuccess = Run-K6Test "tests/load/work-order-reads.js" "load" "$OutputDir/reads-load.json" "Work Order Reads (Load)"
    $createsSuccess = Run-K6Test "tests/load/work-order-creates.js" "load" "$OutputDir/creates-load.json" "Work Order Creates (Load)"
    
    $success = $success -and $readsSuccess -and $createsSuccess
}

# Generate report
Generate-Report $OutputDir $TestType

# Summary
if ($success) {
    Write-Status "`n=== All Tests Completed Successfully ===" "Green"
    Write-Status "Reports saved to: $OutputDir" "Green"
    exit 0
} else {
    Write-Status "`n=== Some Tests Failed ===" "Red"
    Write-Status "Check reports in: $OutputDir" "Yellow"
    exit 1
}