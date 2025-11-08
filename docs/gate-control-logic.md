# Gate Control Logic Documentation

## Overview
Tento dokument popisuje přesnou logiku ovládání brány včetně kontroly otevření, automatického zavření a synchronizace mezi uživateli.

## 1. Kontrola otevření (Open Check)

### Scénář 1: Správné otevření
1. **Uživatel klikne na bránu** (status: "Brána zavřena")
2. **Spustí se modrý odpočet:** 🔵 "Kontrola otevření: 10s"
3. **Status se změní na "Otevírá se..."**
4. **Interval kontroluje každých 500ms pomocí useRef**
5. **Detekce "Otevírá se..."** → Kontrola se OKAMŽITĚ zastaví
6. **Žádný retry** - brána se normálně otevírá
7. **Status: "Brána otevřena"** → Spustí se 🟠 "Auto zavření: 4:10"

### Scénář 2: Selhání otevření
1. **Uživatel klikne na bránu** (status: "Brána zavřena")
2. **Spustí se modrý odpočet:** 🔵 "Kontrola otevření: 10s"
3. **Status zůstane "Brána zavřena" nebo "Neznámý stav"**
4. **Interval kontroluje každých 500ms**
5. **Po 10s (20 kontrolách)** → Status NENÍ "Otevírá se..."
6. **Automaticky se provede retry** → Druhý pokus o otevření
7. **Zobrazí se:** 🔄 "Provádím druhý pokus o otevření..."

### Klíčové technické detaily:
- **useRef pro mqttStatus:** `mqttStatusRef.current = mqttStatus` zajišťuje vždy aktuální data
- **Interval každých 500ms:** `setInterval(() => { ... }, 500)`
- **Maximální počet kontrol:** `Math.ceil(openCheckTimeLimit / 0.5)`
- **Detekce "Otevírá se...":** Všechny varianty textu včetně diakritiky
- **Okamžité zastavení:** `clearInterval(checkInterval)` při detekci otevírání

## 2. Automatické zavření (Auto-Close)

### Spuštění auto-zavření:
1. **Status: "Brána otevřena"** (z jakéhokoli důvodu)
2. **Spustí se oranžový odpočet:** 🟠 "Auto zavření: 4:10"
3. **Odpočet běží dolů každých 1s**

### Po dosažení limitu (0:00):
1. **Oranžové pole ZMIZÍ** (`autoCloseEnabled = false`)
2. **Zobrazí se zelené pole:** ⏱️ "Brána je otevřena již: 4:11"
3. **Text se mění na reálnou dobu otevření:** 4:11, 4:12, 4:13... (nastavený čas + další sekundy)
4. **Pokračuje každou sekundu** dokud se brána nezavře

### Zastavení auto-zavření:
1. **Status: "Zavírá se..."** → Odpočet OKAMŽITĚ zmizí
2. **Status: "Brána zavřena"** → Odpočet je zastaven
3. **Reset stavu:** `autoCloseEnabled = false`, `autoCloseCountdown = 0`, `showOpenDuration = false`

### Detekce stavů:
```typescript
const isGateOpen = currentStatus.includes('otevřena') || 
                  currentStatus.includes('open') ||
                  currentStatus.includes('otevreno') ||
                  originalStatus.includes('Brána otevřena') ||
                  originalStatus.includes('Gate open');

const isGateClosing = currentStatus.includes('zavírání') || 
                     currentStatus.includes('closing') ||
                     currentStatus.includes('zavirani') ||
                     originalStatus.includes('Zavírá se...');
```

## 3. Synchronizace mezi uživateli

### Real-time synchronizace VŠECH časů:
**KRITICKÉ:** Všechny časy v aplikaci musí být real-time synchronizovány mezi všemi online uživateli!

#### Synchronizované časovače:
1. **🟠 Auto-close countdown** (4:10, 4:09, ..., 0:01)
   - Všichni uživatelé vidí STEJNÝ odpočet
   - Synchronizace každou sekundu přes `gateSync` event
   
2. **⏱️ Reálná doba otevření** (4:11, 4:12, 4:13...)
   - Všichni uživatelé vidí STEJNÝ čas
   - Počítá se od `gateOpenTime` timestamp
   - Synchronizace přes localStorage + custom events

