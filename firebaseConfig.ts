
// Fix: Merged imports from the same module to resolve "no exported member" errors in certain TypeScript environments
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

// --- CONFIGURATION FLAG ---
// Set to true to enable Firebase Firestore sync.
export const IS_FIREBASE = true; // Enabled by default as user wants "registered" notes

const firebaseConfig = {
  apiKey: "AIzaSyCID7AGwR-tfNsiJIBd0nPfBGE5adLAbwY",
  authDomain: "train-api-49052.firebaseapp.com",
  projectId: "train-api-49052",
  storageBucket: "train-api-49052.firebasestorage.app",
  messagingSenderId: "1056584302761",
  appId: "1:1056584302761:web:659d6c4a3692ded2c4a9b8",
  measurementId: "G-DT7ZYWWZ8E"
};

let db: Firestore | null = null;

if (IS_FIREBASE) {
  try {
    const app: FirebaseApp = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log("🔥 Firestore initialized and active.");
  } catch (e) {
    console.warn("Firebase initialization failed. Check your config or connection.", e);
    db = null;
  }
} else {
  console.log("💾 Offline Mode Active (LocalStorage). Set IS_FIREBASE = true in firebaseConfig.ts to sync.");
}

export { db };
