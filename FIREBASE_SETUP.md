# Firebase Setup Guide

## 📋 KROKY PRO NASTAVENÍ FUNKČNÍHO FIREBASE

### 1. Vytvoření Firebase projektu
1. Jděte na [Firebase Console](https://console.firebase.google.com)
2. Klikněte na "Add project"
3. Zadejte název projektu (např. "gate-control-app")
4. Povolte Google Analytics (volitelné)
5. Klikněte na "Create project"

### 2. Povolení Authentication
1. V levém menu klikněte na "Authentication"
2. Klikněte na "Get started"
3. V záložce "Sign-in method" klikněte na "Email/Password"
4. Povolte "Email/Password" a klikněte na "Save"

### 3. Vytvoření uživatele
1. V Authentication klikněte na záložku "Users"
2. Klikněte na "Add user"
3. Zadejte:
   - **Email:** `brana@test.cz`
   - **Password:** `admin123`
4. Klikněte na "Add user"

### 4. Získání Firebase credentials
1. Klikněte na ikonu ⚙️ (Project Settings) vedle "Project Overview"
2. Přejděte na záložku "General"
3. V sekci "Your apps" klikněte na web ikonu (</>)
4. Zadejte název aplikace (např. "Gate Control Web")
5. Klikněte na "Register app"
6. Zkopírujte `firebaseConfig` objekt

### 5. Konfigurace aplikace
#### Možnost A: Přes .env soubor
Vytvořte soubor `.env` v kořenovém adresáři projektu:

```env
REACT_APP_FIREBASE_API_KEY=vaše_api_key_zde
REACT_APP_FIREBASE_AUTH_DOMAIN=váš-projekt.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=váš-projekt
REACT_APP_FIREBASE_STORAGE_BUCKET=váš-projekt.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789012
REACT_APP_FIREBASE_APP_ID=vaše_app_id
```

#### Možnost B: Přímá úprava config.ts
V souboru `src/firebase/config.ts` nahraďte placeholder hodnoty vašimi reálnými credentials:

```typescript
const firebaseConfig = {
  apiKey: "vaše_api_key_zde",
  authDomain: "váš-projekt.firebaseapp.com",
  projectId: "váš-projekt",
  storageBucket: "váš-projekt.appspot.com",
  messagingSenderId: "123456789012",
  appId: "vaše_app_id"
};
```

### 6. Restart aplikace
```bash
# Zastavte aktuální běh (Ctrl+C)
# A spusťte znovu
npm start
```

## 🧪 TESTOVÁNÍ

### Otestujte přihlášení:
1. Otevřete http://localhost:3001
2. Zadejte email: `brana@test.cz`
3. Zadejte heslo: `admin123`
4. Klikněte na "Přihlásit"

### Očekávaný výsledek:
- ✅ Úspěšné přihlášení
- ✅ Přesměrování na dashboard
- ✅ MQTT status "Připojeno"
- ✅ Funkční ovládací tlačítka

## 🚨 ŘEŠENÍ PROBLÉMŮ

### Chyba: "auth/api-key-not-valid"
- Zkontrolujte správnost API klíče
- Ujistěte se že používáte web credentials (ne service account)

### Chyba: "auth/user-not-found"
- Vytvořte uživatele v Firebase Console
- Zkontrolujte přesnost emailu

### Chyba: "auth/wrong-password"
- Zkontrolujte heslo uživatele
- Vytvořte nového uživatele s heslem `admin123`

### Chyba: "auth/network-request-failed"
- Zkontrolujte internetové připojení
- Ujistěte se že Firebase Auth je povolen

## 📱 DALŠÍ MOŽNOSTI

### Přidání dalších uživatelů:
- **Admin:** admin@gatecontrol.cz / admin123
- **User:** user@gatecontrol.cz / user123
- **Test:** test@gatecontrol.cz / test123

### Povolení dalších metod:
- **Google Sign-in**
- **Facebook Login**
- **Phone Authentication**

---

**Po nastavení Firebase bude aplikace plně funkční s reálnou autentizací!** 🎉
