import React, { useRef, useEffect, useLayoutEffect, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  MoreHorizontal,
  Eraser as EraserIcon,
  Trash2,
  XCircle,
  Check,
  Undo2,
  Redo2,
  PenTool,
  LassoSelect,
  Scissors,
  Plus,
} from "lucide-react";
import { DarAlHikayatColorPickerSheet } from "./DarAlHikayatColorPickerSheet";
import { ThemeColors } from "../contexts/AppContext";
import { hasHandwritingInk, type HandwritingSaveResult } from "../lib/handwriting-document";
import { isHandwritingFeatureEnabled } from "../lib/handwriting-feature-flags";
import { renderRecordedInk, calculateVelocity, getVelocityAdjustedWidth } from "../lib/handwriting-engine";
import { applyDualEraser, EraserMode, computeStrokeBounds } from "../lib/handwriting-eraser-dual";
import { renderHighlighterStroke, HIGHLIGHTER_CONFIG, HIGHLIGHTER_PALETTE, suppressSystemContextMenu } from "../lib/handwriting-highlighter";
import {
  findStrokesInsideLasso,
  computeSelectionBox,
  transformSelectedStrokes,
  getAnchorForCorner,
  computeScaledBox,
  type LassoBoundingBox,
} from "../lib/handwriting-lasso";
import { detectSmartShape, convertStrokeToShape, type DetectedShapeType, SHAPE_CONFIG } from "../lib/handwriting-shapes";

export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
  time: number;
  inkWidth?: number;
}

export interface Stroke {
  id: string;
  color: string;
  width: number;
  points: StrokePoint[];
  tool?: "pen" | "highlighter" | "shape" | "lasso";
  isHighlighter?: boolean;
  opacity?: number;
  shapeType?: DetectedShapeType;
  originalPoints?: StrokePoint[];
  renderVersion?: 1;
}

