@echo off
REM ESMS - Troubleshooting Tool
REM Diagnoses common issues

color 0E
echo ========================================
echo   ESMS - Troubleshooting Tool
echo ========================================
echo.

echo Running diagnostics...
echo.

REM Check 1: Node.js
echo [1/6] Checking Node.js installation...
where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo   ✅ Node.js is installed
    node --version
) else (
    echo   ❌ Node.js NOT found!
    echo   → Download from https://nodejs.org/
)
echo.

REM Check 2: node_modules
echo [2/6] Checking dependencies...
if exist "node_modules\" (
    echo   ✅ node_modules folder exists
) else (
    echo   ❌ Dependencies NOT installed!
    echo   → Run: npm install
)
echo.

REM Check 3: .env.local
echo [3/6] Checking environment configuration...
if exist ".env.local" (
    echo   ✅ .env.local file exists
    
    REM Check if it has real values
    findstr /C:"https://" .env.local >nul
    if %ERRORLEVEL% EQU 0 (
        echo   ✅ Supabase URL configured
    ) else (
        echo   ❌ Supabase URL not configured!
        echo   → Update .env.local with real Supabase credentials
    )
    
    findstr /C:"eyJ" .env.local >nul
    if %ERRORLEVEL% EQU 0 (
        echo   ✅ API keys configured
    ) else (
        echo   ❌ API keys not configured!
        echo   → Update .env.local with real API keys
    )
) else (
    echo   ❌ .env.local file NOT found!
    echo   → Create .env.local file with Supabase credentials
)
echo.

REM Check 4: Package.json
echo [4/6] Checking project configuration...
if exist "package.json" (
    echo   ✅ package.json exists
) else (
    echo   ❌ package.json NOT found!
    echo   → You may be in the wrong directory
)
echo.

REM Check 5: Next.js cache
echo [5/6] Checking Next.js cache...
if exist ".next\" (
    echo   ⚠️  .next folder exists (cache present)
    echo   → If you have errors, run: clear-cache.bat
) else (
    echo   ✅ No cache (clean state)
)
echo.

REM Check 6: Port availability
echo [6/6] Checking port 3000...
netstat -ano | findstr ":3000" >nul
if %ERRORLEVEL% EQU 0 (
    echo   ⚠️  Port 3000 is in use
    echo   → Stop other apps using port 3000
    echo   → Or change port in package.json
) else (
    echo   ✅ Port 3000 is available
)
echo.

echo ========================================
echo   Diagnostics Complete
echo ========================================
echo.

REM Summary
echo SUMMARY:
echo.
echo Common fixes:
echo   1. Missing Supabase config → Run: setup-supabase.bat
echo   2. Cache errors → Run: clear-cache.bat
echo   3. Dependencies missing → Run: npm install
echo   4. Port in use → Close other apps or change port
echo.
echo For detailed help, see:
echo   - COMPLETE_SETUP_GUIDE.md
echo   - VISUAL_SETUP_GUIDE.md
echo.
pause

