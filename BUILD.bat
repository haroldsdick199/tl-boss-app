@echo off
title TL Design Team — Build Installer
echo.
echo  =============================================
echo   TL Design Team — Building Windows Installer
echo  =============================================
echo.

:: Check Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Node.js is not installed.
    echo  Please download it from https://nodejs.org and run this again.
    pause
    exit /b 1
)

echo  [1/3] Cleaning old files...
if exist node_modules (
    rmdir /s /q node_modules
)

echo  [2/3] Installing dependencies...
call npm install
if errorlevel 1 (
    echo.
    echo  ERROR: npm install failed. Check your internet connection.
    pause
    exit /b 1
)

echo.
echo  [3/3] Building Windows installer...
call npx electron-builder --win --x64
if errorlevel 1 (
    echo.
    echo  ERROR: Build failed. See output above.
    pause
    exit /b 1
)

echo.
echo  Done!
echo.
echo  Your installer is in the "dist" folder.
echo  Run "TL Design Team Setup 1.0.0.exe" to install the app.
echo  After installing you can pin it to your taskbar.
echo.
explorer dist
pause
