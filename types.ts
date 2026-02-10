export type Point = { x: number; y: number };

export enum NoteColor {
  YELLOW = '#fef3c7',
  BLUE = '#dbeafe',
  GREEN = '#dcfce7',
  RED = '#fee2e2',
  PURPLE = '#f3e8ff',
  GRAY = '#f3f4f6',
}

export enum TaskStatus {
  TODO = 'todo',
  DOING = 'doing',
  DONE = 'done',
}

export enum ToolType {
  SELECT = 'select',
  HAND = 'hand',
  PEN = 'pen',
  ERASER = 'eraser',
}

export interface Job {
  id: string;
  name: string;
  color: string; // Tailwind class like 'bg-blue-600'
}

// Configuração padrão inicial
export const DEFAULT_JOBS: Job[] = [
  { id: 'job1', name: 'Empresa 1', color: 'bg-blue-600' },
  { id: 'job2', name: 'Empresa 2', color: 'bg-purple-600' },
  { id: 'job3', name: 'Empresa 3', color: 'bg-orange-600' },
];

export interface Note {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  color: NoteColor;
  isTask: boolean;
  status: TaskStatus;
  priority: 'low' | 'medium' | 'high';
  job: string; // ID do job
  zIndex: number;
}

export interface Stroke {
  id: string;
  points: Point[];
  color: string;
  size: number;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface BoardState {
  notes: Note[];
  strokes: Stroke[];
  viewport: Viewport;
  jobs: Job[]; 
  tool: ToolType;
  penColor: string;
  penSize: number;
  isDarkMode: boolean;
  selectedNoteIds: string[];
  clipboard: Note[]; 
  isDashboardOpen: boolean;
  isGeneratingAI: boolean; 
  isSyncing: boolean; // Tracking Firebase sync state
  
  // Actions
  setTool: (tool: ToolType) => void;
  setPenColor: (color: string) => void;
  setPenSize: (size: number) => void;
  toggleDarkMode: () => void;
  setDashboardOpen: (isOpen: boolean) => void;
  centerView: () => void;
  focusOnNote: (id: string) => void;
  
  addNote: (note: Note) => void;
  updateNote: (id: string, updates: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  duplicateNote: (id: string) => void;
  copySelection: () => void;
  pasteClipboard: () => void;
  selectNote: (id: string | null, multi?: boolean) => void;
  bringToFront: (id: string) => void;
  
  addJob: (name: string, color: string) => void;
  updateJobName: (id: string, name: string) => void;
  deleteJob: (id: string) => void;
  
  addStroke: (stroke: Stroke) => void;
  deleteStroke: (id: string) => void;
  clearBoard: () => void;
  
  setViewport: (viewport: Viewport) => void;
  loadBoard: (data: { notes: Note[], strokes: Stroke[], viewport: Viewport, jobs?: Job[] }) => void;

  // AI Actions
  generateBrainstorm: (noteId: string) => Promise<void>;
}