# 📦 Instalace Gate Control Projektu

## 🚀 Rychlá instalace

### 1. Instalace Node.js
1. Stáhněte Node.js z [https://nodejs.org/](https://nodejs.org/)
2. Doporučuji verzi **LTS (Long Term Support)**
3. Nainstalujte s výchozími nastaveními

### 2. Instalace závislostí

#### Možnost A: Spuštěním instalačního skriptu
```bash
# Windows (Command Prompt)
install.bat

# Windows (PowerShell)
install.ps1
```

#### Možnost B: Manuální instalace
```bash
# Otevřete Command Prompt nebo PowerShell v adresáři projektu
cd c:\Programovani\OvladaniBrany

# Nainstalujte všechny závislosti
npm install
```

## 📋 Seznam závislostí

### Produkční balíčky
- `react` (^19.0.0) - React knihovna
- `react-dom` (^19.0.0) - React DOM renderer
- `react-router-dom` (^7.0.0) - React routing
- `firebase` (^11.0.0) - Firebase SDK
- `mqtt` (^5.7.0) - MQTT klient
- `tailwindcss` (^4.0.0) - CSS framework

### Vývojové balíčky
- `@types/node` (^22.0.0) - Node.js typy
- `@types/react` (^19.0.0) - React typy
- `@types/react-dom` (^19.0.0) - React DOM typy
- `@types/mqtt` (^5.0.0) - MQTT typy
- `typescript` (^5.6.0) - TypeScript kompilátor
- `@tailwindcss/forms` (^0.5.0) - Tailwind forms plugin
- `@tailwindcss/typography` (^0.5.0) - Tailwind typography plugin

## 🔧 Možné příkazy

Po instalaci můžete použít tyto příkazy:

```bash
# Spuštění vývojového serveru
npm start

# Build produkční verze
npm run build

# Spuštění testů
npm test

# Kontrola TypeScript chyb
npm run lint

# Automatická oprava linting chyb
npm run lint:fix
```

## 🌐 Testování aplikace

1. **Spusťte vývojový server:**
   ```bash
   npm start
   ```

2. **Otevřete prohlížeč:**
   - Aplikace bude dostupná na `http://localhost:3000`

3. **Testovací funkce:**
   - Přihlášení přes Firebase Auth
   - Ovládání brány a garáže přes MQTT
   - Zobrazení stavu připojení
   - HTTP fallback při HTTPS připojení

## 🔍 Konfigurace

### Environment proměnné
Vytvořte soubor `.env` v kořenovém adresáři:
```env
REACT_APP_FIREBASE_API_KEY=vas_firebase_api_klic
REACT_APP_FIREBASE_AUTH_DOMAIN=vas-projekt.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=vas-projekt-id
REACT_APP_MQTT_URL=ws://89.24.76.191:9001/mqtt
REACT_APP_MQTT_WSS_URL=wss://89.24.76.191:9002/mqtt
```

### MQTT Broker
- **WebSocket (HTTP):** `ws://89.24.76.191:9001/mqtt`
- **WebSocket (HTTPS):** `wss://89.24.76.191:9002/mqtt`
- **HTTP Proxy:** `/api/mqtt-proxy` (fallback)

## 🐛 Řešení problémů

### Chyba: "node is not recognized"
- Nainstalujte Node.js z [https://nodejs.org/](https://nodejs.org/)
- Restartujte terminál

### Chyba: "npm command failed"
- Spusťte jako administrátor
- Zkontrolujte internetové připojení
- Vymažte `node_modules` a `package-lock.json` a zkuste znovu

### Chyba: "Cannot find module"
- Spusťte `npm install` pro instalaci chybějících balíčků

### Port 3000 je obsazený
- Změňte port v `.env`: `PORT=3001`
- Nebo zabijte proces na portu 3000: `netstat -ano | findstr :3000`

## 📞 Podpora

Pokud narazíte na problémy:
1. Zkontrolujte verze Node.js a npm
2. Vymažte `node_modules` a `package-lock.json`
3. Spusťte `npm install` znovu
4. Zkontrolujte `.env` konfiguraci

---

**Po úspěšné instalaci je projekt připraven k testování!** 🎉
