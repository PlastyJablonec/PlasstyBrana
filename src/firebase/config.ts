import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

// Firebase configuration - Reálné credentials
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyBaDmIBLtw4ck4eUJMmGScwPBPYuIv8QSU",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "brana-a71fe.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "brana-a71fe",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "brana-a71fe.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "1080619570120",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:1080619570120:web:62c1ea8d1a78532672e6fd",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-K8FRR55FR5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Analytics
export let analytics: any = null;
if (typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
    console.log('📊 Firebase Analytics initialized');
  } catch (error) {
    console.warn('Analytics initialization failed:', error);
  }
}

export default app;

// Helper functions for Firebase operations
export const isFirebaseConfigured = (): boolean => {
  return !!(firebaseConfig.apiKey && 
           firebaseConfig.authDomain && 
           firebaseConfig.projectId &&
           firebaseConfig.apiKey !== "demo-api-key");
};

export const getFirebaseConfig = () => {
  return { ...firebaseConfig };
};
