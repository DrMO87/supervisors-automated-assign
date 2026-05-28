@echo off
REM Faculty Exam Supervision & Proctoring System (ESMS)
REM Production Build Script for Windows

echo ========================================
echo   ESMS - Production Build
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
)

echo [INFO] Building production version...
echo.

REM Run the build
call npm run build

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo [SUCCESS] Build completed successfully!
    echo ========================================
    echo.
    echo To start the production server, run:
    echo   npm run start
    echo.
    echo Or use start-production.bat
    echo.
) else (
    echo.
    echo ========================================
    echo [ERROR] Build failed!
    echo ========================================
    echo.
    echo Please check the error messages above.
    echo.
)

pause

