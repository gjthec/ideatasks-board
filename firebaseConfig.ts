
// Fix: Use standard Firebase v9+ modular imports. Ensure the package 'firebase' is used for subpaths.
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getDatabase, Database } from 'firebase/database';

// --- CONFIGURATION FLAG ---
// Altere para true para ativar o Firebase.
// Importante: Verifique se a databaseURL no console do Firebase termina em .firebaseio.com ou .firebasedatabase.app
export const IS_FIREBASE = true;

const firebaseConfig = {
  apiKey: "AIzaSyCID7AGwR-tfNsiJIBd0nPfBGE5adLAbwY",
  authDomain: "train-api-49052.firebaseapp.com",
  projectId: "train-api-49052",
  storageBucket: "train-api-49052.firebasestorage.app",
  messagingSenderId: "1056584302761",
  appId: "1:1056584302761:web:659d6c4a3692ded2c4a9b8",
  measurementId: "G-DT7ZYWWZ8E",
  // Se o erro persistir, verifique no console do Firebase -> Realtime Database se a URL está correta.
  // Projetos fora dos EUA geralmente precisam da região na URL (ex: .europe-west1.firebasedatabase.app)
  databaseURL: "https://train-api-49052-default-rtdb.firebaseio.com"
};

let db: Database | null = null;

if (IS_FIREBASE) {
    try {
        const app: FirebaseApp = initializeApp(firebaseConfig);
        // Passamos a databaseURL explicitamente para garantir que o SDK conecte ao endpoint correto
        db = getDatabase(app, firebaseConfig.databaseURL);
        console.log("🔥 Firebase initialized and active at:", firebaseConfig.databaseURL);
    } catch (e) {
        console.warn("Firebase initialization failed. Check your config or connection.", e);
        db = null;
    }
} else {
    console.log("💾 Offline Mode Active (LocalStorage). Set IS_FIREBASE = true in firebaseConfig.ts to sync.");
}

export { db };
