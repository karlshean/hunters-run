@echo off
setlocal enabledelayedexpansion

REM Staging Server Restart Script (Windows)
REM Simple script to restart the hr-api server in staging mode

set "STAGING_PORT=3000"
if not "%STAGING_PORT%"=="" set "STAGING_PORT=%STAGING_PORT%"

set "PROJECT_ROOT=%~dp0..\..\..\"
set "HR_API_DIR=%PROJECT_ROOT%apps\hr-api"

echo 🔄 Restarting Hunters Run HR API in staging mode...
echo 📁 Project root: %PROJECT_ROOT%
echo 🖥️  HR API dir: %HR_API_DIR%
echo 🔌 Port: %STAGING_PORT%

REM Change to HR API directory
cd /d "%HR_API_DIR%"

REM Check if .env.staging exists
if not exist ".env.staging" (
    echo ❌ Error: .env.staging not found
    echo 💡 Copy .env.staging.example and populate with real staging values
    exit /b 1
)

echo ✅ Found .env.staging configuration

REM Build if needed
if not exist "dist" (
    echo 🔨 Building application...
    call npm run build
    if errorlevel 1 (
        echo ❌ Build failed
        exit /b 1
    )
) else (
    echo 📦 Using existing build (run 'npm run build' to rebuild)
)

REM Kill existing staging processes
echo 🛑 Stopping any existing staging processes...
taskkill /f /im node.exe 2>nul || echo No existing node processes found

REM Wait a moment
timeout /t 2 /nobreak >nul

echo 🚀 Starting staging server...
echo 📊 Health check will be available at: http://localhost:%STAGING_PORT%/api/health

REM Set environment for staging
set "NODE_ENV=staging"
set "PORT=%STAGING_PORT%"

REM Load .env.staging variables (simplified approach)
for /f "usebackq tokens=1,* delims==" %%a in (".env.staging") do (
    if not "%%a"=="" if not "%%a:~0,1%"=="#" (
        set "%%a=%%b"
    )
)

REM Start server with output redirection
echo ✅ Starting server (PID will be shown)...
start /b node dist/main.js > staging.log 2>&1

REM Wait for startup
timeout /t 3 /nobreak >nul

REM Basic health check using curl (if available)
echo 🏥 Performing health check...
curl -f -s "http://localhost:%STAGING_PORT%/api/health" >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Health check passed - staging server is running
    echo.
    echo 🔗 Available endpoints:
    echo    Health: http://localhost:%STAGING_PORT%/api/health
    echo    Properties: http://localhost:%STAGING_PORT%/api/properties
    echo    Work Orders: http://localhost:%STAGING_PORT%/api/work-orders
    echo.
    echo 🛠️  Test with:
    echo    curl -H "Authorization: Bearer dev-token" -H "x-org-id: 00000000-0000-4000-8000-000000000001" http://localhost:%STAGING_PORT%/api/properties
) else (
    echo ❌ Health check failed or curl not available
    echo 📝 Check if server is running manually: http://localhost:%STAGING_PORT%/api/health
    echo 📝 Check logs: type staging.log
)

echo.
echo 💡 Server is running in background. Use Task Manager to stop node.exe processes.
pause