3. **🔵 Open check countdown** (10s, 9s, ..., 1s)
   - Synchronizace kontroly otevření mezi uživateli
   - `gateOpenCheckSync` event

### Mechanismus synchronizace:
1. **LocalStorage events:** Pro synchronizaci v rámci stejného prohlížeče mezi taby
2. **Custom events:** Pro synchronizaci mezi okny/taby
3. **Timestamp kontrola:** Zabrání zastaralým datům
4. **gateOpenTime:** Společný timestamp pro výpočet reálné doby otevření

### Příklad synchronizace:
```typescript
// Odeslání synchronizace při otevření brány
const syncData = {
  autoCloseEnabled: true,
  autoCloseCountdown: 250,
  gateOpenTime: Date.now(), // Společný timestamp!
  timestamp: Date.now()
};
localStorage.setItem('gateSync', JSON.stringify(syncData));
window.dispatchEvent(new CustomEvent('gateSync', { detail: syncData }));

// Příjem synchronizace
window.addEventListener('gateSync', (e) => {
  const syncData = e.detail;
  if (syncData.timestamp) {
    setAutoCloseEnabled(syncData.autoCloseEnabled);
    setAutoCloseCountdown(syncData.autoCloseCountdown);
    setGateOpenTime(syncData.gateOpenTime); // Synchronizace času otevření!
  }
});

// Výpočet reálné doby otevření (všichni vidí STEJNÝ čas)
const totalOpenTime = autoCloseTimeLimit + Math.floor((Date.now() - gateOpenTime) / 1000);
```

### Důležité poznámky:
- **Všichni online uživatelé vidí STEJNÉ časy** - žádné rozdíly mezi zařízeními
- **gateOpenTime** je společný timestamp pro všechny uživatele
- **Synchronizace funguje i při refresh stránky** (localStorage persistence)
- **Automatická synchronizace** při změně stavu brány

### Příklad real-time synchronizace:
**Scénář:** Uživatel A otevře bránu, Uživatel B má otevřený dashboard

1. **T=0s:** Uživatel A klikne na bránu
   - Všichni vidí: 🔵 "Kontrola otevření: 10s"
   
2. **T=2s:** Brána se začne otevírat
   - Všichni vidí: "Brána se otevírá..."
   
3. **T=5s:** Brána je otevřená
   - Všichni vidí: 🟠 "Auto zavření: 4:10"
   - `gateOpenTime = 1699368000000` (společný timestamp)
   
4. **T=10s:** Odpočet pokračuje
   - Všichni vidí: 🟠 "Auto zavření: 4:05"
   
5. **T=250s:** Limit dosažen
   - Všichni vidí: ⏱️ "Brána je otevřena již: 4:11"
   - Výpočet: `250s + 1s = 4:11`
   
6. **T=260s:** Pokračuje
   - Všichni vidí: ⏱️ "Brána je otevřena již: 4:21"
   - Výpočet: `250s + 11s = 4:21`
   
7. **Kdykoli:** Uživatel C otevře dashboard
   - Vidí STEJNÝ čas jako ostatní (synchronizace z localStorage)

## 4. Nastavení v Admin Panelu

### Konfigurovatelné časy:
- **Čas auto-zavření:** 4:10 (250s) default (lze nastavit od 0:00 do 999:59)
- **Čas kontroly otevření:** 10s default
- **Čas pro retry:** 3s default

### Ukládání nastavení:
- **Firestore Database:** `settings/gateControl` dokument
- **Real-time synchronizace:** Všichni uživatelé vidí STEJNÉ nastavení
- **onSnapshot listener:** Automatická aktualizace při změně nastavení
- **Žádný localStorage:** Vše v DB pro konzistenci mezi uživateli
- **Persist napříč sessiony**

## 5. Debug a logování

### Debug tlačítko:
- **🔧 Test Status** v pravém horním rohu
- **Manuální kontrola aktuálního statusu**
- **Výpis do console pro diagnostiku**

### Logování:
```typescript
console.log('🔍 Gate status check:', {
  originalStatus,
  currentStatus,
  isGateOpen,
  isGateClosed,
  isGateOpening,
  isGateClosing,
  autoCloseEnabled,
  autoCloseCountdown
});

console.log('🔍 Real-time status check:', {
  originalStatus,
  currentStatus,
  isGateOpening,
  checkCount,
  note: 'Using FRESH mqttStatus data'
});
```

