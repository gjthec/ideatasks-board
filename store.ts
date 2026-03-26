import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  BoardState,
  Note,
  Point,
  Stroke,
  TaskStatus,
  ToolType,
  Viewport,
  DEFAULT_JOBS,
} from './types';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { IS_FIREBASE } from './firebaseConfig';
import { authService } from './authService';
import {
  DEFAULT_USER_PREFERENCES,
  UserPreferences,
  ensureUserPreferences,
  saveUserPreferences,
  subscribeToUserPreferences,
} from './userPreferencesService';
import {
  deleteCard,
  deleteDrawing,
  getOrCreateUserCanvas,
  migrateLocalDataToCanvas,
  subscribeCanvasRealtime,
  upsertCard,
  upsertCanvasJobs,
  upsertDrawing,
} from './canvasService';

const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };
const STORAGE_KEY = 'ideatasks-board-v1';

const generateId = () => Math.random().toString(36).substr(2, 9);

const isTaskStatus = (status: unknown): status is TaskStatus =>
  status === TaskStatus.TODO || status === TaskStatus.DOING || status === TaskStatus.DONE;

const NOTE_COLORS = new Set(['#fef3c7', '#dbeafe', '#dcfce7', '#fee2e2', '#f3e8ff', '#f3f4f6']);
const normalizeNoteColor = (value: unknown): Note['color'] => {
  if (typeof value !== 'string') return '#fef3c7' as Note['color'];
  const normalized = value.trim().toLowerCase();
  return (NOTE_COLORS.has(normalized) ? normalized : '#fef3c7') as Note['color'];
};

const normalizeViewport = (input: any): Viewport => {
  const x = Number(input?.x);
  const y = Number(input?.y);
  const zoom = Number(input?.zoom);
  return {
    x: Number.isFinite(x) ? x : DEFAULT_VIEWPORT.x,
    y: Number.isFinite(y) ? y : DEFAULT_VIEWPORT.y,
    zoom: Number.isFinite(zoom) ? Math.max(0.1, Math.min(5, zoom)) : DEFAULT_VIEWPORT.zoom,
  };
};

const normalizeJobs = (jobsRaw: any): BoardState['jobs'] => {
  if (!Array.isArray(jobsRaw)) return DEFAULT_JOBS;
  const jobs = jobsRaw
    .map((job: any, index: number) => {
      const rawName = job?.name ?? job?.companyName ?? job?.label;
      return {
        id: typeof job?.id === 'string' && job.id ? job.id : generateId(),
        name: typeof rawName === 'string' && rawName.trim() ? rawName.trim() : `Empresa ${index + 1}`,
        color: typeof job?.color === 'string' && job.color ? job.color : 'bg-blue-600',
      };
    })
    .filter((job: any) => job.id);
  return jobs.length ? jobs : DEFAULT_JOBS;
};

