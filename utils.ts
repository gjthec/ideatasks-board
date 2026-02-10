import { Point, Viewport, Stroke, NoteColor } from './types';

export const screenToWorld = (point: Point, viewport: Viewport): Point => {
  return {
    x: (point.x - viewport.x) / viewport.zoom,
    y: (point.y - viewport.y) / viewport.zoom,
  };
};

export const worldToScreen = (point: Point, viewport: Viewport): Point => {
  return {
    x: point.x * viewport.zoom + viewport.x,
    y: point.y * viewport.zoom + viewport.y,
  };
};

export const getSvgPathFromStroke = (stroke: Stroke): string => {
  if (stroke.points.length === 0) return '';

  // Simple line smoothing can be added here, for now using polyline
  const d = stroke.points.reduce(
    (acc, point, i, a) => {
        if (i === 0) return `M ${point.x} ${point.y}`;
        
        // Simple smoothing using quadratic bezier for better look
        // (Midpoint strategy)
        // For strict lines use: return `${acc} L ${point.x} ${point.y}`;
        
        const p0 = a[i - 1];
        const p1 = point;
        const midX = (p0.x + p1.x) / 2;
        const midY = (p0.y + p1.y) / 2;
        return `${acc} Q ${p0.x} ${p0.y} ${midX} ${midY}`; 
        
    },
    ''
  );
  
  // Add last point
  const last = stroke.points[stroke.points.length - 1];
  return d + ` L ${last.x} ${last.y}`;
};

export const generateId = () => Math.random().toString(36).substr(2, 9);

// Maps the strong UI colors of Jobs to the pastel Note colors
export const getNoteColorFromJobColor = (jobColor: string): NoteColor => {
  if (!jobColor) return NoteColor.YELLOW;
  
  if (jobColor.includes('blue') || jobColor.includes('sky') || jobColor.includes('cyan')) return NoteColor.BLUE;
  if (jobColor.includes('green') || jobColor.includes('teal') || jobColor.includes('emerald')) return NoteColor.GREEN;
  if (jobColor.includes('red') || jobColor.includes('rose') || jobColor.includes('pink')) return NoteColor.RED;
  if (jobColor.includes('purple') || jobColor.includes('violet') || jobColor.includes('indigo')) return NoteColor.PURPLE;
  if (jobColor.includes('gray') || jobColor.includes('slate')) return NoteColor.GRAY;
  
  // Default fallback for Orange, Yellow, Amber, or unknown
  return NoteColor.YELLOW;
};