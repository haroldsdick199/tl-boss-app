@echo off
cd /d "%~dp0"
title Tirso Lighting App - Build
echo.
echo  ============================================
echo   Tirso Lighting App - Building Windows Installer
echo  ============================================
echo.

:: Check Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Node.js is not installed.
    echo  Please download it from https://nodejs.org
    goto :end
)

echo  [0/3] Closing any running app instances...
taskkill /f /im "Tirso Lighting App.exe" /t >nul 2>&1
taskkill /f /im "TL Design Team.exe" /t >nul 2>&1
timeout /t 2 /nobreak >nul

echo  [1/3] Moving old dist out of the way...
if exist _dist_old ( rd /s /q _dist_old >nul 2>&1 )
if exist dist (
    ren dist _dist_old >nul 2>&1
    if exist dist (
        echo  ERROR: Could not move dist folder.
        goto :end
    )
)

echo  [2/3] Installing dependencies...
call npm install
if errorlevel 1 (
    echo.
    echo  ERROR: npm install failed.
    goto :end
)

echo.
echo  [3/3] Building Windows installer...
call npx electron-builder --win --x64
if errorlevel 1 (
    echo.
    echo  ERROR: Build failed. See output above.
    goto :end
)

:: Clean up the old renamed folder in the background
if exist _dist_old ( rd /s /q _dist_old >nul 2>&1 )

echo.
echo  ============================================
echo   SUCCESS! Installer is in the dist folder.
echo   Run: Tirso Lighting App Setup 1.0.0.exe
echo  ============================================
echo.
explorer dist

:end
echo.
pause