const migrateImportedJson = (data: any) => {
  if (!data || typeof data !== 'object') return null;

  const notesSource = Array.isArray(data.notes)
    ? data.notes
    : Array.isArray(data.cards)
      ? data.cards
      : [];
  const strokesSource = Array.isArray(data.strokes)
    ? data.strokes
    : Array.isArray(data.drawings)
      ? data.drawings
      : [];
  const jobs = normalizeJobs(data.jobs);
  const fallbackJobId = jobs[0]?.id || DEFAULT_JOBS[0].id;

  const notes: Note[] = notesSource
    .filter((note: any) => note && typeof note === 'object')
    .map((note: any, index: number) => {
      const x = Number(note.x ?? note.position?.x ?? note.posX);
      const y = Number(note.y ?? note.position?.y ?? note.posY);
      const width = Number(note.width ?? note.size?.width ?? note.w);
      const height = Number(note.height ?? note.size?.height ?? note.h);
      const status = note.status ?? note.taskStatus;
      return {
        id: typeof note.id === 'string' && note.id ? note.id : generateId(),
        x: Number.isFinite(x) ? x : 0,
        y: Number.isFinite(y) ? y : 0,
        width: Number.isFinite(width) ? Math.max(150, width) : 200,
        height: Number.isFinite(height) ? Math.max(100, height) : 180,
        content: typeof note.content === 'string' ? note.content : typeof note.text === 'string' ? note.text : '',
        color: normalizeNoteColor(note.color),
        isTask: typeof note.isTask === 'boolean' ? note.isTask : Boolean(note.task),
        status: isTaskStatus(status) ? status : TaskStatus.TODO,
        priority: note.priority === 'low' || note.priority === 'high' ? note.priority : 'medium',
        job: typeof note.job === 'string' && note.job ? note.job : fallbackJobId,
        zIndex: Number.isFinite(Number(note.zIndex)) ? Number(note.zIndex) : index + 1,
      };
    });

  const strokes: Stroke[] = strokesSource
    .filter((stroke: any) => stroke && typeof stroke === 'object')
    .map((stroke: any) => {
      const pointsSource = Array.isArray(stroke.points)
        ? stroke.points
        : Array.isArray(stroke.path)
          ? stroke.path
          : [];
      const points = pointsSource
        .map((p: any) => ({
          x: Number(p?.x),
          y: Number(p?.y),
        }))
        .filter((p: Point) => Number.isFinite(p.x) && Number.isFinite(p.y));
      return {
        id: typeof stroke.id === 'string' && stroke.id ? stroke.id : generateId(),
        points,
        color: typeof stroke.color === 'string' && stroke.color ? stroke.color : '#000000',
        size: Number.isFinite(Number(stroke.size)) ? Math.max(1, Number(stroke.size)) : 3,
      };
    })
    .filter((stroke: Stroke) => stroke.points.length > 0);

  if (!Array.isArray(data.notes) && !Array.isArray(data.cards) && !Array.isArray(data.strokes) && !Array.isArray(data.drawings)) {
    return null;
  }

  return {
    notes,
    strokes,
    viewport: normalizeViewport(data.viewport),
    jobs,
  };
};

let syncUnsubscribe: (() => void) | null = null;
let prefsUnsubscribe: (() => void) | null = null;
let authUnsubscribe: (() => void) | null = null;
let isApplyingRemoteState = false;
let prefDebounce: ReturnType<typeof setTimeout> | null = null;
let boardSyncDebounce: ReturnType<typeof setTimeout> | null = null;

const applyTheme = (isDark: boolean) => {
  if (isDark) document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
};



