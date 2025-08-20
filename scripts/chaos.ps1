# Chaos Engineering Script for Hunters Run
# Tests system resilience by simulating infrastructure failures

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("redis-restart", "postgres-restart", "all")]
    [string]$Test,
    
    [string]$BaseUrl = "http://localhost:3000",
    [int]$LoadDuration = 60,
    [string]$ComposeProject = "hunters-run"
)

Write-Host "=== Hunters Run Chaos Engineering ===" -ForegroundColor Cyan
Write-Host "Test: $Test" -ForegroundColor Yellow
Write-Host "Base URL: $BaseUrl" -ForegroundColor Yellow
Write-Host "Load Duration: $LoadDuration seconds" -ForegroundColor Yellow
Write-Host ""

# Function to check if service is healthy
function Test-ServiceHealth {
    param(
        [string]$Url,
        [string]$ServiceName
    )
    
    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 5 -ErrorAction Stop
        $status = $response.StatusCode
        Write-Host "[$ServiceName] Health check: HTTP $status" -ForegroundColor Green
        return $status -eq 200
    }
    catch {
        Write-Host "[$ServiceName] Health check failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Function to check API ready endpoint
function Test-ReadyEndpoint {
    try {
        $response = Invoke-WebRequest -Uri "$BaseUrl/api/ready" -Method GET -TimeoutSec 5 -ErrorAction Stop
        $status = $response.StatusCode
        Write-Host "[API] Ready check: HTTP $status" -ForegroundColor Green
        return $status
    }
    catch {
        Write-Host "[API] Ready check failed: $($_.Exception.Message)" -ForegroundColor Red
        return 503
    }
}

# Function to start background load test
function Start-BackgroundLoad {
    param(
        [string]$TestScript,
        [int]$Duration
    )
    
    Write-Host "Starting background load test: $TestScript" -ForegroundColor Blue
    
    # Check if k6 is available
    try {
        $k6Version = k6 version 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "WARNING: k6 not found. Install k6 to run load tests during chaos." -ForegroundColor Yellow
            return $null
        }
    }
    catch {
        Write-Host "WARNING: k6 not found. Install k6 to run load tests during chaos." -ForegroundColor Yellow
        return $null
    }
    
    $env:K6_SCENARIO = "smoke"
    $env:BASE_URL = $BaseUrl
    
    $job = Start-Job -ScriptBlock {
        param($TestScript, $Duration, $BaseUrl)
        
        $env:K6_SCENARIO = "smoke"
        $env:BASE_URL = $BaseUrl
        
        # Run k6 test
        & k6 run --duration "${Duration}s" $TestScript
    } -ArgumentList $TestScript, $Duration, $BaseUrl
    
    Write-Host "Background load test started (Job ID: $($job.Id))" -ForegroundColor Blue
    return $job
}

# Function to stop background job
function Stop-BackgroundLoad {
    param($Job)
    
    if ($Job) {
        Write-Host "Stopping background load test..." -ForegroundColor Blue
        Stop-Job $Job -ErrorAction SilentlyContinue
        Remove-Job $Job -ErrorAction SilentlyContinue
    }
}

# Function to restart Docker service
function Restart-DockerService {
    param(
        [string]$ServiceName,
        [int]$DownDuration = 10
    )
    
    Write-Host "=== Chaos Test: Restarting $ServiceName ===" -ForegroundColor Red
    
    # Stop the service
    Write-Host "Stopping $ServiceName..." -ForegroundColor Yellow
    docker-compose -p $ComposeProject stop $ServiceName
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to stop $ServiceName" -ForegroundColor Red
        return $false
    }
    
    Write-Host "$ServiceName stopped. Waiting $DownDuration seconds..." -ForegroundColor Yellow
    Start-Sleep -Seconds $DownDuration
    
    # Start the service
    Write-Host "Starting $ServiceName..." -ForegroundColor Yellow
    docker-compose -p $ComposeProject start $ServiceName
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to start $ServiceName" -ForegroundColor Red
        return $false
    }
    
    # Wait for service to be healthy
    Write-Host "Waiting for $ServiceName to become healthy..." -ForegroundColor Yellow
    $attempts = 0
    $maxAttempts = 30
    
    do {
        Start-Sleep -Seconds 2
        $attempts++
        
        # Check Docker health
        $health = docker-compose -p $ComposeProject ps $ServiceName --format "{{.Health}}"
        Write-Host "[$ServiceName] Health: $health (attempt $attempts/$maxAttempts)" -ForegroundColor Blue
        
        if ($health -eq "healthy") {
            Write-Host "$ServiceName is healthy!" -ForegroundColor Green
            return $true
        }
    } while ($attempts -lt $maxAttempts)
    
    Write-Host "$ServiceName failed to become healthy within timeout" -ForegroundColor Red
    return $false
}

