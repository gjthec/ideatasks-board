import { auth, db, IS_FIREBASE } from './firebaseConfig';
import {
  GoogleAuthProvider,
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

const googleProvider = new GoogleAuthProvider();

// Sincroniza o perfil básico do usuário na coleção users/{uid}
const upsertUserProfile = async (user: User) => {
  if (!db) return;
  await setDoc(
    doc(db, 'users', user.uid),
    {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || user.email?.split('@')[0] || 'Usuário',
      photoURL: user.photoURL || null,
      lastLoginAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const authService = {
  async loginWithEmail(email: string, password: string) {
    if (!IS_FIREBASE || !auth) throw new Error('Firebase Auth indisponível.');
    const result = await signInWithEmailAndPassword(auth, email, password);
    await upsertUserProfile(result.user);
    return result.user;
  },

  async registerWithEmail(email: string, password: string) {
    if (!IS_FIREBASE || !auth) throw new Error('Firebase Auth indisponível.');
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await upsertUserProfile(result.user);
    return result.user;
  },

  async loginWithGoogle() {
    if (!IS_FIREBASE || !auth) throw new Error('Firebase Auth indisponível.');
    const result = await signInWithPopup(auth, googleProvider);
    await upsertUserProfile(result.user);
    return result.user;
  },

  async logout() {
    if (!IS_FIREBASE || !auth) return;
    await signOut(auth);
  },

  onAuthChange(callback: (user: User | null) => void) {
    if (!IS_FIREBASE || !auth) {
      callback(null);
      return () => undefined;
    }
    return onAuthStateChanged(auth, callback);
  },
};