// Corrige freeze: sincroniza board somente após ações locais (debounce),
// evitando loop de escrita causado por snapshots remotos.
const scheduleBoardSync = () => {
  if (!IS_FIREBASE || isApplyingRemoteState) return;

  if (boardSyncDebounce) clearTimeout(boardSyncDebounce);
  boardSyncDebounce = setTimeout(async () => {
    const state = useBoardStore.getState();
    const user = state.currentUser;
    const canvasId = state.activeCanvasId;

    if (!user || !canvasId || isApplyingRemoteState) return;

    useBoardStore.setState({ isSyncing: true });
    try {
      await Promise.all(state.notes.map((note) => upsertCard(canvasId, note, user.uid)));
      await Promise.all(state.strokes.map((stroke) => upsertDrawing(canvasId, stroke, user.uid)));
      await upsertCanvasJobs(canvasId, state.jobs);

      const localNoteIds = new Set(state.notes.map((n) => n.id));
      const localStrokeIds = new Set(state.strokes.map((st) => st.id));
      const previousState = (globalThis as any).__ideatasks_prev_state as { notes: Note[]; strokes: Stroke[] } | undefined;

      if (previousState) {
        await Promise.all(previousState.notes.filter((n) => !localNoteIds.has(n.id)).map((n) => deleteCard(canvasId, n.id)));
        await Promise.all(previousState.strokes.filter((st) => !localStrokeIds.has(st.id)).map((st) => deleteDrawing(canvasId, st.id)));
      }

      (globalThis as any).__ideatasks_prev_state = { notes: state.notes, strokes: state.strokes };
    } finally {
      useBoardStore.setState({ isSyncing: false });
    }
  }, 800);
};
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
    currentUser: null,
    isAuthReady: false,
    activeCanvasId: null,
    lastCardColor: DEFAULT_USER_PREFERENCES.lastCardColor,
    defaultCardStatus: TaskStatus.TODO,

    setTool: (tool) => setStore({ tool, selectedNoteIds: [] }),
    setPenColor: (penColor) => setStore({ penColor }),
    setPenSize: (penSize) => setStore({ penSize }),
    toggleDarkMode: () => setStore((state) => ({ isDarkMode: !state.isDarkMode })),
    setDashboardOpen: (isOpen) => setStore({ isDashboardOpen: isOpen }),
    setLastCardColor: (color) => setStore({ lastCardColor: color }),
    setDefaultCardStatus: (status) => setStore({ defaultCardStatus: status }),

    initializeAuth: () => {
      if (authUnsubscribe) return;

      if (!IS_FIREBASE) {
        const savedState = localStorage.getItem(STORAGE_KEY);
        if (savedState) {
          try {
            get().loadBoard(JSON.parse(savedState));
          } catch (error) {
            console.error('LocalStorage load error', error);
          }
        }
        const dark = localStorage.getItem('ideatasks-darkmode') === 'true';
        setStore({ isDarkMode: dark, isAuthReady: true });
        applyTheme(dark);
        return;
      }

      authUnsubscribe = authService.onAuthChange(async (user) => {
        if (!user) {
          syncUnsubscribe?.();
          prefsUnsubscribe?.();
          syncUnsubscribe = null;
          prefsUnsubscribe = null;
          setStore({
            currentUser: null,
            activeCanvasId: null,
            notes: [],
            strokes: [],
            viewport: DEFAULT_VIEWPORT,
            isAuthReady: true,
          });
          return;
        }

        setStore({ currentUser: user, isAuthReady: true });

        const prefs = await ensureUserPreferences(user.uid);
        const isDark = prefs.theme === 'dark';
        isApplyingRemoteState = true;
        setStore({
          isDarkMode: isDark,
          lastCardColor: prefs.lastCardColor,
          defaultCardStatus: (prefs.defaultCardStatus as TaskStatus) || TaskStatus.TODO,
          viewport: {
            x: prefs.canvasOffset?.x ?? 0,
            y: prefs.canvasOffset?.y ?? 0,
            zoom: prefs.lastZoomLevel || 1,
          },
        });
        isApplyingRemoteState = false;
        applyTheme(isDark);

        prefsUnsubscribe?.();
        prefsUnsubscribe = subscribeToUserPreferences(user.uid, (remotePrefs: UserPreferences) => {
          if (isApplyingRemoteState) return;
          isApplyingRemoteState = true;
          setStore({
            isDarkMode: remotePrefs.theme === 'dark',
            lastCardColor: remotePrefs.lastCardColor,
            defaultCardStatus: (remotePrefs.defaultCardStatus as TaskStatus) || TaskStatus.TODO,
            viewport: {
              ...get().viewport,
              x: remotePrefs.canvasOffset?.x ?? get().viewport.x,
              y: remotePrefs.canvasOffset?.y ?? get().viewport.y,
              zoom: remotePrefs.lastZoomLevel || get().viewport.zoom,
            },
          });
          isApplyingRemoteState = false;
          applyTheme(remotePrefs.theme === 'dark');
        });

        const canvasId = await getOrCreateUserCanvas(user.uid, user.email);
        if (!canvasId) return;

        await migrateLocalDataToCanvas(user.uid, canvasId, STORAGE_KEY);
        setStore({ activeCanvasId: canvasId });

        syncUnsubscribe?.();
        syncUnsubscribe = subscribeCanvasRealtime(
          canvasId,
          (cards) => {
            isApplyingRemoteState = true;
            setStore({ notes: cards });
            (globalThis as any).__ideatasks_prev_state = {
              notes: cards,
              strokes: useBoardStore.getState().strokes,
            };
            isApplyingRemoteState = false;
          },
          (drawings) => {
            isApplyingRemoteState = true;
            setStore({ strokes: drawings });
            (globalThis as any).__ideatasks_prev_state = {
              notes: useBoardStore.getState().notes,
              strokes: drawings,
            };
            isApplyingRemoteState = false;
          },
          (jobs) => {
            isApplyingRemoteState = true;
            setStore({ jobs: normalizeJobs(jobs) });
            isApplyingRemoteState = false;
          }
        );
      });
    },

    centerView: () =>
      setStore((state) => {
        if (state.notes.length === 0 && state.strokes.length === 0) {
          return { viewport: DEFAULT_VIEWPORT };
        }

        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;
        state.notes.forEach((n) => {
          minX = Math.min(minX, n.x);
          minY = Math.min(minY, n.y);
          maxX = Math.max(maxX, n.x + n.width);
          maxY = Math.max(maxY, n.y + n.height);
        });
        state.strokes.forEach((s) => {
          s.points.forEach((p) => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
          });
        });

        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;
        const padding = 100;
        const zoom = Math.min(
          Math.max(
            Math.min(
              (window.innerWidth - padding * 2) / contentWidth,
              (window.innerHeight - padding * 2) / contentHeight
            ),
            0.1
          ),
          1
        );

        return {
          viewport: {
            x: window.innerWidth / 2 - (minX + contentWidth / 2) * zoom,
            y: window.innerHeight / 2 - (minY + contentHeight / 2) * zoom,
            zoom,
          },
        };
      }),

    focusOnNote: (id) =>
      setStore((state) => {
        const note = state.notes.find((n) => n.id === id);
        if (!note) return {};
        const targetZoom = Math.max(state.viewport.zoom, 0.8);
        return {
          viewport: {
            x: window.innerWidth / 2 - (note.x + note.width / 2) * targetZoom,
            y: window.innerHeight / 2 - (note.y + note.height / 2) * targetZoom,
            zoom: targetZoom,
          },
          selectedNoteIds: [id],
          isDashboardOpen: false,
        };
      }),

    addNote: (note) => {
      setStore((state) => ({
        notes: [...state.notes, { ...note, zIndex: state.notes.length + 1 }],
        selectedNoteIds: [note.id],
        tool: ToolType.SELECT,
      }));
      scheduleBoardSync();
    },

    updateNote: (id, updates) => {
      setStore((state) => ({
        notes: state.notes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
      }));
      scheduleBoardSync();
    },

    deleteNote: (id) => {
      setStore((state) => ({
        notes: state.notes.filter((n) => n.id !== id),
        selectedNoteIds: state.selectedNoteIds.filter((sid) => sid !== id),
      }));
      scheduleBoardSync();
    },

    duplicateNote: (id) => {
      setStore((state) => {
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
      });
      scheduleBoardSync();
    },

    copySelection: () =>
      setStore((state) => {
        const selected = state.notes.filter((n) => state.selectedNoteIds.includes(n.id));
        if (!selected.length) return {};
        return { clipboard: selected.map((n) => ({ ...n })) };
      }),

    pasteClipboard: () => {
      setStore((state) => {
        if (!state.clipboard.length) return {};
        const newNotes: Note[] = state.clipboard.map((note) => ({
          ...note,
          id: generateId(),
          x: note.x + 20,
          y: note.y + 20,
          zIndex: state.notes.length + 1,
        }));
        return {
          notes: [...state.notes, ...newNotes],
          selectedNoteIds: newNotes.map((n) => n.id),
          clipboard: state.clipboard.map((n) => ({ ...n, x: n.x + 20, y: n.y + 20 })),
        };
      });
      scheduleBoardSync();
    },

    selectNote: (id, multi = false) =>
      setStore((state) => {
        if (id === null) return { selectedNoteIds: [] };
        if (multi) {
          return {
            selectedNoteIds: state.selectedNoteIds.includes(id)
              ? state.selectedNoteIds.filter((sid) => sid !== id)
              : [...state.selectedNoteIds, id],
          };
        }
        return { selectedNoteIds: [id] };
      }),

    bringToFront: (id) =>
      setStore((state) => {
        const maxZ = Math.max(...state.notes.map((n) => n.zIndex), 0);
        return { notes: state.notes.map((n) => (n.id === id ? { ...n, zIndex: maxZ + 1 } : n)) };
      }),

    addJob: (name, color) => {
      setStore((state) => ({ jobs: [...state.jobs, { id: generateId(), name, color }] }));
      scheduleBoardSync();
    },
    updateJobName: (id, name) => {
      setStore((state) => ({ jobs: state.jobs.map((j) => (j.id === id ? { ...j, name } : j)) }));
      scheduleBoardSync();
    },
    deleteJob: (id) => {
      setStore((state) => ({
        jobs: state.jobs.filter((j) => j.id !== id),
        notes: state.notes.map((n) => (n.job === id ? { ...n, job: state.jobs[0]?.id || 'default' } : n)),
      }));
      scheduleBoardSync();
    },

    addStroke: (stroke) => {
      setStore((state) => ({ strokes: [...state.strokes, stroke] }));
      scheduleBoardSync();
    },
    deleteStroke: (id) => {
      setStore((state) => ({ strokes: state.strokes.filter((s) => s.id !== id) }));
      scheduleBoardSync();
    },

    clearBoard: () => {
      setStore({ notes: [], strokes: [], viewport: DEFAULT_VIEWPORT });
      scheduleBoardSync();
    },
    setViewport: (viewport) => setStore({ viewport }),
    loadBoard: (data) => {
      const normalizedData = migrateImportedJson(data);
      if (!normalizedData) return false;
      setStore({
        notes: normalizedData.notes,
        strokes: normalizedData.strokes,
        viewport: normalizedData.viewport,
        jobs: normalizedData.jobs,
        selectedNoteIds: [],
        clipboard: [],
      });
      scheduleBoardSync();
      return true;
    },

    generateBrainstorm: async (noteId) => {
      const state = get();
      const note = state.notes.find((n) => n.id === noteId);
      if (!note || state.isGeneratingAI) return;
      setStore({ isGeneratingAI: true });
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response: GenerateContentResponse = await ai.models.generateContent({
          model: 'gemini-3-pro-preview',
          contents: `Brainstorm and expand upon the following idea: "${note.content}". Provide 3 concise suggestions or related tasks.`,
          config: { systemInstruction: 'You are a creative productivity assistant. Keep suggestions brief and actionable.' },
        });
        if (response.text) state.updateNote(noteId, { content: `${note.content}\n\n--- AI Brainstorm ---\n${response.text}` });
      } catch (error) {
        console.error('Gemini AI brainstorm failed:', error);
      } finally {
        setStore({ isGeneratingAI: false });
      }
    },
  }))
);

