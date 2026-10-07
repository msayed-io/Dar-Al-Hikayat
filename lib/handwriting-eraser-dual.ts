/**
 * المنظومة المزدوجة للممحاة المتجهة (Dual Vector Eraser System)
 *
 * تضم نوعين متميزين:
 * 1. الممحاة الجزئية الدقيقة (Partial / Pixel-Cut Eraser): تقطع وتمحو ما تحت القرص فقط وتبقي الباقي مقاطع مستقلة.
 * 2. الممحاة الكائنية الذكية (Stroke / Object Eraser): بمجرد ملامستها لأي جزء من الخط، تحذف المسار بالكامل.
 */

import type { Stroke, StrokePoint } from "../components/DarAlHikayatHandwriting";
import { eraseStrokePortion } from "./handwriting-eraser";

export type EraserMode = "partial" | "stroke";

export interface StrokeBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * حساب الصندوق المحيط بالمسار (AABB Bounding Box)
 */
export function computeStrokeBounds(stroke: Stroke): StrokeBounds {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const halfW = (stroke.width || 3.5) / 2;

  for (let i = 0; i < stroke.points.length; i++) {
    const p = stroke.points[i];
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  if (minX === Infinity) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }

  return {
    minX: minX - halfW,
    maxX: maxX + halfW,
    minY: minY - halfW,
    maxY: maxY + halfW,
  };
}

/**
 * فحص ما إذا كان الضلع المستقيم يتقاطع مع دائرة أو يقع داخلها
 */
export function segmentIntersectsCircle(
  ax: number, ay: number,
  bx: number, by: number,
  cx: number, cy: number,
  radius: number
): boolean {
  const r2 = radius * radius;
  // فحص النقطتين الطرفيتين
  const dax = ax - cx, day = ay - cy;
  if (dax * dax + day * day <= r2) return true;
  const dbx = bx - cx, dby = by - cy;
  if (dbx * dbx + dby * dby <= r2) return true;

  // فحص المسافة العمودية لأقرب نقطة على الضلع
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return false;

  const t = Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / len2));
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  const dist2 = (cx - projX) * (cx - projX) + (cy - projY) * (cy - projY);

  return dist2 <= r2;
}

/**
 * اختبار ملامسة قرص الممحاة للمسار
 */
export function strokeTouchesCircle(stroke: Stroke, cx: number, cy: number, radius: number): boolean {
  const pts = stroke.points;
  if (!pts || pts.length === 0) return false;

  const r2 = radius * radius;
  if (pts.length === 1) {
    const dx = pts[0].x - cx;
    const dy = pts[0].y - cy;
    return dx * dx + dy * dy <= r2;
  }

  for (let i = 1; i < pts.length; i++) {
    if (segmentIntersectsCircle(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, cx, cy, radius)) {
      return true;
    }
  }

  return false;
}

/**
 * تنفيذ المسح بالمود المطلوب (كائني كامل أو جزئي مقسم)
 */
export function applyDualEraser(
  strokes: readonly Stroke[],
  ex: number,
  ey: number,
  radius: number,
  mode: EraserMode,
  boundsCache: Map<string, StrokeBounds>
): { nextStrokes: Stroke[]; modified: boolean } {
  let didModify = false;
  const nextStrokes: Stroke[] = [];

  for (let i = 0; i < strokes.length; i++) {
    const stroke = strokes[i];
    let bounds = boundsCache.get(stroke.id);
    if (!bounds) {
      bounds = computeStrokeBounds(stroke);
      boundsCache.set(stroke.id, bounds);
    }

    // تصفية سريعة عبر الصندوق المحيط O(1)
    const outsideBounds = (
      ex + radius < bounds.minX ||
      ex - radius > bounds.maxX ||
      ey + radius < bounds.minY ||
      ey - radius > bounds.maxY
    );

    if (outsideBounds) {
      nextStrokes.push(stroke);
      continue;
    }

    if (mode === "stroke") {
      // ممحاة كائنية: إذا لمس أي جزء، احذف المسار بالكامل
      if (strokeTouchesCircle(stroke, ex, ey, radius)) {
        didModify = true;
        boundsCache.delete(stroke.id);
      } else {
        nextStrokes.push(stroke);
      }
    } else {
      // ممحاة جزئية: قص دقيق للمسار
      const pieces = eraseStrokePortion(stroke, ex, ey, radius);
      if (pieces.length === 1 && pieces[0] === stroke) {
        nextStrokes.push(stroke);
      } else {
        didModify = true;
        boundsCache.delete(stroke.id);
        for (let p = 0; p < pieces.length; p++) {
          nextStrokes.push(pieces[p]);
        }
      }
    }
  }

  return { nextStrokes, modified: didModify };
}