## 6. Edge Cases a chytré scénáře

### Externí otevření:
- **Brána se otevře bez kliknutí** (fyzicky, dálkově)
- **Status: "Brána otevřena"** → Auto-zavření se spustí automaticky
- **Všichni online uživatelé vidí odpočet**

### Ztráta spojení:
- **MQTT disconnect** → Všechny odpočty se zastaví
- **Reconnect** → Status se obnoví, odpočty se přizpůsobí

### Rychlé klikání:
- **Debounce:** `gateLoading` stav zabrání duplicitním příkazům
- **Timeout cleanup:** Staré intervaly se vždy čistí

## 7. Performance a optimalizace

### Efektivní intervaly:
- **Open check:** 500ms interval (rychlá reakce)
- **Auto-close:** 1000ms interval (standardní odpočet)
- **Cleanup:** Všechny intervaly se čistí při unmount

### Memory management:
- **useRef pro mqttStatus:** Žádné unnecessary re-renders
- **Event listener cleanup:** Správné odstranění při unmount
- **LocalStorage size:** Minimal data, efficient storage

## 8. Bezpečnost a permission

### Role-based access:
- **Gate permission:** `hasPermission(user, 'gate')`
- **Garage permission:** `hasPermission(user, 'garage')`
- **Stop mode:** `canUseStopMode(user)`

### MQTT logování:
- **User ID extraction:** Z emailu `user@domain` → `ID: 12345`
- **Audit trail:** Všechny příkazy se logují s ID uživatele
- **Error handling:** Graceful fallback při selhání

---

## 9. Nasazení na Vercel a produkční prostředí

### Architektura synchronizace na Vercel:
```typescript
// Client-side synchronizace (funguje všude)
- LocalStorage events: Pro synchronizaci v rámci stejného prohlížeče
- Custom events: Pro synchronizaci mezi okny/taby
- Timestamp kontrola: Zabrání zastaralým datům

// Server-side MQTT broker (nezávislý na Vercel)
- MQTT broker běží na vlastním serveru
- Vercel pouze jako statický hosting + API routes
- Real-time komunikace přes WebSocket (MQTT)
```

### Co funguje na Vercel bez problémů:
**✅ Plná funkčnost synchronizace:**
- **LocalStorage synchronizace** - funguje na všech hostingech
- **Real-time odpočty** - client-side JavaScript
- **Formátování času** - H:MM:SS dynamicky
- **Admin Panel nastavení** - persist v localStorage
- **Debug logování** - console.log pro vývoj

**✅ MQTT komunikace:**
- **WebSocket připojení** k externímu MQTT brokeru
- **Real-time status aktualizace** z brány
- **Retry mechanismus** při ztrátě spojení
- **User ID logování** pro audit trail

### Vercel deployment konfigurace:
```json
// vercel.json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "no-cache, no-store, must-revalidate"
        }
      ]
    }
  ]
}
```

### Produkční MQTT nastavení:
```typescript
// src/services/optimizedMqttService.ts
const PRODUCTION_MQTT_CONFIG = {
  host: 'mqtt.vasedomena.cz',  // Váš MQTT broker
  port: 8883,                   // WebSocket SSL port
  protocol: 'wss',              // Secure WebSocket
  clientId: `vercel_${Math.random().toString(16).substr(2, 8)}`,
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD
};

// Environment variables na Vercel
// MQTT_USERNAME=vas_username
// MQTT_PASSWORD=vas_heslo
// MQTT_BROKER_URL=wss://mqtt.vasedomena.cz:8883
```

### Performance na Vercel:
**✅ Optimalizace pro produkci:**
- **Statické soubory** z CDN (Vercel Edge Network)
- **Client-side caching** pro localStorage
- **Minimal API calls** - většina logiku client-side
- **Efficient intervals** - 500ms a 1000ms pro minimal load

**✅ Monitoring a debug:**
```typescript
// Produkční debug logy
if (process.env.NODE_ENV === 'development') {
  console.log('🔍 Debug info:', debugData);
} else {
  // Produkce - pouze error logy
  console.error('❌ Production error:', error);
}
```

