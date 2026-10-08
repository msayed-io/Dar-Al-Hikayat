/** @vitest-environment jsdom */
import React, { act, createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Handwriting, { type HandwritingHandle, type Stroke } from "../components/DarAlHikayatHandwriting";
import { setupDom, theme, EMPTY_STROKES, pointer } from "./helpers/handwriting-dom";
import * as featureFlags from "../lib/handwriting-feature-flags";
import { SHAPE_CONFIG } from "../lib/handwriting-shapes";
import { eraseStrokePortion } from "../lib/handwriting-eraser";
import { transformSelectedStrokes } from "../lib/handwriting-lasso";
import { getHandwritingPreview } from "../lib/handwriting-document";
import { renderRecordedInk, drawInkSegment } from "../lib/handwriting-engine";

let dom: ReturnType<typeof setupDom>;
beforeEach(() => { dom = setupDom(); });
afterEach(() => { dom.cleanup(); vi.useRealTimers(); });
async function mount() {
  const ref = createRef<HandwritingHandle>();
  await dom.render(<Handwriting ref={ref} isActive theme={theme} initialStrokes={EMPTY_STROKES} onClose={() => {}} />);
  vi.useFakeTimers();
  return ref;
}
async function circle() {
  await pointer('#handwriting-canvas-layer', 'pointerdown', 290, 260);
  for (let i = 1; i <= 32; i++) {
    const t = i * Math.PI / 16;
    await pointer(window, 'pointermove', 200 + 90 * Math.cos(t), 260 + 90 * Math.sin(t));
  }
}
async function wait(ms: number) { await act(async () => { vi.advanceTimersByTime(ms); }); }

describe('Handwriting surgical regression tests', () => {
  it('does not convert on lift without the completed hold, including just below the threshold', async () => {
    const ref = await mount(); await circle(); await wait(SHAPE_CONFIG.HOLD_DURATION_MS - 1);
    await pointer(window, 'pointerup', 290, 260);
    expect(ref.current!.getStrokes()[0].tool).not.toBe('shape');
    expect(ref.current!.getStrokes()[0].points).toHaveLength(33);
  });
  it('a held shape undoes to the exact original ink, then redoes the shape', async () => {
    const ref = await mount(); await circle(); await wait(SHAPE_CONFIG.HOLD_DURATION_MS + 1);
    await pointer(window, 'pointerup', 290, 260);
    const converted = ref.current!.getStrokes()[0];
    expect(converted.tool).toBe('shape');
    await act(async () => ref.current!.undo());
    const original = ref.current!.getStrokes()[0];
    expect(original.points).toEqual(converted.originalPoints);
    expect(original.renderVersion).toBeUndefined();
    expect(original.color).toBe(converted.color);
    expect(original.width).toBe(converted.width);
    await act(async () => ref.current!.redo());
    expect(ref.current!.getStrokes()[0]).toEqual(converted);
  });
  it('resumed movement invalidates the held candidate', async () => {
    const ref = await mount(); await circle(); await wait(481);
    await pointer(window, 'pointermove', 305, 280);
    await pointer(window, 'pointerup', 305, 280);
    expect(ref.current!.getStrokes()[0].tool).not.toBe('shape');
    expect(ref.current!.getStrokes()[0].points).toHaveLength(34);
  });
  it.each(['pointercancel', 'blur'])('does not convert on %s after a hold', async event => {
    const ref = await mount(); await circle(); await wait(481);
    if (event === 'blur') await act(async () => window.dispatchEvent(new Event('blur')));
    else await pointer(window, event, 290, 260);
    expect(ref.current!.getStrokes()[0].tool).not.toBe('shape');
  });
  it('stores new pen samples unchanged in the original format', async () => {
    const ref = await mount();
    await pointer('#handwriting-canvas-layer', 'pointerdown', 100, 200);
    await pointer(window, 'pointermove', 150, 220);
    await pointer(window, 'pointermove', 180, 210);
    await pointer(window, 'pointerup', 180, 210);
    const stroke = ref.current!.getStrokes()[0];
    expect(stroke.renderVersion).toBeUndefined();
    expect(stroke.points.map(p => [p.x, p.y])).toEqual([[100, 200], [150, 220], [180, 210]]);
    expect(stroke.points.every(p => p.inkWidth === undefined)).toBe(true);
  });
  it('retains separate undo steps across multiple strokes despite event closures', async () => {
    const ref = await mount();
    for (let i = 0; i < 3; i++) {
      await pointer('#handwriting-canvas-layer', 'pointerdown', 100 + i * 20, 200);
      await pointer(window, 'pointermove', 105 + i * 20, 230);
      await pointer(window, 'pointerup', 105 + i * 20, 230);
    }
    for (let count = 2; count >= 0; count--) {
      await act(async () => ref.current!.undo());
      expect(ref.current!.getStrokes()).toHaveLength(count);
    }
  });
  it('honors disabled feature controls and shape recognition without removing saved ink', async () => {
    vi.spyOn(featureFlags, 'isHandwritingFeatureEnabled').mockReturnValue(false);
    const ref = await mount();
    expect((document.getElementById('handwriting-btn-lasso') as HTMLButtonElement).disabled).toBe(true);
    expect((document.getElementById('handwriting-btn-highlighter') as HTMLButtonElement).disabled).toBe(true);
    await circle(); await wait(481); await pointer(window, 'pointerup', 290, 260);
    expect(ref.current!.getStrokes()[0].tool).not.toBe('shape');
    expect(ref.current!.getStrokes()[0].renderVersion).toBeUndefined();
    expect(ref.current!.getStrokes()[0].points.every(p => p.inkWidth === undefined)).toBe(true);
  });
  it('retains read compatibility for already-saved v1 ink, including recorded widths', () => {
    const operations: unknown[][] = [];
    const ctx = new Proxy({} as CanvasRenderingContext2D, {
      set(t, key, value) { operations.push(['set', key, value]); return true; },
      get(t, key) { return (...args: unknown[]) => operations.push([key, ...args]); },
    });
    const stroke: Stroke = { id: 'v1', width: 3.5, color: '#123456', renderVersion: 1,
      points: [{ x: 30, y: 40, time: 0, pressure: .5, inkWidth: 3.5 },
        { x: 80, y: 70, time: 30, pressure: .5, inkWidth: 4.1 },
        { x: 160, y: 45, time: 35, pressure: .5, inkWidth: 3.1 }] };
    renderRecordedInk(ctx, stroke);
    expect(operations.filter(o => o[0] === 'set' && o[1] === 'lineWidth').map(o => o[2])).toEqual([4.1, 3.1]);
    const replaySegments = operations.filter(o => ['moveTo', 'lineTo', 'quadraticCurveTo', 'stroke'].includes(o[0] as string));
    operations.length = 0;
    drawInkSegment(ctx, stroke.points[0], stroke.points[1]);
    drawInkSegment(ctx, stroke.points[1], stroke.points[2], stroke.points[0]);
    expect(operations.filter(o => o[0] !== 'beginPath')).toEqual(replaySegments);
    const paths = getHandwritingPreview([stroke])!.strokes;
    expect(paths.map(p => p.width)).toEqual([3.5, 4.1, 3.1]);
    expect(paths.at(-1)!.path).toContain('120 57.5');
  });
  it('preserves highlighter metadata when splitting, and recorded widths when splitting or resizing', () => {
    const stroke: Stroke = { id: 'ink', color: '#ff0', width: 4, renderVersion: 1,
      tool: 'highlighter', isHighlighter: true, opacity: .25,
      points: [{ x: 0, y: 100, pressure: .5, time: 0, inkWidth: 4 },
        { x: 200, y: 100, pressure: .5, time: 20, inkWidth: 6 }] };
    const fragments = eraseStrokePortion(stroke, 100, 100, 20);
    expect(fragments).toHaveLength(2);
    expect(fragments.every(s => s.isHighlighter && s.opacity === .25 && s.renderVersion === 1)).toBe(true);
    expect(fragments[0].points.at(-1)!.inkWidth).toBeCloseTo(4.8);
    const transformed = transformSelectedStrokes([stroke], ['ink'], 3, 4, 2, 0, 0)[0];
    expect(transformed.points.map(p => p.inkWidth)).toEqual([8, 12]);
    expect(stroke.points[0].inkWidth).toBe(4);
  });
});