// Persistência local para o modo sem Firebase
if (!IS_FIREBASE) {
  useBoardStore.subscribe(
    (state) => ({ notes: state.notes, strokes: state.strokes, viewport: state.viewport, jobs: state.jobs }),
    (data) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data)),
    { equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b) }
  );
}

// Sincroniza preferências (tema, zoom, offset, etc) com debounce de 1000ms
useBoardStore.subscribe(
  (state) => ({
    user: state.currentUser,
    isDarkMode: state.isDarkMode,
    viewport: state.viewport,
    lastCardColor: state.lastCardColor,
    defaultCardStatus: state.defaultCardStatus,
  }),
  ({ user, isDarkMode, viewport, lastCardColor, defaultCardStatus }) => {
    applyTheme(isDarkMode);
    if (!IS_FIREBASE || !user || isApplyingRemoteState) return;

    if (prefDebounce) clearTimeout(prefDebounce);
    prefDebounce = setTimeout(() => {
      saveUserPreferences(user.uid, {
        theme: isDarkMode ? 'dark' : 'light',
        lastCardColor,
        lastZoomLevel: viewport.zoom,
        canvasOffset: { x: viewport.x, y: viewport.y },
        defaultCardStatus: defaultCardStatus as UserPreferences['defaultCardStatus'],
      });
    }, 1000);
  }
);
