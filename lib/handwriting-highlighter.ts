/**
 * قلم التظليل والتمييز الاحترافي (Professional Highlighting Tool)
 *
 * الخصائص:
 * 1. شفافية دقيقة ومزج لوني لا يغطي معالم الخط الأصلي أو النصوص التحتية
 * 2. استخدام أسلوب Multiply / Semi-transparent Overlay
 * 3. حظر كبسولة النسخ والتحديد وقائمة السياق للنظام أثناء التظليل
 * 4. تراكم لوني طبيعي وأنيق عند تقاطع ضربات التظليل
 */

import type { StrokePoint, Stroke } from "../components/DarAlHikayatHandwriting";

export const HIGHLIGHTER_CONFIG = {
  /** معامل الشفافية المشبع والمضيء لقلم التظليل */
  DEFAULT_OPACITY: 0.42,
  /** السماكة الافتراضية العريضة للماركر */
  DEFAULT_WIDTH: 26.0,
  /** خيارات سماكة الماركر */
  WIDTH_PRESETS: [
    { value: 18.0, label: "رفيع", dotSize: 10 },
    { value: 26.0, label: "متوسط", dotSize: 14 },
    { value: 36.0, label: "عريض", dotSize: 18 },
  ],
  /** نظام المزج اللوني */
  COMPOSITE_OPERATION: "source-over" as GlobalCompositeOperation,
} as const;

/**
 * ألوان التظليل المعتمدة والمنتقاة بعناية لدار الحكايات (المطابقة لمحرر النصوص الاحترافي)
 */
export const HIGHLIGHTER_PALETTE = [
  { hex: "#FFE600", lightHex: "#FFE600", name: "أصفر ساطع" },
  { hex: "#4ADE80", lightHex: "#4ADE80", name: "أخضر نضاح" },
  { hex: "#FF729F", lightHex: "#FF729F", name: "وردي زاهي" },
  { hex: "#38BDF8", lightHex: "#38BDF8", name: "أزرق سماوي" },
  { hex: "#FB923C", lightHex: "#FB923C", name: "برتقالي مشرق" },
  { hex: "#C084FC", lightHex: "#C084FC", name: "خزامي بنفسجي" },
];

/**
 * رسم ضربة تظليل شفافة متناسقة
 */
export function renderHighlighterStroke(
  ctx: CanvasRenderingContext2D,
  points: readonly StrokePoint[],
  color: string,
  width: number = HIGHLIGHTER_CONFIG.DEFAULT_WIDTH,
  opacity: number = HIGHLIGHTER_CONFIG.DEFAULT_OPACITY
): void {
  if (!points || points.length === 0) return;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = width;

  if (points.length === 1) {
    const p = points[0];
    ctx.beginPath();
    ctx.arc(p.x, p.y, width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

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

  ctx.restore();
}

/**
 * منع كبسولة النظام وقائمة النسخ/اللصق على أجهزة الأندرويد والـ WebView
 */
export function suppressSystemContextMenu(event: Event): void {
  event.preventDefault();
  event.stopPropagation();
}
