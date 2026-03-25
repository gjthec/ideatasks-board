import { db } from './firebaseConfig';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';

export type UserPreferences = {
  uid: string;
  theme: 'light' | 'dark';
  lastCardColor: string;
  lastZoomLevel: number;
  canvasOffset: { x: number; y: number };
  defaultCardStatus: 'todo' | 'doing' | 'done';
};

export const DEFAULT_USER_PREFERENCES: Omit<UserPreferences, 'uid'> = {
  theme: 'light',
  lastCardColor: '#fef3c7',
  lastZoomLevel: 1,
  canvasOffset: { x: 0, y: 0 },
  defaultCardStatus: 'todo',
};

const prefDoc = (uid: string) => doc(db!, 'userPreferences', uid);

export const ensureUserPreferences = async (uid: string) => {
  if (!db) return { uid, ...DEFAULT_USER_PREFERENCES };
  const snapshot = await getDoc(prefDoc(uid));
  if (!snapshot.exists()) {
    const payload = { uid, ...DEFAULT_USER_PREFERENCES, updatedAt: serverTimestamp() };
    await setDoc(prefDoc(uid), payload, { merge: true });
    return { uid, ...DEFAULT_USER_PREFERENCES };
  }

  return {
    uid,
    ...DEFAULT_USER_PREFERENCES,
    ...(snapshot.data() as Partial<UserPreferences>),
  };
};

export const saveUserPreferences = async (uid: string, updates: Partial<UserPreferences>) => {
  if (!db) return;
  await setDoc(
    prefDoc(uid),
    {
      uid,
      ...updates,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const subscribeToUserPreferences = (
  uid: string,
  callback: (preferences: UserPreferences) => void
) => {
  if (!db) return () => undefined;
  return onSnapshot(prefDoc(uid), (snapshot) => {
    if (!snapshot.exists()) return;
    callback({
      uid,
      ...DEFAULT_USER_PREFERENCES,
      ...(snapshot.data() as Partial<UserPreferences>),
    });
  });
};
