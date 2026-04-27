import React, { useEffect } from 'react';
import { Board } from './components/Board';
import { Toolbar } from './components/Toolbar';
import { TaskDashboard } from './components/TaskDashboard';
import { LoginPanel } from './components/LoginPanel';
import { CollectionCloneButton } from './components/CollectionCloneButton';
import { useBoardStore } from './store';

const App: React.FC = () => {
  const { initializeAuth, currentUser, isAuthReady } = useBoardStore();

  useEffect(() => {
    // Inicializa observador de autenticação na subida da aplicação.
    initializeAuth();
  }, [initializeAuth]);

  return (
    <div className="w-screen h-screen overflow-hidden flex flex-col relative">
      <Toolbar />
      <div className="flex-1 relative bg-gray-50 dark:bg-gray-900 overflow-hidden">
        <Board />
      </div>
      <TaskDashboard />
      <CollectionCloneButton />
      {isAuthReady && !currentUser && <LoginPanel />}
    </div>
  );
};

export default App;
