const DPR = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
const TAU = Math.PI * 2;
const PAD = 140;

export interface Particle {
  ox: number;
  oy: number;
  vx: number;
  vy: number;
  a: number;
  r: number;
  d: number; // delay ms
  l: number; // lifetime ms
  s: number; // noise scale
  c: number; // curl amplitude
  p: number; // phase
  b: number; // sprite bucket index
  erased: boolean;
}

export interface SpriteBucket {
  r: number;
  g: number;
  b: number;
  idx: number;
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
 * Snapshots a card DOM element into an offscreen canvas.
 * Handles background glass/solid colors, borders, text, titles, badges, and icons.
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
  c.scale(cv.width / W, cv.height / H);

  const cs = getComputedStyle(cardEl);
  const radius = parseFloat(cs.borderTopLeftRadius) || 32;

  // Draw card background based on active theme / computed style
  let bg = cs.backgroundColor;
  if (!bg || bg === "rgba(0, 0, 0, 0)" || bg === "transparent") {
    const isDark = document.documentElement.classList.contains("dark");
    bg = isDark ? "rgba(17, 23, 24, 0.95)" : "rgba(234, 230, 210, 0.95)";
  }
  c.fillStyle = bg;
  roundRect(c, 0, 0, W, H, radius);
  c.fill();

  // Draw card border
  if (cs.borderColor && parseFloat(cs.borderWidth) > 0) {
    c.strokeStyle = cs.borderColor;
    c.lineWidth = parseFloat(cs.borderWidth);
    roundRect(c, 0, 0, W, H, radius);
    c.stroke();
  }

  // Draw internal elements (texts, titles, badges, icons)
  const childNodes = cardEl.querySelectorAll<HTMLElement>(
    "h2, p, span, svg, div"
  );
  childNodes.forEach((el) => {
    // Skip containers that have text child nodes already handled by leaf nodes
    if (el.children.length > 0 && el.tagName !== "SPAN" && el.tagName !== "svg")
      return;

    const elRect = el.getBoundingClientRect();
    if (elRect.width === 0 || elRect.height === 0) return;

    const relX = elRect.left - rect.left;
    const relY = elRect.top - rect.top;
    const elCs = getComputedStyle(el);

    // Draw background for pill badges or chips if present
    if (
      elCs.backgroundColor &&
      elCs.backgroundColor !== "rgba(0, 0, 0, 0)" &&
      elCs.backgroundColor !== "transparent"
    ) {
      const elRadius = parseFloat(elCs.borderTopLeftRadius) || 12;
      c.fillStyle = elCs.backgroundColor;
      roundRect(c, relX, relY, elRect.width, elRect.height, elRadius);
      c.fill();
      if (elCs.borderColor && parseFloat(elCs.borderWidth) > 0) {
        c.strokeStyle = elCs.borderColor;
        c.lineWidth = parseFloat(elCs.borderWidth);
        roundRect(c, relX, relY, elRect.width, elRect.height, elRadius);
        c.stroke();
      }
    }

    // Draw SVG icon if element is SVG
    if (el.tagName.toLowerCase() === "svg") {
      c.save();
      c.fillStyle = elCs.color || cs.color;
      c.strokeStyle = elCs.color || cs.color;
      roundRect(
        c,
        relX,
        relY,
        Math.min(elRect.width, 20),
        Math.min(elRect.height, 20),
        4
      );
      c.fill();
      c.restore();
      return;
    }

    // Draw Text
    const text = el.textContent?.trim();
    if (!text) return;

    c.save();
    c.font = `${elCs.fontStyle} ${elCs.fontWeight} ${elCs.fontSize} ${elCs.fontFamily}`;
    c.fillStyle = elCs.color;
    const isRtl = true; // Arabic UI default
    c.textAlign = isRtl ? "right" : "left";
    c.textBaseline = "top";

    const lines = wrapText(c, text, elRect.width + 10);
    const lineHeight =
      parseFloat(elCs.lineHeight) || parseFloat(elCs.fontSize) * 1.3;
    lines.forEach((line, idx) => {
      const lineY = relY + idx * lineHeight;
      const drawX = isRtl ? relX + elRect.width : relX;
      c.fillText(line, drawX, lineY);
    });
    c.restore();
  });

  return { cv, W, H, rect };
}

/**
 * Samples particle matrix directly from the card snapshot canvas.
 * Inherits real colors of the story card background, title, and body text.
 */
export function sampleParticles(
  srcCanvas: HTMLCanvasElement,
  W: number,
  H: number
): { parts: Particle[]; buckets: Map<number, SpriteBucket> } {
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
  const A_MIN = 35;

  const parts: Particle[] = [];
  const buckets = new Map<number, SpriteBucket>();

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
      const key = (r0 >> 4) << 8 | (g0 >> 4) << 4 | (b0 >> 4);
      let bk = buckets.get(key);
      if (!bk) {
        const m = front ? 1 : 0.82;
        bk = {
          r: (r0 * m) | 0,
          g: (g0 * m) | 0,
          b: (b0 * m) | 0,
          idx: buckets.size,
        };
        buckets.set(key, bk);
      }

      const ang = Math.atan2(dy, dx) + n * 0.75 + (Math.random() - 0.5) * 0.22;
      const spd =
        (25 + n * 11) *
        (0.6 + dN * 0.75) *
        (0.92 + Math.random() * 0.2) *
        (front ? 1.05 : 0.88);

      // Progressive wave delay across the card: ~450ms spread allows the eye to clearly watch disintegration
      const delay =
        (1 - px / W) * 260 + (n * 0.5 + 0.5) * 160 + (front ? 0 : 55);

      const edgeFade = 1 - Math.pow(dN, 2.4) * 0.22;

      parts.push({
        ox: px,
        oy: py,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 18,
        a: (a / 255) * edgeFade,
        r: baseR * (front ? 1.05 : 0.85),
        d: delay,
        // Slightly extended lifetime: ~1050ms - 1370ms (~1.1 to 1.35 seconds)
        // Perfectly balanced: not too rushed and not sluggish
        l: 1050 + Math.random() * 320,
        s: n,
        c: (Math.random() - 0.5) * 20,
        p: Math.random() * TAU,
        b: bk.idx,
        erased: false,
      });
    }
  }

  return { parts, buckets };
}

