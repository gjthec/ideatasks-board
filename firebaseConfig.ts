
// Fix: Use the correct modular SDK import for Firebase.
// In some environments, the standard "firebase/app" import is expected to provide initializeApp as a named export.
import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// --- CONFIGURATION FLAG ---
// Set this to true to enable real-time synchronization with Firebase
export const IS_FIREBASE = true;

const firebaseConfig = {
  apiKey: "AIzaSyCID7AGwR-tfNsiJIBd0nPfBGE5adLAbwY",
  authDomain: "train-api-49052.firebaseapp.com",
  projectId: "train-api-49052",
  storageBucket: "train-api-49052.firebasestorage.app",
  messagingSenderId: "1056584302761",
  appId: "1:1056584302761:web:659d6c4a3692ded2c4a9b8",
  measurementId: "G-DT7ZYWWZ8E",
};


let db: any = null;

if (IS_FIREBASE) {
    try {
        const app = initializeApp(firebaseConfig);
        db = getDatabase(app);
        console.log("🔥 Firebase initialized and active.");
    } catch (e) {
        console.warn("Firebase initialization failed. Check your config or connection.", e);
        db = null;
    }
} else {
    console.log("💾 Offline Mode Active (LocalStorage). Set IS_FIREBASE = true in firebaseConfig.ts to sync.");
}

export { db };
