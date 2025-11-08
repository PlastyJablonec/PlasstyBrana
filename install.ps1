# Instalační skript pro Gate Control projekt
Write-Host "Instalace závislostí pro Gate Control projekt..." -ForegroundColor Green
Write-Host ""

# Kontrola Node.js
Write-Host "1. Kontrola Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js je nainstalovaný: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ CHYBA: Node.js není nainstalovaný!" -ForegroundColor Red
    Write-Host "Prosím stáhněte a nainstalujte Node.js z: https://nodejs.org/" -ForegroundColor Yellow
    Write-Host "Doporučuji verzi LTS (Long Term Support)" -ForegroundColor Yellow
    Read-Host "Stiskněte Enter pro ukončení"
    exit 1
}
Write-Host ""

# Instalace npm balíčků
Write-Host "2. Instalace npm balíčků..." -ForegroundColor Yellow
try {
    npm install
    if ($LASTEXITCODE -ne 0) {
        throw "Instalace selhala"
    }
    Write-Host "✅ Balíčky úspěšně nainstalovány" -ForegroundColor Green
} catch {
    Write-Host "❌ CHYBA: Instalace balíčků selhala!" -ForegroundColor Red
    Read-Host "Stiskněte Enter pro ukončení"
    exit 1
}
Write-Host ""

# Kontrola instalace
Write-Host "3. Kontrola instalace..." -ForegroundColor Yellow
Write-Host "Nainstalované balíčky:" -ForegroundColor Cyan
npm list --depth=0
Write-Host ""

# Možné příkazy pro vývoj
Write-Host "4. Možné příkazy pro vývoj:" -ForegroundColor Yellow
Write-Host "   npm start       - Spuštění vývojového serveru" -ForegroundColor Cyan
Write-Host "   npm run build   - Build produkční verze" -ForegroundColor Cyan
Write-Host "   npm test        - Spuštění testů" -ForegroundColor Cyan
Write-Host "   npm run lint    - Kontrola TypeScript chyb" -ForegroundColor Cyan
Write-Host ""

Write-Host "✅ Instalace dokončena!" -ForegroundColor Green
Write-Host "Projekt je připraven k testování." -ForegroundColor Green
Read-Host "Stiskněte Enter pro ukončení"
