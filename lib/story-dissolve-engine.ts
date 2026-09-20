const DPR = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
const TAU = Math.PI * 2;

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
 * Snapshots a card DOM element into an offscreen canvas downscaled by 0.5 (1/4 area).
 * Ultra-fast capture (< 3ms per card).
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

  // Downscale by 0.5 for fast 1/4 area canvas sampling
  const scaleRatio = 0.5;
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(W * scaleRatio * DPR));
  cv.height = Math.max(1, Math.round(H * scaleRatio * DPR));
  const c = cv.getContext("2d")!;
  c.scale(cv.width / W, cv.height / H);

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

/**
 * Samples particle matrix for a card with target particle budget cap.
 */
export function sampleParticlesForCard(
  cardEl: HTMLElement,
  targetParticleCap: number
): Particle[] {
  const { cv: src, W, H, rect } = takeCardSnapshot(cardEl);
  const w = src.width;
  const h = src.height;

  const bc = src.getContext("2d")!;
  const data = bc.getImageData(0, 0, w, h).data;

  const totalPixels = (w * h) / 4;
  // Calculate dynamic step to match targetParticleCap (up to targetParticleCap)
  const idealStep = Math.max(2, Math.floor(Math.sqrt((w * h) / Math.max(1, targetParticleCap))));
  const step = idealStep;
  const baseR = 2.5;
  const A_MIN = 30;

  const parts: Particle[] = [];
  const cx = W * 0.5;
  const cy = H * 0.5;
  const maxR = Math.hypot(cx, cy) || 1;

  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4;
      const a = data[i + 3];
      if (a < A_MIN) continue;

      const px = (x / w) * W;
      const py = (y / h) * H;

      const dx = px - cx;
      const dy = py - cy;
      const dN = Math.hypot(dx, dy) / maxR;
      const n = noise(px, py);
      const front = noise(px * 2.7 + 100, py * 2.7 + 100) > 0;

      const r0 = data[i];
      const g0 = data[i + 1];
      const b0 = data[i + 2];
      const m = front ? 1 : 0.82;
      const finalR = Math.round(r0 * m);
      const finalG = Math.round(g0 * m);
      const finalB = Math.round(b0 * m);

      // Quantize colors for efficient batching
      const qR = Math.round(finalR / 16) * 16;
      const qG = Math.round(finalG / 16) * 16;
      const qB = Math.round(finalB / 16) * 16;
      const colorKey = `rgb(${qR},${qG},${qB})`;

      const ang = Math.atan2(dy, dx) + n * 0.75 + (Math.random() - 0.5) * 0.22;
      const spd =
        (25 + n * 11) *
        (0.6 + dN * 0.75) *
        (0.92 + Math.random() * 0.2) *
        (front ? 1.05 : 0.88);

      // Progressive wave delay across card: ~450ms spread
      const delay = (1 - px / W) * 260 + (n * 0.5 + 0.5) * 160 + (front ? 0 : 55);
      const edgeFade = 1 - Math.pow(dN, 2.4) * 0.22;

      parts.push({
        ox: px,
        oy: py,
        screenX: rect.left + px,
        screenY: rect.top + py,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 18,
        a: (a / 255) * edgeFade,
        r: baseR * (front ? 1.05 : 0.85),
        d: delay,
        l: 1050 + Math.random() * 320,
        s: n,
        c: (Math.random() - 0.5) * 20,
        p: Math.random() * TAU,
        r0: qR,
        g0: qG,
        b0: qB,
        colorKey,
      });

      if (parts.length >= targetParticleCap) break;
    }
    if (parts.length >= targetParticleCap) break;
  }

  return parts;
}

/**
 * Unified Batch Particle Dissolve Engine.
 * Single viewport canvas + single rAF loop + batched color rendering path.
 */
export function playStoryDissolveBatch(
  cards: { id: number; el?: HTMLElement | null }[],
  onDone?: () => void
): { canvas: HTMLCanvasElement; cleanup: () => void } {
  const validCards = cards.filter((c) => c.el && c.el.getBoundingClientRect().width > 0);

  // If no card elements passed in, invoke onDone immediately
  if (validCards.length === 0) {
    if (onDone) onDone();
    const emptyCanvas = document.createElement("canvas");
    return { canvas: emptyCanvas, cleanup: () => {} };
  }

  // Immediately hide all card elements visually
  validCards.forEach(({ el }) => {
    if (el) {
      el.style.opacity = "0";
      el.style.pointerEvents = "none";
      el.style.transition = "none";
    }
  });

  // Calculate particle budget per card (max 12,000 total across all cards)
  const MAX_TOTAL_PARTICLES = 12000;
  const perCardCap = Math.max(80, Math.floor(MAX_TOTAL_PARTICLES / validCards.length));

  // Collect all particles
  const allParticles: Particle[] = [];
  for (const { el } of validCards) {
    if (el) {
      const pList = sampleParticlesForCard(el, perCardCap);
      allParticles.push(...pList);
    }
  }

  // Group particles by colorKey for batched path rendering
  const colorGroups = new Map<string, Particle[]>();
  for (const p of allParticles) {
    let grp = colorGroups.get(p.colorKey);
    if (!grp) {
      grp = [];
      colorGroups.get(p.colorKey) || colorGroups.set(p.colorKey, grp);
    }
    grp.push(p);
  }

  // Create single overlay canvas over whole viewport
  const viewW = typeof window !== "undefined" ? window.innerWidth : 1000;
  const viewH = typeof window !== "undefined" ? window.innerHeight : 1000;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewW * DPR);
  canvas.height = Math.round(viewH * DPR);
  canvas.style.cssText = `position:fixed;left:0;top:0;width:${viewW}px;height:${viewH}px;pointer-events:none;z-index:9999;`;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d")!;
  ctx.scale(DPR, DPR);

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
    const wt = t * 0.00125;

    ctx.clearRect(0, 0, viewW, viewH);

    let activeCount = 0;

    // Batched Path Rendering per Color Group
    colorGroups.forEach((pList, colorKey) => {
      ctx.fillStyle = colorKey;
      ctx.beginPath();
      let groupHasActive = false;

      for (let i = 0; i < pList.length; i++) {
        const p = pList[i];
        const lt = (t - p.d) / p.l;
        if (lt <= 0 || lt >= 1) continue;

        activeCount++;
        groupHasActive = true;

        const e = easeOut(lt);
        const curlX = Math.sin(wt * 1.3 + p.p) * p.c * e;
        const curlY = Math.cos(wt * 1.15 + p.p * 1.3) * p.c * 0.55 * e;

        const x =
          p.screenX +
          p.vx * e +
          Math.sin(p.oy * 0.022 + wt) * 6 * e +
          Math.sin(lt * 4.5 + p.s * 2.8) * 2.5 * e +
          curlX;

        const y =
          p.screenY +
          p.vy * e +
          Math.cos(p.ox * 0.022 + wt * 1.2) * 6 * e +
          Math.cos(lt * 3.8 + p.s * 2.5) * 2.5 * e +
          28 * lt * lt +
          curlY;

        const rad = p.r * (0.16 + 0.84 * Math.pow(1 - lt, 1.3));

        ctx.moveTo(x + rad, y);
        ctx.arc(x, y, rad, 0, TAU);
      }

      if (groupHasActive) {
        ctx.fill();
      }
    });

    // Check if animation finished or if max duration (1.5 seconds) reached
    if (activeCount > 0 && elapsed < 1500) {
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
