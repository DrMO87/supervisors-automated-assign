@echo off
REM Faculty Exam Supervision & Proctoring System (ESMS)
REM Production Server Start Script for Windows

echo ========================================
echo   ESMS - Production Server
echo ========================================
echo.

REM Check if .next folder exists (build output)
if not exist ".next\" (
    echo [ERROR] Production build not found!
    echo.
    echo Please build the application first:
    echo   1. Run build-app.bat
    echo   OR
    echo   2. Run: npm run build
    echo.
    pause
    exit /b 1
)

REM Check if .env.local exists
if not exist ".env.local" (
    echo [WARNING] .env.local file not found!
    echo.
    echo Please create .env.local with your Supabase credentials.
    echo See QUICK_START.md for setup instructions.
    echo.
    pause
    exit /b 1
)

echo [INFO] Starting production server...
echo [INFO] The app will be available at http://localhost:3010
echo [INFO] Opening browser automatically...
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

REM Open browser after a short delay
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3010"

REM Start the production server
npm run start -- -p 3010

