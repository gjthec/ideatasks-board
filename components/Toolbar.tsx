import React, { useRef, useState } from 'react';
import { 
  MousePointer2, Hand, Pen, Eraser, 
  StickyNote, Download, Upload, Trash2, 
  Moon, Sun, Plus, Minus, Briefcase, X,
  LayoutDashboard, Check, Trash, Scan
} from 'lucide-react';
import { useBoardStore } from '../store';
import { ToolType, NoteColor, DEFAULT_JOBS, TaskStatus } from '../types';
import { generateId, getNoteColorFromJobColor } from '../utils';

const COLORS = [
  '#000000', '#ef4444', '#22c55e', '#3b82f6', '#a855f7'
];

const JOB_COLORS = [
  'bg-blue-600', 'bg-purple-600', 'bg-green-600', 'bg-red-600', 
  'bg-orange-600', 'bg-teal-600', 'bg-pink-600', 'bg-gray-600'
];

export const Toolbar: React.FC = () => {
  const { 
    tool, setTool, 
    penColor, setPenColor, 
    penSize, setPenSize,
    addNote, clearBoard,
    viewport, setViewport, centerView,
    isDarkMode, toggleDarkMode,
    notes, strokes, jobs, 
    updateJobName, addJob, deleteJob, loadBoard,
    setDashboardOpen
  } = useBoardStore();

  const [showJobSettings, setShowJobSettings] = useState(false);
  const [newJobName, setNewJobName] = useState('');
  const [newJobColor, setNewJobColor] = useState(JOB_COLORS[0]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreateNote = () => {
    const centerX = (-viewport.x + window.innerWidth / 2) / viewport.zoom;
    const centerY = (-viewport.y + window.innerHeight / 2) / viewport.zoom;

    const currentDefaultJob = jobs[0] || DEFAULT_JOBS[0];
    const initialColor = getNoteColorFromJobColor(currentDefaultJob.color);

    addNote({
      id: generateId(),
      x: centerX - 100,
      y: centerY - 75,
      width: 200,
      height: 180,
      content: '',
      color: initialColor,
      isTask: false,
      status: TaskStatus.TODO, 
      priority: 'medium',
      job: currentDefaultJob.id,
      zIndex: 0
    });
  };

  const handleAddJob = () => {
    if (newJobName.trim()) {
      addJob(newJobName, newJobColor);
      setNewJobName('');
    }
  };

  const handleExport = () => {
    const data = { notes, strokes, viewport, jobs };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `idea-board-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.notes && json.strokes) {
          loadBoard(json);
        } else {
          alert('Invalid file format');
        }
      } catch (err) {
        alert('Failed to parse JSON');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleZoom = (delta: number) => {
    setViewport({
      ...viewport,
      zoom: Math.max(0.1, Math.min(5, viewport.zoom + delta))
    });
  };

  return (
    <>
      {/* 
         RESPONSIVE CONTAINER:
         - Mobile: bottom-4, max-w-[95vw]
         - Desktop (md): top-4, bottom-auto
      */}
      <div className="fixed bottom-4 md:top-4 md:bottom-auto left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 shadow-xl rounded-xl p-2 flex items-center gap-2 md:gap-4 border border-gray-200 dark:border-gray-700 z-50 overflow-x-auto max-w-[95vw] scrollbar-hide">
        
        {/* Tools Group */}
        <div className="flex items-center gap-1 border-r border-gray-200 dark:border-gray-700 pr-2 md:pr-3 shrink-0">
          <ToolButton 
            active={tool === ToolType.SELECT} 
            onClick={() => setTool(ToolType.SELECT)} 
            icon={<MousePointer2 size={18} />} 
            label="Select" 
          />
          <ToolButton 
            active={tool === ToolType.HAND} 
            onClick={() => setTool(ToolType.HAND)} 
            icon={<Hand size={18} />} 
            label="Pan" 
          />
          <ToolButton 
            active={false} 
            onClick={handleCreateNote} 
            icon={<StickyNote size={18} />} 
            label="Add Note" 
          />
        </div>

        {/* Drawing Group */}
        <div className="flex items-center gap-1 border-r border-gray-200 dark:border-gray-700 pr-2 md:pr-3 shrink-0">
          <ToolButton 
            active={tool === ToolType.PEN} 
            onClick={() => setTool(ToolType.PEN)} 
            icon={<Pen size={18} />} 
            label="Pen" 
          />
          <ToolButton 
            active={tool === ToolType.ERASER} 
            onClick={() => setTool(ToolType.ERASER)} 
            icon={<Eraser size={18} />} 
            label="Eraser" 
          />
          
          {tool === ToolType.PEN && (
            <div className="flex items-center gap-2 ml-2">
              {/* Hide Range on mobile to save space, or make it smaller */}
              <input 
                type="range" 
                min="1" max="20" 
                value={penSize} 
                onChange={(e) => setPenSize(parseInt(e.target.value))}
                className="w-12 md:w-16 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 hidden sm:block"
              />
              <div className="flex gap-1">
                {COLORS.map(c => (
                  <button
                    key={c}
                    className={`w-4 h-4 rounded-full border border-gray-300 ${penColor === c ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setPenColor(c)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions Group */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Zoom Controls: Often redundant on mobile with Pinch, but good for accessibility */}
          <div className="flex items-center hidden sm:flex">
              <button 
                  onClick={() => handleZoom(-0.1)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300"
                  title="Zoom Out"
              >
                  <Minus size={18} />
              </button>
              
              <button 
                onClick={centerView}
                className="text-xs text-gray-500 w-10 md:w-12 text-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded py-1 cursor-pointer"
              >
                {Math.round(viewport.zoom * 100)}%
              </button>

              <button 
                  onClick={() => handleZoom(0.1)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300"
                  title="Zoom In"
              >
                  <Plus size={18} />
              </button>
          </div>
          
          <ToolButton 
            active={false} 
            onClick={centerView} 
            icon={<Scan size={18} />} 
            label="Fit Content" 
          />
        
          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1 md:mx-2" />
          
          <ToolButton 
            active={showJobSettings} 
            onClick={() => setShowJobSettings(true)} 
            icon={<Briefcase size={18} />} 
            label="Companies" 
          />
          
           <ToolButton 
            active={false} 
            onClick={() => setDashboardOpen(true)} 
            icon={<LayoutDashboard size={18} />} 
            label="Dashboard" 
          />

          <div className="hidden sm:block">
            <ToolButton 
                active={false} 
                onClick={handleExport} 
                icon={<Download size={18} />} 
                label="Export" 
            />
          </div>

          <label className="cursor-pointer p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors hidden sm:block" title="Import JSON">
            <Upload size={18} />
            <input type="file" className="hidden" accept=".json" onChange={handleImport} ref={fileInputRef} />
          </label>
          
          <ToolButton 
            active={false} 
            onClick={toggleDarkMode} 
            icon={isDarkMode ? <Sun size={18} /> : <Moon size={18} />} 
            label="Theme" 
          />
          
          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1 md:mx-2" />

          <button 
            onClick={() => { if(confirm('Clear entire board?')) clearBoard() }}
            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            title="Clear Board"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Companies Modal - Responsive */}
      {showJobSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-[450px] border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in duration-200">
             <div className="flex justify-between items-center mb-4">
               <h2 className="text-lg font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                 <Briefcase size={20} className="text-blue-500"/> 
                 Manage Companies
               </h2>
               <button onClick={() => setShowJobSettings(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-500">
                 <X size={20} />
               </button>
             </div>
             
             {/* List Existing Jobs */}
             <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 mb-6">
               <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Existing Companies</p>
               {jobs.map((job) => (
                 <div key={job.id} className="flex items-center gap-2 group">
                    <div className={`w-4 h-4 rounded-full ${job.color} shrink-0 ring-2 ring-white dark:ring-gray-800`} />
                    <input 
                      type="text" 
                      value={job.name}
                      onChange={(e) => updateJobName(job.id, e.target.value)}
                      className="flex-1 bg-transparent border-b border-transparent focus:border-blue-500 hover:border-gray-200 dark:hover:border-gray-700 rounded-none px-1 py-1 text-sm focus:outline-none text-gray-700 dark:text-gray-200"
                      placeholder="Company Name"
                    />
                    {jobs.length > 1 && (
                      <button 
                        onClick={() => { if(confirm('Delete company? Tasks will be moved to default.')) deleteJob(job.id) }}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                      >
                        <Trash size={14} />
                      </button>
                    )}
                 </div>
               ))}
             </div>

             {/* Add New Job */}
             <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Add New Company</p>
                <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide">
                   {JOB_COLORS.map(color => (
                     <button
                        key={color}
                        onClick={() => setNewJobColor(color)}
                        className={`w-5 h-5 rounded-full shrink-0 ${color} ${newJobColor === color ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-800' : 'opacity-70 hover:opacity-100'} transition-all`}
                     />
                   ))}
                </div>
                <div className="flex gap-2">
                   <input 
                     type="text" 
                     value={newJobName}
                     onChange={(e) => setNewJobName(e.target.value)}
                     className="flex-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full"
                     placeholder="New Company..."
                   />
                   <button 
                     onClick={handleAddJob}
                     disabled={!newJobName.trim()}
                     className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center gap-1"
                   >
                     <Plus size={16} /> Add
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}
    </>
  );
};

const ToolButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    title={label}
    className={`p-2 rounded transition-colors shrink-0 ${
      active 
        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300' 
        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
    }`}
  >
    {icon}
  </button>
);