# Test Redis restart during load
function Test-RedisRestart {
    Write-Host "`n=== Redis Restart Chaos Test ===" -ForegroundColor Cyan
    Write-Host "Objective: System continues processing during Redis restart" -ForegroundColor White
    
    # Start background load
    $loadJob = Start-BackgroundLoad "tests/load/work-order-reads.js" $LoadDuration
    
    # Let load stabilize
    Start-Sleep -Seconds 5
    
    # Test initial health
    Write-Host "`nTesting initial system health..." -ForegroundColor Blue
    Test-ServiceHealth "$BaseUrl/api/health" "API"
    $readyStatus = Test-ReadyEndpoint
    
    # Restart Redis
    Write-Host "`nRestarting Redis during load..." -ForegroundColor Red
    $redisRestarted = Restart-DockerService "redis" 10
    
    if (-not $redisRestarted) {
        Write-Host "Redis restart failed!" -ForegroundColor Red
        Stop-BackgroundLoad $loadJob
        return $false
    }
    
    # Monitor system during recovery
    Write-Host "`nMonitoring system recovery..." -ForegroundColor Blue
    for ($i = 1; $i -le 10; $i++) {
        Start-Sleep -Seconds 3
        Write-Host "Recovery check $i/10:" -ForegroundColor Blue
        Test-ServiceHealth "$BaseUrl/api/health" "API"
        Test-ReadyEndpoint | Out-Null
    }
    
    # Clean up
    Stop-BackgroundLoad $loadJob
    
    Write-Host "`nRedis restart test completed!" -ForegroundColor Green
    return $true
}

# Test Postgres restart during load
function Test-PostgresRestart {
    Write-Host "`n=== Postgres Restart Chaos Test ===" -ForegroundColor Cyan
    Write-Host "Objective: API returns 503 from /ready, 200 from /health during Postgres downtime" -ForegroundColor White
    
    # Start background load
    $loadJob = Start-BackgroundLoad "tests/load/work-order-reads.js" $LoadDuration
    
    # Let load stabilize
    Start-Sleep -Seconds 5
    
    # Test initial health
    Write-Host "`nTesting initial system health..." -ForegroundColor Blue
    Test-ServiceHealth "$BaseUrl/api/health" "API"
    $readyStatus = Test-ReadyEndpoint
    
    # Restart Postgres
    Write-Host "`nRestarting Postgres during load..." -ForegroundColor Red
    
    # Stop Postgres
    Write-Host "Stopping Postgres..." -ForegroundColor Yellow
    docker-compose -p $ComposeProject stop postgres
    
    # Monitor expected behavior during outage
    Write-Host "`nMonitoring expected failure behavior..." -ForegroundColor Blue
    for ($i = 1; $i -le 5; $i++) {
        Start-Sleep -Seconds 2
        Write-Host "Outage check $i/5:" -ForegroundColor Blue
        
        # Health should still return 200
        $healthOk = Test-ServiceHealth "$BaseUrl/api/health" "API"
        
        # Ready should return 503
        $readyStatus = Test-ReadyEndpoint
        if ($readyStatus -eq 503) {
            Write-Host "[API] Ready correctly returns 503 during DB outage" -ForegroundColor Green
        } else {
            Write-Host "[API] Ready returned $readyStatus (expected 503)" -ForegroundColor Yellow
        }
    }
    
    # Restart Postgres
    Write-Host "`nRestarting Postgres..." -ForegroundColor Yellow
    $postgresRestarted = Restart-DockerService "postgres" 0
    
    if (-not $postgresRestarted) {
        Write-Host "Postgres restart failed!" -ForegroundColor Red
        Stop-BackgroundLoad $loadJob
        return $false
    }
    
    # Monitor recovery
    Write-Host "`nMonitoring system recovery..." -ForegroundColor Blue
    for ($i = 1; $i -le 10; $i++) {
        Start-Sleep -Seconds 3
        Write-Host "Recovery check $i/10:" -ForegroundColor Blue
        
        $healthOk = Test-ServiceHealth "$BaseUrl/api/health" "API"
        $readyStatus = Test-ReadyEndpoint
        
        if ($readyStatus -eq 200) {
            Write-Host "[API] System fully recovered!" -ForegroundColor Green
            break
        }
    }
    
    # Clean up
    Stop-BackgroundLoad $loadJob
    
    Write-Host "`nPostgres restart test completed!" -ForegroundColor Green
    return $true
}

# Main execution
try {
    # Ensure Docker Compose is available
    $composeVersion = docker-compose version 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Docker Compose not found. Please install Docker Compose." -ForegroundColor Red
        exit 1
    }
    
    # Check if services are running
    Write-Host "Checking Docker services..." -ForegroundColor Blue
    $runningServices = docker-compose -p $ComposeProject ps --services --filter status=running
    
    if (-not $runningServices.Contains("postgres") -or -not $runningServices.Contains("redis")) {
        Write-Host "WARNING: Required services not running. Starting stack..." -ForegroundColor Yellow
        docker-compose -p $ComposeProject up -d
        Start-Sleep -Seconds 10
    }
    
    # Execute tests based on parameter
    $success = $true
    
    switch ($Test) {
        "redis-restart" {
            $success = Test-RedisRestart
        }
        "postgres-restart" {
            $success = Test-PostgresRestart
        }
        "all" {
            $success = Test-RedisRestart
            if ($success) {
                Start-Sleep -Seconds 5
                $success = Test-PostgresRestart
            }
        }
    }
    
    if ($success) {
        Write-Host "`n=== Chaos Test Completed Successfully ===" -ForegroundColor Green
        exit 0
    } else {
        Write-Host "`n=== Chaos Test Failed ===" -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}