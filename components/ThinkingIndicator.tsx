import React, { useEffect, useRef } from "react";

// Geometry and animation copied from the supplied thinking-orb-ar-weaving-react demo.
const ORB_SIZE = 20;
const PRESET_SPEED = 2.75;
const USER_SPEED = 1;
const opts = {
  strandN: 6,
  turns: 3,
  ghostN: 17,
  rBase: 1.2 * 1.36,
  rDepth: 1.8 * 1.36,
  rsPow: 0.6,
  rMin: 0.3
};

function frac(x) { return x - Math.floor(x); }

function fibDir(i, n) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (2 * (i + 0.5)) / n;
  const rad = Math.sqrt(1 - y * y);
  const a = i * golden;
  return [rad * Math.cos(a), y, rad * Math.sin(a)];
}

function makeProj(yaw, tilt, cx, cy, scale) {
  const st = Math.sin(tilt), ct = Math.cos(tilt);
  const sy = Math.sin(yaw), cyw = Math.cos(yaw);
  return (x, y, z) => {
    const x1 = x * cyw + z * sy;
    const z1 = -x * sy + z * cyw;
    const y1 = y * ct - z1 * st;
    const z2 = y * st + z1 * ct;
    return [cx + x1 * scale, cy - y1 * scale, z2];
  };
}

function radiusScale(size, pow) { return (size / 300) ** pow; }

export function frameBraid(size: number, t: number, o = opts) {
  const cx = size / 2, cy = size / 2;
  const R = (size / 2) * 0.76;
  const pt = makeProj(t * 0.4, 0.3, cx, cy, 1);
  const rs = radiusScale(size, o.rsPow ?? 0.6);
  const dots = [];
  const ghostN = o.ghostN ?? 150;

  for (let i = 0; i < ghostN; i++) {
    const d = fibDir(i, ghostN);
    const [px, py, z] = pt(d[0] * R, d[1] * R, d[2] * R);
    const depth = (z / R + 1) / 2;
    dots.push({ x: px, y: py, z, r: 0.8 * rs, white: 0.78, a: 0.1 + 0.22 * depth });
  }

  const strandN = o.strandN ?? 52;
  const turns = o.turns ?? 3;
  for (let s = 0; s < 3; s++) {
    const phase = (s / 3) * 2 * Math.PI;
    for (let i = 0; i < strandN; i++) {
      const u = (frac(i / strandN + t * 0.045) * 2 - 1) * 0.96;
      const surf = Math.sqrt(Math.max(0, 1 - u * u));
      const endFade = Math.min(1, (1 - Math.abs(u)) / 0.1);
      const a = u * Math.PI * turns + phase;
      const weave = 1 + 0.075 * Math.sin(u * Math.PI * turns * 2 + phase * 2 + t * 0.8);
      const rr = surf * R * weave;
      const [px, py, zr] = pt(Math.cos(a) * rr, u * R * weave, Math.sin(a) * rr);
      const depth = (zr / R + 1) / 2;
      dots.push({
        x: px, y: py, z: zr,
        r: ((o.rBase ?? 1.2) + (o.rDepth ?? 1.8) * depth) * rs,
        white: 0.55 - 0.45 * depth,
        a: endFade * (0.45 + 0.55 * depth)
      });
    }
  }

  const visible = dots.filter(d => (d.a ?? 1) >= 0.02);
  for (const d of visible) d.r = Math.max(o.rMin ?? 0.3, d.r);
  visible.sort((a, b) => a.z - b.z);
  return visible;
}

// Only the palette changes: source luminance/depth/alpha are preserved.
function inkColor(white: number, alpha: number, ink: string, paper: string) {
  const w = Math.min(1, Math.max(0, white));
  const blend = Math.round((1 - w) * 255) / 255;
  const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const foreground = rgb(ink), background = rgb(paper);
  const channels = foreground.map((v, i) => Math.round(background[i] + (v - background[i]) * blend));
  return `rgba(${channels.join(",")},${alpha})`;
}

function ThinkingOrb({ ink, paper }: { ink: string; paper: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(ORB_SIZE * dpr);
    canvas.height = Math.round(ORB_SIZE * dpr);
    let raf = 0;
    let running = true;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function draw(seconds) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, ORB_SIZE, ORB_SIZE);
      for (const d of frameBraid(ORB_SIZE, seconds, opts)) {
        ctx.fillStyle = inkColor(d.white, d.a ?? 1, ink, paper);
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (reduced) {
      draw(0.6);
      return () => { running = false; };
    }

    const loop = (now) => {
      if (!running) return;
      draw((now / 1000) * PRESET_SPEED * USER_SPEED);
      raf = requestAnimationFrame(loop);
    };
    draw((performance.now() / 1000) * PRESET_SPEED * USER_SPEED);
    raf = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(raf); };
  }, [ink, paper]);

  return <canvas ref={ref} className="dar-thinking-orb" aria-hidden="true" />;
}

export default function ThinkingIndicator({ theme }: { theme: { text: string; bg: string } }) {
  return (
    <span className="dar-thinking-line" dir="rtl" role="status" aria-label="جارٍ التفكير"
      style={{ "--dar-shimmer-base": `color-mix(in srgb, ${theme.text} 50%, transparent)`, "--dar-shimmer-highlight": theme.text } as React.CSSProperties}>
      <ThinkingOrb ink={theme.text} paper={theme.bg} />
      <span className="dar-thinking-shimmer" data-text="جارٍ التفكير…">جارٍ التفكير…</span>
    </span>
  );
}
