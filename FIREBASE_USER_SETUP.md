# 🚨 NUTNÉ KROKY PRO VYTVOŘENÍ ADMIN UŽIVATELE

## 📋 PROBLÉM
Aplikace selhává při přihlášení protože v Firebase Auth neexistuje uživatel `brana@test.cz`.

## 🔘 ŘEŠENÍ

### 1. Vytvořte uživatele v Firebase Console:
1. Přejděte na [Firebase Console](https://console.firebase.google.com)
2. Vyberte projekt: `brana-a71fe`
3. V levém menu klikněte na **Authentication**
4. Klikněte na záložku **Users**
5. Klikněte na **Add user**
6. Vyplňte:
   - **Email**: `brana@test.cz`
   - **Password**: `admin123`
7. Klikněte na **Add user**

### 2. Vytvořte Firestore dokument:
1. V levém menu klikněte na **Firestore Database**
2. Klikněte na **Start collection**
3. **Collection ID**: `users`
4. Vytvořte dokument s **Document ID**: Firebase UID uživatele
5. Přidejte pole:
   ```json
   {
     "email": "brana@test.cz",
     "displayName": "Admin User",
     "role": "admin",
     "approved": true,
     "permissions": {
       "gate": true,
       "garage": true,
       "camera": true,
       "stopMode": true,
       "viewLogs": true,
       "manageUsers": true,
       "requireLocation": true,
       "allowGPS": true,
       "requireLocationProximity": true
     },
     "createdAt": "2024-01-01T00:00:00.000Z",
     "lastLogin": "2024-01-01T00:00:00.000Z"
   }
   ```

### 3. Alternativa - použijte Firebase Auth Emulator:
Pokud nemáte přístup k Firebase Console, můžete spustit lokální emulator:

```bash
# Nainstalujte Firebase CLI
npm install -g firebase-tools

# Přihlaste se
firebase login

# Inicializujte emulátory
firebase init emulators

# Spusťte emulátor
firebase emulators:start
```

## 🧪 TESTOVÁNÍ

Po vytvoření uživatele:
1. Restartujte aplikaci
2. Zkuste přihlášení: `brana@test.cz / admin123`
3. Měli byste vidět admin tlačítko v Dashboard

## ✅ OČEKÁVANÝ VÝSLEDEK

- ✅ Přihlášení úspěšné
- ✅ Admin tlačítko viditelné
- ✅ Přístup na /admin stránku
- ✅ Správa uživatelů funkční

**Po vytvoření Firebase uživatele bude vše fungovat!** 🎉
