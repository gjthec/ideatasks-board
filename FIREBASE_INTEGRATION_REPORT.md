# Relatório de Estrutura + Plano de Integração Firebase

## TASK-04 — Análise da estrutura atual

- **Framework detectado:** React + TypeScript + Zustand + Vite.
- **Tema dark/light:** controlado por `isDarkMode` no `store.ts` e toggle em `components/Toolbar.tsx`.
- **Criação/renderização de cards:** criação no `components/Toolbar.tsx` (`handleCreateNote`), render em `components/Board.tsx` com `NoteItem`.
- **Zoom/pan:** controlado em `components/Board.tsx` (`handleWheel`, gesto touch, pan por ponteiro) e exibido na toolbar.
- **Cores dos cards:** definidas por `NoteColor` e helper `getNoteColorFromJobColor` em `utils.ts`.
- **Firebase existente:** havia Firestore básico em `firebaseConfig.ts` e sync único em `store.ts` (`ideatasks/board_main`).
- **Autenticação existente:** não havia fluxo de login/logout/autorização.
- **Persistência local:** fallback em `localStorage` via `STORAGE_KEY` no `store.ts`.
- **Event listeners da toolbar:** ferramentas, zoom, import/export, clear board, dark mode, modal de companies.

## Estratégia aplicada por task

1. **TASK-01 (Preferências)**
   - Novo serviço `userPreferencesService.ts` com `ensure`, `save` (merge) e `onSnapshot`.
   - Salva `theme`, `lastCardColor`, `lastZoomLevel`, `canvasOffset`, `defaultCardStatus` com debounce de 1000ms.
2. **TASK-02 (Multiusuário)**
   - Novo `authService.ts` com email/senha, Google e `onAuthStateChanged`.
   - Criação/atualização de `users/{uid}` após login.
   - Novo `canvasService.ts` para `canvases/{canvasId}` + subcollections `cards` e `drawings`.
3. **TASK-03 (Realtime)**
   - `onSnapshot` em `cards` e `drawings` por canvas ativo.
   - `unsubscribe` no logout/troca de usuário.
   - Sincronização otimista local → remoto.

## Regras de segurança Firestore

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    match /userPreferences/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    match /canvases/{canvasId} {
      allow read, write: if request.auth != null && (
        resource.data.ownerUid == request.auth.uid ||
        request.auth.uid in resource.data.members
      );

      match /cards/{cardId} {
        allow read, write: if request.auth != null;
      }

      match /drawings/{drawingId} {
        allow read, write: if request.auth != null;
      }
    }
  }
}
```

## Instruções de migração localStorage -> Firebase

1. Usuário autentica pela primeira vez.
2. App chama `migrateLocalDataToCanvas(uid, canvasId, STORAGE_KEY)`.
3. Dados de `notes` e `strokes` do localStorage são enviados para subcollections.
4. Flag `ideatasks-migrated-{uid}=true` evita remigração.
5. A partir disso, o estado passa a ser mantido por snapshots do Firestore.
