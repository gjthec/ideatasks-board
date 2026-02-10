import React from 'react';
import { Board } from './components/Board';
import { Toolbar } from './components/Toolbar';
import { TaskDashboard } from './components/TaskDashboard';

const App: React.FC = () => {
  return (
    <div className="w-screen h-screen overflow-hidden flex flex-col relative">
      <Toolbar />
      <div className="flex-1 relative bg-gray-50 dark:bg-gray-900 overflow-hidden">
        <Board />
      </div>
      <TaskDashboard />
    </div>
  );
};

export default App;