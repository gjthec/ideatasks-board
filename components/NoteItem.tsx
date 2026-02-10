
import React, { useState, useRef, useEffect } from 'react';
import { useBoardStore } from '../store';
import { Note, NoteColor, TaskStatus, ToolType, DEFAULT_JOBS } from '../types';
import { Trash2, Copy, CheckSquare, Sparkles, Loader2 } from 'lucide-react';
import { getNoteColorFromJobColor } from '../utils';

interface NoteItemProps {
  note: Note;
  onMouseDown: (e: React.PointerEvent) => void;
}

// Map specifically for border colors
const BORDER_MAP: Record<NoteColor, string> = {
  [NoteColor.YELLOW]: 'border-amber-200 dark:border-amber-800',
  [NoteColor.BLUE]: 'border-blue-200 dark:border-blue-800',
  [NoteColor.GREEN]: 'border-green-200 dark:border-green-800',
  [NoteColor.RED]: 'border-red-200 dark:border-red-800',
  [NoteColor.PURPLE]: 'border-purple-200 dark:border-purple-800',
  [NoteColor.GRAY]: 'border-gray-200 dark:border-gray-700',
};

// Background classes
const BG_MAP: Record<NoteColor, string> = {
  [NoteColor.YELLOW]: 'bg-amber-100 dark:bg-amber-900/50',
  [NoteColor.BLUE]: 'bg-blue-100 dark:bg-blue-900/50',
  [NoteColor.GREEN]: 'bg-green-100 dark:bg-green-900/50',
  [NoteColor.RED]: 'bg-red-100 dark:bg-red-900/50',
  [NoteColor.PURPLE]: 'bg-purple-100 dark:bg-purple-900/50',
  [NoteColor.GRAY]: 'bg-gray-100 dark:bg-gray-800',
};

