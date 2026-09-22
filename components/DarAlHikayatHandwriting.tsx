import React, { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import { ChevronDown, ChevronUp, MoreHorizontal, Eraser as EraserIcon, Trash2, XCircle } from "lucide-react";
import { ThemeColors } from "../contexts/AppContext";

export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
  time: number;
}

export interface Stroke {
  id: string;
  color: string;
  width: number;
  points: StrokePoint[];
}

export interface HandwritingHandle {
  getStrokes: () => Stroke[];
  getDataUrl: () => string;
  clear: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

interface DarAlHikayatHandwritingProps {
  isActive: boolean;
  isReadingMode?: boolean;
  onClose: () => void;
  onDiscard?: () => void;
  theme: ThemeColors;
  initialStrokes?: Stroke[];
  initialPageRuled?: boolean;
  onStrokesChange?: (strokes: Stroke[], isPageRuled: boolean, dataUrl: string) => void;
  containerRef?: React.RefObject<HTMLElement | null>;
  onUndoChange?: (canUndo: boolean, canRedo: boolean) => void;
}

// Preset stroke thickness values with noticeable, distinct sizes from ultra-thin calligraphy to bold heading nib
const THICKNESS_PRESETS = [
  { label: "دقيق جداً (ريشة رفيعة)", value: 1.5, svgWidth: 1.0, dotSize: 3 },
  { label: "دقيق (خط النسخ)", value: 3.5, svgWidth: 2.5, dotSize: 5 },
  { label: "متوسط (خط الرقعة)", value: 7.0, svgWidth: 4.8, dotSize: 8 },
  { label: "عريض (خط الثلث)", value: 13.0, svgWidth: 8.0, dotSize: 12 },
  { label: "عريض جداً (قلم التمييز والتعريض)", value: 24.0, svgWidth: 13.0, dotSize: 18 },
];

// Curated 8 color palette aligned with Dar Al Hikayat
const COLOR_PALETTE = [
  { hex: "#FFFFFF", name: "أبيض ناصع", lightHex: "#121A1B" },
  { hex: "#A7AA63", name: "ذهب دار الحكايات", lightHex: "#888C3E" },
  { hex: "#3B82F6", name: "أزرق حبري ملكي", lightHex: "#2563EB" },
  { hex: "#0EA5E9", name: "سماوي صافي", lightHex: "#0284C7" },
  { hex: "#10B981", name: "زمردي إسلامي", lightHex: "#059669" },
  { hex: "#F59E0B", name: "عنبر وذهب", lightHex: "#D97706" },
  { hex: "#EF4444", name: "قرمزي ياقوتي", lightHex: "#DC2626" },
  { hex: "#9333EA", name: "أرجواني ملكي", lightHex: "#7E22CE" },
];

type PopupType = "none" | "thickness" | "color" | "options" | "eraser";

export const DarAlHikayatHandwriting = forwardRef<HandwritingHandle, DarAlHikayatHandwritingProps>(
  ({ isActive, isReadingMode = false, onClose, onDiscard, theme, initialStrokes = [], initialPageRuled = false, onStrokesChange, containerRef, onUndoChange }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const ruledCanvasRef = useRef<HTMLCanvasElement>(null);

    // Drawing Tool States
    const [activeTool, setActiveTool] = useState<"pen" | "eraser">("pen");
    const [selectedThickness, setSelectedThickness] = useState<number>(3.5);
    const [selectedColor, setSelectedColor] = useState<string>(() => (theme.isDark ? "#FFFFFF" : "#121A1B"));
    const [isPageRuled, setIsPageRuled] = useState<boolean>(initialPageRuled);

    // Collapsed Capsule Dome State (Minimize/Expand)
    const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

    // Active popup capsule above bottom bar
    const [activePopup, setActivePopup] = useState<PopupType>("none");

    // Strokes & History for Undo/Redo
    const [strokes, setStrokes] = useState<Stroke[]>(initialStrokes);
    const [history, setHistory] = useState<Stroke[][]>([initialStrokes]);
    const [historyIndex, setHistoryIndex] = useState<number>(0);

    // Infinite Canvas Vertical Pan State & Refs
    const [panY, setPanY] = useState<number>(0);
    const panYRef = useRef<number>(0);
    const isTwoFingerPanningRef = useRef<boolean>(false);
    const lastTwoFingerYRef = useRef<number>(0);
    const twoFingerCooldownRef = useRef<number>(0);

    // Reading Mode Navigation Refs
    const isMousePanningRef = useRef<boolean>(false);
    const lastMouseYRef = useRef<number>(0);
    const readingTouchStartYRef = useRef<number>(0);

    // Drawing in-progress refs
    const isDrawingRef = useRef<boolean>(false);
    const currentPointsRef = useRef<StrokePoint[]>([]);
    const lastPointRef = useRef<StrokePoint | null>(null);
    const didEraseDuringDragRef = useRef<boolean>(false);
    const lastInternalStrokesRef = useRef<Stroke[]>(initialStrokes);

    // Redraw whenever strokes change or canvas resizes, with panY translation
    const redrawAll = useCallback(
      (strokesToDraw: Stroke[], currentPanY: number = panYRef.current) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d", { desynchronized: true, alpha: true });
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const viewportHeight = canvas.height / dpr;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(dpr, dpr);
        ctx.translate(0, -currentPanY);

        // Render each stroke with smooth quadratic curves
        strokesToDraw.forEach((stroke) => {
          if (!stroke.points || stroke.points.length === 0) return;

          // Viewport culling optimization
          let minStrokeY = Infinity;
          let maxStrokeY = -Infinity;
          for (let p = 0; p < stroke.points.length; p++) {
            const y = stroke.points[p].y;
            if (y < minStrokeY) minStrokeY = y;
            if (y > maxStrokeY) maxStrokeY = y;
          }
          if (maxStrokeY < currentPanY - 60 || minStrokeY > currentPanY + viewportHeight + 60) {
            return;
          }

          ctx.save();
          ctx.strokeStyle = stroke.color;
          ctx.fillStyle = stroke.color;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";

          if (stroke.points.length === 1) {
            const p = stroke.points[0];
            ctx.beginPath();
            ctx.arc(p.x, p.y, stroke.width / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
          }

          for (let i = 1; i < stroke.points.length; i++) {
            const p0 = stroke.points[i - 1];
            const p1 = stroke.points[i];

            const midX = (p0.x + p1.x) / 2;
            const midY = (p0.y + p1.y) / 2;

            // Pressure & velocity sensitive width
            const currentWidth = stroke.width * (0.65 + (p1.pressure || 0.5) * 0.7);
            ctx.lineWidth = currentWidth;

            ctx.beginPath();
            if (i === 1) {
              ctx.moveTo(p0.x, p0.y);
              ctx.lineTo(midX, midY);
            } else {
              const prevMidX = (stroke.points[i - 2].x + p0.x) / 2;
              const prevMidY = (stroke.points[i - 2].y + p0.y) / 2;
              ctx.moveTo(prevMidX, prevMidY);
              ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
            }
            ctx.stroke();
          }
          ctx.restore();
        });
        ctx.restore();
      },
      []
    );

    // Synchronize initial strokes only when note loads externally or changes from outside
    useEffect(() => {
      if (initialStrokes && initialStrokes !== lastInternalStrokesRef.current) {
        lastInternalStrokesRef.current = initialStrokes;
        setStrokes(initialStrokes);
        setHistory([initialStrokes]);
        setHistoryIndex(0);
        redrawAll(initialStrokes, panYRef.current);
      }
    }, [initialStrokes, redrawAll]);

    useEffect(() => {
      setIsPageRuled(initialPageRuled);
    }, [initialPageRuled]);

    // Draw Ruled lines on background canvas across the infinite vertical page
    const drawRuledLines = useCallback(
      (currentPanY: number = panYRef.current) => {
        const canvas = ruledCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        if (!isPageRuled) return;

        const viewportHeight = canvas.height / dpr;
        const width = canvas.width / dpr;
        const lineHeight = 38; // 38px comfortable manuscript ruling
        const startY = 80;

        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.translate(0, -currentPanY);

        // Theme-based elegant ruling color
        ctx.strokeStyle = theme.isDark ? "rgba(226, 223, 210, 0.16)" : "rgba(18, 26, 27, 0.15)";
        ctx.lineWidth = 1;

        // Mathematically consistent ruling indices from 0 to infinity
        const firstLineIdx = Math.max(0, Math.floor((currentPanY - startY) / lineHeight));
        const lastLineIdx = Math.floor((currentPanY + viewportHeight + lineHeight - startY) / lineHeight);

        for (let i = firstLineIdx; i <= lastLineIdx; i++) {
          const y = startY + i * lineHeight;
          ctx.beginPath();
          ctx.moveTo(24, y);
          ctx.lineTo(width - 24, y);
          ctx.stroke();
        }
        ctx.restore();
      },
      [isPageRuled, theme.isDark]
    );

    // Resize canvas to match target container with device pixel ratio
    const resizeCanvases = useCallback(() => {
      const canvas = canvasRef.current;
      const ruledCanvas = ruledCanvasRef.current;
      if (!canvas || !ruledCanvas) return;

      const dpr = window.devicePixelRatio || 1;
      const docWidth = window.innerWidth;
      const docHeight = window.innerHeight;

      if (canvas.width !== docWidth * dpr || canvas.height !== docHeight * dpr) {
        canvas.width = docWidth * dpr;
        canvas.height = docHeight * dpr;
        canvas.style.width = `${docWidth}px`;
        canvas.style.height = `${docHeight}px`;

        ruledCanvas.width = docWidth * dpr;
        ruledCanvas.height = docHeight * dpr;
        ruledCanvas.style.width = `${docWidth}px`;
        ruledCanvas.style.height = `${docHeight}px`;

        redrawAll(strokes, panYRef.current);
        drawRuledLines(panYRef.current);
      }
    }, [strokes, redrawAll, drawRuledLines]);

    useEffect(() => {
      resizeCanvases();
      window.addEventListener("resize", resizeCanvases);
      return () => {
        window.removeEventListener("resize", resizeCanvases);
      };
    }, [resizeCanvases]);

    useEffect(() => {
      drawRuledLines(panYRef.current);
    }, [drawRuledLines, isPageRuled]);

    // Prevent default browser gesture behavior on the canvas
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const preventDefaultTouch = (e: TouchEvent) => {
        if (isActive || isReadingMode) {
          e.preventDefault();
        }
      };

      canvas.addEventListener("touchstart", preventDefaultTouch, { passive: false });
      canvas.addEventListener("touchmove", preventDefaultTouch, { passive: false });
      return () => {
        canvas.removeEventListener("touchstart", preventDefaultTouch);
        canvas.removeEventListener("touchmove", preventDefaultTouch);
      };
    }, [isActive, isReadingMode]);

