import React, { useState } from 'react';
import { collection, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, IS_FIREBASE } from '../firebaseConfig';

const SOURCE_COLLECTION = 'bugsescripts';
const TARGET_COLLECTION = 'jgtecnologiasauto';

export const CollectionCloneButton: React.FC = () => {
  const [isCopying, setIsCopying] = useState(false);

  if (!IS_FIREBASE || !db) {
    return null;
  }

  const handleCopyCollection = async () => {
    if (isCopying) return;

    const confirmed = window.confirm(
      `Isso vai copiar todos os documentos de "${SOURCE_COLLECTION}" para "${TARGET_COLLECTION}". Deseja continuar?`
    );

    if (!confirmed) return;

    setIsCopying(true);
    try {
      const sourceSnapshot = await getDocs(collection(db, SOURCE_COLLECTION));

      if (sourceSnapshot.empty) {
        alert(`A collection "${SOURCE_COLLECTION}" está vazia.`);
        return;
      }

      const copyPromises = sourceSnapshot.docs.map((snapshotDoc) => {
        return setDoc(
          doc(db, TARGET_COLLECTION, snapshotDoc.id),
          {
            ...snapshotDoc.data(),
            copiedAt: serverTimestamp(),
            copiedFrom: SOURCE_COLLECTION,
          },
          { merge: true }
        );
      });

      await Promise.all(copyPromises);
      alert(
        `Cópia concluída: ${sourceSnapshot.size} documento(s) de "${SOURCE_COLLECTION}" para "${TARGET_COLLECTION}".`
      );
    } catch (error) {
      console.error('Erro ao copiar collection:', error);
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
        title={`Copiar ${SOURCE_COLLECTION} -> ${TARGET_COLLECTION}`}
      >
        {isCopying ? 'Copiando...' : 'Copiar bugsescripts → jgtecnologiasauto'}
      </button>
    </div>
  );
};
