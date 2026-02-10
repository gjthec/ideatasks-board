import React, { useRef, useState, useEffect } from 'react';
import { useBoardStore } from '../store';
import { screenToWorld, getSvgPathFromStroke, generateId } from '../utils';
import { NoteItem } from './NoteItem';
import { ToolType, Point } from '../types';

// Helper for distance between two points
const getDistance = (p1: Point, p2: Point) => {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
};

// Helper for midpoint
const getMidpoint = (p1: Point, p2: Point) => {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
};

export const Board: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { 
    viewport, setViewport, 
    notes, strokes, 
    tool, addStroke, deleteStroke,
    selectNote, selectedNoteIds, updateNote, deleteNote, duplicateNote,
    copySelection, pasteClipboard,
    penColor, penSize 
  } = useBoardStore();

  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  
  // Track active pointers for multi-touch gestures
  const activePointers = useRef<Map<number, Point>>(new Map());
  // Track initial values for gesture calculations
  const gestureRef = useRef<{
    initialDist: number;
    initialZoom: number;
    initialMid: Point;
    initialViewport: Point;
  } | null>(null);

  // Ref-based drag state for instant performance
  const dragInfoRef = useRef<{
    mode: 'pan' | 'drag-note' | 'draw' | 'idle' | 'gesture';
    startX: number;
    startY: number;
    initialViewport?: { x: number; y: number };
    noteId?: string;
    initialNotePos?: { x: number; y: number };
  }>({ mode: 'idle', startX: 0, startY: 0 });

  const [dragMode, setDragMode] = useState<'pan' | 'drag-note' | 'draw' | 'idle' | 'gesture'>('idle');

  // Handle Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT') {
          return;
      }
      if (e.code === 'Space' && !e.repeat) setIsSpacePressed(true);
      if (e.key === 'Delete' || e.key === 'Backspace') selectedNoteIds.forEach(id => deleteNote(id));

      if (e.ctrlKey || e.metaKey) {
          if (e.key === 'd') { e.preventDefault(); selectedNoteIds.forEach(id => duplicateNote(id)); }
          if (e.key === 'c') { e.preventDefault(); copySelection(); }
          if (e.key === 'v') { e.preventDefault(); pasteClipboard(); }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsSpacePressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedNoteIds, deleteNote, duplicateNote, copySelection, pasteClipboard]);

  // Handle Wheel Zoom and Pan
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const zoomFactor = -e.deltaY * 0.001;
      const newZoom = Math.max(0.1, Math.min(5, viewport.zoom + zoomFactor));
      
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const worldX = (mouseX - viewport.x) / viewport.zoom;
      const worldY = (mouseY - viewport.y) / viewport.zoom;
      
      setViewport({
        x: mouseX - worldX * newZoom,
        y: mouseY - worldY * newZoom,
        zoom: newZoom
      });
    } else {
      // Pan
      setViewport({
        ...viewport,
        x: viewport.x - e.deltaX,
        y: viewport.y - e.deltaY
      });
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    containerRef.current.setPointerCapture(e.pointerId);
    
    // Add pointer to map
    activePointers.current.set(e.pointerId, {x: e.clientX, y: e.clientY});

    // Check for Multi-touch (Gesture Mode)
    if (activePointers.current.size === 2) {
        // Switch to gesture mode immediately
        const pointers = Array.from(activePointers.current.values()) as Point[];
        const p1 = pointers[0];
        const p2 = pointers[1];
        
        gestureRef.current = {
            initialDist: getDistance(p1, p2),
            initialZoom: viewport.zoom,
            initialMid: getMidpoint(p1, p2),
            initialViewport: { x: viewport.x, y: viewport.y }
        };
        
        dragInfoRef.current.mode = 'gesture';
        setDragMode('gesture');
        setCurrentStroke([]); // Cancel any drawing
        return;
    }

    // Only process single touch logic if we are NOT already in gesture mode
    if (activePointers.current.size > 1) return;

    const isPrimaryButton = e.button === 0;
    const isMiddleButton = e.button === 1;

    // Pan Logic (Spacebar, Middle Mouse, Hand Tool)
    if (isMiddleButton || isSpacePressed || tool === ToolType.HAND) {
      e.preventDefault();
      dragInfoRef.current = {
        mode: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        initialViewport: { x: viewport.x, y: viewport.y }
      };
      setDragMode('pan');
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const worldPos = screenToWorld({ x, y }, viewport);

    // Draw Logic
    if (tool === ToolType.PEN && isPrimaryButton) {
      e.preventDefault();
      dragInfoRef.current = { mode: 'draw', startX: x, startY: y };
      setCurrentStroke([worldPos]);
      setDragMode('draw');
      selectNote(null);
    } else if (tool === ToolType.SELECT && isPrimaryButton) {
        selectNote(null);
    }
  };

  const handleNoteMouseDown = (e: React.PointerEvent, noteId: string) => {
    if (tool === ToolType.PEN || tool === ToolType.ERASER || tool === ToolType.HAND || isSpacePressed) return;
    
    // If multiple fingers are down, we ignore note dragging to allow zooming/panning
    if (activePointers.current.size > 0) return;

    e.stopPropagation();
    containerRef.current?.setPointerCapture(e.pointerId);
    activePointers.current.set(e.pointerId, {x: e.clientX, y: e.clientY});

    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    if (!e.shiftKey) selectNote(noteId);
    else selectNote(noteId, true);

    dragInfoRef.current = {
      mode: 'drag-note',
      startX: e.clientX,
      startY: e.clientY,
      noteId: noteId,
      initialNotePos: { x: note.x, y: note.y }
    };
    setDragMode('drag-note');
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    // Update pointer position in map
    if (activePointers.current.has(e.pointerId)) {
        activePointers.current.set(e.pointerId, {x: e.clientX, y: e.clientY});
    }

    // Handle Gesture (2 fingers)
    if (dragInfoRef.current.mode === 'gesture' && activePointers.current.size === 2 && gestureRef.current) {
        const pointers = Array.from(activePointers.current.values()) as Point[];
        const p1 = pointers[0];
        const p2 = pointers[1];
        
        // 1. Calculate new scale
        const currentDist = getDistance(p1, p2);
        const scale = currentDist / gestureRef.current.initialDist;
        const newZoom = Math.max(0.1, Math.min(5, gestureRef.current.initialZoom * scale));
        
        // 2. Calculate Pan (Midpoint shift)
        const currentMid = getMidpoint(p1, p2);
        const initialMid = gestureRef.current.initialMid;
        
        // Complex math to zoom around the midpoint
        // Basically: translate old origin -> scale -> translate new origin back + pan offset
        // Simplified: Scale viewport relative to midpoint + track panning
        
        // We calculate where the initial midpoint *was* in the world
        // And where it *is* now, then adjust viewport.
        
        // Actually, easiest way is to apply zoom relative to initial midpoint, then add delta pan
        const rect = containerRef.current!.getBoundingClientRect();
        
        // Relative to container
        const midRelX = initialMid.x - rect.left;
        const midRelY = initialMid.y - rect.top;
        
        // World position of midpoint at start
        // worldX = (midRelX - initView.x) / initZoom
        
        // New Viewport X needed to keep worldX under the pointer (ignoring pan for a second)
        // midRelX = worldX * newZoom + newViewX
        // newViewX = midRelX - worldX * newZoom
        
        const initView = gestureRef.current.initialViewport;
        const initZoom = gestureRef.current.initialZoom;
        
        const worldX = (midRelX - initView.x) / initZoom;
        const worldY = (midRelY - initView.y) / initZoom;
        
        const zoomX = midRelX - worldX * newZoom;
        const zoomY = midRelY - worldY * newZoom;
        
        // Now add the panning delta (currentMid - initialMid)
        const panDeltaX = currentMid.x - initialMid.x;
        const panDeltaY = currentMid.y - initialMid.y;
        
        setViewport({
            x: zoomX + panDeltaX,
            y: zoomY + panDeltaY,
            zoom: newZoom
        });
        
        return;
    }

    // Standard Drag/Draw Logic
    const { mode, startX, startY, initialViewport, initialNotePos, noteId } = dragInfoRef.current;
    if (mode === 'idle') return;
    e.preventDefault();

    if (mode === 'pan') {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (initialViewport) {
        setViewport({
          ...viewport,
          x: initialViewport.x + dx,
          y: initialViewport.y + dy
        });
      }
    } else if (mode === 'drag-note') {
       if (!initialNotePos || !noteId) return;
       const dx = (e.clientX - startX) / viewport.zoom;
       const dy = (e.clientY - startY) / viewport.zoom;
       
       const newX = initialNotePos.x + dx;
       const newY = initialNotePos.y + dy;
       const noteElement = document.getElementById(`note-${noteId}`);
       if (noteElement) {
           noteElement.style.transform = `translate(${newX}px, ${newY}px)`;
       }
    } else if (mode === 'draw') {
        const rect = containerRef.current!.getBoundingClientRect();
        const worldPos = screenToWorld({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        }, viewport);
        setCurrentStroke(prev => [...prev, worldPos]);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    activePointers.current.delete(e.pointerId);

    // If we still have fingers down, don't stop everything entirely, 
    // but usually lifting one finger ends a multi-touch gesture.
    // To keep it simple: any lift ends the current major action.
    
    if (activePointers.current.size < 2 && dragInfoRef.current.mode === 'gesture') {
        dragInfoRef.current.mode = 'idle';
        setDragMode('idle');
        gestureRef.current = null;
    }
    
    // Standard End Logic
    const { mode, startX, startY, noteId, initialNotePos } = dragInfoRef.current;

    if (mode === 'drag-note' && noteId && initialNotePos) {
         const dx = (e.clientX - startX) / viewport.zoom;
         const dy = (e.clientY - startY) / viewport.zoom;
         updateNote(noteId, { x: initialNotePos.x + dx, y: initialNotePos.y + dy });
    }

    if (mode === 'draw' && currentStroke.length > 0) {
      addStroke({
        id: generateId(),
        points: currentStroke,
        color: penColor,
        size: penSize
      });
      setCurrentStroke([]);
    }
    
    if (activePointers.current.size === 0) {
        dragInfoRef.current = { mode: 'idle', startX: 0, startY: 0 };
        setDragMode('idle');
        if (containerRef.current && containerRef.current.hasPointerCapture(e.pointerId)) {
            containerRef.current.releasePointerCapture(e.pointerId);
        }
    }
  };

  // Eraser Logic
  const handleStrokeClick = (e: React.PointerEvent, strokeId: string) => {
      if (tool === ToolType.ERASER) {
          e.stopPropagation();
          deleteStroke(strokeId);
      }
  };

  const getCursor = () => {
    if (isSpacePressed || tool === ToolType.HAND || dragMode === 'pan' || dragMode === 'gesture') return 'cursor-grab active:cursor-grabbing';
    if (tool === ToolType.PEN) return 'cursor-crosshair';
    if (tool === ToolType.ERASER) return 'cursor-cell';
    return 'cursor-default';
  };

  const backgroundSize = 20 * viewport.zoom;
  const backgroundPosition = `${viewport.x}px ${viewport.y}px`;

  return (
    <div 
        ref={containerRef}
        className={`w-full h-full absolute inset-0 overflow-hidden touch-none ${getCursor()}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp} 
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
    >
        {/* Infinite Grid Background */}
        <div 
            className="absolute inset-0 pointer-events-none opacity-20 dark:opacity-10"
            style={{
                backgroundImage: `radial-gradient(circle, #000 1px, transparent 1px)`,
                backgroundSize: `${backgroundSize}px ${backgroundSize}px`,
                backgroundPosition: backgroundPosition,
            }}
        />

        {/* Transformed Content Layer */}
        <div 
            className="absolute top-0 left-0 w-full h-full origin-top-left will-change-transform"
            style={{
                transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`
            }}
        >
            {notes.map(note => (
                <NoteItem 
                    key={note.id} 
                    note={note} 
                    onMouseDown={(e) => handleNoteMouseDown(e, note.id)} 
                />
            ))}
            <svg className="absolute top-0 left-0 overflow-visible w-full h-full pointer-events-none z-[9999]">
                 {strokes.map(stroke => (
                     <path 
                        key={stroke.id}
                        d={getSvgPathFromStroke(stroke)}
                        fill="none"
                        stroke={stroke.color}
                        strokeWidth={stroke.size}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`transition-opacity ${tool === ToolType.ERASER ? 'pointer-events-auto hover:opacity-30 cursor-pointer' : 'pointer-events-none'}`}
                        onPointerDown={(e) => handleStrokeClick(e, stroke.id)}
                     />
                 ))}
                 {currentStroke.length > 0 && (
                     <path 
                        d={getSvgPathFromStroke({ id: 'temp', points: currentStroke, color: penColor, size: penSize })}
                        fill="none"
                        stroke={penColor}
                        strokeWidth={penSize}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="opacity-70 pointer-events-none"
                     />
                 )}
            </svg>
        </div>
        
        <div className="hidden md:block absolute bottom-4 right-4 text-xs text-gray-400 pointer-events-none select-none z-50">
            Hold Space + Drag to Pan • Ctrl + Scroll to Zoom
        </div>
    </div>
  );
};