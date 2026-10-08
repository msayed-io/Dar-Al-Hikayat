import { describe, it, expect } from "vitest";
import { calculateVelocity, getVelocityAdjustedWidth, renderStrokePath } from "../lib/handwriting-engine";
import { applyDualEraser, strokeTouchesCircle, computeStrokeBounds } from "../lib/handwriting-eraser-dual";
import { HIGHLIGHTER_CONFIG, HIGHLIGHTER_PALETTE, renderHighlighterStroke } from "../lib/handwriting-highlighter";
import { isPointInPolygon, findStrokesInsideLasso, computeSelectionBox, transformSelectedStrokes } from "../lib/handwriting-lasso";
import { detectSmartShape, convertStrokeToShape, SHAPE_CONFIG } from "../lib/handwriting-shapes";
import { HANDWRITING_FEATURE_FLAGS, isHandwritingFeatureEnabled } from "../lib/handwriting-feature-flags";
import type { Stroke, StrokePoint } from "../components/DarAlHikayatHandwriting";

describe("Phase 1: Graphics Engine & Velocity-Based Thickness", () => {
  it("calculates velocity correctly between points", () => {
    const p1: StrokePoint = { x: 0, y: 0, pressure: 0.5, time: 0 };
    const p2: StrokePoint = { x: 30, y: 40, pressure: 0.5, time: 50 }; // distance = 50, dt = 50 -> 1 px/ms
    const v = calculateVelocity(p1, p2);
    expect(v).toBeCloseTo(1.0, 2);
  });

  it("yields thinner width when drawing fast and thicker width when drawing slow", () => {
    const baseWidth = 10;
    const slowWidth = getVelocityAdjustedWidth(baseWidth, 0.1);
    const fastWidth = getVelocityAdjustedWidth(baseWidth, 3.0);
    expect(slowWidth).toBeGreaterThan(baseWidth);
    expect(fastWidth).toBeLessThan(baseWidth);
  });

  it("renders zero-delay dot for single-point contact", () => {
    const p1: StrokePoint = { x: 50, y: 50, pressure: 0.5, time: 0 };
    const points = [p1];
    let arcCalled = false;
    let fillCalled = false;
    const fakeCtx = {
      beginPath: () => {},
      arc: () => { arcCalled = true; },
      fill: () => { fillCalled = true; },
    } as unknown as CanvasRenderingContext2D;

    renderStrokePath(fakeCtx, points, 4, "#FFFFFF");
    expect(arcCalled).toBe(true);
    expect(fillCalled).toBe(true);
  });
});

describe("Phase 2: Dual Vector Eraser (Partial vs Stroke)", () => {
  const mkTestStroke = (id: string, x1: number, y1: number, x2: number, y2: number): Stroke => ({
    id,
    color: "#000000",
    width: 4,
    points: [
      { x: x1, y: y1, pressure: 0.5, time: 0 },
      { x: x2, y: y2, pressure: 0.5, time: 10 },
    ],
  });

  it("stroke-mode eraser deletes entire stroke on contact", () => {
    const stroke1 = mkTestStroke("s1", 10, 10, 50, 10);
    const stroke2 = mkTestStroke("s2", 100, 100, 150, 100);
    const cache = new Map();
    const { nextStrokes, modified } = applyDualEraser([stroke1, stroke2], 30, 10, 15, "stroke", cache);
    expect(modified).toBe(true);
    expect(nextStrokes.map((s) => s.id)).toEqual(["s2"]);
  });

  it("partial-mode eraser cuts/segments the stroke instead of deleting whole stroke", () => {
    const stroke = mkTestStroke("s_long", -100, 0, 100, 0);
    const cache = new Map();
    const { nextStrokes, modified } = applyDualEraser([stroke], 0, 0, 20, "partial", cache);
    expect(modified).toBe(true);
    expect(nextStrokes.length).toBe(2); // Two segments left outside the disk
  });
});

describe("Phase 3: Highlighting Tool", () => {
  it("highlighter palette contains vibrant, curated colors", () => {
    expect(HIGHLIGHTER_PALETTE.length).toBeGreaterThanOrEqual(4);
    expect(HIGHLIGHTER_CONFIG.DEFAULT_OPACITY).toBeLessThan(0.6);
  });

  it("renderHighlighterStroke applies proper alpha opacity without throwing", () => {
    let alphaSet = 0;
    const fakeCtx = {
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      quadraticCurveTo: () => {},
      stroke: () => {},
      set globalAlpha(v: number) { alphaSet = v; },
    } as unknown as CanvasRenderingContext2D;

    const points: StrokePoint[] = [
      { x: 10, y: 10, pressure: 0.5, time: 0 },
      { x: 50, y: 10, pressure: 0.5, time: 10 },
    ];
    renderHighlighterStroke(fakeCtx, points, "#FACC15", 20, 0.35);
    expect(alphaSet).toBe(0.35);
  });
});

