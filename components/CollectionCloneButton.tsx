import React, { useState } from 'react';
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, IS_FIREBASE } from '../firebaseConfig';

const SOURCE_CANVAS_PATH = 'canvases/bugsescripts';
const TARGET_CANVAS_PATH = 'canvases/jgtecnologiasauto';

const getCanvasIdFromPath = (path: string) => path.split('/').filter(Boolean).at(-1) || '';

export const CollectionCloneButton: React.FC = () => {
  const [isCopying, setIsCopying] = useState(false);

  if (!IS_FIREBASE || !db) {
    return null;
  }

  const handleCopyCollection = async () => {
    if (isCopying) return;

    const confirmed = window.confirm(
      `Isso vai copiar os dados de "${SOURCE_CANVAS_PATH}" (documento + subcollections cards/drawings) para "${TARGET_CANVAS_PATH}". Deseja continuar?`
    );

    if (!confirmed) return;

    setIsCopying(true);
    try {
      const sourceCanvasRef = doc(db, SOURCE_CANVAS_PATH);
      const targetCanvasRef = doc(db, TARGET_CANVAS_PATH);
      const targetCanvasId = getCanvasIdFromPath(TARGET_CANVAS_PATH);

      const sourceCanvasSnapshot = await getDoc(sourceCanvasRef);
      if (!sourceCanvasSnapshot.exists()) {
        alert(`O documento "${SOURCE_CANVAS_PATH}" não existe.`);
        return;
      }

      await setDoc(
        targetCanvasRef,
        {
          ...sourceCanvasSnapshot.data(),
          canvasId: targetCanvasId,
          copiedAt: serverTimestamp(),
          copiedFrom: SOURCE_CANVAS_PATH,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      const [cardsSnapshot, drawingsSnapshot] = await Promise.all([
        getDocs(collection(sourceCanvasRef, 'cards')),
        getDocs(collection(sourceCanvasRef, 'drawings')),
      ]);

      const cardsPromises = cardsSnapshot.docs.map((snapshotDoc) =>
        setDoc(
          doc(targetCanvasRef, 'cards', snapshotDoc.id),
          {
            ...snapshotDoc.data(),
            copiedAt: serverTimestamp(),
            copiedFrom: SOURCE_CANVAS_PATH,
          },
          { merge: true }
        )
      );

      const drawingsPromises = drawingsSnapshot.docs.map((snapshotDoc) =>
        setDoc(
          doc(targetCanvasRef, 'drawings', snapshotDoc.id),
          {
            ...snapshotDoc.data(),
            copiedAt: serverTimestamp(),
            copiedFrom: SOURCE_CANVAS_PATH,
          },
          { merge: true }
        )
      );

      await Promise.all([...cardsPromises, ...drawingsPromises]);

      alert(
        `Cópia concluída para ${TARGET_CANVAS_PATH}: 1 documento, ${cardsSnapshot.size} card(s) e ${drawingsSnapshot.size} drawing(s).`
      );
    } catch (error) {
      console.error('Erro ao copiar canvas/subcollections:', error);
      alert('Falha ao copiar os documentos. Verifique permissões do Firestore e tente novamente.');
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-40 flex items-center justify-center">
      <button
        type="button"
        onClick={handleCopyCollection}
        disabled={isCopying}
        className="pointer-events-auto px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold shadow-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
        title={`Copiar ${SOURCE_CANVAS_PATH} -> ${TARGET_CANVAS_PATH}`}
      >
        {isCopying ? 'Copiando...' : `Copiar ${SOURCE_CANVAS_PATH} → ${TARGET_CANVAS_PATH}`}
      </button>
    </div>
  );
};
