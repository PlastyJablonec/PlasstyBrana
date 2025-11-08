@echo off
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0"

echo Spoustim debug test...
echo.

node debug-login.js

pause
