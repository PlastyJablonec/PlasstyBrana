@echo off
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0"

echo Spoustim Real Firebase Authentication test...
echo.

node test-real-firebase.js

pause
