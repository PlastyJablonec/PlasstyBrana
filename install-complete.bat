@echo off
echo Kompletní instalace Gate Control projektu...
echo.

echo 1. Instalace Node.js přes winget...
winget install OpenJS.NodeJS --accept-package-agreements --accept-source-agreements
if %errorlevel% neq 0 (
    echo Varování: Instalace Node.js selhala nebo je již nainstalovaný
    echo Zkusím pokračovat...
)

echo.
echo 2. Aktualizace PATH...
call refreshenv

echo.
echo 3. Kontrola Node.js...
timeout /t 5 /nobreak >nul
node --version
if %errorlevel% neq 0 (
    echo CHYBA: Node.js stále není dostupný!
    echo Prosím restartujte terminál a spusťte znovu
    pause
    exit /b 1
)

echo.
echo 4. Instalace npm balíčků...
cd /d "%~dp0"
npm install
if %errorlevel% neq 0 (
    echo CHYBA: Instalace balíčků selhala!
    pause
    exit /b 1
)

echo.
echo 5. Kontrola instalace...
npm list --depth=0

echo.
echo ✅ Instalace dokončena!
echo Projekt je připraven k testování.
echo.
echo Příští kroky:
echo 1. Spusťte: npm start
echo 2. Otevřete: http://localhost:3000
echo.
pause
