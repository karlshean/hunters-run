#!/usr/bin/env pwsh
# Supabase One-Click Setup Script
# Prompts for Supabase URL if not set, then runs complete end-to-end setup

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
$logFile = "$logDir/supabase-oneclick.log"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# Start transcript
Start-Transcript -Path $logFile -Append

Write-Info "Supabase One-Click Setup Started at $timestamp"
Write-Info "Logging to: $logFile"

$apiProcess = $null

try {
    # Step 1: Get or validate DATABASE_URL
    Write-Step "Step 1/7: Database URL Configuration"
    
    $databaseUrl = $env:DATABASE_URL
    
    if (-not $databaseUrl) {
        Write-Info "DATABASE_URL environment variable not set"
        Write-Host ""
        Write-Host "Please paste your Supabase connection string:" -ForegroundColor Yellow
        Write-Host "Format: postgres://postgres:[password]@db.[project-ref].supabase.co:5432/postgres?sslmode=require" -ForegroundColor Gray
        Write-Host ""
        $databaseUrl = Read-Host "Connection String"
        
        if (-not $databaseUrl) {
            throw "No connection string provided"
        }
    }
    
    # Validate Supabase URL format
    if (-not $databaseUrl.Contains("supabase.co")) {
        throw "Connection string must contain 'supabase.co' (expected Supabase URL)"
    }
    
    if (-not $databaseUrl.Contains("sslmode=require")) {
        throw "Connection string must contain 'sslmode=require' for secure Supabase connection"
    }
    
    Write-Success "Valid Supabase connection string detected"
    
    # Step 2: Update .env file
    Write-Step "Step 2/7: Updating .env Configuration"
    
    $envFile = ".env"
    $envLines = @()
    $databaseUrlFound = $false
    
    # Read existing .env if it exists
    if (Test-Path $envFile) {
        $envLines = Get-Content $envFile
        for ($i = 0; $i -lt $envLines.Count; $i++) {
            if ($envLines[$i] -match "^DATABASE_URL=") {
                $envLines[$i] = "DATABASE_URL=$databaseUrl"
                $databaseUrlFound = $true
                break
            }
        }
    }
    
    # Add DATABASE_URL if not found
    if (-not $databaseUrlFound) {
        $envLines += "DATABASE_URL=$databaseUrl"
    }
    
    # Write updated .env file
    $envLines | Out-File -FilePath $envFile -Encoding utf8
    $env:DATABASE_URL = $databaseUrl
    
    Write-Success ".env file updated with Supabase connection"
    
    # Step 3: Install dependencies
    Write-Step "Step 3/7: Installing Dependencies"
    
    $npmInstallResult = npm install 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "npm install failed: $npmInstallResult"
    }
    
    Write-Success "Dependencies installed successfully"
    
    # Step 4: Run migrations
    Write-Step "Step 4/7: Running Database Migrations"
    
    $migrateResult = npm run migrate:supabase 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Database migration failed: $migrateResult"
    }
    
    Write-Success "Database migrations completed"
    
    # Step 5: Seed demo data
    Write-Step "Step 5/7: Seeding Demo Data"
    
    $seedResult = npm run seed:supabase 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Database seeding failed: $seedResult"
    }
    
    Write-Success "Demo data seeded successfully"
    
    # Step 6: Start development servers
    Write-Step "Step 6/7: Starting API and Web Servers"
    
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
    
    # Step 7: Run CEO validation
    Write-Step "Step 7/7: Running CEO Validation"
    
    Write-Info "Running comprehensive CEO validation..."
    $ceoResult = npm run ceo:validate 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "CEO validation failed: $ceoResult"
    }
    
    Write-Success "CEO validation passed"
    
    # All steps completed successfully
    Write-BigSuccess "SUPABASE ONE-CLICK SETUP COMPLETE!"
    
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
    Write-Error "Setup failed at step: $($_.Exception.Message)"
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "   1. Check your Supabase connection string format" -ForegroundColor White
    Write-Host "   2. Ensure your Supabase project allows connections" -ForegroundColor White
    Write-Host "   3. Verify you have npm and Node.js installed" -ForegroundColor White
    Write-Host "   4. Check the full log at: $logFile" -ForegroundColor White
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

Write-Info "Supabase One-Click Setup completed at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"