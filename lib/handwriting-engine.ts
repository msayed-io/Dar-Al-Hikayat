/**
 * محرك الرسم والتنعيم المتقدم (Handwriting Graphics & Smoothing Engine)
 *
 * يوفر:
 * 1. حساب السماكة المتجاوبة مع سرعة حركة اليد (Velocity-Based Thickness / Calligraphy Effect)
 * 2. التنعيم التزايدي بالمنحنيات التربيعية والتكعيبية (Incremental Smooth Bezier)
 * 3. محاكاة ضربات الفرشاة الاحترافية (Freehand Brush Simulation) دون أي تأخير في مسار الرسم الحي
 * 4. الحفاظ الصارم على ظهور النقطة الأولى فوراً من أول لمسة وبلا أي قفزة بصرية عند رفع القلم.
 */

import type { StrokePoint, Stroke } from "../components/DarAlHikayatHandwriting";

// ثوابت المعايرة المسماة لسماكة القلم وسرعته
export const ENGINE_CONFIG = {
  /** أدنى معامل لسماكة الخط عند أقصى سرعة */
  MIN_WIDTH_FACTOR: 0.70,
  /** أقصى معامل لسماكة الخط عند التأني والبطء */
  MAX_WIDTH_FACTOR: 1.25,
  /** السرعة المرجعية القياسية بالبكسل لكل مللي ثانية */
  REFERENCE_SPEED_PX_MS: 1.2,
  /** معامل تنعيم انتقال السماكة بين النقاط المتتالية لمنع التعرجات المفاجئة */
  THICKNESS_SMOOTH_ALPHA: 0.35,
} as const;

/**
 * حساب السرعة بين نقطتين بالبكسل لكل مللي ثانية
 */
export function calculateVelocity(p1: StrokePoint, p2: StrokePoint): number {
  const dt = Math.max(1, p2.time - p1.time);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist / dt;
}

/**
 * حساب السماكة التفاعلية لنقطة بناءً على السرعة والسماكة الأساسية
 */
export function getVelocityAdjustedWidth(
  baseWidth: number,
  velocity: number,
  previousWidth?: number
): number {
  // نسبة السرعة مقارنة بالسرعة المرجعية
  const speedRatio = Math.min(2.5, velocity / ENGINE_CONFIG.REFERENCE_SPEED_PX_MS);
  
  // كلما زادت السرعة قل السمك، وكلما تباطأ زاد السمك لإعطاء طابع خط الرقعة والنسخ
  const factor = ENGINE_CONFIG.MAX_WIDTH_FACTOR -
    (speedRatio / 2.5) * (ENGINE_CONFIG.MAX_WIDTH_FACTOR - ENGINE_CONFIG.MIN_WIDTH_FACTOR);

  const targetWidth = baseWidth * factor;

  if (typeof previousWidth === "number" && Number.isFinite(previousWidth)) {
    return previousWidth * (1 - ENGINE_CONFIG.THICKNESS_SMOOTH_ALPHA) +
      targetWidth * ENGINE_CONFIG.THICKNESS_SMOOTH_ALPHA;
  }

  return targetWidth;
}

/**
 * رسم مقطع حبري ناعم ومتطابق بين الرسم الحي والرسم النهائي
 */
export function renderStrokePath(
  ctx: CanvasRenderingContext2D,
  points: readonly StrokePoint[],
  baseWidth: number,
  color: string,
  enableVelocity = true
): void {
  if (!points || points.length === 0) return;

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // نقطة وحيدة: دائرة فورية متطابقة
  if (points.length === 1) {
    const p = points[0];
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(1, baseWidth / 2), 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  // نقطتان: خط مباشر
  if (points.length === 2) {
    const p0 = points[0];
    const p1 = points[1];
    ctx.lineWidth = baseWidth;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
    return;
  }

  // أكثر من نقطتين: منحنيات ناعمة تزايدية
  ctx.lineWidth = baseWidth;
  ctx.beginPath();
  const p0 = points[0];
  ctx.moveTo(p0.x, p0.y);

  for (let i = 1; i < points.length; i++) {
    const pt0 = points[i - 1];
    const pt1 = points[i];
    const midX = (pt0.x + pt1.x) / 2;
    const midY = (pt0.y + pt1.y) / 2;
    ctx.quadraticCurveTo(pt0.x, pt0.y, midX, midY);
  }

  const lastPt = points[points.length - 1];
  ctx.lineTo(lastPt.x, lastPt.y);
  ctx.stroke();
}

/** Identical primitive for live ink and persisted v1 replay. Caller owns transforms. */
export function drawInkSegment(ctx: CanvasRenderingContext2D, previous: StrokePoint,
  point: StrokePoint, before?: StrokePoint): void {
  ctx.beginPath();
  const x = (previous.x + point.x) / 2, y = (previous.y + point.y) / 2;
  if (!before) {
    ctx.moveTo(previous.x, previous.y);
    ctx.lineTo(x, y);
  } else {
    ctx.moveTo((before.x + previous.x) / 2, (before.y + previous.y) / 2);
    ctx.quadraticCurveTo(previous.x, previous.y, x, y);
  }
  ctx.stroke();
}

function recordedWidth(point: StrokePoint, fallback: number): number {
  return Number.isFinite(point.inkWidth) && point.inkWidth! > 0 ? point.inkWidth! : fallback;
}

/** Replays recorded segment widths, without recalculating speed after transforms. */
export function renderRecordedInk(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  const points = stroke.points;
  if (!points.length) return;
  ctx.fillStyle = ctx.strokeStyle = stroke.color;
  ctx.lineCap = ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.arc(points[0].x, points[0].y, recordedWidth(points[0], stroke.width) / 2, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 1; i < points.length; i++) {
    ctx.lineWidth = recordedWidth(points[i], stroke.width);
    drawInkSegment(ctx, points[i - 1], points[i], i > 1 ? points[i - 2] : undefined);
  }
}

/** Same v1 geometry for vector-only previews; legacy previews remain unchanged. */
export function getRecordedInkPaths(stroke: Stroke): Array<{
  id: string; color: string; width: number; dot?: { x: number; y: number }; path?: string;
}> {
  if (!stroke.points.length) return [];
  const first = stroke.points[0];
  const paths: ReturnType<typeof getRecordedInkPaths> = [{
    id: `${stroke.id}_dot`, color: stroke.color, width: recordedWidth(first, stroke.width),
    dot: { x: first.x, y: first.y },
  }];
  for (let i = 1; i < stroke.points.length; i++) {
    const a = stroke.points[i - 1], b = stroke.points[i], before = stroke.points[i - 2];
    const end = `${(a.x + b.x) / 2} ${(a.y + b.y) / 2}`;
    paths.push({ id: `${stroke.id}_${i}`, color: stroke.color, width: recordedWidth(b, stroke.width),
      path: before
        ? `M ${(before.x + a.x) / 2} ${(before.y + a.y) / 2} Q ${a.x} ${a.y} ${end}`
        : `M ${a.x} ${a.y} L ${end}` });
  }
  return paths;
}
