@echo off
echo Instalace závislostí pro Gate Control projekt...
echo.

echo 1. Kontrola Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo CHYBA: Node.js není nainstalovaný!
    echo Prosím stáhněte a nainstalujte Node.js z: https://nodejs.org/
    echo Doporučuji verzi LTS (Long Term Support)
    pause
    exit /b 1
)

echo ✅ Node.js je nainstalovaný
node --version
echo.

echo 2. Instalace npm balíčků...
npm install
if %errorlevel% neq 0 (
    echo CHYBA: Instalace balíčků selhala!
    pause
    exit /b 1
)

echo ✅ Balíčky úspěšně nainstalovány
echo.

echo 3. Kontrola instalace...
echo.
echo Nainstalované balíčky:
npm list --depth=0
echo.

echo 4. Možné příkazy pro vývoj:
echo    npm start       - Spuštění vývojového serveru
echo    npm run build   - Build produkční verze
echo    npm test        - Spuštění testů
echo    npm run lint    - Kontrola TypeScript chyb
echo.

echo ✅ Instalace dokončena!
echo Projekt je připraven k testování.
pause
