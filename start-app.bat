@echo off
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0"

echo Spoustim aplikaci na portu 3001...
echo.

npm start

pause
