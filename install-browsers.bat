@echo off
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0"

echo Instaluji Playwright browsery...
echo.

npx playwright install

echo.
echo Browsery nainstalovany!
pause
