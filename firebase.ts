import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";

// Your web app's Firebase configuration (from Firebase Console)
const firebaseConfig = {
  apiKey: "AIzaSyD-PHMZZelMHFTQq4bcH8Zz2XO2AmMdyxM",
  authDomain: "mediqueue-43fc8.firebaseapp.com",
  projectId: "mediqueue-43fc8",
  storageBucket: "mediqueue-43fc8.firebasestorage.app",
  messagingSenderId: "705154059119",
  appId: "1:705154059119:web:d91f0192f06d71b054f69a",
  measurementId: "G-2ZRBM70YR1"
};

// Initialize Firebase app (singleton pattern)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with offline persistence (fixes "missing index" errors)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

// Initialize other services
export const auth = getAuth(app);
export const storage = getStorage(app);

// Initialize Analytics only on client side (prevents SSR errors)
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) getAnalytics(app);
  });
}

export default app;