export const NoteItem: React.FC<NoteItemProps> = ({ note, onMouseDown }) => {
  const { 
    updateNote, deleteNote, duplicateNote, 
    selectedNoteIds, tool, bringToFront,
    jobs, generateBrainstorm, isGeneratingAI
  } = useBoardStore();
  
  const isSelected = selectedNoteIds.includes(note.id);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Prevent drag when interacting with controls
  const stopPropagation = (e: React.PointerEvent | React.MouseEvent | React.ChangeEvent) => {
    e.stopPropagation();
  };

  const handleResize = (e: React.PointerEvent, corner: string) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = note.width;
    const startH = note.height;
    const zoom = useBoardStore.getState().viewport.zoom;

    const onMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / zoom;
      const dy = (moveEvent.clientY - startY) / zoom;
      
      updateNote(note.id, {
        width: Math.max(150, startW + dx),
        height: Math.max(100, startH + dy)
      });
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const activeJobs = jobs && jobs.length > 0 ? jobs : DEFAULT_JOBS;
  const currentJob = activeJobs.find(j => j.id === note.job) || activeJobs[0];

  const isDone = note.isTask && note.status === TaskStatus.DONE;
  const isGhost = isDone && !isSelected;

  const bgClass = BG_MAP[note.color];
  const borderClass = BORDER_MAP[note.color];

  return (
    <div
      id={`note-${note.id}`}
      className={`absolute flex flex-col rounded-lg shadow-sm border transition-[opacity,box-shadow,background-color,border-color,filter] duration-300 group
        ${borderClass} ${bgClass}
        ${isSelected ? 'ring-2 ring-blue-500 shadow-xl z-50' : 'hover:shadow-md'}
        ${isGhost ? 'opacity-40 hover:opacity-100 grayscale hover:grayscale-0' : 'opacity-100'}
      `}
      style={{
        transform: `translate(${note.x}px, ${note.y}px)`,
        width: note.width,
        height: note.height,
        zIndex: note.zIndex,
        pointerEvents: (tool === ToolType.PEN || tool === ToolType.ERASER) ? 'none' : 'auto'
      }}
      onPointerDown={(e) => {
        bringToFront(note.id);
        onMouseDown(e);
      }}
      onDoubleClick={() => setIsEditing(true)}
    >
      {/* Header / Drag Handle */}
      <div className="h-7 flex items-center justify-between px-2 cursor-grab active:cursor-grabbing border-b border-black/5 gap-2 relative">
        
        {/* Left Side: Job Selector */}
        <div className="flex items-center gap-1 max-w-[70%]">
             {/* Job Badge Selector */}
            <div className="relative flex items-center group/job">
                <div className={`w-2 h-2 rounded-full mr-1 ${currentJob.color} shrink-0`} />
                <select 
                    value={note.job}
                    onChange={(e) => { 
                        stopPropagation(e); 
                        const newJobId = e.target.value;
                        const newJob = activeJobs.find(j => j.id === newJobId);
                        if (newJob) {
                            // Update job and reset color to the job's default color
                            const newColor = getNoteColorFromJobColor(newJob.color);
                            updateNote(note.id, { job: newJobId, color: newColor });
                        } else {
                            updateNote(note.id, { job: newJobId });
                        }
                    }}
                    onPointerDown={(e) => stopPropagation(e)}
                    className="bg-transparent text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 outline-none cursor-pointer hover:text-gray-800 dark:hover:text-gray-200 appearance-none w-full truncate"
                >
                    {activeJobs.map(job => (
                        <option key={job.id} value={job.id}>
                            {job.name}
                        </option>
                    ))}
                </select>
            </div>
        </div>

        {/* Right Side: Actions */}
        {isSelected && (
           <div className="flex gap-1 ml-auto shrink-0">
                <button 
                    className="p-0.5 hover:bg-black/10 rounded" 
                    onPointerDown={(e) => { stopPropagation(e); duplicateNote(note.id); }}
                    title="Duplicate"
                >
                    <Copy size={12} />
                </button>
                <button 
                    className="p-0.5 hover:bg-red-500/20 text-red-600 rounded" 
                    onPointerDown={(e) => { stopPropagation(e); deleteNote(note.id); }}
                    title="Delete"
                >
                    <Trash2 size={12} />
                </button>
           </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-2 overflow-hidden relative flex flex-col">
        {note.isTask && (
             <div 
             className="flex items-center gap-2 cursor-pointer mb-2 pb-1 border-b border-black/5" 
             onClick={(e) => { stopPropagation(e as any); updateNote(note.id, { status: note.status === TaskStatus.DONE ? TaskStatus.TODO : TaskStatus.DONE }); }}
             onPointerDown={(e) => stopPropagation(e)}
           >
             <input 
               type="checkbox" 
               checked={note.status === TaskStatus.DONE} 
               readOnly 
               className="cursor-pointer"
             />
             <span className={`text-xs font-medium uppercase ${note.status === TaskStatus.DONE ? 'line-through opacity-50' : ''}`}>
               {note.status}
             </span>
           </div>
        )}

        <textarea
            ref={textAreaRef}
            className={`w-full flex-1 bg-transparent resize-none outline-none font-sans text-gray-800 dark:text-gray-100 ${note.status === TaskStatus.DONE && note.isTask ? 'line-through opacity-50' : ''}`}
            value={note.content}
            onChange={(e) => updateNote(note.id, { content: e.target.value })}
            onPointerDown={(e) => stopPropagation(e)}
            placeholder="Type something..."
            spellCheck={false}
        />
      </div>

      {/* Footer Controls */}
      <div className="h-8 flex items-center justify-between px-2 border-t border-black/5 bg-black/5 rounded-b-lg">
         <div className="flex items-center gap-1">
            <button 
                className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${note.isTask ? 'bg-blue-500 text-white' : 'hover:bg-black/10 text-gray-600 dark:text-gray-400'}`}
                onPointerDown={(e) => { stopPropagation(e); updateNote(note.id, { isTask: !note.isTask }); }}
            >
                <CheckSquare size={10} />
                Task
            </button>

            {/* AI Brainstorm Button */}
            <button 
                className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800/50 disabled:opacity-50`}
                onPointerDown={(e) => { stopPropagation(e); generateBrainstorm(note.id); }}
                disabled={isGeneratingAI}
                title="AI Brainstorm with Gemini"
            >
                {isGeneratingAI ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                AI
            </button>
         </div>

         {/* Priority Indicator */}
         {note.isTask && (
             <div className="flex gap-1 mx-2">
                 {(['low', 'medium', 'high'] as const).map(p => (
                     <div 
                        key={p} 
                        className={`w-2 h-2 rounded-full cursor-pointer ${note.priority === p ? 'ring-1 ring-black' : 'opacity-30'}`}
                        style={{ backgroundColor: p === 'high' ? 'red' : p === 'medium' ? 'orange' : 'green'}}
                        onPointerDown={(e) => { stopPropagation(e); updateNote(note.id, { priority: p }); }}
                        title={p}
                     />
                 ))}
             </div>
         )}
         
         {/* Resize Handle */}
         <div 
            className="cursor-se-resize p-1 opacity-50 hover:opacity-100 ml-auto"
            onPointerDown={(e) => handleResize(e, 'se')}
         >
             <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                 <path d="M10 10 L0 10 L10 0 Z" />
             </svg>
         </div>
      </div>
    </div>
  );
};
