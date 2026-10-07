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
