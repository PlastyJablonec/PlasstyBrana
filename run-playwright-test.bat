@echo off
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0"

echo Spoustim Playwright test aplikace...
echo.

node test-app-with-playwright.js

pause
