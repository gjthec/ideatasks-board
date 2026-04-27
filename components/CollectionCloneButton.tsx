import React, { useState } from 'react';
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, IS_FIREBASE } from '../firebaseConfig';

const SOURCE_CANVAS_ID = 'bugsescripts';
const TARGET_CANVAS_ID = 'jgtecnologiasauto';

export const CollectionCloneButton: React.FC = () => {
  const [isCopying, setIsCopying] = useState(false);

  if (!IS_FIREBASE || !db) {
    return null;
  }

  const handleCopyCollection = async () => {
    if (isCopying) return;

    const sourcePath = `canvases/${SOURCE_CANVAS_ID}`;
    const targetPath = `canvases/${TARGET_CANVAS_ID}`;

    const confirmed = window.confirm(
      `Isso vai copiar os dados de "${sourcePath}" (documento + subcollections cards/drawings) para "${targetPath}". Deseja continuar?`
    );

    if (!confirmed) return;

    setIsCopying(true);
    try {
      const sourceCanvasRef = doc(db, 'canvases', SOURCE_CANVAS_ID);
      const targetCanvasRef = doc(db, 'canvases', TARGET_CANVAS_ID);

      const sourceCanvasSnapshot = await getDoc(sourceCanvasRef);
      if (!sourceCanvasSnapshot.exists()) {
        alert(`O documento "${sourcePath}" não existe.`);
        return;
      }

      await setDoc(
        targetCanvasRef,
        {
          ...sourceCanvasSnapshot.data(),
          canvasId: TARGET_CANVAS_ID,
          copiedAt: serverTimestamp(),
          copiedFrom: sourcePath,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      const [cardsSnapshot, drawingsSnapshot] = await Promise.all([
        getDocs(collection(db, 'canvases', SOURCE_CANVAS_ID, 'cards')),
        getDocs(collection(db, 'canvases', SOURCE_CANVAS_ID, 'drawings')),
      ]);

      const cardsPromises = cardsSnapshot.docs.map((snapshotDoc) =>
        setDoc(
          doc(db, 'canvases', TARGET_CANVAS_ID, 'cards', snapshotDoc.id),
          {
            ...snapshotDoc.data(),
            copiedAt: serverTimestamp(),
            copiedFrom: sourcePath,
          },
          { merge: true }
        )
      );

      const drawingsPromises = drawingsSnapshot.docs.map((snapshotDoc) =>
        setDoc(
          doc(db, 'canvases', TARGET_CANVAS_ID, 'drawings', snapshotDoc.id),
          {
            ...snapshotDoc.data(),
            copiedAt: serverTimestamp(),
            copiedFrom: sourcePath,
          },
          { merge: true }
        )
      );

      await Promise.all([...cardsPromises, ...drawingsPromises]);

      alert(
        `Cópia concluída para ${targetPath}: 1 documento, ${cardsSnapshot.size} card(s) e ${drawingsSnapshot.size} drawing(s).`
      );
    } catch (error) {
      console.error('Erro ao copiar canvas:', error);
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
        title={`Copiar canvases/${SOURCE_CANVAS_ID} -> canvases/${TARGET_CANVAS_ID}`}
      >
        {isCopying
          ? 'Copiando...'
          : `Copiar canvases/${SOURCE_CANVAS_ID} → canvases/${TARGET_CANVAS_ID}`}
      </button>
    </div>
  );
};
