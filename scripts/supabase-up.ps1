#!/usr/bin/env pwsh
# Supabase Up Script (No-Prompt Variant)
# Uses existing $env:DATABASE_URL to run migrate → seed → dev → health check → ceo:validate

$ErrorActionPreference = "Stop"

# Color output functions
function Write-Success($msg) { Write-Host "SUCCESS: $msg" -ForegroundColor Green }
function Write-Error($msg) { Write-Host "ERROR: $msg" -ForegroundColor Red }
function Write-Info($msg) { Write-Host "INFO: $msg" -ForegroundColor Cyan }
function Write-Step($msg) { Write-Host "STEP: $msg" -ForegroundColor Yellow }
function Write-BigSuccess($msg) { 
    Write-Host ""
    Write-Host "SUCCESS: $msg" -ForegroundColor Green -BackgroundColor Black
    Write-Host ""
}

# Setup logging
$logDir = "reports"
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}
$logFile = "$logDir/supabase-up.log"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# Start transcript
Start-Transcript -Path $logFile -Append

Write-Info "Supabase Up Started at $timestamp"
Write-Info "Logging to: $logFile"

$apiProcess = $null

try {
    # Step 1: Validate DATABASE_URL
    Write-Step "Step 1/5: Validating Database Configuration"
    
    if (-not $env:DATABASE_URL) {
        throw "DATABASE_URL environment variable is not set. Please set it to your Supabase connection string or use 'npm run supabase:oneclick' for guided setup."
    }
    
    # Validate Supabase URL format
    if (-not $env:DATABASE_URL.Contains("supabase.co")) {
        throw "DATABASE_URL must contain 'supabase.co' (expected Supabase URL)"
    }
    
    if (-not $env:DATABASE_URL.Contains("sslmode=require")) {
        throw "DATABASE_URL must contain 'sslmode=require' for secure Supabase connection"
    }
    
    # Mask password in logs
    $maskedUrl = $env:DATABASE_URL -replace '(postgres://[^:]+:)[^@]+(@)', '$1***$2'
    Write-Success "Valid Supabase connection string: $maskedUrl"
    
    # Step 2: Run migrations
    Write-Step "Step 2/5: Running Database Migrations"
    
    $migrateResult = npm run migrate:supabase 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Database migration failed: $migrateResult"
    }
    
    Write-Success "Database migrations completed"
    
    # Step 3: Seed demo data
    Write-Step "Step 3/5: Seeding Demo Data"
    
    $seedResult = npm run seed:supabase 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Database seeding failed: $seedResult"
    }
    
    Write-Success "Demo data seeded successfully"
    
    # Step 4: Start development servers and health check
    Write-Step "Step 4/5: Starting Servers and Health Check"
    
    Write-Info "Starting development servers..."
    $apiProcess = Start-Process -FilePath "npm" -ArgumentList "run", "dev:supabase" -PassThru -WindowStyle Hidden
    
    # Wait for API health check
    $maxRetries = 30
    $retryDelay = 2
    $healthUrl = "http://localhost:3000/api/health"
    $apiReady = $false
    
    Write-Info "Waiting for API to be ready at $healthUrl..."
    
    for ($i = 1; $i -le $maxRetries; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $healthUrl -TimeoutSec 5 -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                $apiReady = $true
                Write-Success "API server is ready (attempt $i)"
                break
            }
        } catch {
            Write-Info "Waiting for API... (attempt $i/$maxRetries)"
        }
        
        if ($i -lt $maxRetries) {
            Start-Sleep -Seconds $retryDelay
        }
    }
    
    if (-not $apiReady) {
        throw "API failed to become healthy after $($maxRetries * $retryDelay) seconds"
    }
    
    # Step 5: Run CEO validation
    Write-Step "Step 5/5: Running CEO Validation"
    
    Write-Info "Running comprehensive CEO validation..."
    $ceoResult = npm run ceo:validate 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "CEO validation failed: $ceoResult"
    }
    
    Write-Success "CEO validation passed"
    
    # All steps completed successfully
    Write-BigSuccess "SUPABASE UP COMPLETE!"
    
    Write-Host ""
    Write-Host "Your Hunters Run application is now running:" -ForegroundColor Green
    Write-Host "   API:     http://localhost:3000/api/health" -ForegroundColor White
    Write-Host "   Web UI:  http://localhost:3001" -ForegroundColor White
    Write-Host ""
    Write-Host "All systems operational:" -ForegroundColor Green
    Write-Host "   • Database migrations applied" -ForegroundColor White
    Write-Host "   • Demo data loaded" -ForegroundColor White
    Write-Host "   • API server running" -ForegroundColor White
    Write-Host "   • Web UI running" -ForegroundColor White
    Write-Host "   • CEO validation passed" -ForegroundColor White
    Write-Host ""
    Write-Host "Full log available at: $logFile" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Ready to go! Your Supabase-powered Hunters Run is live!" -ForegroundColor Green
    
} catch {
    Write-Error "Supabase up failed: $($_.Exception.Message)"
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "   1. Ensure DATABASE_URL is set correctly" -ForegroundColor White
    Write-Host "   2. Check your Supabase project allows connections" -ForegroundColor White
    Write-Host "   3. Verify dependencies are installed (npm install)" -ForegroundColor White
    Write-Host "   4. Check the full log at: $logFile" -ForegroundColor White
    Write-Host ""
    Write-Host "For guided setup, run: npm run supabase:oneclick" -ForegroundColor Yellow
    Write-Host ""
    
    # Clean up: stop API process if it was started
    if ($apiProcess -and -not $apiProcess.HasExited) {
        try {
            $apiProcess.Kill()
            $apiProcess.WaitForExit(5000)
            Write-Info "Stopped development servers"
        } catch {
            Write-Info "Development servers cleanup completed"
        }
    }
    
    exit 1
} finally {
    Stop-Transcript
}

Write-Info "Supabase Up completed at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"