describe("Phase 4: Lasso Selection & Proportional Transformation", () => {
  const polygon = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];

  it("isPointInPolygon accurately classifies points inside and outside", () => {
    expect(isPointInPolygon({ x: 50, y: 50 }, polygon)).toBe(true);
    expect(isPointInPolygon({ x: 150, y: 50 }, polygon)).toBe(false);
  });

  it("findStrokesInsideLasso identifies strokes contained within the loop", () => {
    const insideStroke: Stroke = {
      id: "inside",
      color: "#000",
      width: 2,
      points: [
        { x: 30, y: 30, pressure: 0.5, time: 0 },
        { x: 40, y: 40, pressure: 0.5, time: 1 },
      ],
    };
    const outsideStroke: Stroke = {
      id: "outside",
      color: "#000",
      width: 2,
      points: [
        { x: 200, y: 200, pressure: 0.5, time: 0 },
        { x: 220, y: 220, pressure: 0.5, time: 1 },
      ],
    };

    const ids = findStrokesInsideLasso([insideStroke, outsideStroke], polygon);
    expect(ids).toEqual(["inside"]);
  });

  it("transformSelectedStrokes translates and scales proportionally", () => {
    const stroke: Stroke = {
      id: "s1",
      color: "#000",
      width: 4,
      points: [{ x: 10, y: 20, pressure: 0.5, time: 0 }],
    };
    const transformed = transformSelectedStrokes([stroke], ["s1"], 5, 10, 2, 0, 0);
    // x' = 0 + (10 - 0) * 2 + 5 = 25
    // y' = 0 + (20 - 0) * 2 + 10 = 50
    expect(transformed[0].points[0].x).toBe(25);
    expect(transformed[0].points[0].y).toBe(50);
    expect(transformed[0].width).toBe(8);
  });
});

describe("Phase 5: Smart Shape Classifier (Hold-to-Shape & Arabic Safety)", () => {
  it("rejects small strokes to safeguard Arabic letters and numbers (و, ه, ص, ط, ٥)", () => {
    // Small loop of letter Waw (radius ~ 10px, width ~ 20px)
    const smallLoop: StrokePoint[] = [];
    for (let i = 0; i <= 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      smallLoop.push({
        x: 100 + 12 * Math.cos(angle),
        y: 100 + 12 * Math.sin(angle),
        pressure: 0.5,
        time: i * 5,
      });
    }
    const result = detectSmartShape(smallLoop);
    expect(result.isShape).toBe(false); // Safeguarded!
  });

  it("detects a large hand-drawn circle and generates a perfect ellipse/circle", () => {
    const largeCircle: StrokePoint[] = [];
    for (let i = 0; i <= 36; i++) {
      const angle = (i / 36) * Math.PI * 2;
      largeCircle.push({
        x: 200 + 60 * Math.cos(angle),
        y: 200 + 60 * Math.sin(angle),
        pressure: 0.5,
        time: i * 10,
      });
    }
    const result = detectSmartShape(largeCircle);
    expect(result.isShape).toBe(true);
    expect(result.shapeType).toBe("circle");
    expect(result.generatedPoints?.length).toBeGreaterThan(20);
  });

  it("convertStrokeToShape preserves original points for 1-click undo", () => {
    const originalPoints: StrokePoint[] = [
      { x: 0, y: 0, pressure: 0.5, time: 0 },
      { x: 100, y: 100, pressure: 0.5, time: 10 },
    ];
    const stroke: Stroke = {
      id: "orig",
      color: "#FFF",
      width: 3.5,
      points: originalPoints,
    };
    const converted = convertStrokeToShape(stroke, {
      isShape: true,
      shapeType: "rectangle",
      generatedPoints: [{ x: 0, y: 0, pressure: 0.5, time: 0 }],
    });
    expect(converted.tool).toBe("shape");
    expect(converted.originalPoints).toEqual(originalPoints);
  });
});

describe("Phase 7: Feature Flags & Invariants", () => {
  it("remaining feature flags are active by default", () => {
    expect(isHandwritingFeatureEnabled("SMOOTH_GRAPHICS_ENGINE")).toBe(true);
    expect(isHandwritingFeatureEnabled("DUAL_VECTOR_ERASER")).toBe(true);
    expect(isHandwritingFeatureEnabled("HIGHLIGHTER_TOOL")).toBe(true);
    expect(isHandwritingFeatureEnabled("LASSO_TOOL")).toBe(true);
    expect(isHandwritingFeatureEnabled("SMART_SHAPE_RECOGNITION")).toBe(true);
  });
});
