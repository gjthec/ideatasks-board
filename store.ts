import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { BoardState, Note, NoteColor, Stroke, TaskStatus, ToolType, Viewport, DEFAULT_JOBS } from './types';
import { db, IS_FIREBASE } from './firebaseConfig';
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };
const STORAGE_KEY = 'ideatasks-board-v1';

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

export const useBoardStore = create<BoardState>()(
  subscribeWithSelector((setStore, get) => ({
    notes: [],
    strokes: [],
    jobs: DEFAULT_JOBS,
    viewport: DEFAULT_VIEWPORT,
    tool: ToolType.SELECT,
    penColor: '#000000',
    penSize: 3,
    isDarkMode: false,
    selectedNoteIds: [],
    clipboard: [],
    isDashboardOpen: false,
    isGeneratingAI: false,
    isSyncing: false,

    setTool: (tool) => setStore({ tool, selectedNoteIds: [] }),
    setPenColor: (penColor) => setStore({ penColor }),
    setPenSize: (penSize) => setStore({ penSize }),
    toggleDarkMode: () => setStore((state) => ({ isDarkMode: !state.isDarkMode })),
    setDashboardOpen: (isOpen) => setStore({ isDashboardOpen: isOpen }),

    centerView: () => setStore((state) => {
        if (state.notes.length === 0 && state.strokes.length === 0) {
            return { viewport: DEFAULT_VIEWPORT };
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        state.notes.forEach(n => {
            minX = Math.min(minX, n.x);
            minY = Math.min(minY, n.y);
            maxX = Math.max(maxX, n.x + n.width);
            maxY = Math.max(maxY, n.y + n.height);
        });

        state.strokes.forEach(s => {
            s.points.forEach(p => {
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            });
        });

        if (minX === Infinity) return { viewport: DEFAULT_VIEWPORT };

        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;
        const padding = 100;
        
        const windowW = window.innerWidth;
        const windowH = window.innerHeight;

        let zoom = Math.min(
            (windowW - padding * 2) / contentWidth,
            (windowH - padding * 2) / contentHeight
        );

        zoom = Math.min(Math.max(zoom, 0.1), 1);

        const contentCenterX = minX + contentWidth / 2;
        const contentCenterY = minY + contentHeight / 2;
        
        const newX = (windowW / 2) - (contentCenterX * zoom);
        const newY = (windowH / 2) - (contentCenterY * zoom);

        return {
            viewport: { x: newX, y: newY, zoom }
        };
    }),

    focusOnNote: (id) => setStore((state) => {
        const note = state.notes.find(n => n.id === id);
        if (!note) return {};

        const windowW = window.innerWidth;
        const windowH = window.innerHeight;
        const targetZoom = Math.max(state.viewport.zoom, 0.8);
        const noteCenterX = note.x + note.width / 2;
        const noteCenterY = note.y + note.height / 2;

        const newX = (windowW / 2) - (noteCenterX * targetZoom);
        const newY = (windowH / 2) - (noteCenterY * targetZoom);

        return {
            viewport: { x: newX, y: newY, zoom: targetZoom },
            selectedNoteIds: [id],
            isDashboardOpen: false
        };
    }),

    addNote: (note) => setStore((state) => ({ 
      notes: [...state.notes, { ...note, zIndex: state.notes.length + 1 }],
      selectedNoteIds: [note.id],
      tool: ToolType.SELECT
    })),

    updateNote: (id, updates) => setStore((state) => ({
      notes: state.notes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    })),

    deleteNote: (id) => setStore((state) => ({
      notes: state.notes.filter((n) => n.id !== id),
      selectedNoteIds: state.selectedNoteIds.filter((sid) => sid !== id),
    })),

    duplicateNote: (id) => setStore((state) => {
      const noteToCopy = state.notes.find((n) => n.id === id);
      if (!noteToCopy) return {};
      
      const newNote: Note = {
        ...noteToCopy,
        id: generateId(),
        x: noteToCopy.x + 20,
        y: noteToCopy.y + 20,
        zIndex: state.notes.length + 1,
      };
      
      return { notes: [...state.notes, newNote], selectedNoteIds: [newNote.id] };
    }),

    copySelection: () => setStore((state) => {
        const selected = state.notes.filter(n => state.selectedNoteIds.includes(n.id));
        if (selected.length === 0) return {};
        return { clipboard: selected.map(n => ({...n})) };
    }),

    pasteClipboard: () => setStore((state) => {
        if (state.clipboard.length === 0) return {};

        const newNotes: Note[] = state.clipboard.map((note) => ({
            ...note,
            id: generateId(),
            x: note.x + 20,
            y: note.y + 20,
            zIndex: state.notes.length + 1
        }));

        return {
            notes: [...state.notes, ...newNotes],
            selectedNoteIds: newNotes.map(n => n.id),
            clipboard: state.clipboard.map(n => ({ ...n, x: n.x + 20, y: n.y + 20 }))
        };
    }),

    selectNote: (id, multi = false) => setStore((state) => {
      if (id === null) return { selectedNoteIds: [] };
      if (multi) {
        return { 
          selectedNoteIds: state.selectedNoteIds.includes(id) 
            ? state.selectedNoteIds.filter(sid => sid !== id)
            : [...state.selectedNoteIds, id]
        };
      }
      return { selectedNoteIds: [id] };
    }),

    bringToFront: (id) => setStore((state) => {
        const maxZ = Math.max(...state.notes.map(n => n.zIndex), 0);
        return {
            notes: state.notes.map(n => n.id === id ? { ...n, zIndex: maxZ + 1 } : n)
        }
    }),

    addJob: (name, color) => setStore((state) => ({
      jobs: [...state.jobs, { id: generateId(), name, color }]
    })),

    updateJobName: (id, name) => setStore((state) => ({
        jobs: state.jobs.map(j => j.id === id ? { ...j, name } : j)
    })),

    deleteJob: (id) => setStore((state) => ({
      jobs: state.jobs.filter(j => j.id !== id),
      notes: state.notes.map(n => n.job === id ? { ...n, job: state.jobs[0]?.id || 'default' } : n)
    })),

    addStroke: (stroke) => setStore((state) => ({ strokes: [...state.strokes, stroke] })),
    
    deleteStroke: (id) => setStore((state) => ({
      strokes: state.strokes.filter((s) => s.id !== id),
    })),

    clearBoard: () => setStore({ notes: [], strokes: [], viewport: DEFAULT_VIEWPORT }),

    setViewport: (viewport) => setStore({ viewport }),

    loadBoard: (data) => setStore({
      notes: data.notes || [],
      strokes: data.strokes || [],
      viewport: data.viewport || DEFAULT_VIEWPORT,
      jobs: data.jobs || DEFAULT_JOBS
    }),

    generateBrainstorm: async (noteId) => {
      const state = get();
      const note = state.notes.find(n => n.id === noteId);
      if (!note || state.isGeneratingAI) return;

      setStore({ isGeneratingAI: true });

      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response: GenerateContentResponse = await ai.models.generateContent({
          model: 'gemini-3-pro-preview',
          contents: `Brainstorm and expand upon the following idea: "${note.content}". Provide 3 concise suggestions or related tasks.`,
          config: {
            systemInstruction: "You are a creative productivity assistant. Keep suggestions brief and actionable."
          }
        });

        const aiText = response.text;
        if (aiText) {
          const updatedContent = note.content + "\n\n--- AI Brainstorm ---\n" + aiText;
          state.updateNote(noteId, { content: updatedContent });
        }
      } catch (error) {
        console.error("Gemini AI brainstorm failed:", error);
      } finally {
        setStore({ isGeneratingAI: false });
      }
    }
  }))
);

