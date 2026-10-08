/**
 * مصنف الأشكال الذكي المتقدم (Smart Shape Recognition Engine with Hold-to-Shape)
 *
 * يتعرف بدقة عالية على:
 * 1. الدائرة والشكل البيضاوي (Circle & Ellipse)
 * 2. المربع والمستطيل (Square & Rectangle)
 * 3. المثلث (Triangle)
 * 4. الخط المستقيم (Straight Line)
 *
 * مع ضمانات حديدية لحماية الحروف والأرقام العربية من التحويل الخاطئ.
 */

import type { StrokePoint, Stroke } from "../components/DarAlHikayatHandwriting";

export const SHAPE_CONFIG = {
  /** مدة التوقف المطلوبة بالمللي ثانية عند نهاية الخط لتفعيل التحويل (Hold-to-Shape) */
  HOLD_DURATION_MS: 480,
  /** الحد الأدنى لعرض وارتفاع الشكل المغلق لمنع تحويل حلقات الحروف العربية (و، ه، ص، ط، ٥...) */
  MIN_DIMENSION_PX: 42,
  /** الحد الأدنى لطول المحيط بالبكسل */
  MIN_PERIMETER_PX: 100,
  /** الحد الأدنى لطول الخط المستقيم */
  MIN_LINE_LENGTH_PX: 45,
} as const;

export type DetectedShapeType = "circle" | "ellipse" | "rectangle" | "square" | "triangle" | "line" | "star";

export interface ShapeDetectionResult {
  isShape: boolean;
  shapeType?: DetectedShapeType;
  generatedPoints?: StrokePoint[];
}

