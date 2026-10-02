/** @vitest-environment jsdom */
/**
 * End-to-end wiring inside the editor: a mouse payload paints the tablet
 * pointer, never focuses the text surface, and the tablet keyboard stays
 * hidden for as long as the phone is paired (restored on disconnect).
 */
import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RemoteKeystrokePayload } from "../lib/remote-keyboard-service";

const remote = vi.hoisted(() => ({
  onKeystroke: null as null | ((payload: RemoteKeystrokePayload) => void),
  onStatus: null as null | ((connected: boolean, ip?: string) => void),
  updateRemoteSession: vi.fn(),
  hideKeyboard: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("../contexts/AppContext", () => ({
  useApp: () => ({
    selectedNote: null,
    currentTheme: {
      mode: "royal_classic",
      bg: "#EAE6D2",
      text: "#121A1B",
      accent: "#A7AA63",
      secondary: "#4A5556",
      glass: "rgba(244,241,228,0.96)",
      border: "rgba(18,26,27,0.12)",
      shadow: "0 4px 30px rgba(0,0,0,0.4)",
      isDark: false,
    },
    backToHome: vi.fn(),
    saveNote: vi.fn().mockResolvedValue(true),
    toggleTheme: vi.fn(),
  }),
}));
vi.mock("../lib/storage-service", () => ({
  StorageService: { getStoryBody: vi.fn().mockResolvedValue("") },
}));
vi.mock("../components/DarAlHikayatAIAssistant", () => ({ default: () => null }));
vi.mock("../lib/remote-keyboard-service", () => ({
  NativeRemoteServer: { hideKeyboard: remote.hideKeyboard },
  getDeviceLocalIp: vi
    .fn()
    .mockResolvedValue({ primaryIp: "192.168.1.15", ips: ["192.168.1.15"], port: 8080, connectionUrl: "http://192.168.1.15:8080/" }),
  updateRemoteSession: remote.updateRemoteSession,
  listenForRemoteKeystrokes: (
    _pin: string,
    onKeystroke: (payload: RemoteKeystrokePayload) => void,
    onStatus?: (connected: boolean, ip?: string) => void,
  ) => {
    remote.onKeystroke = onKeystroke;
    remote.onStatus = onStatus || null;
    return () => {
      remote.onKeystroke = null;
      remote.onStatus = null;
    };
  },
}));

import { Capacitor } from "@capacitor/core";
import Editor from "../components/DarAlHikayatEditor";

let host: HTMLElement;
let root: ReturnType<typeof import("react-dom/client").createRoot> | null = null;

const payload = (patch: Partial<RemoteKeystrokePayload>): RemoteKeystrokePayload => ({
  sessionPin: "123456",
  type: "MOUSE",
  timestamp: Date.now(),
  ...patch,
});

const push = async (patch: Partial<RemoteKeystrokePayload>) => {
  await act(async () => {
    remote.onKeystroke?.(payload(patch));
  });
};

const cursorNode = () => document.querySelector('[data-remote-mouse-cursor="true"]') as HTMLElement | null;
const editorSurface = () => document.querySelector(".editor-container") as HTMLElement | null;

beforeEach(async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  localStorage.clear();
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1024 });
  Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 768 });
  vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => setTimeout(() => cb(0), 16) as unknown as number);
  vi.stubGlobal("cancelAnimationFrame", (h: number) => clearTimeout(h));
  const { createRoot } = await import("react-dom/client");
  await act(async () => {
    root = createRoot(host);
    root.render(<Editor />);
  });
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
    root = null;
  });
  host.remove();
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-remote-keyboard");
  remote.onKeystroke = null;
  remote.onStatus = null;
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("Wireless pointer inside the editor", () => {
  it("shows the tablet pointer when the phone opens the mouse tab", async () => {
    expect(cursorNode()).toBeNull();
    await push({ action: "MOUSE_MODE", enabled: true });
    expect(cursorNode()).not.toBeNull();
    await push({ action: "MOUSE_MOVE", dx: 40, dy: 25 });
    expect(cursorNode()!.style.transform).toContain("translate3d");
  });

  it("a pointer click does NOT focus the text surface or pop the tablet keyboard", async () => {
    const surface = editorSurface()!;
    surface.setAttribute("contenteditable", "true");
    await push({ action: "MOUSE_MODE", enabled: true });

    const before = document.activeElement;
    await push({ action: "MOUSE_CLICK", button: "left", clicks: 1 });

    expect(document.activeElement).toBe(before);
    expect(document.activeElement).not.toBe(surface);
  });

  it("hides the tablet keyboard while paired and restores typing on disconnect", async () => {
    const surface = editorSurface()!;
    surface.setAttribute("inputmode", "text");
    surface.setAttribute("contenteditable", "true");

    await act(async () => {
      remote.onStatus?.(true, "الهاتف");
    });

    expect(document.documentElement.getAttribute("data-remote-keyboard")).toBe("on");
    expect(surface.getAttribute("inputmode")).toBe("none");
    expect(surface.getAttribute("virtualkeyboardpolicy")).toBe("manual");
    expect(remote.hideKeyboard).toHaveBeenCalled();

    await push({ action: "MOUSE_MODE", enabled: true });
    expect(cursorNode()).not.toBeNull();

    await push({ action: "disconnect" } as any);
    await act(async () => {
      remote.onStatus?.(false, "تم قطع الاتصال");
    });

    expect(document.documentElement.hasAttribute("data-remote-keyboard")).toBe(false);
    expect(surface.getAttribute("inputmode")).toBe("text");
    expect(surface.hasAttribute("virtualkeyboardpolicy")).toBe(false);
    expect(cursorNode()).toBeNull();
  });

  it("a disconnect payload ends the session and restores the tablet keyboard", async () => {
    const surface = editorSurface()!;
    surface.setAttribute("contenteditable", "true");
    await act(async () => {
      remote.onStatus?.(true, "الهاتف");
    });
    await push({ action: "MOUSE_MODE", enabled: true });
    expect(cursorNode()).not.toBeNull();

    await push({ type: "COMMAND", action: "disconnect" } as any);

    expect(document.documentElement.hasAttribute("data-remote-keyboard")).toBe(false);
    expect(cursorNode()).toBeNull();
    expect(surface.hasAttribute("inputmode")).toBe(false);
  });

  it("keeps normal remote typing intact while the pointer guard is active", async () => {
    const surface = editorSurface()!;
    surface.setAttribute("contenteditable", "true");
    surface.innerHTML = "<p>سطر</p>";
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, "execCommand", { configurable: true, writable: true, value: execCommand });
    Object.defineProperty(document, "queryCommandSupported", {
      configurable: true,
      writable: true,
      value: vi.fn(() => true),
    });

    await act(async () => {
      remote.onStatus?.(true, "الهاتف");
    });
    await push({ type: "KEY", action: undefined, char: "ب" });

    expect(execCommand).toHaveBeenCalledWith("insertText", false, "ب");
    // The guard must still be holding the tablet keyboard down afterwards.
    expect(document.documentElement.getAttribute("data-remote-keyboard")).toBe("on");
  });

  it("an unknown command with no character is silently ignored", async () => {
    const surface = editorSurface()!;
    surface.setAttribute("contenteditable", "true");
    await push({ type: "KEY", char: "" });
    expect(document.activeElement).not.toBe(surface);
  });
});
