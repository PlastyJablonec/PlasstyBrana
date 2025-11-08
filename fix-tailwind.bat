@echo off
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0"
echo Opravuji TailwindCSS...

echo 1. Odinstaluji nekompatibilni verze...
npm uninstall tailwindcss @tailwindcss/postcss

echo 2. Instaluji kompatibilni verzi TailwindCSS v3...
npm install tailwindcss@3.4.0 @tailwindcss/forms@0.5.7 @tailwindcss/typography@0.5.10

echo 3. Opravuji PostCSS konfiguraci...

echo 4. Hotovo!
pause
