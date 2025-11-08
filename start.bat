@echo off
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0"
echo Spouštím Gate Control aplikaci...
echo.
echo Aplikace bude dostupná na: http://localhost:3000
echo Pro zastavení stiskněte Ctrl+C
echo.
npm start