export function buildSprites(
  buckets: Map<number, SpriteBucket>
): HTMLCanvasElement[] {
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
 * Executes the cinematic particle dissolve physics animation for a given story card element.
 * Retains 2-layer visual depth (Base untransformed canvas + main particle overlay canvas).
 */
export function playStoryDissolve(
  cardEl: HTMLElement,
  onDone?: () => void
): { canvas: HTMLCanvasElement; cleanup: () => void } {
  const snap = takeCardSnapshot(cardEl);
  const { cv: src, W, H, rect } = snap;

  const cssW = W + PAD * 2;
  const cssH = H + PAD * 2;

  /* Base Canvas (W x H) */
  const base = document.createElement("canvas");
  base.width = Math.round(W * DPR);
  base.height = Math.round(H * DPR);
  const bctx = base.getContext("2d")!;
  bctx.scale(DPR, DPR);
  bctx.drawImage(src, 0, 0, W, H);

  /* Main Overlay Canvas (W + 2*PAD x H + 2*PAD) */
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(cssW * DPR);
  canvas.height = Math.round(cssH * DPR);
  canvas.style.cssText =
    "position:fixed;" +
    `left:${rect.left - PAD}px;` +
    `top:${rect.top - PAD}px;` +
    `width:${cssW}px;` +
    `height:${cssH}px;` +
    "pointer-events:none;z-index:9999;";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d")!;
  ctx.scale(DPR, DPR);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "low";

  // Hide the original card element visually while particles animate
  cardEl.style.opacity = "0";
  cardEl.style.pointerEvents = "none";

  const { parts, buckets } = sampleParticles(src, W, H);
  const sprites = buildSprites(buckets);
  const N = parts.length;

  const t0 = performance.now();
  let rafId = 0;
  let paused = false;
  let elapsed = 0;
  let lastNow = t0;
  let erasedCount = 0;
  let allStarted = false;

  function frame(now: number) {
    if (paused) return;

    const dt = now - lastNow;
    lastNow = now;
    elapsed += dt;

    const t = elapsed;
    const wt = t * 0.00125;

    /* PASS 1 — Erasure from Base Canvas */
    if (!allStarted) {
      let first = true;
      for (let i = 0; i < N; i++) {
        const p = parts[i];
        if (p.erased || t < p.d) continue;
        p.erased = true;
        erasedCount++;
        if (first) {
          bctx.globalCompositeOperation = "destination-out";
          bctx.beginPath();
          first = false;
        }
        bctx.moveTo(p.ox + p.r * 1.15, p.oy);
        bctx.arc(p.ox, p.oy, p.r * 1.15, 0, TAU);
      }
      if (!first) {
        bctx.fill();
        bctx.globalCompositeOperation = "source-over";
      }
      if (erasedCount === N) allStarted = true;
    }

    /* PASS 2 — Render Particles */
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.globalAlpha = 1;

    if (!allStarted) ctx.drawImage(base, PAD, PAD, W, H);

    let pending = 0;

    for (let i = 0; i < N; i++) {
      const p = parts[i];
      const lt = (t - p.d) / p.l;
      if (lt >= 1) continue;
      pending++;

      if (lt <= 0) continue;

      const e = easeOut(lt);
      const curlX = Math.sin(wt * 1.3 + p.p) * p.c * e;
      const curlY = Math.cos(wt * 1.15 + p.p * 1.3) * p.c * 0.55 * e;

      const x =
        p.ox +
        p.vx * e +
        Math.sin(p.oy * 0.022 + wt) * 6 * e +
        Math.sin(lt * 4.5 + p.s * 2.8) * 2.5 * e +
        curlX;

      const y =
        p.oy +
        p.vy * e +
        Math.cos(p.ox * 0.022 + wt * 1.2) * 6 * e +
        Math.cos(lt * 3.8 + p.s * 2.5) * 2.5 * e +
        28 * lt * lt +
        curlY;

      // Keep particles vividly visible through early flight (~16%), then gently dissolve into stardust
      const al = p.a * (1 - easeIn(clamp((lt - 0.16) / 0.84, 0, 1)));
      const rad = p.r * (0.16 + 0.84 * Math.pow(1 - lt, 1.3));

      ctx.globalAlpha = al;
      ctx.drawImage(
        sprites[p.b],
        PAD + x - rad,
        PAD + y - rad,
        rad * 2,
        rad * 2
      );
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
    document.removeEventListener("visibilitychange", onVisibility);
  }

  function onVisibility() {
    if (document.hidden) {
      paused = true;
      cancelAnimationFrame(rafId);
    } else if (paused) {
      paused = false;
      lastNow = performance.now();
      rafId = requestAnimationFrame(frame);
    }
  }

  document.addEventListener("visibilitychange", onVisibility);
  rafId = requestAnimationFrame(frame);

  return { canvas, cleanup };
}
