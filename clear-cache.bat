@echo off
REM ESMS - Clear Next.js Cache
REM Fixes build errors and cache issues

echo ========================================
echo   ESMS - Clear Cache
echo ========================================
echo.

echo [INFO] Clearing Next.js cache...
echo.

REM Remove .next folder
if exist ".next\" (
    echo [INFO] Removing .next folder...
    rmdir /s /q ".next"
    echo [SUCCESS] .next folder removed
) else (
    echo [INFO] .next folder not found (already clean)
)

echo.

REM Remove node_modules/.cache if exists
if exist "node_modules\.cache\" (
    echo [INFO] Removing node_modules cache...
    rmdir /s /q "node_modules\.cache"
    echo [SUCCESS] node_modules cache removed
) else (
    echo [INFO] node_modules cache not found
)

echo.

REM Remove tsconfig.tsbuildinfo if exists
if exist "tsconfig.tsbuildinfo" (
    echo [INFO] Removing TypeScript build info...
    del /q "tsconfig.tsbuildinfo"
    echo [SUCCESS] TypeScript build info removed
) else (
    echo [INFO] TypeScript build info not found
)

echo.
echo ========================================
echo [SUCCESS] Cache cleared successfully!
echo ========================================
echo.
echo You can now run start-app.bat
echo.
pause