export interface HandwritingHandle {
  getStrokes: () => Stroke[];
  getDataUrl: () => string;
  getPageRuled: () => boolean;
  clear: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export interface DarAlHikayatHandwritingProps {
  isActive: boolean;
  isReadingMode?: boolean;
  onClose: () => void;
  onSave?: () => Promise<HandwritingSaveResult>;
  onTitleChange?: (title: string) => void;
  onReturnToEdit?: () => void;
  isSaving?: boolean;
  isDirty?: boolean;
  onDiscard?: () => void;
  theme: ThemeColors;
  initialStrokes?: Stroke[];
  initialPageRuled?: boolean;
  onStrokesChange?: (strokes: Stroke[], isPageRuled: boolean, dataUrl: string) => void;
  containerRef?: React.RefObject<HTMLElement | null>;
  onUndoChange?: (canUndo: boolean, canRedo: boolean) => void;
  backgroundStyle?: React.CSSProperties;
  title?: string;
  onInsertText?: (text: string) => void;
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
const EMPTY_STROKES: Stroke[] = [];

export const DarAlHikayatHandwriting = forwardRef<HandwritingHandle, DarAlHikayatHandwritingProps>(
  (
    {
      isActive,
      isReadingMode = false,
      onClose,
      onSave,
      onTitleChange,
      onReturnToEdit,
      isSaving = false,
      isDirty = false,
      onDiscard,
      theme,
      initialStrokes = EMPTY_STROKES,
      initialPageRuled = false,
      onStrokesChange,
      containerRef,
      onUndoChange,
      backgroundStyle,
      title,
      onInsertText,
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const ruledCanvasRef = useRef<HTMLCanvasElement>(null);

    // Canvas node mounting state
    const [canvasNode, setCanvasNode] = useState<HTMLCanvasElement | null>(null);
    const assignCanvasRef = useCallback((node: HTMLCanvasElement | null) => {
      canvasRef.current = node;
      setCanvasNode(node);
    }, []);

    // Drawing Tool States
    const [activeTool, setActiveTool] = useState<"pen" | "highlighter" | "eraser" | "lasso">("pen");
    const [eraserMode, setEraserMode] = useState<EraserMode>("partial");
    const [selectedThickness, setSelectedThickness] = useState<number>(3.5);
    const [selectedColor, setSelectedColor] = useState<string>(() => (theme.isDark ? "#FFFFFF" : "#121A1B"));
    const [selectedHighlighterColor, setSelectedHighlighterColor] = useState<string>("#FFE600");
    const [selectedHighlighterWidth, setSelectedHighlighterWidth] = useState<number>(26.0);
    const [isPageRuled, setIsPageRuled] = useState<boolean>(initialPageRuled);
    const [isSmartShapesEnabled, setIsSmartShapesEnabled] = useState<boolean>(true);

    // Lasso Selection States
    const [selectedStrokeIds, setSelectedStrokeIds] = useState<string[]>([]);
    const [selectionBox, setSelectionBox] = useState<LassoBoundingBox | null>(null);

    // Collapsed Capsule Dome State (Minimize/Expand)
    const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

    // Document actions
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [saveWarning, setSaveWarning] = useState<string | null>(null);
    const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const returnToEditRef = useRef(onReturnToEdit);
    returnToEditRef.current = onReturnToEdit;

    useEffect(() => () => {
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    }, []);

    const handleSaveClick = async () => {
      if (isSaving || !onSave) return;
      (document.activeElement as HTMLElement)?.blur?.();
      const result = await onSave();
      if (result !== "empty" && result !== "failed") return;
      setSaveWarning(
        result === "empty"
          ? "لا يمكن حفظ حكاية فارغة! ارسم بيدك أو اكتب عنواناً أولاً."
          : "تعذر الحفظ. رسوماتك ما زالت هنا؛ حاول مرة أخرى."
      );
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      warningTimerRef.current = setTimeout(() => setSaveWarning(null), 3000);
    };

    // Active popup capsule above bottom bar
    const [activePopup, setActivePopup] = useState<PopupType>("none");

    // Custom Color Picker Sheet States & History
    const [isColorPickerSheetOpen, setIsColorPickerSheetOpen] = useState<boolean>(false);
    const isColorPickerSheetOpenRef = useRef<boolean>(false);
    useEffect(() => {
      isColorPickerSheetOpenRef.current = isColorPickerSheetOpen;
    }, [isColorPickerSheetOpen]);

    const [customColors, setCustomColors] = useState<string[]>(() => {
      try {
        const stored = localStorage.getItem("dar_al_hikayat_custom_handwriting_colors");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) return parsed.slice(0, 6);
        }
      } catch {}
      return [];
    });

    const handleCustomColorApply = useCallback((hex: string) => {
      const isHl = activeToolRef.current === "highlighter";
      if (isHl) {
        setSelectedHighlighterColor(hex);
        selectedHighlighterColorRef.current = hex;
      } else {
        setSelectedColor(hex);
        selectedColorRef.current = hex;
        if (activeToolRef.current === "eraser" || activeToolRef.current === "lasso") {
          setActiveTool("pen");
          activeToolRef.current = "pen";
        }
      }
      setCustomColors((prev) => {
        const filtered = prev.filter((c) => c.toUpperCase() !== hex.toUpperCase());
        const updated = [hex.toUpperCase(), ...filtered].slice(0, 6);
        try {
          localStorage.setItem("dar_al_hikayat_custom_handwriting_colors", JSON.stringify(updated));
        } catch {}
        return updated;
      });
      setIsColorPickerSheetOpen(false);
      setActivePopup("none");
    }, []);

    // Strokes & History for Undo/Redo
    const [strokes, setStrokes] = useState<Stroke[]>(initialStrokes);
    const [history, setHistory] = useState<Stroke[][]>([initialStrokes]);
    const [historyIndex, setHistoryIndex] = useState<number>(0);
    const historyRef = useRef({ entries: history, index: historyIndex });
    historyRef.current = { entries: history, index: historyIndex };

    // Infinite Canvas Vertical Pan State & Refs
    const [panY, setPanY] = useState<number>(0);
    const panYRef = useRef<number>(0);
    const activePointersRef = useRef<Map<number, { clientX: number; clientY: number }>>(new Map());

    // Drawing in-progress refs
    const isDrawingRef = useRef<boolean>(false);
    const currentPointsRef = useRef<StrokePoint[]>([]);
    const lastPointRef = useRef<StrokePoint | null>(null);
    const lastPointWidthRef = useRef<number>(3.5);
    const didEraseDuringDragRef = useRef<boolean>(false);
    const lastInternalStrokesRef = useRef<Stroke[]>(initialStrokes);

    const activeToolRef = useRef<"pen" | "highlighter" | "eraser" | "lasso">("pen");
    const eraserModeRef = useRef<EraserMode>("partial");
    const selectedThicknessRef = useRef<number>(3.5);
    const selectedColorRef = useRef<string>(theme.isDark ? "#FFFFFF" : "#121A1B");
    const selectedHighlighterColorRef = useRef<string>("#FFE600");
    const selectedHighlighterWidthRef = useRef<number>(26.0);
    const strokesRef = useRef<Stroke[]>(initialStrokes);

    // Lasso refs
    const lassoLoopRef = useRef<{ x: number; y: number }[]>([]);
    const selectedStrokeIdsRef = useRef<string[]>([]);
    const currentSelectionBoxRef = useRef<LassoBoundingBox | null>(null);
    const baseSelectionBoxRef = useRef<LassoBoundingBox | null>(null);
    const isTransformingRef = useRef<boolean>(false);
    const transformModeRef = useRef<"move" | "scale" | null>(null);
    const scaleCornerIndexRef = useRef<number>(0);
    const scaleAnchorRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const transformStartRef = useRef<{ clientX: number; clientY: number; worldX: number; worldY: number } | null>(null);
    const preTransformStrokesRef = useRef<Stroke[] | null>(null);
    const pendingTransformRef = useRef<(() => void) | null>(null);
    const applyingTransformRef = useRef(false);
    const flushPendingTransform = () => {
      const pending = pendingTransformRef.current;
      pendingTransformRef.current = null;
      if (!pending) return;
      applyingTransformRef.current = true;
      try { pending(); } finally { applyingTransformRef.current = false; }
    };

    // Smart Shapes refs
    const shapeHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const candidateShapeRef = useRef<Stroke | null>(null);
    const isSmartShapesEnabledRef = useRef<boolean>(true);
    useEffect(() => () => {
      if (shapeHoldTimerRef.current) clearTimeout(shapeHoldTimerRef.current);
      shapeHoldTimerRef.current = null;
      candidateShapeRef.current = null;
    }, [isActive]);

    // Throttled redraw RAF
    const redrawRafIdRef = useRef<number | null>(null);

    // Spatial index of stroke bounding boxes for O(1) eraser culling
    const strokeBoundsRef = useRef<Map<string, { minX: number; maxX: number; minY: number; maxY: number }>>(new Map());

    useEffect(() => {
      activeToolRef.current = activeTool;
    }, [activeTool]);
    useEffect(() => {
      eraserModeRef.current = eraserMode;
    }, [eraserMode]);
    useEffect(() => {
      selectedThicknessRef.current = selectedThickness;
      lastPointWidthRef.current = selectedThickness;
    }, [selectedThickness]);
    useEffect(() => {
      selectedColorRef.current = selectedColor;
    }, [selectedColor]);
    useEffect(() => {
      selectedHighlighterColorRef.current = selectedHighlighterColor;
    }, [selectedHighlighterColor]);
    useEffect(() => {
      selectedHighlighterWidthRef.current = selectedHighlighterWidth;
    }, [selectedHighlighterWidth]);
    useEffect(() => {
      strokesRef.current = strokes;
    }, [strokes]);
    useEffect(() => {
      isSmartShapesEnabledRef.current = isSmartShapesEnabled;
    }, [isSmartShapesEnabled]);
    useEffect(() => {
      selectedStrokeIdsRef.current = selectedStrokeIds;
    }, [selectedStrokeIds]);

    // Keep default ink color in sync with theme changes
    useEffect(() => {
      const defaultInk = theme.isDark ? "#FFFFFF" : "#121A1B";
      setSelectedColor(defaultInk);
      selectedColorRef.current = defaultInk;
    }, [theme.isDark]);

    // High-performance batched canvas redraw
    const redrawAll = useCallback(
      (strokesToDraw: Stroke[], currentPanY: number = panYRef.current, includeSelection = true) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(dpr, dpr);
        ctx.translate(0, -currentPanY);

        // Pass 1: Committed Highlighter strokes (drawn with soft alpha and blend)
        for (let sIdx = 0; sIdx < strokesToDraw.length; sIdx++) {
          const stroke = strokesToDraw[sIdx];
          if (!stroke.points || stroke.points.length === 0) continue;
          if (stroke.isHighlighter || stroke.tool === "highlighter") {
            renderHighlighterStroke(
              ctx,
              stroke.points,
              stroke.color,
              stroke.width || HIGHLIGHTER_CONFIG.DEFAULT_WIDTH,
              stroke.opacity || HIGHLIGHTER_CONFIG.DEFAULT_OPACITY
            );
          }
        }

        // Pass 1b: Live in-progress Highlighter stroke (rendered under ink in real-time with no overlapping blotches!)
        if (
          isDrawingRef.current &&
          activeToolRef.current === "highlighter" &&
          currentPointsRef.current.length > 0
        ) {
          renderHighlighterStroke(
            ctx,
            currentPointsRef.current,
            selectedHighlighterColorRef.current || "#FFE600",
            selectedHighlighterWidthRef.current || HIGHLIGHTER_CONFIG.DEFAULT_WIDTH,
            HIGHLIGHTER_CONFIG.DEFAULT_OPACITY
          );
        }

        // Pass 2: Regular ink and shape strokes
        for (let sIdx = 0; sIdx < strokesToDraw.length; sIdx++) {
          const stroke = strokesToDraw[sIdx];
          if (!stroke.points || stroke.points.length === 0) continue;
          if (stroke.isHighlighter || stroke.tool === "highlighter") continue;

          // Compatibility only for ink already saved by v1.0.127. New ink uses the original renderer.
          if (stroke.renderVersion === 1) {
            renderRecordedInk(ctx, stroke);
            continue;
          }

          ctx.strokeStyle = stroke.color;
          ctx.fillStyle = stroke.color;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.lineWidth = stroke.width;

          if (stroke.points.length === 1) {
            const p = stroke.points[0];
            ctx.beginPath();
            ctx.arc(p.x, p.y, stroke.width / 2, 0, Math.PI * 2);
            ctx.fill();
            continue;
          }

          ctx.beginPath();
          const p0 = stroke.points[0];
          ctx.moveTo(p0.x, p0.y);

          for (let i = 1; i < stroke.points.length; i++) {
            const pt0 = stroke.points[i - 1];
            const pt1 = stroke.points[i];
            const midX = (pt0.x + pt1.x) / 2;
            const midY = (pt0.y + pt1.y) / 2;
            ctx.quadraticCurveTo(pt0.x, pt0.y, midX, midY);
          }
          const lastPt = stroke.points[stroke.points.length - 1];
          ctx.lineTo(lastPt.x, lastPt.y);
          ctx.stroke();
        }

        // Pass 3: Lasso loop in-progress
        if (includeSelection && lassoLoopRef.current.length > 1) {
          ctx.save();
          ctx.strokeStyle = theme.accent;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.moveTo(lassoLoopRef.current[0].x, lassoLoopRef.current[0].y);
          for (let i = 1; i < lassoLoopRef.current.length; i++) {
            ctx.lineTo(lassoLoopRef.current[i].x, lassoLoopRef.current[i].y);
          }
          ctx.stroke();
          ctx.restore();
        }

        // Pass 4: Lasso Selection Box overlay (uses real-time box from ref or state)
        const activeBox = currentSelectionBoxRef.current || selectionBox;
        if (includeSelection && activeBox && selectedStrokeIdsRef.current.length > 0) {
          ctx.save();
          ctx.strokeStyle = theme.accent;
          ctx.lineWidth = 1.8;
          ctx.setLineDash([6, 4]);
          ctx.strokeRect(activeBox.minX, activeBox.minY, activeBox.width, activeBox.height);

          // Corner handles for proportional scaling with high visibility
          const handleRadius = 6;
          ctx.setLineDash([]);
          const corners = [
            { x: activeBox.minX, y: activeBox.minY },
            { x: activeBox.maxX, y: activeBox.minY },
            { x: activeBox.maxX, y: activeBox.maxY },
            { x: activeBox.minX, y: activeBox.maxY },
          ];
          for (const c of corners) {
            ctx.beginPath();
            ctx.arc(c.x, c.y, handleRadius, 0, Math.PI * 2);
            ctx.fillStyle = "#FFFFFF";
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = theme.accent;
            ctx.stroke();
          }
          ctx.restore();
        }

        ctx.restore();
      },
      [selectionBox, theme.accent]
    );

    // Throttled RAF scheduler
    const scheduleRedraw = useCallback(() => {
      if (redrawRafIdRef.current !== null) return;
      redrawRafIdRef.current = requestAnimationFrame(() => {
        flushPendingTransform();
        redrawRafIdRef.current = null;
        redrawAll(strokesRef.current, panYRef.current);
      });
    }, [redrawAll]);

    useEffect(() => {
      return () => {
        pendingTransformRef.current = null;
        if (redrawRafIdRef.current !== null) {
          cancelAnimationFrame(redrawRafIdRef.current);
          redrawRafIdRef.current = null;
        }
      };
    }, []);

    // Synchronize initial strokes
    useEffect(() => {
      if (initialStrokes && initialStrokes !== lastInternalStrokesRef.current) {
        lastInternalStrokesRef.current = initialStrokes;
        setStrokes(initialStrokes);
        setHistory([initialStrokes]);
        setHistoryIndex(0);
        strokeBoundsRef.current.clear();
        redrawAll(initialStrokes, panYRef.current);
      }
    }, [initialStrokes, redrawAll]);

    useEffect(() => {
      setIsPageRuled(initialPageRuled);
    }, [initialPageRuled]);

    // Draw Ruled lines on background canvas
    const drawRuledLines = useCallback(
      (currentPanY: number = panYRef.current) => {
        const canvas = ruledCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        if (!isPageRuled) return;

        const viewportHeight = canvas.height / dpr;
        const width = canvas.width / dpr;
        const lineHeight = 38;
        const startY = 80;

        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.translate(0, -currentPanY);

        ctx.strokeStyle = theme.isDark ? "rgba(226, 223, 210, 0.16)" : "rgba(18, 26, 27, 0.15)";
        ctx.lineWidth = 1;

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

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const docWidth = window.innerWidth || document.documentElement.clientWidth || 360;
      const docHeight = window.innerHeight || document.documentElement.clientHeight || 640;

      const targetW = Math.round(docWidth * dpr);
      const targetH = Math.round(docHeight * dpr);

      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;

        ruledCanvas.width = targetW;
        ruledCanvas.height = targetH;

        redrawAll(strokesRef.current, panYRef.current);
        drawRuledLines(panYRef.current);
      }
    }, [redrawAll, drawRuledLines]);

