@echo off
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0"

echo Spoustim Playwright login test...
echo.

node test-login-with-playwright.js

pause
