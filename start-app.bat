@echo off
REM Faculty Exam Supervision & Proctoring System (ESMS)
REM Quick Start Script for Windows

echo ========================================
echo   ESMS - Exam Supervision System
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Display Node version
echo [INFO] Node.js version:
node --version
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo [WARNING] Dependencies not installed!
    echo [INFO] Installing dependencies...
    echo.
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install dependencies!
        pause
        exit /b 1
    )
    echo.
    echo [SUCCESS] Dependencies installed!
    echo.
)

REM Check if .env.local exists
if not exist ".env.local" (
    echo [WARNING] .env.local file not found!
    echo.
    echo Please create .env.local with your Supabase credentials:
    echo   NEXT_PUBLIC_SUPABASE_URL=your-project-url
    echo   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
    echo   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
    echo.
    echo See QUICK_START.md for detailed setup instructions.
    echo.
    pause
    exit /b 1
)

echo [INFO] Starting development server...
echo [INFO] The app will be available at http://localhost:3010
echo [INFO] Opening browser automatically...
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

REM Open browser after a short delay
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3010"

REM Start the development server
npm run dev -- -p 3010

