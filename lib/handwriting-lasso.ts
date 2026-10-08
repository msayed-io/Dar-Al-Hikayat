/**
 * أداة التحديد والتحريك المتجهي (Lasso Selection & Transform Tool)
 *
 * الخصائص:
 * 1. رسم حلقة لا نهائية (Lasso Loop) لتحديد المسارات والنصوص المتجهية.
 * 2. خوارزمية فحص النقطة داخل المضلع (Ray-Casting Point-in-Polygon).
 * 3. إطار تحديد تفاعلي مع مقابض تحجيم نسبي متناسق وتحريك سلس.
 * 4. تكامل كامل مع نظام التراجع/الإعادة والحفظ المتجهي.
 */

import type { StrokePoint, Stroke } from "../components/DarAlHikayatHandwriting";

export interface LassoBoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

/**
 * خوارزمية Ray Casting للتحقق مما إذا كانت النقطة داخل مضلع اللاسو
 */
export function isPointInPolygon(point: { x: number; y: number }, polygon: readonly { x: number; y: number }[]): boolean {
  if (polygon.length < 3) return false;

  let inside = false;
  const x = point.x, y = point.y;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;

    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * فحص تقاطع قطعتين مستقيمتين
 */
function lineSegmentsIntersect(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number }
): boolean {
  const ccw = (A: { x: number; y: number }, B: { x: number; y: number }, C: { x: number; y: number }) =>
    (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
  return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
}

/**
 * حساب المسافة بين نقطة وقطعة مستقيمة
 */
function distanceToSegment(
  p: { x: number; y: number },
  v: { x: number; y: number },
  w: { x: number; y: number }
): number {
  const l2 = (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y);
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

/**
 * تحديد المسارات المحتواة أو المتقاطعة مع حلقة اللاسو بسلاسة ودون اشتراط إغلاق دقيق بالمسطرة
 * تدعم أيضاً النقر المباشر (Tap to select) على أي مسار لتحديده فورياً
 */
export function findStrokesInsideLasso(
  strokes: readonly Stroke[],
  lassoPoints: readonly { x: number; y: number }[]
): string[] {
  if (!lassoPoints || lassoPoints.length === 0) return [];

  // 1. فحص النقر المباشر / اللمس السريع لتحديد مسار فردي
  if (lassoPoints.length <= 4) {
    const p = lassoPoints[0];
    const totalDist = lassoPoints.reduce((acc, pt, idx) => {
      if (idx === 0) return 0;
      return acc + Math.hypot(pt.x - lassoPoints[idx - 1].x, pt.y - lassoPoints[idx - 1].y);
    }, 0);

    if (totalDist < 18) {
      // Direct tap selection
      for (let s = strokes.length - 1; s >= 0; s--) {
        const stroke = strokes[s];
        if (!stroke.points || stroke.points.length === 0) continue;
        const hitThreshold = Math.max(14, (stroke.width || 3) + 8);

        for (let i = 0; i < stroke.points.length; i++) {
          if (Math.hypot(stroke.points[i].x - p.x, stroke.points[i].y - p.y) <= hitThreshold) {
            return [stroke.id];
          }
          if (i > 0) {
            const d = distanceToSegment(p, stroke.points[i - 1], stroke.points[i]);
            if (d <= hitThreshold) {
              return [stroke.id];
            }
          }
        }
      }
    }
  }

  if (lassoPoints.length < 2) return [];

  // إغلاق المضلع تلقائياً بربط النهاية بالبداية دون اشتراط إغلاق يدوي بالمسطرة
  const first = lassoPoints[0];
  const last = lassoPoints[lassoPoints.length - 1];
  const closedPolygon: { x: number; y: number }[] =
    first.x === last.x && first.y === last.y
      ? [...lassoPoints]
      : [...lassoPoints, { x: first.x, y: first.y }];

  // حساب الصندوق المحيط بحلقة اللاسو للفلترة السريعة
  let lMinX = Infinity, lMaxX = -Infinity, lMinY = Infinity, lMaxY = -Infinity;
  for (const pt of lassoPoints) {
    if (pt.x < lMinX) lMinX = pt.x;
    if (pt.x > lMaxX) lMaxX = pt.x;
    if (pt.y < lMinY) lMinY = pt.y;
    if (pt.y > lMaxY) lMaxY = pt.y;
  }

  const selectedIds: string[] = [];

  for (const stroke of strokes) {
    if (!stroke.points || stroke.points.length === 0) continue;

    // حساب الصندوق المحيط للمسار
    let sMinX = Infinity, sMaxX = -Infinity, sMinY = Infinity, sMaxY = -Infinity;
    for (const p of stroke.points) {
      if (p.x < sMinX) sMinX = p.x;
      if (p.x > sMaxX) sMaxX = p.x;
      if (p.y < sMinY) sMinY = p.y;
      if (p.y > sMaxY) sMaxY = p.y;
    }

    // إذا لم يتقاطع الصندوقان نهائياً، نتخطى
    if (sMaxX < lMinX || sMinX > lMaxX || sMaxY < lMinY || sMinY > lMaxY) {
      continue;
    }

    const strokeCenterX = (sMinX + sMaxX) / 2;
    const strokeCenterY = (sMinY + sMaxY) / 2;

    // 1. فحص مركز المسار إذا كان داخل المضلع
    if (isPointInPolygon({ x: strokeCenterX, y: strokeCenterY }, closedPolygon)) {
      selectedIds.push(stroke.id);
      continue;
    }

    // 2. فحص نقاط المسار
    const sampleStep = Math.max(1, Math.floor(stroke.points.length / 15));
    let hasPointInside = false;
    for (let i = 0; i < stroke.points.length; i += sampleStep) {
      if (isPointInPolygon(stroke.points[i], closedPolygon)) {
        hasPointInside = true;
        break;
      }
    }

    if (hasPointInside) {
      selectedIds.push(stroke.id);
      continue;
    }

    // 3. فحص تقاطع خط اللاسو مع خطوط المسار
    let hasIntersection = false;
    const lassoStep = Math.max(1, Math.floor(lassoPoints.length / 30));
    for (let i = 0; i < lassoPoints.length - 1; i += lassoStep) {
      const lp1 = lassoPoints[i];
      const lp2 = lassoPoints[Math.min(i + lassoStep, lassoPoints.length - 1)];

      for (let j = 0; j < stroke.points.length - 1; j += sampleStep) {
        const sp1 = stroke.points[j];
        const sp2 = stroke.points[Math.min(j + sampleStep, stroke.points.length - 1)];

        if (lineSegmentsIntersect(lp1, lp2, sp1, sp2)) {
          hasIntersection = true;
          break;
        }
      }
      if (hasIntersection) break;
    }

    if (hasIntersection) {
      selectedIds.push(stroke.id);
    }
  }

  return selectedIds;
}

/**
 * حساب الصندوق المحيط بمجموعة المسارات المحددة
 */
export function computeSelectionBox(
  strokes: readonly Stroke[],
  selectedIds: readonly string[],
  padding = 12
): LassoBoundingBox | null {
  if (selectedIds.length === 0) return null;

  const idSet = new Set(selectedIds);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  for (const stroke of strokes) {
    if (!idSet.has(stroke.id)) continue;
    for (const p of stroke.points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  }

  if (minX === Infinity) return null;

  minX -= padding;
  maxX += padding;
  minY -= padding;
  maxY += padding;

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

/**
 * تطبيق التحويل (نقل أو تكبير/تصغير نسبي) على المسارات المحددة بأقصى سرعة ومعالجة فورية
 */
export function transformSelectedStrokes(
  strokes: readonly Stroke[],
  selectedIds: readonly string[] | Set<string>,
  dx: number,
  dy: number,
  scale: number,
  originX: number,
  originY: number
): Stroke[] {
  const idSet = selectedIds instanceof Set ? selectedIds : new Set(selectedIds);
  const len = strokes.length;
  const result: Stroke[] = new Array(len);

  for (let i = 0; i < len; i++) {
    const stroke = strokes[i];
    if (!idSet.has(stroke.id)) {
      result[i] = stroke;
      continue;
    }

    const pts = stroke.points;
    const ptLen = pts ? pts.length : 0;
    const newPoints: StrokePoint[] = new Array(ptLen);

    for (let j = 0; j < ptLen; j++) {
      const p = pts[j];
      newPoints[j] = {
        x: originX + (p.x - originX) * scale + dx,
        y: originY + (p.y - originY) * scale + dy,
        pressure: p.pressure,
        time: p.time,
        ...(p.inkWidth !== undefined ? { inkWidth: p.inkWidth * scale } : {}),
      };
    }

    result[i] = {
      ...stroke,
      width: Math.max(1, stroke.width * scale),
      points: newPoints,
    };
  }

  return result;
}

/**
 * حساب النقطة الثابتة (Anchor Point) المقابلة للمقبض الذي يتم سحبه
 */
export function getAnchorForCorner(cornerIndex: number, box: LassoBoundingBox): { x: number; y: number } {
  switch (cornerIndex) {
    case 0: // أعلى اليمين/اليسار (Top-Left) -> النقطة الثابتة هي أسفل اليمين (Bottom-Right)
      return { x: box.maxX, y: box.maxY };
    case 1: // Top-Right -> النقطة الثابتة هي Bottom-Left
      return { x: box.minX, y: box.maxY };
    case 2: // Bottom-Right -> النقطة الثابتة هي Top-Left
      return { x: box.minX, y: box.minY };
    case 3: // Bottom-Left -> النقطة الثابتة هي Top-Right
      return { x: box.maxX, y: box.minY };
    default:
      return { x: box.centerX, y: box.centerY };
  }
}

/**
 * حساب الصندوق المحيط الجديد بدقة رياضية عند التحجيم من زاوية محددة
 */
export function computeScaledBox(
  baseBox: LassoBoundingBox,
  anchor: { x: number; y: number },
  scale: number
): LassoBoundingBox {
  const rawMinX = anchor.x + (baseBox.minX - anchor.x) * scale;
  const rawMaxX = anchor.x + (baseBox.maxX - anchor.x) * scale;
  const rawMinY = anchor.y + (baseBox.minY - anchor.y) * scale;
  const rawMaxY = anchor.y + (baseBox.maxY - anchor.y) * scale;

  const minX = Math.min(rawMinX, rawMaxX);
  const maxX = Math.max(rawMinX, rawMaxX);
  const minY = Math.min(rawMinY, rawMaxY);
  const maxY = Math.max(rawMinY, rawMaxY);

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}