    // Export current canvas as data URL
    const generateDataUrl = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return "";
      return canvas.toDataURL("image/png");
    }, []);

    // Save strokes state to parent
    const notifyChange = useCallback(
      (newStrokes: Stroke[], ruled: boolean) => {
        if (onStrokesChange) {
          const dataUrl = generateDataUrl();
          onStrokesChange(newStrokes, ruled, dataUrl);
        }
      },
      [onStrokesChange, generateDataUrl]
    );

    // Notify undo/redo availability to parent
    useEffect(() => {
      if (onUndoChange) {
        onUndoChange(historyIndex > 0, historyIndex < history.length - 1);
      }
    }, [historyIndex, history.length, onUndoChange]);

    // History push
    const recordHistory = (newStrokes: Stroke[]) => {
      const nextHistory = history.slice(0, historyIndex + 1);
      nextHistory.push(newStrokes);
      if (nextHistory.length > 50) nextHistory.shift();
      const newIdx = nextHistory.length - 1;
      lastInternalStrokesRef.current = newStrokes;
      setHistory(nextHistory);
      setHistoryIndex(newIdx);
      setStrokes(newStrokes);
      notifyChange(newStrokes, isPageRuled);
      if (onUndoChange) {
        onUndoChange(newIdx > 0, false);
      }
    };

    // Undo action
    const handleUndo = useCallback(() => {
      if (historyIndex > 0) {
        const nextIndex = historyIndex - 1;
        setHistoryIndex(nextIndex);
        const previousStrokes = history[nextIndex];
        lastInternalStrokesRef.current = previousStrokes;
        setStrokes(previousStrokes);
        redrawAll(previousStrokes, panYRef.current);
        notifyChange(previousStrokes, isPageRuled);
        if (onUndoChange) {
          onUndoChange(nextIndex > 0, nextIndex < history.length - 1);
        }
      }
    }, [history, historyIndex, redrawAll, notifyChange, isPageRuled, onUndoChange]);

    // Redo action
    const handleRedo = useCallback(() => {
      if (historyIndex < history.length - 1) {
        const nextIndex = historyIndex + 1;
        setHistoryIndex(nextIndex);
        const nextStrokes = history[nextIndex];
        lastInternalStrokesRef.current = nextStrokes;
        setStrokes(nextStrokes);
        redrawAll(nextStrokes, panYRef.current);
        notifyChange(nextStrokes, isPageRuled);
        if (onUndoChange) {
          onUndoChange(nextIndex > 0, nextIndex < history.length - 1);
        }
      }
    }, [history, historyIndex, redrawAll, notifyChange, isPageRuled, onUndoChange]);

    // Keyboard shortcuts for Undo (Ctrl/Cmd+Z) and Redo (Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z) in handwriting mode
    useEffect(() => {
      if (!isActive) return;
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && !e.altKey) {
          if (e.key === "z" && !e.shiftKey) {
            e.preventDefault();
            handleUndo();
          } else if (e.key === "y" || (e.key === "z" && e.shiftKey) || (e.key === "Z" && e.shiftKey)) {
            e.preventDefault();
            handleRedo();
          }
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isActive, handleUndo, handleRedo]);

    // Clear all strokes
    const handleClearAll = useCallback(() => {
      recordHistory([]);
      redrawAll([], panYRef.current);
      setActivePopup("none");
    }, [history, historyIndex, redrawAll, isPageRuled]);

    // Discard entire handwriting mode & clear all session data completely
    const handleDiscardAll = useCallback(() => {
      setStrokes([]);
      setHistory([[]]);
      setHistoryIndex(0);
      lastInternalStrokesRef.current = [];
      redrawAll([], panYRef.current);
      setActivePopup("none");
      setIsCollapsed(false);
      if (onStrokesChange) {
        onStrokesChange([], false, "");
      }
      if (onUndoChange) {
        onUndoChange(false, false);
      }
      if (onDiscard) {
        onDiscard();
      } else {
        onClose();
      }
    }, [redrawAll, onStrokesChange, onUndoChange, onDiscard, onClose]);

    // Helper: distance between point and line segment
    const distToSegmentSquared = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
      const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
      if (l2 === 0) return (px - x1) * (px - x1) + (py - y1) * (py - y1);
      let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
      t = Math.max(0, Math.min(1, t));
      const projX = x1 + t * (x2 - x1);
      const projY = y1 + t * (y2 - y1);
      return (px - projX) * (px - projX) + (py - projY) * (py - projY);
    };

    // Realistic Segment Eraser (Takes world coordinates)
    const eraseAtPoint = (worldX: number, worldY: number, radius = 24) => {
      const r2 = radius * radius;
      let didModify = false;
      const nextStrokes: Stroke[] = [];

      for (const stroke of strokes) {
        // Quick bounding check in world coordinates
        let touches = false;
        for (let i = 0; i < stroke.points.length; i++) {
          const pt = stroke.points[i];
          const dx = pt.x - worldX;
          const dy = pt.y - worldY;
          if (dx * dx + dy * dy <= r2) {
            touches = true;
            break;
          }
          if (i > 0) {
            const prev = stroke.points[i - 1];
            if (distToSegmentSquared(worldX, worldY, prev.x, prev.y, pt.x, pt.y) <= r2) {
              touches = true;
              break;
            }
          }
        }

        if (!touches) {
          nextStrokes.push(stroke);
          continue;
        }

        didModify = true;

        // Split this stroke into segments that lie outside the eraser radius
        let currentSegment: StrokePoint[] = [];
        for (let i = 0; i < stroke.points.length; i++) {
          const pt = stroke.points[i];
          const dx = pt.x - worldX;
          const dy = pt.y - worldY;
          const inside = dx * dx + dy * dy <= r2;

          if (inside) {
            if (currentSegment.length > 0) {
              if (currentSegment.length > 1) {
                nextStrokes.push({
                  id: `stroke_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                  color: stroke.color,
                  width: stroke.width,
                  points: currentSegment,
                });
              }
              currentSegment = [];
            }
          } else {
            currentSegment.push(pt);
          }
        }

        if (currentSegment.length > 1) {
          nextStrokes.push({
            id: `stroke_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            color: stroke.color,
            width: stroke.width,
            points: currentSegment,
          });
        }
      }

      if (didModify) {
        didEraseDuringDragRef.current = true;
        setStrokes(nextStrokes);
        redrawAll(nextStrokes, panYRef.current);
      }
    };

    // Core Drawing Helpers (Operating in World Coordinates)
    const startDrawing = (clientX: number, clientY: number, pressure = 0.5) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();

      const worldX = clientX - rect.left;
      const worldY = clientY - rect.top + panYRef.current;

      isDrawingRef.current = true;
      didEraseDuringDragRef.current = false;

      const startPoint: StrokePoint = { x: worldX, y: worldY, pressure, time: performance.now() };
      currentPointsRef.current = [startPoint];
      lastPointRef.current = startPoint;

      if (activeTool === "eraser") {
        eraseAtPoint(worldX, worldY);
      } else {
        const ctx = canvas.getContext("2d", { desynchronized: true, alpha: true });
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.scale(dpr, dpr);
          ctx.translate(0, -panYRef.current);
          ctx.fillStyle = selectedColor;
          ctx.beginPath();
          ctx.arc(worldX, worldY, (selectedThickness * (0.65 + pressure * 0.7)) / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    };

    const moveDrawing = (clientX: number, clientY: number, pressure = 0.5) => {
      if (!isDrawingRef.current || !isActive) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();

      const worldX = clientX - rect.left;
      const worldY = clientY - rect.top + panYRef.current;
      const point: StrokePoint = { x: worldX, y: worldY, pressure, time: performance.now() };

      if (activeTool === "eraser") {
        eraseAtPoint(worldX, worldY);
      } else {
        const prevPoint = lastPointRef.current;
        if (prevPoint) {
          const midX = (prevPoint.x + worldX) / 2;
          const midY = (prevPoint.y + worldY) / 2;
          const width = selectedThickness * (0.65 + pressure * 0.7);

          const ctx = canvas.getContext("2d", { desynchronized: true, alpha: true });
          if (ctx) {
            const dpr = window.devicePixelRatio || 1;
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);
            ctx.translate(0, -panYRef.current);

            ctx.strokeStyle = selectedColor;
            ctx.lineWidth = width;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";

            ctx.beginPath();
            if (currentPointsRef.current.length <= 1) {
              ctx.moveTo(prevPoint.x, prevPoint.y);
              ctx.lineTo(midX, midY);
            } else {
              const pBefore = currentPointsRef.current[currentPointsRef.current.length - 2];
              const prevMidX = (pBefore.x + prevPoint.x) / 2;
              const prevMidY = (pBefore.y + prevPoint.y) / 2;
              ctx.moveTo(prevMidX, prevMidY);
              ctx.quadraticCurveTo(prevPoint.x, prevPoint.y, midX, midY);
            }
            ctx.stroke();
            ctx.restore();
          }
        }

        currentPointsRef.current.push(point);
        lastPointRef.current = point;
      }
    };

    const finishDrawing = () => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;

      if (activeTool === "pen" && currentPointsRef.current.length > 0) {
        const newStroke: Stroke = {
          id: `stroke_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          color: selectedColor,
          width: selectedThickness,
          points: [...currentPointsRef.current],
        };
        const updated = [...strokes, newStroke];
        recordHistory(updated);
      } else if (activeTool === "eraser" && didEraseDuringDragRef.current) {
        recordHistory(strokes);
      }

      currentPointsRef.current = [];
      lastPointRef.current = null;
    };

    // High Precision Touch Event Handlers:
    // In Reading Mode: 1 or 2 fingers smoothly scroll the handwritten infinite document
    // In Active Inking Mode: 2 fingers = Infinite Panning Up/Down (Zero drawing or marks), 1 finger = Writing/Erasing
    const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (isReadingMode) {
        if (e.touches.length >= 1) {
          readingTouchStartYRef.current = e.touches[0].clientY;
          lastTwoFingerYRef.current = e.touches[0].clientY;
        }
        return;
      }

      if (!isActive) return;

      if (e.touches.length >= 2) {
        // Two fingers detected: activate smooth panning mode
        isTwoFingerPanningRef.current = true;
        // If drawing was started by the first finger landing a few ms earlier, cancel & clean it up immediately
        if (isDrawingRef.current) {
          isDrawingRef.current = false;
          currentPointsRef.current = [];
          lastPointRef.current = null;
          redrawAll(strokes, panYRef.current);
        }
        lastTwoFingerYRef.current = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        return;
      }

      if (e.touches.length === 1) {
        // Prevent accidental touch start if still in cooldown from two-finger pan
        if (performance.now() - twoFingerCooldownRef.current < 130 || isTwoFingerPanningRef.current) {
          return;
        }
        const touch = e.touches[0];
        const rawForce = (touch as any).force;
        const force = typeof rawForce === "number" && rawForce > 0 ? rawForce : 0.5;
        startDrawing(touch.clientX, touch.clientY, force);
      }
    };

    const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (isReadingMode) {
        if (e.touches.length >= 1) {
          const currentY = e.touches[0].clientY;
          const deltaY = currentY - lastTwoFingerYRef.current;
          lastTwoFingerYRef.current = currentY;

          const nextPanY = Math.max(0, panYRef.current - deltaY);
          if (Math.abs(nextPanY - panYRef.current) > 0.3) {
            panYRef.current = nextPanY;
            setPanY(nextPanY);
            redrawAll(strokes, nextPanY);
            drawRuledLines(nextPanY);
          }
        }
        return;
      }

      if (!isActive) return;

      if (e.touches.length >= 2) {
        // Two-finger smooth infinite scroll
        const currentAvgY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const deltaY = currentAvgY - lastTwoFingerYRef.current;
        lastTwoFingerYRef.current = currentAvgY;

        // Upward swipe drags the canvas up, revealing infinite bottom area (panY increases)
        // Downward swipe scrolls back up towards page top (panY reaches 0)
        const nextPanY = Math.max(0, panYRef.current - deltaY);
        if (Math.abs(nextPanY - panYRef.current) > 0.3) {
          panYRef.current = nextPanY;
          setPanY(nextPanY);
          redrawAll(strokes, nextPanY);
          drawRuledLines(nextPanY);
        }
        return;
      }

      if (e.touches.length === 1 && !isTwoFingerPanningRef.current) {
        if (performance.now() - twoFingerCooldownRef.current < 130) {
          return;
        }
        const touch = e.touches[0];
        const rawForce = (touch as any).force;
        const force = typeof rawForce === "number" && rawForce > 0 ? rawForce : 0.5;
        moveDrawing(touch.clientX, touch.clientY, force);
      }
    };

    const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (isReadingMode) {
        return;
      }

      if (!isActive) return;

      if (e.touches.length === 0) {
        if (isTwoFingerPanningRef.current) {
          isTwoFingerPanningRef.current = false;
          twoFingerCooldownRef.current = performance.now();
        }
        if (isDrawingRef.current) {
          finishDrawing();
        }
      } else if (e.touches.length === 1 && isTwoFingerPanningRef.current) {
        // One finger released before the other during two-finger pan:
        // Set cooldown so the remaining finger does not start an accidental stroke!
        twoFingerCooldownRef.current = performance.now();
      }
    };

    // High performance pointer events for mouse/stylus
    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (isReadingMode) {
        if (e.pointerType !== "touch") {
          isMousePanningRef.current = true;
          lastMouseYRef.current = e.clientY;
          try {
            canvasRef.current?.setPointerCapture(e.pointerId);
          } catch {}
        }
        return;
      }

      if (!isActive || e.pointerType === "touch") return; // Touch handled by handleTouchStart
      e.preventDefault();
      try {
        canvasRef.current?.setPointerCapture(e.pointerId);
      } catch {}
      const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;
      startDrawing(e.clientX, e.clientY, pressure);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (isReadingMode) {
        if (isMousePanningRef.current && e.pointerType !== "touch") {
          const deltaY = e.clientY - lastMouseYRef.current;
          lastMouseYRef.current = e.clientY;
          const nextPanY = Math.max(0, panYRef.current - deltaY);
          if (Math.abs(nextPanY - panYRef.current) > 0.3) {
            panYRef.current = nextPanY;
            setPanY(nextPanY);
            redrawAll(strokes, nextPanY);
            drawRuledLines(nextPanY);
          }
        }
        return;
      }

      if (!isActive || e.pointerType === "touch") return;
      e.preventDefault();
      const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;
      moveDrawing(e.clientX, e.clientY, pressure);
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (isReadingMode) {
        isMousePanningRef.current = false;
        try {
          canvasRef.current?.releasePointerCapture(e.pointerId);
        } catch {}
        return;
      }

      if (!isActive || e.pointerType === "touch") return;
      try {
        canvasRef.current?.releasePointerCapture(e.pointerId);
      } catch {}
      finishDrawing();
    };

    // Desktop Mouse Wheel & Trackpad Vertical Scroll
    const handleWheel = (e: React.WheelEvent) => {
      if (!isActive && !isReadingMode) return;
      const nextPanY = Math.max(0, panYRef.current + e.deltaY);
      if (nextPanY !== panYRef.current) {
        panYRef.current = nextPanY;
        setPanY(nextPanY);
        redrawAll(strokes, nextPanY);
        drawRuledLines(nextPanY);
      }
    };

    // Imperative handle for parent
    useImperativeHandle(ref, () => ({
      getStrokes: () => strokes,
      getDataUrl: () => generateDataUrl(),
      clear: () => handleClearAll(),
      undo: () => handleUndo(),
      redo: () => handleRedo(),
      canUndo: () => historyIndex > 0,
      canRedo: () => historyIndex < history.length - 1,
    }));

    // Toggle popups
    const togglePopup = (popup: PopupType) => {
      setActivePopup((prev) => (prev === popup ? "none" : popup));
    };

    // Close popup when tapping background
    const closePopups = () => {
      setActivePopup("none");
    };

    // Dar Al Hikayat Theme Design Palette
    const barBg = theme.mode === "apple_dark" ? "#1C1C1E" : theme.glass;
    const barBorder = theme.mode === "apple_dark" ? "rgba(255, 255, 255, 0.08)" : theme.border;
    const barShadow = theme.shadow || "0 4px 30px rgba(0,0,0,0.4)";
    const itemHoverBg = theme.isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)";

    const shouldDisplay = isActive || (isReadingMode && strokes.length > 0);

    if (!shouldDisplay) {
      return null;
    }

    return (
      <div
        className={`fixed inset-0 ${
          isReadingMode ? "z-20 pointer-events-auto" : "z-40 pointer-events-auto"
        } transition-opacity duration-300`}
        style={{
          touchAction: "none",
        }}
        onClick={(e) => {
          if ((e.target as HTMLElement)?.id === "handwriting-canvas-layer") {
            closePopups();
          }
        }}
      >
        {/* Layer 1: Ruled Lines Canvas (Background) */}
        <canvas
          ref={ruledCanvasRef}
          className="absolute inset-0 pointer-events-none z-10"
          style={{ display: isPageRuled ? "block" : "none" }}
        />

        {/* Layer 2: Main Inking Canvas with Two-Finger Infinite Panning & Single-Finger Inking */}
        <canvas
          id="handwriting-canvas-layer"
          ref={canvasRef}
          className={`absolute inset-0 z-20 ${
            isActive
              ? "cursor-crosshair"
              : isReadingMode
              ? "cursor-grab active:cursor-grabbing"
              : "pointer-events-none"
          }`}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
          style={{
            touchAction: "none",
          }}
        />

        {/* Floating Bottom Bar & Collapsed Dome (Rendered strictly when isActive is true) */}
        {isActive && (
          <>
            {/* Collapsed Bottom Smooth Circular Arc Dome Button (Matching Screenshot_20260921_210841.jpg and Dar Al Hikayat Themes) */}
            <div
              className="fixed bottom-0 left-1/2 z-50 select-none pointer-events-none"
              style={{
                transform: isCollapsed ? "translateX(-50%) translateY(0%)" : "translateX(-50%) translateY(110%)",
                opacity: isCollapsed ? 1 : 0,
                pointerEvents: isCollapsed ? "auto" : "none",
                transition: "transform 420ms cubic-bezier(0.32, 0.72, 0, 1), opacity 300ms ease-out",
              }}
            >
              <button
                id="handwriting-btn-expand"
                onClick={() => setIsCollapsed(false)}
                className="flex flex-col items-center justify-center backdrop-blur-2xl border-t border-x cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95 group"
                style={{
                  width: "74px",
                  height: "32px",
                  borderRadius: "50% 50% 0 0 / 100% 100% 0 0",
                  backgroundColor: barBg,
                  borderColor: barBorder,
                  color: theme.text,
                  boxShadow: barShadow,
                }}
                title="إظهار كبسولة الكتابة اليدوية"
              >
                <ChevronUp
                  className="w-4.5 h-4.5 transition-colors -mt-0.5 opacity-80 group-hover:opacity-100"
                  style={{ color: theme.text }}
                />
              </button>
            </div>

            {/* Main Floating Capsule Container (Smooth slide down/up with Apple physics) */}
            <div
              className="fixed bottom-0 left-0 right-0 z-50 flex flex-col items-center justify-end pointer-events-none select-none pb-0"
              dir="ltr"
              style={{
                transform: isCollapsed ? "translateY(110%)" : "translateY(0%)",
                opacity: isCollapsed ? 0 : 1,
                pointerEvents: "none",
                transition: "transform 420ms cubic-bezier(0.32, 0.72, 0, 1), opacity 320ms ease-out",
              }}
            >
              {/* --- FLOATING CAPSULES ABOVE THE BAR (Matching Dar Al Hikayat Capsule Design) --- */}
              <div className="relative w-full max-w-[340px] px-2 flex justify-center pb-2 pointer-events-auto">
                  {/* 1. Thickness Capsule (5 Noticeable Distinct Sizes) */}
                  {activePopup === "thickness" && (
                    <div
                      id="capsule-thickness"
                      className="absolute bottom-3 right-0 z-50 rounded-full py-2.5 px-3 flex items-center gap-2 shadow-2xl backdrop-blur-2xl border animate-in fade-in zoom-in-95 duration-200"
                      style={{
                        backgroundColor: barBg,
                        borderColor: barBorder,
                        boxShadow: barShadow,
                        borderRadius: "9999px",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {THICKNESS_PRESETS.map((preset) => {
                        const isSelected = selectedThickness === preset.value;
                        return (
                          <button
                            key={preset.value}
                            onClick={() => {
                              setSelectedThickness(preset.value);
                              setActiveTool("pen");
                            }}
                            className={`relative w-10 h-10 rounded-full flex flex-col items-center justify-center transition-all cursor-pointer ${
                              isSelected
                                ? "scale-110 shadow-sm"
                                : "opacity-75 hover:opacity-100 hover:scale-105"
                            }`}
                            style={{
                              backgroundColor: isSelected ? `${theme.accent}25` : "transparent",
                              borderColor: isSelected ? theme.accent : "transparent",
                            }}
                            title={preset.label}
                          >
                            {/* Distinct Sized Nib Dots */}
                            <div
                              className="rounded-full transition-all"
                              style={{
                                width: `${preset.dotSize}px`,
                                height: `${preset.dotSize}px`,
                                backgroundColor: isSelected ? theme.accent : theme.text,
                              }}
                            />
                            {/* Calligraphic Indicator Stroke */}
                            <div
                              className="mt-1 rounded-full"
                              style={{
                                width: "16px",
                                height: `${Math.min(preset.svgWidth, 4.5)}px`,
                                backgroundColor: isSelected ? theme.accent : `${theme.text}60`,
                              }}
                            />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* 2. Color Capsule (Dar Al Hikayat Palette) */}
                  {activePopup === "color" && (
                    <div
                      id="capsule-color"
                      className="absolute bottom-3 left-1/2 -translate-x-1/2 z-50 rounded-full py-2.5 px-3.5 flex items-center gap-2.5 shadow-2xl backdrop-blur-2xl border animate-in fade-in zoom-in-95 duration-200"
                      style={{
                        backgroundColor: barBg,
                        borderColor: barBorder,
                        boxShadow: barShadow,
                        borderRadius: "9999px",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {COLOR_PALETTE.map((c) => {
                        const colorVal = theme.isDark ? c.hex : c.lightHex;
                        const isSelected = selectedColor.toLowerCase() === colorVal.toLowerCase();
                        return (
                          <button
                            key={c.hex}
                            onClick={() => {
                              setSelectedColor(colorVal);
                              setActiveTool("pen");
                              setActivePopup("none");
                            }}
                            className={`w-7 h-7 rounded-full transition-all cursor-pointer relative flex items-center justify-center ${
                              isSelected ? "scale-115 ring-2 ring-offset-2" : "hover:scale-110 opacity-90 hover:opacity-100"
                            }`}
                            style={{
                              backgroundColor: colorVal,
                              // @ts-ignore
                              "--tw-ring-color": theme.accent,
                              "--tw-ring-offset-color": theme.bg,
                            }}
                            title={c.name}
                          >
                            {c.hex === "#FFFFFF" && (
                              <div className="w-full h-full rounded-full border border-black/20" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* 3. Page Ruling Options & Discard Capsule */}
                  {activePopup === "options" && (
                    <div
                      id="capsule-options"
                      className="absolute bottom-3 left-0 z-50 rounded-2xl py-2.5 px-3.5 flex flex-col gap-2.5 shadow-2xl backdrop-blur-2xl border animate-in fade-in zoom-in-95 duration-200 min-w-[190px]"
                      style={{
                        backgroundColor: barBg,
                        borderColor: barBorder,
                        boxShadow: barShadow,
                      }}
                      onClick={(e) => e.stopPropagation()}
                      dir="rtl"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span
                          className="text-xs font-zain-bold tracking-wide select-none"
                          style={{ color: theme.text }}
                        >
                          تسطير الصفحة
                        </span>
                        <button
                          onClick={() => {
                            const nextVal = !isPageRuled;
                            setIsPageRuled(nextVal);
                            notifyChange(strokes, nextVal);
                          }}
                          className={`relative w-11 h-6 rounded-full transition-colors duration-200 p-0.5 cursor-pointer flex items-center ${
                            isPageRuled ? "bg-[#007AFF]" : "bg-neutral-600/60"
                          }`}
                          dir="ltr"
                        >
                          <div
                            className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                              isPageRuled ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>

                      <div className="w-full h-px" style={{ backgroundColor: theme.border }} />

                      <button
                        id="handwriting-btn-discard-mode"
                        onClick={handleDiscardAll}
                        className="w-full py-1.5 px-3 rounded-full bg-red-500/15 hover:bg-red-500/25 text-red-500 text-xs font-zain-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                        title="إلغاء الكتابة اليدوية وحذف التعديلات"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>إلغاء الكتابة اليدوية</span>
                      </button>
                    </div>
                  )}

                  {/* 4. Eraser Capsule (Clean options + Clear All) */}
                  {activePopup === "eraser" && (
                    <div
                      id="capsule-eraser"
                      className="absolute bottom-3 right-4 z-50 rounded-full py-2 px-3.5 flex items-center gap-2.5 shadow-2xl backdrop-blur-2xl border animate-in fade-in zoom-in-95 duration-200"
                      style={{
                        backgroundColor: barBg,
                        borderColor: barBorder,
                        boxShadow: barShadow,
                        borderRadius: "9999px",
                      }}
                      onClick={(e) => e.stopPropagation()}
                      dir="rtl"
                    >
                      <div className="flex items-center gap-1.5 px-1">
                        <EraserIcon className="w-4 h-4" style={{ color: theme.accent }} />
                        <span className="text-xs font-zain-bold select-none" style={{ color: theme.text }}>
                          مسح موضعي
                        </span>
                      </div>
                      <div className="w-px h-5 mx-0.5" style={{ backgroundColor: theme.border }} />
                      <button
                        onClick={handleClearAll}
                        className="flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/15 hover:bg-red-500/25 text-red-500 text-xs font-zain-bold transition-all cursor-pointer active:scale-95"
                        title="مسح كل الرسومات والخطوط"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>مسح الكل</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* --- MAIN BOTTOM BAR (COMPACT, BALANCED FLOATING CAPSULE) --- */}
                <div className="w-full flex justify-center pb-4 px-4 pointer-events-auto">
                  <div
                    className="inline-flex items-center justify-between gap-3 sm:gap-4.5 h-13 px-4 py-1.5 rounded-full backdrop-blur-2xl border-[0.5px] shadow-2xl transition-all duration-300 overflow-visible relative"
                    style={{
                      backgroundColor: barBg,
                      borderColor: barBorder,
                      boxShadow: barShadow,
                      borderRadius: "9999px",
                    }}
                  >
                    {/* Left Button 1: Chevron Down (Collapse to Bottom Dome Button) */}
                    <button
                      id="handwriting-btn-close"
                      onClick={() => {
                        setActivePopup("none");
                        setIsCollapsed(true);
                      }}
                      className="w-8.5 h-8.5 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer flex-shrink-0"
                      style={{ color: theme.text }}
                      title="طي كبسولة الأدوات"
                    >
                      <ChevronDown className="w-4.5 h-4.5" />
                    </button>

                {/* Left Button 2: More Options (...) for Page Ruling */}
                <button
                  id="handwriting-btn-options"
                  onClick={() => togglePopup("options")}
                  className={`w-8.5 h-8.5 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 flex-shrink-0 ${
                    activePopup === "options"
                      ? "shadow-inner"
                      : "hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                  style={{
                    backgroundColor: activePopup === "options" ? `${theme.accent}25` : undefined,
                    color: activePopup === "options" ? theme.accent : theme.text,
                  }}
                  title="خيارات تسطير الصفحة"
                >
                  <MoreHorizontal className="w-4.5 h-4.5" />
                </button>

                {/* Center: Rainbow Color Ring Button */}
                <div className="flex justify-center items-center px-1">
                  <button
                    id="handwriting-btn-color"
                    onClick={() => togglePopup("color")}
                    className="relative w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer p-0.5 shadow-sm"
                    style={{
                      background: "conic-gradient(from 0deg, #ff0000, #ff8800, #ffff00, #00ff00, #00ffff, #0000ff, #8800ff, #ff0088, #ff0000)",
                    }}
                    title="لوحة الألوان"
                  >
                    {/* Inner Preview Circle */}
                    <div
                      className="w-5.5 h-5.5 rounded-full border border-black/20 dark:border-white/20 shadow-inner transition-colors"
                      style={{ backgroundColor: selectedColor }}
                    />
                  </button>
                </div>

                {/* Right Tool 1: Realistic Eraser Stick (Huawei Notes Inspired) */}
                <button
                  id="handwriting-btn-eraser"
                  onClick={() => {
                    if (activeTool === "eraser") {
                      togglePopup("eraser");
                    } else {
                      setActiveTool("eraser");
                      togglePopup("eraser");
                    }
                  }}
                  className={`relative flex flex-col items-center justify-end w-10 h-10 transition-all duration-300 ease-out cursor-pointer overflow-visible ${
                    activeTool === "eraser"
                      ? "-translate-y-7 scale-110 z-20"
                      : "translate-y-0 opacity-75 hover:opacity-100 hover:-translate-y-1.5 z-10"
                  }`}
                  title="الممحاة (مسح تدريجي موضعي)"
                >
                  <div className="relative flex items-center justify-center overflow-visible">
                    <svg
                      className="w-6 h-12 overflow-visible drop-shadow-md"
                      viewBox="0 0 24 50"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <defs>
                        <linearGradient id="eraserRubberGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#FFFFFF" />
                          <stop offset="25%" stopColor="#FFFFFF" />
                          <stop offset="70%" stopColor="#ECEFF2" />
                          <stop offset="100%" stopColor="#D5DAE0" />
                        </linearGradient>
                        <linearGradient id="eraserHighlight" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
                          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="eraserBarrelGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#9AA0A7" />
                          <stop offset="22%" stopColor="#BDC3C9" />
                          <stop offset="42%" stopColor="#E6E9ED" />
                          <stop offset="65%" stopColor="#A4ABB2" />
                          <stop offset="100%" stopColor="#7F858C" />
                        </linearGradient>
                        <linearGradient id="eraserSeamGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#7B8188" />
                          <stop offset="40%" stopColor="#D5DAE0" />
                          <stop offset="100%" stopColor="#676D74" />
                        </linearGradient>
                      </defs>

                      {/* White Rubber Dome Cap */}
                      <path
                        d="M 3 20 L 3 9 C 3 3.5 7.5 1.5 12 1.5 C 16.5 1.5 21 3.5 21 9 L 21 20 Z"
                        fill="url(#eraserRubberGrad)"
                      />
                      {/* Left vertical soft highlight on rubber */}
                      <path
                        d="M 4.5 20 L 4.5 9 C 4.5 4.5 7.5 2.5 10 2 L 10 20 Z"
                        fill="url(#eraserHighlight)"
                        opacity="0.65"
                      />

                      {/* Ferrule Seam Ring */}
                      <rect x="3" y="19.5" width="18" height="1.2" fill="url(#eraserSeamGrad)" />

                      {/* Metallic Textured Sleeve / Barrel with Rounded Base */}
                      <rect
                        x="3"
                        y="20.7"
                        width="18"
                        height="27.3"
                        rx="2.5"
                        fill="url(#eraserBarrelGrad)"
                      />
                      {/* Specular vertical light reflection streak down the barrel */}
                      <rect
                        x="5.5"
                        y="20.7"
                        width="2.5"
                        height="25"
                        fill="#FFFFFF"
                        opacity="0.4"
                      />
                    </svg>
                  </div>
                  {activeTool === "eraser" && (
                    <span
                      className="w-1.5 h-1.5 rounded-full absolute -bottom-2 shadow-sm transition-all"
                      style={{ backgroundColor: theme.accent }}
                    />
                  )}
                </button>

                {/* Right Tool 2: Realistic Fountain Pen (Huawei Notes Inspired) */}
                <button
                  id="handwriting-btn-pen"
                  onClick={() => {
                    if (activeTool === "pen") {
                      togglePopup("thickness");
                    } else {
                      setActiveTool("pen");
                      togglePopup("thickness");
                    }
                  }}
                  className={`relative flex flex-col items-center justify-end w-10 h-10 transition-all duration-300 ease-out cursor-pointer overflow-visible ${
                    activeTool === "pen"
                      ? "-translate-y-7 scale-110 z-20"
                      : "translate-y-0 opacity-75 hover:opacity-100 hover:-translate-y-1.5 z-10"
                  }`}
                  title="ريشة القلم الحبر وسماكة الخط"
                >
                  <div className="relative flex items-center justify-center overflow-visible">
                    <svg
                      className="w-7 h-14 overflow-visible drop-shadow-md"
                      viewBox="0 0 28 58"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <defs>
                        <linearGradient id="nibLeftBevel" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#DFE3E7" />
                          <stop offset="35%" stopColor="#FFFFFF" />
                          <stop offset="85%" stopColor="#F5F7F9" />
                          <stop offset="100%" stopColor="#CBD0D6" />
                        </linearGradient>
                        <linearGradient id="nibRightBevel" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#B3B8BF" />
                          <stop offset="45%" stopColor="#CBD0D6" />
                          <stop offset="80%" stopColor="#9AA0A7" />
                          <stop offset="100%" stopColor="#7E848B" />
                        </linearGradient>
                        <linearGradient id="penCollarGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#7A8087" />
                          <stop offset="35%" stopColor="#FFFFFF" />
                          <stop offset="70%" stopColor="#C4C9CF" />
                          <stop offset="100%" stopColor="#636970" />
                        </linearGradient>
                        <linearGradient id="penBarrelGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#C4C8CE" />
                          <stop offset="28%" stopColor="#F6F8FA" />
                          <stop offset="68%" stopColor="#E9ECEF" />
                          <stop offset="100%" stopColor="#A8AEB6" />
                        </linearGradient>
                      </defs>

                      {/* --- FOUNTAIN PEN NIB --- */}
                      {/* Left Half / Bevel of Nib */}
                      <path
                        d="M 14 1.5 L 5.5 19.5 C 4.5 21.5 5.5 24 6.5 26.5 L 14 26.5 Z"
                        fill="url(#nibLeftBevel)"
                      />
                      {/* Right Half / Bevel of Nib */}
                      <path
                        d="M 14 1.5 L 22.5 19.5 C 23.5 21.5 22.5 24 21.5 26.5 L 14 26.5 Z"
                        fill="url(#nibRightBevel)"
                      />

                      {/* Center Slit Line */}
                      <line x1="14" y1="1.5" x2="14" y2="17.5" stroke="#3D4248" strokeWidth="0.8" />
                      {/* Breather Hole */}
                      <circle cx="14" cy="17.5" r="1.3" fill="#24282D" />

                      {/* Collar Ring */}
                      <path
                        d="M 6 26.5 C 6 25.5 22 25.5 22 26.5 L 22.5 29.5 C 22.5 30.5 5.5 30.5 5.5 29.5 Z"
                        fill="url(#penCollarGrad)"
                        stroke="#60666D"
                        strokeWidth="0.4"
                      />

                      {/* Pen Barrel Body (Tapering downwards with smooth rounded base) */}
                      <path
                        d="M 6 29.5 C 5.2 38 4.6 46.5 4 54 C 4 56.5 5.5 58 8 58 L 20 58 C 22.5 58 24 56.5 24 54 C 23.4 46.5 22.8 38 22 29.5 Z"
                        fill="url(#penBarrelGrad)"
                      />
                      {/* Left vertical subtle sheen highlight on pen barrel */}
                      <path
                        d="M 8 29.5 C 7.2 38 6.6 46.5 6 56 L 8.5 56 C 9.1 46.5 9.8 38 10.5 29.5 Z"
                        fill="#FFFFFF"
                        opacity="0.38"
                      />
                    </svg>
                  </div>
                  {activeTool === "pen" && (
                    <span
                      className="w-1.5 h-1.5 rounded-full absolute -bottom-2 shadow-sm transition-all"
                      style={{ backgroundColor: theme.accent }}
                    />
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
  }
);

DarAlHikayatHandwriting.displayName = "DarAlHikayatHandwriting";
export default DarAlHikayatHandwriting;

