const DPR = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
const TAU = Math.PI * 2;

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeIn = (t: number) => t * t * t;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export function noise(x: number, y: number): number {
  const a = Math.sin(x * 0.03 + Math.cos(y * 0.041) * 2.4);
  const b = Math.cos(y * 0.036 + Math.sin(x * 0.033) * 2.1);
  return a * b;
}

function roundRect(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  r = Math.min(r, w * 0.5, h * 0.5);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (cur && ctx.measureText(test).width > maxWidth) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * Snapshots a card DOM element into an offscreen canvas at native DPR resolution.
 */
export function takeCardSnapshot(cardEl: HTMLElement): {
  cv: HTMLCanvasElement;
  W: number;
  H: number;
  rect: DOMRect;
} {
  const rect = cardEl.getBoundingClientRect();
  const W = Math.max(1, rect.width);
  const H = Math.max(1, rect.height);

  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(W * DPR));
  cv.height = Math.max(1, Math.round(H * DPR));
  const c = cv.getContext("2d")!;
  c.scale(DPR, DPR);

  const cs = getComputedStyle(cardEl);
  const radius = parseFloat(cs.borderTopLeftRadius) || 32;

  let bg = cs.backgroundColor;
  if (!bg || bg === "rgba(0, 0, 0, 0)" || bg === "transparent") {
    const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
    bg = isDark ? "rgba(17, 23, 24, 0.95)" : "rgba(234, 230, 210, 0.95)";
  }
  c.fillStyle = bg;
  roundRect(c, 0, 0, W, H, radius);
  c.fill();

  if (cs.borderColor && parseFloat(cs.borderWidth) > 0) {
    c.strokeStyle = cs.borderColor;
    c.lineWidth = parseFloat(cs.borderWidth);
    roundRect(c, 0, 0, W, H, radius);
    c.stroke();
  }

  const childNodes = cardEl.querySelectorAll<HTMLElement>("h2, p, span, svg, div");
  childNodes.forEach((el) => {
    if (el.children.length > 0 && el.tagName !== "SPAN" && el.tagName.toLowerCase() !== "svg")
      return;

    const elRect = el.getBoundingClientRect();
    if (elRect.width === 0 || elRect.height === 0) return;

    const relX = elRect.left - rect.left;
    const relY = elRect.top - rect.top;
    const elCs = getComputedStyle(el);

    if (
      elCs.backgroundColor &&
      elCs.backgroundColor !== "rgba(0, 0, 0, 0)" &&
      elCs.backgroundColor !== "transparent"
    ) {
      const elRadius = parseFloat(elCs.borderTopLeftRadius) || 12;
      c.fillStyle = elCs.backgroundColor;
      roundRect(c, relX, relY, elRect.width, elRect.height, elRadius);
      c.fill();
    }

    if (el.tagName.toLowerCase() === "svg") {
      c.save();
      c.fillStyle = elCs.color || cs.color;
      roundRect(c, relX, relY, Math.min(elRect.width, 20), Math.min(elRect.height, 20), 4);
      c.fill();
      c.restore();
      return;
    }

    const text = el.textContent?.trim();
    if (!text) return;

    c.save();
    c.font = `${elCs.fontStyle} ${elCs.fontWeight} ${elCs.fontSize} ${elCs.fontFamily}`;
    c.fillStyle = elCs.color;
    c.textAlign = "right";
    c.textBaseline = "top";

    const lines = wrapText(c, text, elRect.width + 10);
    const lineHeight = parseFloat(elCs.lineHeight) || parseFloat(elCs.fontSize) * 1.3;
    lines.forEach((line, idx) => {
      const lineY = relY + idx * lineHeight;
      const drawX = relX + elRect.width;
      c.fillText(line, drawX, lineY);
    });
    c.restore();
  });

  return { cv, W, H, rect };
}

export interface Particle {
  ox: number;
  oy: number;
  screenX: number;
  screenY: number;
  vx: number;
  vy: number;
  a: number;
  r: number;
  d: number; // delay ms
  l: number; // lifetime ms
  s: number; // noise scale
  c: number; // curl amplitude
  p: number; // phase
  r0: number;
  g0: number;
  b0: number;
  colorKey: string;
}

export interface DissolveParticle {
  ox: number;
  oy: number;
  vx: number;
  vy: number;
  a: number;
  r: number;
  d: number;
  l: number;
  s: number;
  c: number;
  p: number;
  b: number; // sprite bucket index
  erased: boolean;
}

export interface CardDissolveUnit {
  el: HTMLElement;
  src: HTMLCanvasElement;
  base: HTMLCanvasElement;
  bctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  rect: DOMRect;
  parts: DissolveParticle[];
  sprites: HTMLCanvasElement[];
  erasedCount: number;
  allStarted: boolean;
}

/**
 * Samples particles for a card with authentic blur pre-filtering and bucketing.
 */
