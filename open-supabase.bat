@echo off
REM Quick access to Supabase dashboard

echo ========================================
echo   Opening Supabase Dashboard
echo ========================================
echo.

REM Check if .env.local exists and has a real URL
if exist ".env.local" (
    findstr /C:"https://" .env.local >nul
    if %ERRORLEVEL% EQU 0 (
        echo [INFO] Opening your Supabase project...
        echo.
        
        REM Extract the Supabase URL from .env.local
        for /f "tokens=2 delims==" %%a in ('findstr "NEXT_PUBLIC_SUPABASE_URL" .env.local') do set SUPABASE_URL=%%a
        
        REM Remove any quotes or spaces
        set SUPABASE_URL=%SUPABASE_URL:"=%
        set SUPABASE_URL=%SUPABASE_URL: =%
        
        echo Opening: %SUPABASE_URL%
        echo.
        echo What would you like to open?
        echo.
        echo 1. Dashboard (Overview)
        echo 2. Table Editor
        echo 3. SQL Editor
        echo 4. API Settings
        echo 5. All of the above
        echo.
        set /p choice="Enter your choice (1-5): "
        
        if "%choice%"=="1" (
            start %SUPABASE_URL%
        ) else if "%choice%"=="2" (
            start %SUPABASE_URL%/editor
        ) else if "%choice%"=="3" (
            start %SUPABASE_URL%/sql
        ) else if "%choice%"=="4" (
            start %SUPABASE_URL%/settings/api
        ) else if "%choice%"=="5" (
            echo Opening all tabs...
            start %SUPABASE_URL%
            timeout /t 1 /nobreak >nul
            start %SUPABASE_URL%/editor
            timeout /t 1 /nobreak >nul
            start %SUPABASE_URL%/sql
            timeout /t 1 /nobreak >nul
            start %SUPABASE_URL%/settings/api
        ) else (
            echo Invalid choice. Opening dashboard...
            start %SUPABASE_URL%
        )
    ) else (
        echo [WARNING] Supabase not configured yet.
        echo.
        echo Opening Supabase homepage...
        echo Run setup-supabase.bat to configure.
        start https://supabase.com/dashboard
    )
) else (
    echo [WARNING] .env.local not found.
    echo.
    echo Opening Supabase homepage...
    echo Run setup-supabase.bat to configure.
    start https://supabase.com/dashboard
)

echo.
echo Done!
timeout /t 2 /nobreak >nul

