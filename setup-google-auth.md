# Nastavení Google Authentication

## 📋 Kroky pro povolení Google Auth

### 1. Firebase Console - Authentication
1. Přejděte na [Firebase Console](https://console.firebase.google.com)
2. Vyberte projekt: `brana-a71fe`
3. V levém menu klikněte na **Authentication**
4. Klikněte na záložku **Sign-in method**
5. Klikněte na **Google** a povolte ho
6. Ujistěte se že je **Email/Password** také povolen

### 2. Google Cloud Console - OAuth 2.0
1. Přejděte na [Google Cloud Console](https://console.cloud.google.com)
2. Vyberte projekt: `brana-a71fe`
3. V levém menu jděte na **APIs & Services** → **Credentials**
4. Klikněte na **OAuth consent screen**
5. Pokud ještě nemáte, vytvořte nový:
   - **User Type**: External
   - **App name**: Gate Control
   - **User support email**: váš@email.cz
   - **Developer contact**: váš@email.cz
6. Přidejte **Authorized domains**:
   - `localhost`
   - `127.0.0.1`
   - Váš produkční doména (pokud existuje)

### 3. Vytvoření OAuth 2.0 Client ID
1. V **Credentials** klikněte na **Create Credentials** → **OAuth 2.0 Client IDs**
2. **Application type**: Web application
3. **Name**: Gate Control Web
4. **Authorized JavaScript origins**:
   - `http://localhost:3001`
   - `https://localhost:3001`
   - Váš produkční URL
5. **Authorized redirect URIs** (Firebase automaticky přidá):
   - `https://brana-a71fe.firebaseapp.com/__/auth/handler`
6. Klikněte na **Create**

### 4. Firebase - Připojení Google Client
1. Vraťte se do Firebase Console → Authentication → Sign-in method
2. Klikněte na **Google** a upravte nastavení
3. Zadejte **Web client ID** z Google Cloud Console
4. Uložte nastavení

## 🧪 Testování

### Testovací účty
Vytvořte testovací uživatele v Firebase Authentication → Users:
- **Email**: `brana@test.cz`
- **Heslo**: `admin123`
- **Role**: Admin (schválit ručně po registraci)

### Postup testování
1. Spusťte aplikaci: `npm start`
2. Otevřete http://localhost:3001
3. Zkuste **Google Sign In**
4. Zkuste **Email/Password Sign In**
5. Ověřte že noví uživatelé čekají na schválení

## 🔧 Firebase Rules

Pro správné fungování přidejte Firebase Security Rules:

### Firestore Rules
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null && 
        resource.data.role in ['admin', 'user', 'viewer'];
      allow write: if request.auth != null && 
        request.auth.token.email == 'admin@brana.cz'; // Admin email
    }
    
    // Activities collection
    match /activities/{activityId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && 
        request.auth.uid == resource.data.user;
    }
    
    // Settings collection
    match /settings/{document} {
      allow read, write: if request.auth != null && 
        request.auth.token.email == 'admin@brana.cz'; // Admin only
    }
  }
}
```

## 🚀 Po nastavení

Po dokončení těchto kroků bude aplikace podporovat:
- ✅ **Google Authentication**
- ✅ **Email/Password Authentication** 
- ✅ **Admin schvalování uživatelů**
- ✅ **Role-based permissions**
- ✅ **Firebase Security Rules**

**Aplikace bude plně připravena na produkční nasazení!** 🎉
