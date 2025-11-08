@echo off
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0"
echo Instaluji TailwindCSS v3...
npm install tailwindcss@3.4.0 @tailwindcss/forms@0.5.7 @tailwindcss/typography@0.5.10
pause
