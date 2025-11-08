// Create admin user in Firebase Auth
const admin = require('firebase-admin');

// Firebase service account (you'll need to download this from Firebase Console)
const serviceAccount = {
  "type": "service_account",
  "project_id": "brana-a71fe",
  "private_key_id": "YOUR_PRIVATE_KEY_ID",
  "private_key": "YOUR_PRIVATE_KEY",
  "client_email": "firebase-adminsdk-xxxxx@brana-a71fe.iam.gserviceaccount.com",
  "client_id": "YOUR_CLIENT_ID",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token"
};

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'brana-a71fe'
});

const auth = admin.auth();

async function createAdminUser() {
  try {
    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email: 'brana@test.cz',
      password: 'admin123',
      displayName: 'Admin User'
    });

    console.log('✅ Firebase user created:', userRecord.uid);

    // Create user document in Firestore
    const db = admin.firestore();
    await db.collection('users').doc(userRecord.uid).set({
      id: userRecord.uid,
      email: 'brana@test.cz',
      displayName: 'Admin User',
      role: 'admin',
      permissions: {
        gate: true,
        garage: true,
        camera: true,
        stopMode: true,
        viewLogs: true,
        manageUsers: true,
        requireLocation: true,
        allowGPS: true,
        requireLocationProximity: true
      },
      approved: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLogin: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ Firestore user document created');
    console.log('🎉 Admin user is ready!');

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    process.exit();
  }
}

createAdminUser();
