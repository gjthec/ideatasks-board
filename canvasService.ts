import { db } from './firebaseConfig';
import { Note, Stroke } from './types';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';

const canvasCollection = () => collection(db!, 'canvases');

const sanitizeCanvasKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

export const getOrCreateUserCanvas = async (uid: string, email?: string | null) => {
  if (!db) return null;

  // Novo padrão: usa o trecho antes de '@' do e-mail como chave do canvas.
  const emailPrefix = email?.split('@')?.[0] || '';
  const safeCanvasId = sanitizeCanvasKey(emailPrefix);
  if (safeCanvasId) {
    await setDoc(
      doc(db, 'canvases', safeCanvasId),
      {
        canvasId: safeCanvasId,
        ownerUid: uid,
        title: 'Meu Canvas',
        members: [uid],
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
    return safeCanvasId;
  }

  // Fallback: mantém estratégia anterior para contas sem e-mail válido.
  const canvasQuery = query(canvasCollection(), where('ownerUid', '==', uid), limit(1));
  const snapshot = await getDocs(canvasQuery);
  if (!snapshot.empty) return snapshot.docs[0].id;

  const fallbackId = `canvas-${uid}`;
  await setDoc(
    doc(db, 'canvases', fallbackId),
    {
      canvasId: fallbackId,
      ownerUid: uid,
      title: 'Meu Canvas',
      members: [uid],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  return fallbackId;
};

const cardsCollection = (canvasId: string) => collection(db!, 'canvases', canvasId, 'cards');
const drawingsCollection = (canvasId: string) => collection(db!, 'canvases', canvasId, 'drawings');

export const subscribeCanvasRealtime = (
  canvasId: string,
  onCards: (cards: Note[]) => void,
  onDrawings: (drawings: Stroke[]) => void
) => {
  if (!db) return () => undefined;

  const unsubCards = onSnapshot(cardsCollection(canvasId), (snapshot) => {
    const cards = snapshot.docs.map((cardDoc) => ({
      ...(cardDoc.data() as Note),
      id: cardDoc.id,
    }));
    onCards(cards);
  });

  const unsubDrawings = onSnapshot(drawingsCollection(canvasId), (snapshot) => {
    const drawings = snapshot.docs.map((drawingDoc) => ({
      ...(drawingDoc.data() as Stroke),
      id: drawingDoc.id,
    }));
    onDrawings(drawings);
  });

  return () => {
    unsubCards();
    unsubDrawings();
  };
};

export const upsertCard = async (canvasId: string, note: Note, uid: string) => {
  if (!db) return;
  await setDoc(
    doc(db, 'canvases', canvasId, 'cards', note.id),
    {
      ...note,
      cardId: note.id,
      createdBy: uid,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
  await setDoc(doc(db, 'canvases', canvasId), { updatedAt: serverTimestamp() }, { merge: true });
};

export const deleteCard = async (canvasId: string, cardId: string) => {
  if (!db) return;
  await deleteDoc(doc(db, 'canvases', canvasId, 'cards', cardId));
};

export const upsertDrawing = async (canvasId: string, stroke: Stroke, uid: string) => {
  if (!db) return;
  await setDoc(
    doc(db, 'canvases', canvasId, 'drawings', stroke.id),
    {
      ...stroke,
      drawingId: stroke.id,
      pathData: JSON.stringify(stroke.points),
      strokeWidth: stroke.size,
      createdBy: uid,
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
  await setDoc(doc(db, 'canvases', canvasId), { updatedAt: serverTimestamp() }, { merge: true });
};

export const deleteDrawing = async (canvasId: string, drawingId: string) => {
  if (!db) return;
  await deleteDoc(doc(db, 'canvases', canvasId, 'drawings', drawingId));
};

// Migra os dados locais uma única vez após autenticação do usuário.
export const migrateLocalDataToCanvas = async (uid: string, canvasId: string, storageKey: string) => {
  const migratedFlag = `ideatasks-migrated-${uid}`;
  if (localStorage.getItem(migratedFlag) === 'true') return;

  const localData = localStorage.getItem(storageKey);
  if (!localData) {
    localStorage.setItem(migratedFlag, 'true');
    return;
  }

  try {
    const parsed = JSON.parse(localData);
    const notes: Note[] = parsed.notes || [];
    const strokes: Stroke[] = parsed.strokes || [];

    await Promise.all(notes.map((note) => upsertCard(canvasId, note, uid)));
    await Promise.all(strokes.map((stroke) => upsertDrawing(canvasId, stroke, uid)));

    localStorage.setItem(migratedFlag, 'true');
  } catch (error) {
    console.error('Falha ao migrar dados locais para Firestore:', error);
  }
};