function calculatePerimeter(points: readonly StrokePoint[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

function calculatePolygonArea(points: readonly StrokePoint[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}

export function generateEllipsePoints(cx: number, cy: number, rx: number, ry: number, count = 48): StrokePoint[] {
  const points: StrokePoint[] = [];
  const now = performance.now();
  for (let i = 0; i <= count; i++) {
    const angle = (i / count) * Math.PI * 2;
    points.push({
      x: cx + rx * Math.cos(angle),
      y: cy + ry * Math.sin(angle),
      pressure: 0.5,
      time: now + i * 2,
    });
  }
  return points;
}

export function generateRectanglePoints(minX: number, minY: number, maxX: number, maxY: number): StrokePoint[] {
  const now = performance.now();
  return [
    { x: minX, y: minY, pressure: 0.5, time: now },
    { x: maxX, y: minY, pressure: 0.5, time: now + 5 },
    { x: maxX, y: maxY, pressure: 0.5, time: now + 10 },
    { x: minX, y: maxY, pressure: 0.5, time: now + 15 },
    { x: minX, y: minY, pressure: 0.5, time: now + 20 },
  ];
}

export function generateTrianglePoints(minX: number, minY: number, maxX: number, maxY: number, peakX?: number): StrokePoint[] {
  const now = performance.now();
  const topX = peakX ?? (minX + maxX) / 2;
  return [
    { x: topX, y: minY, pressure: 0.5, time: now },
    { x: maxX, y: maxY, pressure: 0.5, time: now + 5 },
    { x: minX, y: maxY, pressure: 0.5, time: now + 10 },
    { x: topX, y: minY, pressure: 0.5, time: now + 15 },
  ];
}

export function generateLinePoints(x1: number, y1: number, x2: number, y2: number): StrokePoint[] {
  const now = performance.now();
  return [
    { x: x1, y: y1, pressure: 0.5, time: now },
    { x: x2, y: y2, pressure: 0.5, time: now + 10 },
  ];
}

export function generateStarPoints(cx: number, cy: number, outerR = 45, innerR = 20, points = 5): StrokePoint[] {
  const pts: StrokePoint[] = [];
  const now = performance.now();
  const total = points * 2;
  for (let i = 0; i <= total; i++) {
    const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push({
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      pressure: 0.5,
      time: now + i * 2,
    });
  }
  return pts;
}

/**
 * حساب عدد الزوايا الحادة لتمييز المضلعات عن الدوائر
 */
function countCorners(points: readonly StrokePoint[]): number {
  let corners = 0;
  const step = Math.max(2, Math.floor(points.length / 14));
  for (let i = step; i < points.length - step; i += 2) {
    const pPrev = points[i - step];
    const pCurr = points[i];
    const pNext = points[i + step];
    const v1 = { x: pCurr.x - pPrev.x, y: pCurr.y - pPrev.y };
    const v2 = { x: pNext.x - pCurr.x, y: pNext.y - pCurr.y };
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.hypot(v1.x, v1.y);
    const mag2 = Math.hypot(v2.x, v2.y);
    if (mag1 < 1 || mag2 < 1) continue;
    const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
    const angle = Math.acos(cos) * (180 / Math.PI);
    if (angle > 50) {
      corners++;
      i += step;
    }
  }
  return corners;
}

/**
 * فحص وتصنيف المسار إلى شكل هندسي مصقول
 */
export function detectSmartShape(points: readonly StrokePoint[]): ShapeDetectionResult {
  if (!points || points.length < 5) {
    return { isShape: false };
  }

  const start = points[0];
  const end = points[points.length - 1];
  const chordDistance = Math.hypot(end.x - start.x, end.y - start.y);
  const perimeter = calculatePerimeter(points);

  if (perimeter === 0) return { isShape: false };

  // 1. فحص الخط المستقيم (غير مغلق واستقامة عالية)
  const isFarEnds = chordDistance / perimeter > 0.68;
  if (isFarEnds && chordDistance >= SHAPE_CONFIG.MIN_LINE_LENGTH_PX) {
    let maxDeviation = 0;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lineLen = chordDistance;

    for (let i = 1; i < points.length - 1; i++) {
      const p = points[i];
      const dist = Math.abs(dy * p.x - dx * p.y + end.x * start.y - end.y * start.x) / lineLen;
      if (dist > maxDeviation) maxDeviation = dist;
    }

    if (maxDeviation / lineLen < 0.18) {
      return {
        isShape: true,
        shapeType: "line",
        generatedPoints: generateLinePoints(start.x, start.y, end.x, end.y),
      };
    }
  }

  // 2. للأشكال المغلقة:
  if (points.length < 10) return { isShape: false };

  // فحص الفجوة بين البداية والنهاية
  const closureGap = chordDistance / perimeter;
  if (closureGap > 0.42) {
    return { isShape: false };
  }

  // حساب الصندوق المحيط
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const width = maxX - minX;
  const height = maxY - minY;

  // حماية الحروف والأرقام العربية
  if (width < SHAPE_CONFIG.MIN_DIMENSION_PX || height < SHAPE_CONFIG.MIN_DIMENSION_PX) {
    return { isShape: false };
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const area = calculatePolygonArea(points);
  const boundingArea = Math.max(1, width * height);
  const fillRatio = area / boundingArea;
  const aspectRatio = Math.min(width, height) / Math.max(width, height);
  const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
  const corners = countCorners(points);

  // حساب تشتت أنصاف الأقطار من المركز
  let sumDist = 0;
  for (const p of points) {
    const rx = width / 2;
    const ry = height / 2;
    const normalizedDist = Math.hypot((p.x - cx) / rx, (p.y - cy) / ry);
    sumDist += Math.abs(normalizedDist - 1);
  }
  const avgRadialDeviation = sumDist / points.length;

  // 3. فحص المثلث أولاً (تعبئة منخفضة 0.30 - 0.65 وشكل غير دائري)
  if (fillRatio >= 0.28 && fillRatio <= 0.66 && circularity < 0.75) {
    let peakIndex = 0;
    let peakY = Infinity;
    for (let i = 0; i < points.length; i++) {
      if (points[i].y < peakY) {
        peakY = points[i].y;
        peakIndex = i;
      }
    }
    const peakX = points[peakIndex].x;

    return {
      isShape: true,
      shapeType: "triangle",
      generatedPoints: generateTrianglePoints(minX, minY, maxX, maxY, peakX),
    };
  }

  // 4. فحص المستطيل والمربع (تعبئة عالية >= 0.70 وزوايا حادة أو دائرية منخفضة)
  if (fillRatio >= 0.68 && (corners >= 2 || circularity < 0.82)) {
    const isSquare = aspectRatio >= 0.80;
    let finalMinX = minX, finalMaxX = maxX, finalMinY = minY, finalMaxY = maxY;

    if (isSquare) {
      const side = (width + height) / 2;
      finalMinX = cx - side / 2;
      finalMaxX = cx + side / 2;
      finalMinY = cy - side / 2;
      finalMaxY = cy + side / 2;
    }

    return {
      isShape: true,
      shapeType: isSquare ? "square" : "rectangle",
      generatedPoints: generateRectanglePoints(finalMinX, finalMinY, finalMaxX, finalMaxY),
    };
  }

  // 5. فحص الدائرة والبيضاوي (دائرية عالية، تشتت قليل، وانعدام الزوايا الحادة)
  if (circularity >= 0.72 && corners <= 1 && avgRadialDeviation < 0.22) {
    const rx = width / 2;
    const ry = height / 2;
    const isCircle = aspectRatio >= 0.80;
    const finalRx = isCircle ? (rx + ry) / 2 : rx;
    const finalRy = isCircle ? (rx + ry) / 2 : ry;

    return {
      isShape: true,
      shapeType: isCircle ? "circle" : "ellipse",
      generatedPoints: generateEllipsePoints(cx, cy, finalRx, finalRy),
    };
  }

  return { isShape: false };
}

/**
 * توليد مسار لشكل هندسي اختباري جاهز في مركز اللوحة
 */
export function createPresetShapeStroke(
  shapeType: DetectedShapeType,
  cx: number,
  cy: number,
  color: string,
  width: number
): Stroke {
  const id = `shape_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  let points: StrokePoint[] = [];

  switch (shapeType) {
    case "circle":
      points = generateEllipsePoints(cx, cy, 60, 60);
      break;
    case "ellipse":
      points = generateEllipsePoints(cx, cy, 80, 45);
      break;
    case "square":
      points = generateRectanglePoints(cx - 50, cy - 50, cx + 50, cy + 50);
      break;
    case "rectangle":
      points = generateRectanglePoints(cx - 80, cy - 45, cx + 80, cy + 45);
      break;
    case "triangle":
      points = generateTrianglePoints(cx - 60, cy - 50, cx + 60, cy + 50, cx);
      break;
    case "line":
      points = generateLinePoints(cx - 90, cy, cx + 90, cy);
      break;
    case "star":
      points = generateStarPoints(cx, cy, 65, 28, 5);
      break;
    default:
      points = generateEllipsePoints(cx, cy, 55, 55);
  }

  return {
    id,
    color,
    width,
    points,
    tool: "shape",
    shapeType,
  };
}

/**
 * تحويل المسار اليدوي إلى مسار شكل هندسي مصقول مع الاحتفاظ بالنسخة الأصلية للتراجع
 */
export function convertStrokeToShape(stroke: Stroke, detection: ShapeDetectionResult): Stroke {
  if (!detection.isShape || !detection.generatedPoints) return stroke;

  return {
    ...stroke,
    tool: "shape",
    renderVersion: undefined,
    shapeType: detection.shapeType,
    originalPoints: [...stroke.points],
    points: detection.generatedPoints,
  };
}