function sampleCardDissolve(srcCanvas: HTMLCanvasElement, W: number, H: number): {
  parts: DissolveParticle[];
  buckets: Map<number, { r: number; g: number; b: number; idx: number }>;
} {
  const w = srcCanvas.width;
  const h = srcCanvas.height;

  const blur = document.createElement("canvas");
  blur.width = w;
  blur.height = h;
  const bc = blur.getContext("2d")!;
  bc.filter = `blur(${DPR * 0.9}px)`;
  bc.drawImage(srcCanvas, 0, 0);

  const data = bc.getImageData(0, 0, w, h).data;

  const step = Math.max(2, Math.round(3 * DPR));
  const stepCss = step / DPR;
  const baseR = stepCss * 0.75;
  const A_MIN = 45;

  const parts: DissolveParticle[] = [];
  const buckets = new Map<number, { r: number; g: number; b: number; idx: number }>();

  const cx = W * 0.5;
  const cy = H * 0.5;
  const maxR = Math.hypot(cx, cy) || 1;

  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4;
      const a = data[i + 3];
      if (a < A_MIN) continue;

      const px = (x + step * 0.5) / DPR;
      const py = (y + step * 0.5) / DPR;

      const dx = px - cx;
      const dy = py - cy;
      const dN = Math.hypot(dx, dy) / maxR;
      const n = noise(px, py);

      const front = noise(px * 2.7 + 100, py * 2.7 + 100) > 0;

      const r0 = data[i];
      const g0 = data[i + 1];
      const b0 = data[i + 2];
      const key = ((r0 >> 4) << 8) | ((g0 >> 4) << 4) | (b0 >> 4);
      let bk = buckets.get(key);
      if (!bk) {
        const m = front ? 1 : 0.82;
        bk = { r: (r0 * m) | 0, g: (g0 * m) | 0, b: (b0 * m) | 0, idx: buckets.size };
        buckets.set(key, bk);
      }

      const ang = Math.atan2(dy, dx) + n * 0.75 + (Math.random() - 0.5) * 0.25;
      const spd =
        (32 + n * 14) *
        (0.55 + dN * 0.85) *
        (0.9 + Math.random() * 0.22) *
        (front ? 1.05 : 0.85);

      const delay =
        (1 - px / W) * 160 +
        (n * 0.5 + 0.5) * 110 +
        (front ? 0 : 45);

      const edgeFade = 1 - Math.pow(dN, 2.4) * 0.22;

      parts.push({
        ox: px,
        oy: py,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 22,
        a: (a / 255) * edgeFade,
        r: baseR * (front ? 1.05 : 0.85),
        d: delay,
        l: 750 + Math.random() * 260,
        s: n,
        c: (Math.random() - 0.5) * 22,
        p: Math.random() * TAU,
        b: bk.idx,
        erased: false,
      });
    }
  }

  return { parts, buckets };
}

/**
 * Builds offscreen circle sprite textures for each quantized color bucket.
 */
function buildSprites(buckets: Map<number, { r: number; g: number; b: number; idx: number }>): HTMLCanvasElement[] {
  const R = 8;
  const S = R * 2 + 2;
  const out: HTMLCanvasElement[] = [];
  for (const { r, g, b } of buckets.values()) {
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const x = c.getContext("2d")!;
    x.fillStyle = `rgb(${r},${g},${b})`;
    x.beginPath();
    x.arc(S * 0.5, S * 0.5, R, 0, TAU);
    x.fill();
    out.push(c);
  }
  return out;
}

/**
 * Unified Authentic Telegram Dissolve Engine for Single & Batch Cards.
 */