// --- PERSISTENCE LOGIC (FIRESTORE) ---

let isExternalUpdate = false;

if (IS_FIREBASE && db) {
    const boardDocRef = doc(db, 'ideatasks', 'board_main');

    // Subscribe to Firestore changes (onSnapshot)
    onSnapshot(boardDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            isExternalUpdate = true;
            useBoardStore.getState().loadBoard({
                notes: data.notes || [],
                strokes: data.strokes || [],
                viewport: data.viewport || DEFAULT_VIEWPORT,
                jobs: data.jobs || DEFAULT_JOBS
            });
            isExternalUpdate = false;
        }
    }, (error) => {
        console.error("Firestore Listen Error:", error);
    });

    // Push local changes to Firestore
    let syncTimeout: any = null;
    useBoardStore.subscribe(
        (state) => ({ 
            notes: state.notes, 
            strokes: state.strokes, 
            viewport: state.viewport, 
            jobs: state.jobs 
        }),
        (data) => {
            if (isExternalUpdate) return;
            if (syncTimeout) clearTimeout(syncTimeout);
            
            useBoardStore.setState({ isSyncing: true });
            
            syncTimeout = setTimeout(() => {
                if (db) {
                    setDoc(boardDocRef, data, { merge: true })
                        .then(() => useBoardStore.setState({ isSyncing: false }))
                        .catch((err) => {
                            console.error("Firestore Sync Error:", err);
                            useBoardStore.setState({ isSyncing: false });
                        });
                }
            }, 800);
        },
        { equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b) }
    );
} else {
    // LocalStorage Fallback
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
        try {
            const parsed = JSON.parse(savedState);
            useBoardStore.getState().loadBoard(parsed);
        } catch(e) {
            console.error("LocalStorage load error", e);
        }
    }

    useBoardStore.subscribe(
        (state) => ({ 
            notes: state.notes, 
            strokes: state.strokes, 
            viewport: state.viewport, 
            jobs: state.jobs 
        }),
        (data) => { 
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); 
        },
        { equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b) }
    );
}

// Dark Mode Persistence
if (localStorage.getItem('ideatasks-darkmode') === 'true') {
    useBoardStore.setState({ isDarkMode: true });
}
useBoardStore.subscribe(
    (state) => state.isDarkMode,
    (isDark) => {
        localStorage.setItem('ideatasks-darkmode', String(isDark));
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }
);