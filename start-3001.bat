@echo off
set PATH=C:\Program Files\nodejs;%PATH%
set PORT=3001
cd /d "%~dp0"
echo Spouštím Gate Control aplikaci na portu 3001...
echo.
echo Aplikace bude dostupná na: http://localhost:3001
echo Pro zastavení stiskněte Ctrl+C
echo.
npm start
