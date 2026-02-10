import React, { useMemo, useState } from 'react';
import { useBoardStore } from '../store';
import { X, CheckCircle, Circle, LayoutDashboard, Search, List, Kanban, Target } from 'lucide-react';
import { TaskStatus, DEFAULT_JOBS } from '../types';

export const TaskDashboard: React.FC = () => {
  const { notes, jobs, isDashboardOpen, setDashboardOpen, updateNote, focusOnNote } = useBoardStore();
  const [activeTab, setActiveTab] = useState<'board' | 'list'>('board');
  const [searchTerm, setSearchTerm] = useState('');

  const groupedTasks = useMemo(() => {
    // Apenas notas que são tarefas
    const tasks = notes.filter(n => n.isTask);
    
    return jobs.map(job => {
        const jobTasks = tasks.filter(t => t.job === job.id);
        const total = jobTasks.length;
        const done = jobTasks.filter(t => t.status === TaskStatus.DONE).length;
        const progress = total > 0 ? Math.round((done / total) * 100) : 0;
        
        return {
            job,
            tasks: jobTasks,
            stats: { total, done, progress }
        };
    });
  }, [notes, jobs]);

  // Lista plana de todas as notas (tarefas ou não) para a aba 'list'
  const filteredNotes = useMemo(() => {
      const lowerSearch = searchTerm.toLowerCase();
      return notes.filter(n => {
          const contentMatch = n.content.toLowerCase().includes(lowerSearch);
          // Opcional: filtrar por nome da empresa também?
          const jobName = (jobs.find(j => j.id === n.job)?.name || '').toLowerCase();
          return contentMatch || jobName.includes(lowerSearch);
      }).sort((a, b) => {
          // Tarefas primeiro, depois notas normais
          if (a.isTask && !b.isTask) return -1;
          if (!a.isTask && b.isTask) return 1;
          return 0;
      });
  }, [notes, jobs, searchTerm]);

  if (!isDashboardOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] backdrop-blur-sm flex justify-end">
        {/* Changed width here: w-full for mobile, md:max-w-md for desktop */}
        <div className="w-full md:max-w-md bg-white dark:bg-gray-900 h-full shadow-2xl border-l border-gray-200 dark:border-gray-800 animate-in slide-in-from-right duration-300 flex flex-col">
            
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                            <LayoutDashboard size={24} className="text-blue-500" />
                            Dashboard
                        </h2>
                    </div>
                    <button 
                        onClick={() => setDashboardOpen(false)}
                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full text-gray-500 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Tab Switcher */}
                <div className="flex bg-gray-200 dark:bg-gray-800 p-1 rounded-lg">
                    <button 
                        onClick={() => setActiveTab('board')}
                        className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'board' ? 'bg-white dark:bg-gray-700 shadow text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                    >
                        <Kanban size={16} /> By Company
                    </button>
                    <button 
                        onClick={() => setActiveTab('list')}
                        className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'list' ? 'bg-white dark:bg-gray-700 shadow text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                    >
                        <List size={16} /> All Notes
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                
                {/* --- TAB: BOARD (COMPANIES) --- */}
                {activeTab === 'board' && (
                    <div className="space-y-8">
                        {groupedTasks.map(({ job, tasks, stats }) => (
                            <div key={job.id} className="animate-in fade-in duration-500">
                                {/* Company Header */}
                                <div className="flex items-center gap-3 mb-3 sticky top-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur py-2 z-10">
                                    <div className={`w-3 h-8 rounded-full ${job.color}`} />
                                    <div className="flex-1">
                                        <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{job.name}</h3>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <span>{stats.done}/{stats.total} Done</span>
                                            <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full max-w-[100px] overflow-hidden">
                                                <div 
                                                    className={`h-full ${job.color} transition-all duration-500`} 
                                                    style={{ width: `${stats.progress}%` }}
                                                />
                                            </div>
                                            <span>{stats.progress}%</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Task List */}
                                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-1 border border-gray-100 dark:border-gray-800">
                                    {tasks.length === 0 ? (
                                        <div className="p-4 text-center text-sm text-gray-400 italic">
                                            No tasks for this company yet.
                                        </div>
                                    ) : (
                                        <ul className="space-y-0.5">
                                            {tasks.map(task => (
                                                <li 
                                                    key={task.id}
                                                    className="group flex items-start gap-3 p-3 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
                                                >
                                                    <button 
                                                        className={`mt-0.5 shrink-0 ${task.status === TaskStatus.DONE ? 'text-green-500' : 'text-gray-300 dark:text-gray-600 group-hover:text-blue-500'}`}
                                                        onClick={(e) => { e.stopPropagation(); updateNote(task.id, { status: task.status === TaskStatus.DONE ? TaskStatus.TODO : TaskStatus.DONE }); }}
                                                    >
                                                        {task.status === TaskStatus.DONE ? <CheckCircle size={18} /> : <Circle size={18} />}
                                                    </button>
                                                    
                                                    <span 
                                                        className={`flex-1 text-sm leading-relaxed ${task.status === TaskStatus.DONE ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-200'}`}
                                                        onClick={() => focusOnNote(task.id)}
                                                    >
                                                        {task.content || <span className="italic text-gray-400">Empty task...</span>}
                                                    </span>
                                                    
                                                    {/* Jump Button */}
                                                    <button
                                                        onClick={() => focusOnNote(task.id)}
                                                        className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-500 rounded transition-all"
                                                        title="Jump to note"
                                                    >
                                                        <Target size={14} />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* --- TAB: LIST (ALL NOTES) --- */}
                {activeTab === 'list' && (
                    <div className="h-full flex flex-col animate-in fade-in duration-300">
                         {/* Search Bar */}
                         <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input 
                                type="text" 
                                placeholder="Search all notes..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-gray-100 dark:bg-gray-800 border-none rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                         </div>

                         {/* Flat List */}
                         <div className="space-y-2 pb-20">
                            {filteredNotes.length === 0 ? (
                                <div className="text-center text-gray-500 mt-10">
                                    No notes found matching "{searchTerm}".
                                </div>
                            ) : (
                                filteredNotes.map(note => {
                                    const job = jobs.find(j => j.id === note.job) || DEFAULT_JOBS[0];
                                    return (
                                        <div 
                                            key={note.id}
                                            onClick={() => focusOnNote(note.id)}
                                            className="group bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500 cursor-pointer transition-all flex gap-3"
                                        >
                                            <div className={`w-1 self-stretch rounded-full ${job.color}`} />
                                            <div className="flex-1 overflow-hidden">
                                                <div className="flex justify-between items-start">
                                                    <span className="text-[10px] uppercase font-bold text-gray-400 mb-1">{job.name}</span>
                                                    {note.isTask && (
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${note.status === TaskStatus.DONE ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                                            {note.status}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-800 dark:text-gray-200 truncate">
                                                    {note.content || <span className="italic text-gray-400">Empty note</span>}
                                                </p>
                                            </div>
                                            <div className="self-center opacity-100 md:opacity-0 md:group-hover:opacity-100 text-blue-500">
                                                <Target size={16} />
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                         </div>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};