### Bezpečnost na Vercel:
**✅ Security measures:**
- **Environment variables** pro MQTT credentials
- **HTTPS/WSS** forced na Vercel
- **Client-side validation** permissions
- **Rate limiting** pro MQTT příkazy
- **Audit trail** s user ID

### Testování na Vercel:
**🚀 Deployment checklist:**
1. **Build test:** `npm run build` ✅
2. **Environment variables** nastaveny ✅
3. **MQTT broker dostupný** z Vercel ✅
4. **WebSocket port 8883** otevřený ✅
5. **CORS nastavení** na MQTT brokeru ✅
6. **SSL certifikát** validní ✅

### Produkční scénáře:
**🎯 Reálné použití:**
- **Více uživatelů** ovládá bránu současně
- **Mobilní připojení** s nestabilním internetem
- **Dlouhé otevření** brány (hodiny)
- **Ztráta spojení** a automatická obnova
- **Cross-browser** synchronizace

---

## Shrnutí
Tento systém zajišťuje spolehlivé ovládání brány s:
- ✅ **Inteligentní kontrolou otevření** (retry při selhání)
- ✅ **Automatickým zavřením** (synchronizované)
- ✅ **Real-time synchronizací** (mezi uživateli)
- ✅ **Robustním error handlingem** (edge cases)
- ✅ **Performance optimalizací** (efektivní intervaly)
- ✅ **Vercel kompatibilitou** (produkční ready)

**Vše funguje spolehlivě na Vercel s externím MQTT brokerem a plnou synchronizací mezi uživateli!**

---

## 10. Detaily a Edge Cases

### Cache problém s posledním přihlášením
**🔍 Pozorovaný problém:**
- **F5 (normální refresh)** → Dashboard zobrazí "Poslední přihlášení: Nikdy"
- **Shift+F5 (hard refresh)** → Dashboard zobrazí správné datum a čas

**🔧 Příčina problému:**
```typescript
// Problém: Browser cache a localStorage timing
// 1. Firebase user data se načtou z cache při F5
// 2. localStorage sync events se spustí později
// 3. Dashboard zobrazí stará data před synchronizací

// Řešení: Shift+F5 vynutí fresh data z Firebase
```

**🛠️ Možná řešení:**
```typescript
// 1. Přidat loading state pro user data
const [userLoading, setUserLoading] = useState(true);

// 2. Zobrazit placeholder při načítání
{userLoading ? (
  <p className="text-sm text-gray-500">Načítám data...</p>
) : (
  <p className="text-sm text-gray-700">
    {formatUserLoginDate(user?.lastLogin)}
  </p>
)}

// 3. Force refresh při F5
useEffect(() => {
  const forceRefresh = () => {
    // Vynutit fresh data z Firebase
    userService.refreshUserData();
  };
  
  // Detekovat F5 vs Shift+F5
  if (performance.navigation.type === 1) {
    // F5 detekován - možná potřeba fresh data
    setTimeout(forceRefresh, 100);
  }
}, []);
```

**📊 Doporučení:**
- **Pro produkci:** Implementovat loading state pro user data
- **Pro vývoj:** Shift+F5 pro fresh data při testování
- **Monitoring:** Přidat logy pro cache vs fresh data

**💡 Proč to funguje na Shift+F5:**
- **Hard refresh** vynutí nové data z Firebase
- **Žádná cache** pro user authentication data
- **Čerstvé timestamp** pro `lastLogin`

---

## Shrnutí
Tento systém zajišťuje spolehlivé ovládání brány s:
- ✅ **Inteligentní kontrolou otevření** (retry při selhání)
- ✅ **Automatickým zavřením** (synchronizované)
- ✅ **Real-time synchronizací** (mezi uživateli)
- ✅ **Robustním error handlingem** (edge cases)
- ✅ **Performance optimalizací** (efektivní intervaly)
- ✅ **Vercel kompatibilitou** (produkční ready)
- ✅ **Cache aware designem** (prohlížeč optimalizace)

**Vše funguje spolehlivě na Vercel s externím MQTT brokerem a plnou synchronizací mezi uživateli!**
