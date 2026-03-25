import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

// --- CONFIGURATION FLAG ---
// Ativa a integração com Firebase (Firestore + Auth)
export const IS_FIREBASE = true;

const firebaseConfig = {
  apiKey: 'AIzaSyCID7AGwR-tfNsiJIBd0nPfBGE5adLAbwY',
  authDomain: 'train-api-49052.firebaseapp.com',
  projectId: 'train-api-49052',
  storageBucket: 'train-api-49052.firebasestorage.app',
  messagingSenderId: '1056584302761',
  appId: '1:1056584302761:web:659d6c4a3692ded2c4a9b8',
  measurementId: 'G-DT7ZYWWZ8E',
};

let db: Firestore | null = null;
let auth: Auth | null = null;

if (IS_FIREBASE) {
  try {
    const app: FirebaseApp = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    console.log('🔥 Firestore/Auth inicializados com sucesso.');
  } catch (e) {
    console.warn('Falha na inicialização do Firebase.', e);
    db = null;
    auth = null;
  }
} else {
  console.log('💾 Modo local ativo (LocalStorage).');
}

export { db, auth };