export function playStoryDissolveBatch(
  cards: { id: number; el?: HTMLElement | null }[],
  onDone?: () => void
): { canvas: HTMLCanvasElement; cleanup: () => void } {
  const vh = typeof window !== "undefined" ? window.innerHeight : 1000;
  const validCards = cards.filter(({ el }) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.bottom > 0 && r.top < vh;
  });

  if (validCards.length === 0) {
    if (onDone) onDone();
    const emptyCanvas = document.createElement("canvas");
    return { canvas: emptyCanvas, cleanup: () => {} };
  }

  const viewW = typeof window !== "undefined" ? window.innerWidth : 1000;
  const viewH = typeof window !== "undefined" ? window.innerHeight : 1000;

  // Create unified overlay canvas
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewW * DPR);
  canvas.height = Math.round(viewH * DPR);
  canvas.style.cssText = `position:fixed;left:0;top:0;width:${viewW}px;height:${viewH}px;pointer-events:none;z-index:9999;`;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d")!;
  ctx.scale(DPR, DPR);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "low";

  // Build dissolve units for all visible cards
  const units: CardDissolveUnit[] = [];
  for (const { el } of validCards) {
    if (!el) continue;
    const { cv: src, W, H, rect } = takeCardSnapshot(el);

    // Create Base Canvas
    const base = document.createElement("canvas");
    base.width = Math.round(W * DPR);
    base.height = Math.round(H * DPR);
    const bctx = base.getContext("2d")!;
    bctx.scale(DPR, DPR);
    bctx.drawImage(src, 0, 0, W, H);

    const { parts, buckets } = sampleCardDissolve(src, W, H);
    const sprites = buildSprites(buckets);

    units.push({
      el,
      src,
      base,
      bctx,
      W,
      H,
      rect,
      parts,
      sprites,
      erasedCount: 0,
      allStarted: false,
    });

    // Hide original DOM element
    el.style.visibility = "hidden";
  }

  const t0 = performance.now();
  let rafId = 0;
  let paused = false;
  let elapsed = 0;
  let lastNow = t0;

  function frame(now: number) {
    if (paused) return;

    const dt = now - lastNow;
    lastNow = now;
    elapsed += dt;

    const t = elapsed;
    const wt = t * 0.0016;

    /* ==========================================================
       PASS 1 — In-place base erosion via destination-out in single fill()
       ========================================================== */
    for (let u = 0; u < units.length; u++) {
      const unit = units[u];
      if (!unit.allStarted) {
        let first = true;
        const N = unit.parts.length;
        for (let i = 0; i < N; i++) {
          const p = unit.parts[i];
          if (p.erased || t < p.d) continue;
          p.erased = true;
          unit.erasedCount++;
          if (first) {
            unit.bctx.globalCompositeOperation = "destination-out";
            unit.bctx.beginPath();
            first = false;
          }
          unit.bctx.moveTo(p.ox + p.r, p.oy);
          unit.bctx.arc(p.ox, p.oy, p.r, 0, TAU);
        }
        if (!first) {
          unit.bctx.fill();
          unit.bctx.globalCompositeOperation = "source-over";
        }
        if (unit.erasedCount === N) unit.allStarted = true;
      }
    }

    /* ==========================================================
       PASS 2 — Render active base canvases and flying particles
       ========================================================== */
    ctx.clearRect(0, 0, viewW, viewH);

    // Draw base card canvas while it still has unerased pixels
    for (let u = 0; u < units.length; u++) {
      const unit = units[u];
      if (!unit.allStarted) {
        ctx.globalAlpha = 1;
        ctx.drawImage(unit.base, unit.rect.left, unit.rect.top, unit.W, unit.H);
      }
    }

    let pending = 0;

    // Draw flying particles with authentic physics and stardust fading
    for (let u = 0; u < units.length; u++) {
      const unit = units[u];
      const N = unit.parts.length;
      for (let i = 0; i < N; i++) {
        const p = unit.parts[i];
        const lt = (t - p.d) / p.l;
        if (lt >= 1) continue;
        pending++;

        if (lt <= 0) continue; // Not started yet — base canvas shows it

        const e = easeOut(lt);
        const curlX = Math.sin(wt * 1.5 + p.p) * p.c * e;
        const curlY = Math.cos(wt * 1.3 + p.p * 1.37) * p.c * 0.6 * e;

        const x =
          p.ox +
          p.vx * e +
          Math.sin(p.oy * 0.024 + wt) * 7 * e +
          Math.sin(lt * 5.5 + p.s * 3.1) * 3 * e +
          curlX;

        const y =
          p.oy +
          p.vy * e +
          Math.cos(p.ox * 0.024 + wt * 1.35) * 7 * e +
          Math.cos(lt * 4.2 + p.s * 2.7) * 3 * e +
          34 * lt * lt +
          curlY;

        const al = p.a * (1 - easeIn(clamp((lt - 0.06) / 0.94, 0, 1)));
        const rad = p.r * (0.14 + 0.86 * Math.pow(1 - lt, 1.6));

        ctx.globalAlpha = al;
        ctx.drawImage(
          unit.sprites[p.b],
          unit.rect.left + x - rad,
          unit.rect.top + y - rad,
          rad * 2,
          rad * 2
        );
      }
    }

    if (pending > 0) {
      rafId = requestAnimationFrame(frame);
    } else {
      cancelAnimationFrame(rafId);
      cleanup();
      if (onDone) onDone();
    }
  }

  function cleanup() {
    cancelAnimationFrame(rafId);
    if (canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onVisibility);
    }
  }

  function onVisibility() {
    if (typeof document !== "undefined" && document.hidden) {
      paused = true;
      cancelAnimationFrame(rafId);
    } else if (paused) {
      paused = false;
      lastNow = performance.now();
      rafId = requestAnimationFrame(frame);
    }
  }

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibility);
  }
  rafId = requestAnimationFrame(frame);

  return { canvas, cleanup };
}

/**
 * Backward compatible single-card dissolve function delegating to playStoryDissolveBatch.
 */
export function playStoryDissolve(
  cardEl: HTMLElement,
  onDone?: () => void
): { canvas: HTMLCanvasElement; cleanup: () => void } {
  return playStoryDissolveBatch([{ id: 0, el: cardEl }], onDone);
}
