/** @vitest-environment jsdom */
import React from "react";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import ThinkingIndicator, { frameBraid } from "../components/ThinkingIndicator";
import { setupDom, theme } from "./helpers/handwriting-dom";

let dom: ReturnType<typeof setupDom>;
beforeEach(() => { dom = setupDom(); });
afterEach(() => dom.cleanup());

it("preserves every source coordinate, radius, alpha and depth ordering at five animation times", () => {
  // Generated directly from the user-supplied HTML engine, not the port.
  const golden = JSON.parse(readFileSync("tests/fixtures/thinking-orb-source-frames.json", "utf8"));
  for (const { t, sha256 } of golden) {
    expect(createHash("sha256").update(JSON.stringify(frameBraid(20, t))).digest("hex")).toBe(sha256);
  }
});
it("keeps the orb first in RTL, the exact label, and DPR-capped 20px canvas", async () => {
  Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 3 });
  await dom.render(<ThinkingIndicator theme={theme} />);
  const line = dom.host.querySelector('[role="status"]')!;
  expect(line.getAttribute("dir")).toBe("rtl");
  expect(line.firstElementChild?.tagName).toBe("CANVAS");
  expect(line.textContent).toBe("جارٍ التفكير…");
  expect(dom.host.querySelector("canvas")!.width).toBe(40);
  expect(dom.host.querySelector("canvas")!.height).toBe(40);
});
it("updates the palette without changing drawing geometry", async () => {
  vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as any);
  await dom.render(<ThinkingIndicator theme={theme} />);
  const firstColor = dom.context.fillStyle;
  const firstArcs = dom.context.arc.mock.calls.slice();
  dom.context.arc.mockClear();
  await dom.render(<ThinkingIndicator theme={{ text: "#E2DFD2", bg: "#111718" }} />);
  expect(dom.context.fillStyle).not.toBe(firstColor);
  expect(dom.context.arc.mock.calls).toEqual(firstArcs);
});
it("renders a static frame for reduced motion and cancels animation on unmount", async () => {
  const request = vi.fn(() => 123);
  const cancel = vi.fn();
  vi.stubGlobal("requestAnimationFrame", request);
  vi.stubGlobal("cancelAnimationFrame", cancel);
  await dom.render(<ThinkingIndicator theme={theme} />);
  expect(request).toHaveBeenCalledTimes(1);
  await dom.render(<div />);
  expect(cancel).toHaveBeenCalledWith(123);
  request.mockClear();
  vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as any);
  await dom.render(<ThinkingIndicator theme={theme} />);
  expect(request).not.toHaveBeenCalled();
});