    useLayoutEffect(() => {
      resizeCanvases();
      window.addEventListener("resize", resizeCanvases);
      window.visualViewport?.addEventListener("resize", resizeCanvases);
      const timer1 = setTimeout(resizeCanvases, 150);
      const timer2 = setTimeout(resizeCanvases, 400);
      return () => {
        window.removeEventListener("resize", resizeCanvases);
        window.visualViewport?.removeEventListener("resize", resizeCanvases);
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }, [resizeCanvases, canvasNode]);

    // Lock body scroll and reset viewport scroll
    useEffect(() => {
      if (isActive) {
        panYRef.current = 0;
        setPanY(0);
        const prevOverflow = document.body.style.overflow;
        const prevTouchAction = document.body.style.touchAction;
        document.body.style.overflow = "hidden";
        document.body.style.touchAction = "none";
        window.scrollTo(0, 0);
        return () => {
          document.body.style.overflow = prevOverflow;
          document.body.style.touchAction = prevTouchAction;
        };
      }
    }, [isActive]);

    useEffect(() => {
      drawRuledLines(panYRef.current);
    }, [drawRuledLines, isPageRuled]);

    useEffect(() => {
      if (!isActive && !isReadingMode) return;
      if (isReadingMode) {
        let firstY = Infinity;
        for (const stroke of strokesRef.current) {
          for (const point of stroke.points) {
            if (Number.isFinite(point.y)) firstY = Math.min(firstY, point.y);
          }
        }
        const start =
          Number.isFinite(firstY) && firstY >= window.innerHeight - 96
            ? Math.max(0, firstY - 112)
            : 0;
        panYRef.current = start;
        setPanY(start);
      }
      redrawAll(strokesRef.current, panYRef.current);
      drawRuledLines(panYRef.current);
    }, [isActive, isReadingMode, redrawAll, drawRuledLines]);

    // Export current canvas as data URL on-demand
    const generateDataUrl = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas || !hasHandwritingInk(strokesRef.current)) return "";
      redrawAll(strokesRef.current, panYRef.current, false);
      try { return canvas.toDataURL("image/png"); }
      finally { redrawAll(strokesRef.current, panYRef.current); }
    }, [redrawAll]);

    const onStrokesChangeRef = useRef(onStrokesChange);
    onStrokesChangeRef.current = onStrokesChange;
    const notifyChange = useCallback((newStrokes: Stroke[], ruled: boolean) => {
      onStrokesChangeRef.current?.(newStrokes, ruled, "");
    }, []);

    // Notify undo/redo availability to parent
    useEffect(() => {
      if (onUndoChange) {
        onUndoChange(historyIndex > 0, historyIndex < history.length - 1);
      }
    }, [historyIndex, history.length, onUndoChange]);

    // History push
    const recordHistory = (newStrokes: Stroke[], beforeConversion?: Stroke[]) => {
      const nextHistory = historyRef.current.entries.slice(0, historyRef.current.index + 1);
      if (beforeConversion) nextHistory.push(beforeConversion);
      nextHistory.push(newStrokes);
      while (nextHistory.length > 50) nextHistory.shift();
      const newIdx = nextHistory.length - 1;
      historyRef.current = { entries: nextHistory, index: newIdx };
      strokeBoundsRef.current.clear();
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
        strokesRef.current = previousStrokes;
        strokeBoundsRef.current.clear();
        setStrokes(previousStrokes);
        setSelectedStrokeIds([]);
        selectedStrokeIdsRef.current = [];
        currentSelectionBoxRef.current = null;
        setSelectionBox(null);
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
        strokesRef.current = nextStrokes;
        strokeBoundsRef.current.clear();
        setStrokes(nextStrokes);
        setSelectedStrokeIds([]);
        selectedStrokeIdsRef.current = [];
        currentSelectionBoxRef.current = null;
        setSelectionBox(null);
        redrawAll(nextStrokes, panYRef.current);
        notifyChange(nextStrokes, isPageRuled);
        if (onUndoChange) {
          onUndoChange(nextIndex > 0, nextIndex < history.length - 1);
        }
      }
    }, [history, historyIndex, redrawAll, notifyChange, isPageRuled, onUndoChange]);

    // Keyboard shortcuts for Undo and Redo
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
      selectedStrokeIdsRef.current = [];
      currentSelectionBoxRef.current = null;
      recordHistory([]);
      strokesRef.current = [];
      redrawAll([], panYRef.current);
      strokeBoundsRef.current.clear();
      setSelectedStrokeIds([]);
      setSelectionBox(null);
      setActivePopup("none");
    }, [history, historyIndex, redrawAll, isPageRuled]);

    // Discard entire handwriting mode
    const handleDiscardAll = useCallback(() => {
      setStrokes([]);
      setHistory([[]]);
      setHistoryIndex(0);
      historyRef.current = { entries: [[]], index: 0 };
      selectedStrokeIdsRef.current = [];
      currentSelectionBoxRef.current = null;
      strokesRef.current = [];
      lastInternalStrokesRef.current = [];
      strokeBoundsRef.current.clear();
      setSelectedStrokeIds([]);
      setSelectionBox(null);
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

    // Dual Vector Eraser integration
    const eraseAtPoint = (worldX: number, worldY: number, radius = 28) => {
      const mode = isHandwritingFeatureEnabled("DUAL_VECTOR_ERASER") ? eraserModeRef.current : "partial";
      const { nextStrokes, modified } = applyDualEraser(
        strokesRef.current,
        worldX,
        worldY,
        radius,
        mode,
        strokeBoundsRef.current
      );

      if (modified) {
        didEraseDuringDragRef.current = true;
        strokesRef.current = nextStrokes;
        scheduleRedraw();
      }
    };

    // Delete selected strokes in Lasso
    const handleDeleteSelectedLasso = () => {
      if (selectedStrokeIdsRef.current.length === 0) return;
      const idsToDelete = new Set(selectedStrokeIdsRef.current);
      const remaining = strokesRef.current.filter((s) => !idsToDelete.has(s.id));
      for (const id of idsToDelete) {
        strokeBoundsRef.current.delete(id);
      }
      strokesRef.current = remaining;
      setSelectedStrokeIds([]);
      selectedStrokeIdsRef.current = [];
      currentSelectionBoxRef.current = null;
      setSelectionBox(null);
      recordHistory(remaining);
      redrawAll(remaining, panYRef.current);
    };

    // Core Drawing Helpers
    const startDrawing = (clientX: number, clientY: number, pressure = 0.5) => {
      if (isColorPickerSheetOpenRef.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();

      const worldX = clientX - rect.left;
      const worldY = clientY - rect.top + panYRef.current;

      isDrawingRef.current = true;
      didEraseDuringDragRef.current = false;
      candidateShapeRef.current = null;

      // Handle Lasso Interactions
      if (activeToolRef.current === "lasso") {
        const activeBox = currentSelectionBoxRef.current || selectionBox;
        if (activeBox && selectedStrokeIdsRef.current.length > 0) {
          // Check corner scaling handles with adaptive radius
          const handleRadius = Math.max(12, Math.min(22, Math.min(activeBox.width, activeBox.height) * 0.35));
          const corners = [
            { x: activeBox.minX, y: activeBox.minY }, // 0: Top-Left
            { x: activeBox.maxX, y: activeBox.minY }, // 1: Top-Right
            { x: activeBox.maxX, y: activeBox.maxY }, // 2: Bottom-Right
            { x: activeBox.minX, y: activeBox.maxY }, // 3: Bottom-Left
          ];

          let hitCornerIndex = -1;
          for (let i = 0; i < 4; i++) {
            if (Math.hypot(corners[i].x - worldX, corners[i].y - worldY) <= handleRadius) {
              hitCornerIndex = i;
              break;
            }
          }

          if (hitCornerIndex !== -1) {
            isTransformingRef.current = true;
            transformModeRef.current = "scale";
            scaleCornerIndexRef.current = hitCornerIndex;
            const anchor = getAnchorForCorner(hitCornerIndex, activeBox);
            scaleAnchorRef.current = anchor;
            transformStartRef.current = { clientX, clientY, worldX, worldY };
            preTransformStrokesRef.current = [...strokesRef.current];
            baseSelectionBoxRef.current = { ...activeBox };
            return;
          }

          // Check inside bounding box for moving
          const hitPadding = 8;
          const insideBox =
            worldX >= activeBox.minX - hitPadding &&
            worldX <= activeBox.maxX + hitPadding &&
            worldY >= activeBox.minY - hitPadding &&
            worldY <= activeBox.maxY + hitPadding;

          if (insideBox) {
            isTransformingRef.current = true;
            transformModeRef.current = "move";
            transformStartRef.current = { clientX, clientY, worldX, worldY };
            preTransformStrokesRef.current = [...strokesRef.current];
            baseSelectionBoxRef.current = { ...activeBox };
            return;
          }
        }

        // New lasso loop start
        setSelectedStrokeIds([]);
        selectedStrokeIdsRef.current = [];
        currentSelectionBoxRef.current = null;
        setSelectionBox(null);
        lassoLoopRef.current = [{ x: worldX, y: worldY }];
        scheduleRedraw();
        return;
      }

      const startPoint: StrokePoint = { x: worldX, y: worldY, pressure, time: performance.now() };
      currentPointsRef.current = [startPoint];
      lastPointRef.current = startPoint;
      lastPointWidthRef.current = selectedThicknessRef.current;

      if (activeToolRef.current === "eraser") {
        eraseAtPoint(worldX, worldY);
      } else if (activeToolRef.current === "highlighter") {
        redrawAll(strokesRef.current, panYRef.current);
      } else {
        // Pen: instant first pixel dot
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.scale(dpr, dpr);
          ctx.translate(0, -panYRef.current);
          ctx.fillStyle = selectedColorRef.current || (theme.isDark ? "#FFFFFF" : "#121A1B");
          ctx.beginPath();
          ctx.arc(worldX, worldY, selectedThicknessRef.current / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Hold-to-Shape timer init
        if (isSmartShapesEnabledRef.current && isHandwritingFeatureEnabled("SMART_SHAPE_RECOGNITION")) {
          if (shapeHoldTimerRef.current) clearTimeout(shapeHoldTimerRef.current);
          shapeHoldTimerRef.current = setTimeout(() => {
            if (isDrawingRef.current && currentPointsRef.current.length >= 12) {
              const detection = detectSmartShape(currentPointsRef.current);
              if (detection.isShape) {
                const tempStroke: Stroke = {
                  id: `shape_${Date.now()}`,
                  color: selectedColorRef.current,
                  width: selectedThicknessRef.current,
                  points: [...currentPointsRef.current],
                };
                candidateShapeRef.current = convertStrokeToShape(tempStroke, detection);
              }
            }
          }, SHAPE_CONFIG.HOLD_DURATION_MS);
        }
      }
    };

    const moveDrawing = (clientX: number, clientY: number, pressure = 0.5) => {
      if (isColorPickerSheetOpenRef.current) return;
      if (!isDrawingRef.current || !isActive) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();

      const worldX = clientX - rect.left;
      const worldY = clientY - rect.top + panYRef.current;
      const point: StrokePoint = { x: worldX, y: worldY, pressure, time: performance.now() };

      // Handle Lasso transforms during move
      const baseBox = baseSelectionBoxRef.current || currentSelectionBoxRef.current || selectionBox;
      if (isTransformingRef.current && transformStartRef.current && preTransformStrokesRef.current && baseBox) {
        // Coalesce pointer/coalesced samples: clone selected geometry once per frame.
        if (!applyingTransformRef.current) {
          pendingTransformRef.current = () => moveDrawing(clientX, clientY, pressure);
          scheduleRedraw();
          return;
        }
        const dx = worldX - transformStartRef.current.worldX;
        const dy = worldY - transformStartRef.current.worldY;

        if (transformModeRef.current === "move") {
          const nextStrokes = transformSelectedStrokes(
            preTransformStrokesRef.current,
            selectedStrokeIdsRef.current,
            dx,
            dy,
            1,
            0,
            0
          );
          strokesRef.current = nextStrokes;

          // Real-time bounding box translation so frame moves with the strokes!
          const updatedBox: LassoBoundingBox = {
            minX: baseBox.minX + dx,
            maxX: baseBox.maxX + dx,
            minY: baseBox.minY + dy,
            maxY: baseBox.maxY + dy,
            width: baseBox.width,
            height: baseBox.height,
            centerX: baseBox.centerX + dx,
            centerY: baseBox.centerY + dy,
          };
          currentSelectionBoxRef.current = updatedBox;
          scheduleRedraw();
          return;
        }

        if (transformModeRef.current === "scale") {
          const anchor = scaleAnchorRef.current;
          if (anchor) {
            const corner = {
              x: scaleCornerIndexRef.current === 0 || scaleCornerIndexRef.current === 3 ? baseBox.minX : baseBox.maxX,
              y: scaleCornerIndexRef.current === 0 || scaleCornerIndexRef.current === 1 ? baseBox.minY : baseBox.maxY,
            };
            const vecX = corner.x - anchor.x;
            const vecY = corner.y - anchor.y;
            const baseDiag = Math.hypot(vecX, vecY);

            let scale = 1;
            if (baseDiag > 4) {
              const dragVecX = worldX - anchor.x;
              const dragVecY = worldY - anchor.y;
              const proj = (dragVecX * vecX + dragVecY * vecY) / baseDiag;
              scale = Math.max(0.15, Math.min(5.0, proj / baseDiag));
            }

            const nextStrokes = transformSelectedStrokes(
              preTransformStrokesRef.current,
              selectedStrokeIdsRef.current,
              0,
              0,
              scale,
              anchor.x,
              anchor.y
            );
            strokesRef.current = nextStrokes;

            // Real-time bounding box scaling anchored precisely to the opposite corner!
            const updatedBox = computeScaledBox(baseBox, anchor, scale);
            currentSelectionBoxRef.current = updatedBox;
            scheduleRedraw();
            return;
          }
        }
      }

      // Handle Lasso loop drawing
      if (activeToolRef.current === "lasso") {
        lassoLoopRef.current.push({ x: worldX, y: worldY });
        scheduleRedraw();
        return;
      }

      if (activeToolRef.current === "eraser") {
        eraseAtPoint(worldX, worldY);
      } else if (activeToolRef.current === "highlighter") {
        currentPointsRef.current.push(point);
        lastPointRef.current = point;
        scheduleRedraw();
      } else {
        // Pen drawing with velocity-sensitive smooth Bezier
        const prevPoint = lastPointRef.current;
        if (prevPoint) {
          const velocity = calculateVelocity(prevPoint, point);
          const dynamicWidth = isHandwritingFeatureEnabled("SMOOTH_GRAPHICS_ENGINE")
            ? getVelocityAdjustedWidth(selectedThicknessRef.current, velocity, lastPointWidthRef.current)
            : selectedThicknessRef.current;

          lastPointWidthRef.current = dynamicWidth;

          const midX = (prevPoint.x + worldX) / 2;
          const midY = (prevPoint.y + worldY) / 2;

          const ctx = canvas.getContext("2d");
          if (ctx) {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);
            ctx.translate(0, -panYRef.current);

            ctx.strokeStyle = selectedColorRef.current || (theme.isDark ? "#FFFFFF" : "#121A1B");
            ctx.lineWidth = dynamicWidth;
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

        // Any resumed movement invalidates a previously held candidate.
        candidateShapeRef.current = null;
        // Reset hold timer if hand continues to move actively
        if (isSmartShapesEnabledRef.current && isHandwritingFeatureEnabled("SMART_SHAPE_RECOGNITION") && shapeHoldTimerRef.current) {
          clearTimeout(shapeHoldTimerRef.current);
          shapeHoldTimerRef.current = setTimeout(() => {
            if (isDrawingRef.current && currentPointsRef.current.length >= 12) {
              const detection = detectSmartShape(currentPointsRef.current);
              if (detection.isShape) {
                const tempStroke: Stroke = {
                  id: `shape_${Date.now()}`,
                  color: selectedColorRef.current,
                  width: selectedThicknessRef.current,
                  points: [...currentPointsRef.current],
                };
                candidateShapeRef.current = convertStrokeToShape(tempStroke, detection);
              }
            }
          }, SHAPE_CONFIG.HOLD_DURATION_MS);
        }
      }
    };

    const finishDrawing = (allowShape = true) => {
      if (!isDrawingRef.current) return;
      flushPendingTransform();
      isDrawingRef.current = false;

      if (shapeHoldTimerRef.current) {
        clearTimeout(shapeHoldTimerRef.current);
        shapeHoldTimerRef.current = null;
      }

      // Commit Lasso Transform
      if (isTransformingRef.current) {
        isTransformingRef.current = false;
        transformModeRef.current = null;
        transformStartRef.current = null;
        preTransformStrokesRef.current = null;
        baseSelectionBoxRef.current = null;
        const newBox = computeSelectionBox(strokesRef.current, selectedStrokeIdsRef.current);
        currentSelectionBoxRef.current = newBox;
        setSelectionBox(newBox);
        recordHistory(strokesRef.current);
        scheduleRedraw();
        return;
      }

      // Finish Lasso Loop
      if (activeToolRef.current === "lasso") {
        if (lassoLoopRef.current.length >= 2) {
          const selected = findStrokesInsideLasso(strokesRef.current, lassoLoopRef.current);
          setSelectedStrokeIds(selected);
          selectedStrokeIdsRef.current = selected;
          const box = computeSelectionBox(strokesRef.current, selected);
          currentSelectionBoxRef.current = box;
          setSelectionBox(box);
        } else {
          setSelectedStrokeIds([]);
          selectedStrokeIdsRef.current = [];
          currentSelectionBoxRef.current = null;
          setSelectionBox(null);
        }
        lassoLoopRef.current = [];
        scheduleRedraw();
        return;
      }

      if (activeToolRef.current === "eraser") {
        if (didEraseDuringDragRef.current) {
          didEraseDuringDragRef.current = false;
          recordHistory(strokesRef.current);
        }
        return;
      }

      if (activeToolRef.current === "highlighter" && currentPointsRef.current.length > 0) {
        const newStroke: Stroke = {
          id: `highlighter_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          color: selectedHighlighterColorRef.current || "#FFE600",
          width: selectedHighlighterWidthRef.current || HIGHLIGHTER_CONFIG.DEFAULT_WIDTH,
          tool: "highlighter",
          isHighlighter: true,
          opacity: HIGHLIGHTER_CONFIG.DEFAULT_OPACITY,
          points: [...currentPointsRef.current],
        };
        const updated = [...strokesRef.current, newStroke];
        strokesRef.current = updated;
        setStrokes(updated);
        recordHistory(updated);
        notifyChange(updated, isPageRuled);
        redrawAll(updated, panYRef.current);
      } else if (activeToolRef.current === "pen" && currentPointsRef.current.length > 0) {
        const rawStroke: Stroke = {
          id: `stroke_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          color: selectedColorRef.current,
          width: selectedThicknessRef.current,
          points: [...currentPointsRef.current],
        };
        // Only a hold completed BEFORE lift may convert; never recognize on lift.
        const held = allowShape && isSmartShapesEnabledRef.current &&
          isHandwritingFeatureEnabled("SMART_SHAPE_RECOGNITION") && candidateShapeRef.current;
        const finalStroke = held ? { ...held, id: rawStroke.id } : rawStroke;
        const beforeConversion = held ? [...strokesRef.current, rawStroke] : undefined;
        const updated = [...strokesRef.current, finalStroke];
        strokesRef.current = updated;
        recordHistory(updated, beforeConversion);
        redrawAll(updated, panYRef.current);
      }

      currentPointsRef.current = [];
      lastPointRef.current = null;
      candidateShapeRef.current = null;
    };

    // Robust pointer & touch event handling
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      let isDrawing = false;
      let isPanning = false;
      let lastPanY = 0;

      const blockTouchGesture = (e: TouchEvent) => {
        if (!isActive && !isReadingMode) return;
        if (e.cancelable) {
          e.preventDefault();
        }
      };

      const handlePointerDown = (e: PointerEvent) => {
        if (!isActive && !isReadingMode) return;
        if (isColorPickerSheetOpenRef.current) return;
        e.preventDefault();

        activePointersRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

        if (isReadingMode) {
          isPanning = true;
          let sumY = 0;
          activePointersRef.current.forEach((p) => (sumY += p.clientY));
          lastPanY = sumY / activePointersRef.current.size;
          return;
        }

        if (activePointersRef.current.size >= 2) {
          isPanning = true;
          if (isDrawing) {
            isDrawing = false;
            isDrawingRef.current = false;
            currentPointsRef.current = [];
            lastPointRef.current = null;
            scheduleRedraw();
          }
          let sumY = 0;
          activePointersRef.current.forEach((p) => (sumY += p.clientY));
          lastPanY = sumY / activePointersRef.current.size;
          return;
        }

        isPanning = false;
        isDrawing = true;
        const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;
        startDrawing(e.clientX, e.clientY, pressure);
      };

      const handlePointerMove = (e: PointerEvent) => {
        if (!isActive && !isReadingMode) return;
        if (isColorPickerSheetOpenRef.current) return;

        if (activePointersRef.current.has(e.pointerId)) {
          activePointersRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
        }

        if (isReadingMode || isPanning || activePointersRef.current.size >= 2) {
          if (activePointersRef.current.size > 0) {
            let sumY = 0;
            activePointersRef.current.forEach((p) => (sumY += p.clientY));
            const currentAvgY = sumY / activePointersRef.current.size;
            const deltaY = currentAvgY - lastPanY;
            lastPanY = currentAvgY;

            const nextPanY = Math.max(0, panYRef.current - deltaY);
            if (Math.abs(nextPanY - panYRef.current) > 0.3) {
              panYRef.current = nextPanY;
              setPanY(nextPanY);
              scheduleRedraw();
              drawRuledLines(nextPanY);
            }
          }
          return;
        }

        if (isDrawing && isDrawingRef.current) {
          e.preventDefault();
          if (typeof (e as any).getCoalescedEvents === "function") {
            const coalesced = (e as any).getCoalescedEvents();
            if (coalesced && coalesced.length > 0) {
              for (let i = 0; i < coalesced.length; i++) {
                const cEvent = coalesced[i];
                const pressure = cEvent.pressure && cEvent.pressure > 0 ? cEvent.pressure : 0.5;
                moveDrawing(cEvent.clientX, cEvent.clientY, pressure);
              }
              return;
            }
          }

          const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;
          moveDrawing(e.clientX, e.clientY, pressure);
        }
      };

      const handlePointerUp = (e: PointerEvent) => {
        activePointersRef.current.delete(e.pointerId);

        if (isReadingMode) {
          if (activePointersRef.current.size === 0) {
            isPanning = false;
          } else {
            let sumY = 0;
            activePointersRef.current.forEach((p) => (sumY += p.clientY));
            lastPanY = sumY / activePointersRef.current.size;
          }
          return;
        }

        if (!isActive) return;

        if (activePointersRef.current.size < 2) {
          isPanning = false;
        }

        if (activePointersRef.current.size === 0) {
          isPanning = false;
          if (isDrawing || isDrawingRef.current) {
            isDrawing = false;
            finishDrawing(e.type === "pointerup");
          }
        }
      };

      const handleWindowBlur = () => {
        activePointersRef.current.clear();
        isPanning = false;
        if (isDrawing || isDrawingRef.current) {
          isDrawing = false;
          finishDrawing(false);
        }
      };

      canvas.addEventListener("touchstart", blockTouchGesture, { passive: false });
      canvas.addEventListener("touchmove", blockTouchGesture, { passive: false });
      canvas.addEventListener("touchend", blockTouchGesture, { passive: false });
      canvas.addEventListener("touchcancel", blockTouchGesture, { passive: false });

      canvas.addEventListener("pointerdown", handlePointerDown, { passive: false });
      canvas.addEventListener("contextmenu", suppressSystemContextMenu);

      window.addEventListener("pointermove", handlePointerMove, { passive: false });
      window.addEventListener("pointerup", handlePointerUp, { passive: false });
      window.addEventListener("pointercancel", handlePointerUp, { passive: false });
      window.addEventListener("blur", handleWindowBlur);

      return () => {
        canvas.removeEventListener("touchstart", blockTouchGesture);
        canvas.removeEventListener("touchmove", blockTouchGesture);
        canvas.removeEventListener("touchend", blockTouchGesture);
        canvas.removeEventListener("touchcancel", blockTouchGesture);

        canvas.removeEventListener("pointerdown", handlePointerDown);
        canvas.removeEventListener("contextmenu", suppressSystemContextMenu);

        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerUp);
        window.removeEventListener("blur", handleWindowBlur);
      };
    }, [isActive, isReadingMode, scheduleRedraw, drawRuledLines]);

    // Reading mode tap detection
    useEffect(() => {
      if (!isReadingMode || !canvasNode) return;
      let tap: { id: number; x: number; y: number; valid: boolean } | null = null;
      const down = (event: PointerEvent) => {
        if (tap) {
          tap.valid = false;
          return;
        }
        tap = { id: event.pointerId, x: event.clientX, y: event.clientY, valid: true };
      };
      const move = (event: PointerEvent) => {
        if (tap?.id === event.pointerId && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 6) {
          tap.valid = false;
        }
      };
      const up = (event: PointerEvent) => {
        if (!tap || tap.id !== event.pointerId) return;
        const rect = canvasNode.getBoundingClientRect();
        const isTap =
          tap.valid &&
          event.type === "pointerup" &&
          Math.hypot(event.clientX - tap.x, event.clientY - tap.y) <= 6 &&
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom;
        tap = null;
        if (isTap) returnToEditRef.current?.();
      };
      const cancel = () => {
        tap = null;
      };
      canvasNode.addEventListener("pointerdown", down);
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", cancel);
      window.addEventListener("blur", cancel);
      return () => {
        canvasNode.removeEventListener("pointerdown", down);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", cancel);
        window.removeEventListener("blur", cancel);
      };
    }, [isReadingMode, canvasNode]);

    const handleWheel = (e: React.WheelEvent) => {
      if (!isActive && !isReadingMode) return;
      const nextPanY = Math.max(0, panYRef.current + e.deltaY);
      if (nextPanY !== panYRef.current) {
        panYRef.current = nextPanY;
        setPanY(nextPanY);
        scheduleRedraw();
        drawRuledLines(nextPanY);
      }
    };

    useImperativeHandle(ref, () => ({
      getStrokes: () => strokesRef.current,
      getDataUrl: () => generateDataUrl(),
      getPageRuled: () => isPageRuled,
      clear: () => handleClearAll(),
      undo: () => handleUndo(),
      redo: () => handleRedo(),
      canUndo: () => historyIndex > 0,
      canRedo: () => historyIndex < history.length - 1,
    }));

    const togglePopup = (popup: PopupType) => {
      setActivePopup((prev) => (prev === popup ? "none" : popup));
    };

    const closePopups = () => {
      setActivePopup("none");
    };

    const barBg = theme.mode === "apple_dark" ? "#1C1C1E" : theme.glass;
    const barBorder = theme.mode === "apple_dark" ? "rgba(255, 255, 255, 0.08)" : theme.border;
    const barShadow = theme.shadow || "0 4px 30px rgba(0,0,0,0.4)";

    const shouldDisplay = isActive || (isReadingMode && strokes.length > 0);

    if (!shouldDisplay) {
      return null;
    }

    const handwritingBgStyle: React.CSSProperties = {
      backgroundColor: theme.mode === "apple_dark" ? "#000000" : theme.bg || (theme.isDark ? "#111718" : "#F4F1EA"),
      color: theme.text,
    };

    const handwritingView = (
      <div
        id="handwriting-document-layer"
        data-mode={isActive ? "edit" : "read"}
        className="fixed inset-0 pointer-events-auto transition-opacity duration-300"
        style={{
          ...handwritingBgStyle,
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
          touchAction: "none",
          zIndex: 999999,
        }}
        onClick={(e) => {
          e.stopPropagation();
          if ((e.target as HTMLElement)?.id === "handwriting-canvas-layer") {
            closePopups();
          }
        }}
      >
        {/* Layer 1: Ruled Lines Canvas */}
        <canvas
          ref={ruledCanvasRef}
          className="absolute inset-0 pointer-events-none w-full h-full"
          style={{
            display: isPageRuled ? "block" : "none",
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            zIndex: 1,
          }}
        />

        {/* Layer 2: Main Inking Canvas */}
        <canvas
          id="handwriting-canvas-layer"
          ref={assignCanvasRef}
          className={`absolute inset-0 w-full h-full ${
            isActive
              ? activeTool === "lasso"
                ? "cursor-crosshair"
                : "cursor-crosshair"
              : isReadingMode
              ? "cursor-grab active:cursor-grabbing"
              : "pointer-events-none"
          }`}
          onWheel={handleWheel}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            touchAction: "none",
            zIndex: 2,
          }}
        />

        {saveWarning && isActive && (
          <div
            role="status"
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[10000000] pointer-events-none w-max max-w-[calc(100vw-32px)]"
            dir="rtl"
          >
            <div
              className="backdrop-blur-xl rounded-full px-5 py-2.5 border shadow-2xl flex items-center gap-2.5"
              style={{
                backgroundColor: theme.isDark ? "rgba(25, 26, 35, 0.95)" : "rgba(255, 255, 255, 0.95)",
                borderColor: `${theme.accent}60`,
              }}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse" style={{ backgroundColor: theme.accent }} />
              <p className="font-zain-bold text-sm leading-normal" style={{ color: theme.text }}>
                {saveWarning}
              </p>
            </div>
          </div>
        )}

        {isSaving && (
          <div className="fixed inset-0 z-[10000000] cursor-wait" aria-busy="true" onKeyDown={(e) => e.stopPropagation()}>
            <span
              role="status"
              className="absolute top-20 left-1/2 -translate-x-1/2 rounded-full px-4 py-2 font-zain-bold text-sm"
              style={{ backgroundColor: theme.bg, color: theme.text }}
            >
              جارٍ الحفظ…
            </span>
          </div>
        )}

        {isReadingMode && (
          <div className="fixed bottom-6 left-0 right-0 z-50 pointer-events-none text-center">
            <span className="text-xs font-zain-reg" style={{ color: theme.secondary }}>
              اسحب لقراءة الرسم، واضغط عليه للعودة للكتابة
            </span>
          </div>
        )}

        {/* Top Header Capsule Bar */}
        {(isActive || isReadingMode) && (
          <header
            className="fixed top-4 left-0 right-0 px-4 pointer-events-none flex justify-center items-center transition-all duration-300 ease-out"
            dir="rtl"
            style={{ zIndex: 9999999 }}
          >
            <div
              className="pointer-events-auto relative w-full max-w-sm sm:max-w-md md:max-w-lg h-12 p-1.5 rounded-full backdrop-blur-2xl border-[0.5px] flex justify-between items-center gap-1.5 shadow-2xl transition-all duration-300"
              style={{
                backgroundColor: theme.mode === "apple_dark" ? "#1C1C1E" : theme.glass,
                borderColor: theme.mode === "apple_dark" ? "rgba(255, 255, 255, 0.08)" : theme.border,
                boxShadow:
                  theme.mode === "apple_dark"
                    ? "0 4px 30px rgba(0, 0, 0, 0.4), 0 1px 3px rgba(0, 0, 0, 0.6)"
                    : theme.shadow,
                borderRadius: "9999px",
              }}
            >
              <div className="flex items-center gap-1 flex-1 min-w-0 pr-1 overflow-hidden">
                <button
                  onClick={onClose}
                  className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer flex-shrink-0 apple-elastic-pinch"
                  style={{ color: theme.text }}
                  disabled={isSaving}
                  title={isReadingMode ? "خروج" : "رجوع"}
                >
                  <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
                </button>
                <div className="flex flex-col justify-center min-w-0 h-9 flex-1">
                  {isEditingTitle && isActive ? (
                    <input
                      aria-label="عنوان الحكاية"
                      value={title || ""}
                      placeholder="بدون عنوان"
                      onChange={(e) => onTitleChange?.(e.target.value)}
                      onBlur={() => setIsEditingTitle(false)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                      }}
                      disabled={isSaving}
                      className="bg-transparent border-none outline-none font-zain-bold text-sm text-right px-0 py-0 m-0 w-full leading-none"
                      style={{ color: theme.text }}
                      autoFocus
                    />
                  ) : (
                    <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                      <h1
                        onClick={() => {
                          if (isActive && !isSaving) {
                            setIsEditingTitle(true);
                          }
                        }}
                        role={isActive ? "button" : undefined}
                        tabIndex={isActive ? 0 : undefined}
                        className={`text-sm font-zain-bold truncate text-right leading-none min-w-0 flex-1 overflow-hidden whitespace-nowrap block select-none ${
                          isActive ? "cursor-pointer" : ""
                        }`}
                        style={{ color: theme.text }}
                        title={title || "بدون عنوان"}
                      >
                        {title || "بدون عنوان"}
                      </h1>
                    </div>
                  )}
                  {isDirty && isActive && (
                    <div className="flex items-center justify-start pointer-events-none select-none mt-1 overflow-visible">
                      <span
                        className="font-zain-light font-normal text-right whitespace-nowrap opacity-75 inline-block select-none"
                        style={{
                          fontSize: "9.5px",
                          transform: "scale(0.82)",
                          transformOrigin: "right center",
                          lineHeight: "1",
                          color: theme.secondary,
                        }}
                      >
                        توجد تغييرات غير محفوظة
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Top Bar Left: Undo, Redo, Save */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {isActive ? (
                  <>
                    <button
                      onClick={handleUndo}
                      disabled={historyIndex <= 0}
                      className={`w-9 h-9 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all ${
                        historyIndex > 0 ? "cursor-pointer" : "cursor-not-allowed opacity-40"
                      }`}
                      style={{
                        color: historyIndex > 0 ? theme.text : theme.secondary,
                      }}
                      title="تراجع"
                    >
                      <Undo2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={handleRedo}
                      disabled={historyIndex >= history.length - 1}
                      className={`w-9 h-9 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all ${
                        historyIndex < history.length - 1 ? "cursor-pointer" : "cursor-not-allowed opacity-40"
                      }`}
                      style={{
                        color: historyIndex < history.length - 1 ? theme.text : theme.secondary,
                      }}
                      title="إعادة"
                    >
                      <Redo2 className="w-4 h-4" />
                    </button>

                    <div className="w-px h-5 mx-0.5" style={{ backgroundColor: theme.border }} />

                    <button
                      onClick={handleSaveClick}
                      disabled={isSaving}
                      className="w-9 h-9 flex items-center justify-center rounded-full active:scale-95 transition-all cursor-pointer shadow-sm apple-elastic-pinch"
                      style={{
                        backgroundColor: theme.mode === "apple_dark" ? "#F5F5F5" : theme.accent,
                        color: theme.mode === "apple_dark" ? "#000000" : theme.bg,
                      }}
                      title="حفظ"
                    >
                      <Check className="w-4 h-4" strokeWidth={2.8} />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={onReturnToEdit}
                    className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
                    style={{ color: theme.text }}
                    title="تعديل الكتابة اليدوية"
                  >
                    <PenTool className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </header>
        )}

        {/* Floating Bottom Bar & Collapsed Dome */}
        {isActive && (
          <>
            {/* Collapsed Dome Button */}
            <div
              className="fixed bottom-0 left-1/2 z-50 select-none pointer-events-none"
              style={{
                transform: isCollapsed && !isColorPickerSheetOpen ? "translateX(-50%) translateY(0%)" : "translateX(-50%) translateY(110%)",
                opacity: isCollapsed && !isColorPickerSheetOpen ? 1 : 0,
                pointerEvents: isCollapsed && !isColorPickerSheetOpen ? "auto" : "none",
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
                <ChevronUp className="w-4.5 h-4.5 transition-colors -mt-0.5 opacity-80 group-hover:opacity-100" style={{ color: theme.text }} />
              </button>
            </div>

            {/* Main Floating Capsule Container */}
            <div
              className="fixed bottom-0 left-0 right-0 z-50 flex flex-col items-center justify-end pointer-events-none select-none pb-0"
              dir="ltr"
              style={{
                transform: isCollapsed || isColorPickerSheetOpen ? "translateY(110%)" : "translateY(0%)",
                opacity: isCollapsed || isColorPickerSheetOpen ? 0 : 1,
                pointerEvents: isCollapsed || isColorPickerSheetOpen ? "none" : undefined,
                transition: "transform 420ms cubic-bezier(0.32, 0.72, 0, 1), opacity 320ms ease-out",
              }}
            >
              {/* Floating Capsules Above Bottom Bar */}
              <div
                className={`relative w-full max-w-[390px] px-2 flex justify-center pb-2 ${
                  activePopup !== "none" || selectedStrokeIds.length > 0 ? "pointer-events-auto" : "pointer-events-none"
                }`}
              >
                {/* 1. Lasso Actions Capsule (when strokes are selected) */}
                {activeTool === "lasso" && selectedStrokeIds.length > 0 && (
                  <div
                    id="capsule-lasso"
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 z-50 rounded-full py-1 px-1.5 flex items-center gap-1.5 shadow-xl backdrop-blur-2xl border animate-in fade-in zoom-in-95 duration-200"
                    style={{
                      backgroundColor: barBg,
                      borderColor: barBorder,
                      boxShadow: barShadow,
                      borderRadius: "9999px",
                    }}
                    onClick={(e) => e.stopPropagation()}
                    dir="rtl"
                  >
                    <button
                      onClick={handleDeleteSelectedLasso}
                      className="w-7 h-7 flex items-center justify-center rounded-full text-red-500 hover:bg-red-500/15 active:bg-red-500/25 active:scale-90 transition-all cursor-pointer"
                      title="حذف التحديد"
                      aria-label="حذف التحديد"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="w-px h-4 mx-0.5 opacity-40" style={{ backgroundColor: theme.border }} />

                    <button
                      onClick={() => {
                        setSelectedStrokeIds([]);
                        selectedStrokeIdsRef.current = [];
                        currentSelectionBoxRef.current = null;
                        setSelectionBox(null);
                        scheduleRedraw();
                      }}
                      className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
                      style={{ color: theme.secondary }}
                      title="إلغاء التحديد"
                      aria-label="إلغاء التحديد"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* 2. Thickness Capsule */}
                {activePopup === "thickness" && (
                  <div
                    id="capsule-thickness"
                    className="absolute bottom-3 right-0 z-50 rounded-full py-1 px-1.5 flex items-center gap-1 shadow-xl backdrop-blur-2xl border animate-in fade-in zoom-in-95 duration-200"
                    style={{
                      backgroundColor: barBg,
                      borderColor: barBorder,
                      boxShadow: barShadow,
                      borderRadius: "9999px",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {activeTool === "highlighter"
                      ? HIGHLIGHTER_CONFIG.WIDTH_PRESETS.map((preset) => {
                          const isSelected = selectedHighlighterWidth === preset.value;
                          return (
                            <button
                              key={preset.value}
                              onClick={() => {
                                setSelectedHighlighterWidth(preset.value);
                                selectedHighlighterWidthRef.current = preset.value;
                                setActivePopup("none");
                              }}
                              className={`relative w-7 h-7 rounded-full flex flex-col items-center justify-center transition-all cursor-pointer active:scale-90 ${
                                isSelected ? "scale-105 shadow-sm" : "opacity-75 hover:opacity-100"
                              }`}
                              style={{
                                backgroundColor: isSelected ? `${theme.accent}25` : "transparent",
                                borderColor: isSelected ? theme.accent : "transparent",
                              }}
                              title={`تظليل ${preset.label}`}
                            >
                              <div
                                style={{
                                  width: "14px",
                                  height: `${Math.max(preset.dotSize * 0.7, 3)}px`,
                                  backgroundColor: selectedHighlighterColor || "#FFE600",
                                  borderRadius: "2px",
                                }}
                              />
                              <span className="text-[8px] font-zain-bold leading-none mt-0.5" style={{ color: theme.text }}>
                                {preset.label}
                              </span>
                            </button>
                          );
                        })
                      : THICKNESS_PRESETS.map((preset) => {
                          const isSelected = selectedThickness === preset.value;
                          return (
                            <button
                              key={preset.value}
                              onClick={() => {
                                setSelectedThickness(preset.value);
                                selectedThicknessRef.current = preset.value;
                                setActiveTool("pen");
                                activeToolRef.current = "pen";
                                setActivePopup("none");
                              }}
                              className={`relative w-7 h-7 rounded-full flex flex-col items-center justify-center transition-all cursor-pointer active:scale-90 ${
                                isSelected ? "scale-105 shadow-sm" : "opacity-75 hover:opacity-100"
                              }`}
                              style={{
                                backgroundColor: isSelected ? `${theme.accent}25` : "transparent",
                                borderColor: isSelected ? theme.accent : "transparent",
                              }}
                              title={preset.label}
                            >
                              <div
                                className="rounded-full transition-all"
                                style={{
                                  width: `${Math.max(preset.dotSize * 0.75, 3)}px`,
                                  height: `${Math.max(preset.dotSize * 0.75, 3)}px`,
                                  backgroundColor: isSelected ? theme.accent : theme.text,
                                }}
                              />
                              <div
                                className="mt-0.5 rounded-full"
                                style={{
                                  width: "12px",
                                  height: `${Math.min(preset.svgWidth * 0.7, 3)}px`,
                                  backgroundColor: isSelected ? theme.accent : `${theme.text}60`,
                                }}
                              />
                            </button>
                          );
                        })}
                  </div>
                )}

                {/* 3. Color Capsule */}
                {activePopup === "color" && (
                  <div
                    id="capsule-color"
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 z-50 rounded-full py-1 px-1.5 flex items-center gap-1.5 shadow-xl backdrop-blur-2xl border animate-in fade-in zoom-in-95 duration-200"
                    style={{
                      backgroundColor: barBg,
                      borderColor: barBorder,
                      boxShadow: barShadow,
                      borderRadius: "9999px",
                    }}
                    onClick={(e) => e.stopPropagation()}
                    dir="ltr"
                  >
                    {/* Rainbow Circle Button with Dark Center & White Plus (Matches Screenshot_20261007_190033.jpg) */}
                    <button
                      id="color-capsule-rainbow-btn"
                      type="button"
                      onClick={() => {
                        setIsColorPickerSheetOpen(true);
                        setActivePopup("none");
                      }}
                      className="relative w-6.5 h-6.5 rounded-full p-[2.5px] flex items-center justify-center transition-all cursor-pointer hover:scale-110 active:scale-95 flex-shrink-0 shadow-sm"
                      style={{
                        background:
                          "conic-gradient(from 180deg, #FF0055, #FF5500, #FFAA00, #00CC44, #00BBFF, #2255FF, #8800FF, #FF00AA, #FF0055)",
                      }}
                      title="إضافة واختيار لون مخصص"
                      aria-label="فتح لوحة اختيار الألوان"
                    >
                      <div
                        className="w-full h-full rounded-full flex items-center justify-center"
                        style={{
                          backgroundColor: "#16171B",
                        }}
                      >
                        <Plus className="w-3.5 h-3.5 text-white" strokeWidth={2.8} />
                      </div>
                    </button>

                    {/* Subtle divider */}
                    <div className="w-px h-3.5 bg-white/20 mx-0.5" />

                    {/* Recent Custom Colors */}
                    {customColors.map((hex) => {
                      const isHl = activeTool === "highlighter";
                      const currentColor = isHl ? selectedHighlighterColor : selectedColor;
                      const isSelected = currentColor.toUpperCase() === hex.toUpperCase();
                      return (
                        <button
                          key={`custom-${hex}`}
                          onClick={() => {
                            if (isHl) {
                              setSelectedHighlighterColor(hex);
                              selectedHighlighterColorRef.current = hex;
                            } else {
                              setSelectedColor(hex);
                              selectedColorRef.current = hex;
                              if (activeTool === "eraser" || activeTool === "lasso") {
                                setActiveTool("pen");
                                activeToolRef.current = "pen";
                              }
                            }
                            setActivePopup("none");
                          }}
                          className={`w-6 h-6 rounded-full transition-all cursor-pointer relative flex items-center justify-center active:scale-90 ${
                            isSelected ? "scale-110 ring-2 ring-offset-1" : "hover:scale-105 opacity-90 hover:opacity-100"
                          }`}
                          style={{
                            backgroundColor: hex,
                            // @ts-ignore
                            "--tw-ring-color": theme.accent,
                            "--tw-ring-offset-color": theme.bg,
                          }}
                          title={`لون مخصص: ${hex}`}
                        />
                      );
                    })}

                    {/* Standard Preset Palette Colors */}
                    {(activeTool === "highlighter" ? HIGHLIGHTER_PALETTE : COLOR_PALETTE).map((c) => {
                      const isHl = activeTool === "highlighter";
                      const currentColor = isHl ? selectedHighlighterColor : selectedColor;
                      const colorVal = isHl ? c.hex : theme.isDark ? c.hex : (c as any).lightHex || c.hex;
                      const isSelected = currentColor.toLowerCase() === colorVal.toLowerCase();
                      return (
                        <button
                          key={c.hex}
                          onClick={() => {
                            if (isHl) {
                              setSelectedHighlighterColor(colorVal);
                              selectedHighlighterColorRef.current = colorVal;
                            } else {
                              setSelectedColor(colorVal);
                              selectedColorRef.current = colorVal;
                              if (activeTool === "eraser" || activeTool === "lasso") {
                                setActiveTool("pen");
                                activeToolRef.current = "pen";
                              }
                            }
                            setActivePopup("none");
                          }}
                          className={`w-6 h-6 rounded-full transition-all cursor-pointer relative flex items-center justify-center active:scale-90 ${
                            isSelected ? "scale-110 ring-2 ring-offset-1" : "hover:scale-105 opacity-90 hover:opacity-100"
                          }`}
                          style={{
                            backgroundColor: colorVal,
                            // @ts-ignore
                            "--tw-ring-color": theme.accent,
                            "--tw-ring-offset-color": theme.bg,
                          }}
                          title={c.name}
                        >
                          {colorVal === "#FFFFFF" && <div className="w-full h-full rounded-full border border-black/20" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 4. Options Capsule (Ruling + Smart Shapes + Discard) */}
                {activePopup === "options" && (
                  <div
                    id="capsule-options"
                    className="absolute bottom-3 left-0 z-50 rounded-2xl py-2.5 px-3 flex flex-col gap-2 shadow-xl backdrop-blur-2xl border animate-in fade-in zoom-in-95 duration-200 min-w-[200px]"
                    style={{
                      backgroundColor: barBg,
                      borderColor: barBorder,
                      boxShadow: barShadow,
                    }}
                    onClick={(e) => e.stopPropagation()}
                    dir="rtl"
                  >
                    {/* 1. Ruling Toggle Switch */}
                    <div
                      onClick={() => {
                        const nextVal = !isPageRuled;
                        setIsPageRuled(nextVal);
                        notifyChange(strokes, nextVal);
                      }}
                      className="flex items-center justify-between gap-3 cursor-pointer py-1 select-none"
                    >
                      <span className="text-xs font-zain-bold tracking-wide select-none" style={{ color: theme.text }}>
                        تسطير الصفحة
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isPageRuled}
                        onClick={(e) => {
                          e.stopPropagation();
                          const nextVal = !isPageRuled;
                          setIsPageRuled(nextVal);
                          notifyChange(strokes, nextVal);
                        }}
                        dir="ltr"
                        className="cursor-pointer border rounded-full relative flex-shrink-0"
                        style={{
                          width: "36px",
                          height: "20px",
                          minWidth: "36px",
                          minHeight: "20px",
                          backgroundColor: isPageRuled ? theme.accent : theme.isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)",
                          borderColor: isPageRuled ? theme.accent : theme.border,
                          transition: "background-color 200ms ease, border-color 200ms ease",
                        }}
                        aria-label="تبديل تسطير الصفحة"
                      >
                        <div
                          style={{
                            width: "16px",
                            height: "16px",
                            borderRadius: "9999px",
                            backgroundColor: "#FFFFFF",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                            position: "absolute",
                            top: "1px",
                            left: "2px",
                            transform: isPageRuled ? "translateX(16px)" : "translateX(0px)",
                            transition: "transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {isPageRuled && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#2C3E30" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                      </button>
                    </div>

                    {/* 2. Smart Shapes Toggle Switch */}
                    <div
                      onClick={() => {
                        setIsSmartShapesEnabled(!isSmartShapesEnabled);
                      }}
                      className="flex items-center justify-between gap-3 cursor-pointer py-1 select-none"
                    >
                      <span className="text-xs font-zain-bold tracking-wide select-none" style={{ color: theme.text }}>
                        التعرف على الأشكال
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isSmartShapesEnabled}
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsSmartShapesEnabled(!isSmartShapesEnabled);
                        }}
                        dir="ltr"
                        className="cursor-pointer border rounded-full relative flex-shrink-0"
                        style={{
                          width: "36px",
                          height: "20px",
                          minWidth: "36px",
                          minHeight: "20px",
                          backgroundColor: isSmartShapesEnabled ? theme.accent : theme.isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)",
                          borderColor: isSmartShapesEnabled ? theme.accent : theme.border,
                          transition: "background-color 200ms ease, border-color 200ms ease",
                        }}
                        aria-label="تبديل التعرف على الأشكال"
                      >
                        <div
                          style={{
                            width: "16px",
                            height: "16px",
                            borderRadius: "9999px",
                            backgroundColor: "#FFFFFF",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                            position: "absolute",
                            top: "1px",
                            left: "2px",
                            transform: isSmartShapesEnabled ? "translateX(16px)" : "translateX(0px)",
                            transition: "transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {isSmartShapesEnabled && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#2C3E30" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                      </button>
                    </div>

                    <div className="w-full h-px opacity-40" style={{ backgroundColor: theme.border }} />

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

                {/* 5. Dual Eraser Capsule */}
                {activePopup === "eraser" && (
                  <div
                    id="capsule-eraser"
                    className="absolute bottom-3 right-4 z-50 rounded-full py-1 px-1.5 flex items-center gap-1 shadow-xl backdrop-blur-2xl border animate-in fade-in zoom-in-95 duration-200"
                    style={{
                      backgroundColor: barBg,
                      borderColor: barBorder,
                      boxShadow: barShadow,
                      borderRadius: "9999px",
                    }}
                    onClick={(e) => e.stopPropagation()}
                    dir="rtl"
                  >
                    {/* Mode Toggle: Partial Eraser */}
                    <button
                      onClick={() => {
                        setEraserMode("partial");
                        eraserModeRef.current = "partial";
                      }}
                      className={`w-7 h-7 flex items-center justify-center rounded-full transition-all cursor-pointer active:scale-90 ${
                        eraserMode === "partial"
                          ? "shadow-sm"
                          : "opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10"
                      }`}
                      style={{
                        backgroundColor: eraserMode === "partial" ? `${theme.accent}25` : "transparent",
                        color: eraserMode === "partial" ? theme.accent : theme.text,
                      }}
                      title="مسح جزئي (تقطيع المسارات)"
                      aria-label="مسح جزئي"
                    >
                      <Scissors className="w-3.5 h-3.5" />
                    </button>

                    {/* Mode Toggle: Whole Stroke Eraser */}
                    <button
                      disabled={!isHandwritingFeatureEnabled("DUAL_VECTOR_ERASER")}
                      onClick={() => {
                        setEraserMode("stroke");
                        eraserModeRef.current = "stroke";
                      }}
                      className={`w-7 h-7 flex items-center justify-center rounded-full transition-all cursor-pointer active:scale-90 ${
                        eraserMode === "stroke"
                          ? "shadow-sm"
                          : "opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10"
                      }`}
                      style={{
                        backgroundColor: eraserMode === "stroke" ? `${theme.accent}25` : "transparent",
                        color: eraserMode === "stroke" ? theme.accent : theme.text,
                      }}
                      title="مسح المسار بالكامل (كائن كامل)"
                      aria-label="مسح المسار بالكامل"
                    >
                      <EraserIcon className="w-3.5 h-3.5" />
                    </button>

                    <div className="w-px h-4 mx-0.5 opacity-40" style={{ backgroundColor: theme.border }} />

                    {/* Clear All Strokes */}
                    <button
                      onClick={handleClearAll}
                      className="w-7 h-7 flex items-center justify-center rounded-full text-red-500 hover:bg-red-500/15 active:bg-red-500/25 active:scale-90 transition-all cursor-pointer"
                      title="مسح كل الرسومات والخطوط"
                      aria-label="مسح كل الرسومات والخطوط"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Main Bottom Bar */}
              <div className="w-full flex justify-center pb-4 px-4 pointer-events-auto">
                <div
                  className="inline-flex items-center justify-between gap-2.5 sm:gap-4 h-13 px-3.5 sm:px-4 py-1.5 rounded-full backdrop-blur-2xl border-[0.5px] shadow-2xl transition-all duration-300 overflow-visible relative"
                  style={{
                    backgroundColor: barBg,
                    borderColor: barBorder,
                    boxShadow: barShadow,
                    borderRadius: "9999px",
                  }}
                >
                  {/* Button 1: Chevron Down (Collapse to Bottom Dome) */}
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

                  {/* Button 2: More Options (...) */}
                  <button
                    id="handwriting-btn-options"
                    onClick={() => togglePopup("options")}
                    className={`w-8.5 h-8.5 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 flex-shrink-0 ${
                      activePopup === "options" ? "shadow-inner" : "hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                    style={{
                      backgroundColor: activePopup === "options" ? `${theme.accent}25` : undefined,
                      color: activePopup === "options" ? theme.accent : theme.text,
                    }}
                    title="خيارات تسطير الصفحة"
                  >
                    <MoreHorizontal className="w-4.5 h-4.5" />
                  </button>

                  {/* Button 3: Lasso Tool */}
                  <button
                    id="handwriting-btn-lasso"
                    disabled={!isHandwritingFeatureEnabled("LASSO_TOOL")}
                    onClick={() => {
                      setActiveTool("lasso");
                      activeToolRef.current = "lasso";
                      setActivePopup("none");
                    }}
                    className={`relative w-8.5 h-8.5 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 flex-shrink-0 ${
                      activeTool === "lasso"
                        ? "shadow-inner"
                        : "hover:bg-black/5 dark:hover:bg-white/5 opacity-75 hover:opacity-100"
                    }`}
                    style={{
                      backgroundColor: activeTool === "lasso" ? `${theme.accent}25` : undefined,
                      color: activeTool === "lasso" ? theme.accent : theme.text,
                    }}
                    title="أداة التحديد والتحريك (Lasso)"
                  >
                    <LassoSelect className="w-4.5 h-4.5" />
                    {activeTool === "lasso" && (
                      <span
                        className="w-1.5 h-1.5 rounded-full absolute -bottom-1 shadow-sm transition-all"
                        style={{ backgroundColor: theme.accent }}
                      />
                    )}
                  </button>

                  {/* Center Button 4: Rainbow Color Picker */}
                  <div className="flex justify-center items-center px-0.5">
                    <button
                      id="handwriting-btn-color"
                      onClick={() => togglePopup("color")}
                      className="relative w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer p-0.5 shadow-sm"
                      style={{
                        background:
                          "conic-gradient(from 0deg, #ff0000, #ff8800, #ffff00, #00ff00, #00ffff, #0000ff, #8800ff, #ff0088, #ff0000)",
                      }}
                      title="لوحة الألوان"
                    >
                      <div
                        className="w-5.5 h-5.5 rounded-full border border-black/20 dark:border-white/20 shadow-inner transition-colors"
                        style={{ backgroundColor: activeTool === "highlighter" ? selectedHighlighterColor : selectedColor }}
                      />
                    </button>
                  </div>

                  {/* Button 5: Highlighter Marker Tool */}
                  <button
                    id="handwriting-btn-highlighter"
                    disabled={!isHandwritingFeatureEnabled("HIGHLIGHTER_TOOL")}
                    onClick={() => {
                      setActiveTool("highlighter");
                      activeToolRef.current = "highlighter";
                      setActivePopup("none");
                    }}
                    className={`relative flex flex-col items-center justify-end w-9 h-10 transition-all duration-300 ease-out cursor-pointer overflow-visible ${
                      activeTool === "highlighter"
                        ? "-translate-y-7 scale-110 z-20"
                        : "translate-y-0 opacity-75 hover:opacity-100 hover:-translate-y-1.5 z-10"
                    }`}
                    title="قلم التظليل والتمييز الشفاف (Highlighter)"
                  >
                    <div className="relative flex items-center justify-center overflow-visible">
                      <svg className="w-6 h-12 overflow-visible drop-shadow-md" viewBox="0 0 24 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                          <linearGradient id="hlBodyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#E2E8F0" />
                            <stop offset="40%" stopColor="#F8FAFC" />
                            <stop offset="100%" stopColor="#CBD5E1" />
                          </linearGradient>
                        </defs>
                        {/* Chisel tip */}
                        <path d="M 5 18 L 8 4 L 16 4 L 19 18 Z" fill={selectedHighlighterColor || "#FFE600"} />
                        {/* Marker barrel */}
                        <rect x="4" y="18" width="16" height="30" rx="3" fill="url(#hlBodyGrad)" />
                        {/* Grip collar accent */}
                        <rect x="4" y="18" width="16" height="4" fill={selectedHighlighterColor || "#FFE600"} />
                        <rect x="6.5" y="24" width="2" height="22" fill="#FFFFFF" opacity="0.6" />
                      </svg>
                    </div>
                    {activeTool === "highlighter" && (
                      <span className="w-1.5 h-1.5 rounded-full absolute -bottom-2 shadow-sm transition-all" style={{ backgroundColor: theme.accent }} />
                    )}
                  </button>

                  {/* Button 6: Realistic Eraser Stick */}
                  <button
                    id="handwriting-btn-eraser"
                    onClick={() => {
                      setActiveTool("eraser");
                      activeToolRef.current = "eraser";
                      togglePopup("eraser");
                    }}
                    className={`relative flex flex-col items-center justify-end w-9 h-10 transition-all duration-300 ease-out cursor-pointer overflow-visible ${
                      activeTool === "eraser"
                        ? "-translate-y-7 scale-110 z-20"
                        : "translate-y-0 opacity-75 hover:opacity-100 hover:-translate-y-1.5 z-10"
                    }`}
                    title="الممحاة (مزدوجة: جزئية أو كائنية)"
                  >
                    <div className="relative flex items-center justify-center overflow-visible">
                      <svg className="w-6 h-12 overflow-visible drop-shadow-md" viewBox="0 0 24 50" fill="none" xmlns="http://www.w3.org/2000/svg">
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
                        <path d="M 3 20 L 3 9 C 3 3.5 7.5 1.5 12 1.5 C 16.5 1.5 21 3.5 21 9 L 21 20 Z" fill="url(#eraserRubberGrad)" />
                        <path d="M 4.5 20 L 4.5 9 C 4.5 4.5 7.5 2.5 10 2 L 10 20 Z" fill="url(#eraserHighlight)" opacity="0.65" />
                        <rect x="3" y="19.5" width="18" height="1.2" fill="url(#eraserSeamGrad)" />
                        <rect x="3" y="20.7" width="18" height="27.3" rx="2.5" fill="url(#eraserBarrelGrad)" />
                        <rect x="5.5" y="20.7" width="2.5" height="25" fill="#FFFFFF" opacity="0.4" />
                      </svg>
                    </div>
                    {activeTool === "eraser" && (
                      <span className="w-1.5 h-1.5 rounded-full absolute -bottom-2 shadow-sm transition-all" style={{ backgroundColor: theme.accent }} />
                    )}
                  </button>

                  {/* Button 7: Realistic Fountain Pen */}
                  <button
                    id="handwriting-btn-pen"
                    onClick={() => {
                      setActiveTool("pen");
                      activeToolRef.current = "pen";
                      togglePopup("thickness");
                    }}
                    className={`relative flex flex-col items-center justify-end w-9 h-10 transition-all duration-300 ease-out cursor-pointer overflow-visible ${
                      activeTool === "pen"
                        ? "-translate-y-7 scale-110 z-20"
                        : "translate-y-0 opacity-75 hover:opacity-100 hover:-translate-y-1.5 z-10"
                    }`}
                    title="ريشة القلم الحبر وسماكة الخط"
                  >
                    <div className="relative flex items-center justify-center overflow-visible">
                      <svg className="w-7 h-14 overflow-visible drop-shadow-md" viewBox="0 0 28 58" fill="none" xmlns="http://www.w3.org/2000/svg">
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
                        <path d="M 14 1.5 L 5.5 19.5 C 4.5 21.5 5.5 24 6.5 26.5 L 14 26.5 Z" fill="url(#nibLeftBevel)" />
                        <path d="M 14 1.5 L 22.5 19.5 C 23.5 21.5 22.5 24 21.5 26.5 L 14 26.5 Z" fill="url(#nibRightBevel)" />
                        <line x1="14" y1="1.5" x2="14" y2="17.5" stroke="#3D4248" strokeWidth="0.8" />
                        <circle cx="14" cy="17.5" r="1.3" fill="#24282D" />
                        <path d="M 6 26.5 C 6 25.5 22 25.5 22 26.5 L 22.5 29.5 C 22.5 30.5 5.5 30.5 5.5 29.5 Z" fill="url(#penCollarGrad)" stroke="#60666D" strokeWidth="0.4" />
                        <path d="M 6 29.5 C 5.2 38 4.6 46.5 4 54 C 4 56.5 5.5 58 8 58 L 20 58 C 22.5 58 24 56.5 24 54 C 23.4 46.5 22.8 38 22 29.5 Z" fill="url(#penBarrelGrad)" />
                        <path d="M 8 29.5 C 7.2 38 6.6 46.5 6 56 L 8.5 56 C 9.1 46.5 9.8 38 10.5 29.5 Z" fill="#FFFFFF" opacity="0.38" />
                      </svg>
                    </div>
                    {activeTool === "pen" && (
                      <span className="w-1.5 h-1.5 rounded-full absolute -bottom-2 shadow-sm transition-all" style={{ backgroundColor: theme.accent }} />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Custom Color Picker Bottom Sheet (Matches Screenshot_20261007_190121.jpg) */}
            <DarAlHikayatColorPickerSheet
              isOpen={isColorPickerSheetOpen}
              onClose={() => setIsColorPickerSheetOpen(false)}
              currentColor={activeTool === "highlighter" ? selectedHighlighterColor : selectedColor}
              onApplyColor={handleCustomColorApply}
              theme={theme}
            />
          </>
        )}
      </div>
    );

    if (typeof document !== "undefined") {
      return createPortal(handwritingView, document.body);
    }
    return handwritingView;
  }
);

DarAlHikayatHandwriting.displayName = "DarAlHikayatHandwriting";
export default DarAlHikayatHandwriting;
