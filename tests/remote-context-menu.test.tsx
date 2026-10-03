/** @vitest-environment jsdom */
/**
 * The tablet-side context menu opened by the phone's right click: it appears at
 * the click point, clamps inside the viewport, routes the four clipboard
 * actions, and disappears on any other pointer action.
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RemoteContextMenu from "../components/RemoteContextMenu";
import { emitRemoteMouse } from "../lib/remote-mouse";

let container: HTMLDivElement;
let root: Root;
let onAction: ReturnType<typeof vi.fn>;

const mount = () => {
  act(() => {
    root.render(<RemoteContextMenu accent="#D97706" isDark onAction={onAction as (action: any) => void} />);
  });
};

const clickItem = (label: string) => {
  const button = Array.from(document.querySelectorAll("button")).find((node) =>
    (node.textContent || "").includes(label),
  );
  expect(button, `missing menu item: ${label}`).toBeTruthy();
  act(() => {
    button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
};

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  onAction = vi.fn();
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 768 });
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("Remote context menu", () => {
  it("stays hidden until the phone right-clicks", () => {
    mount();
    expect(document.body.textContent).not.toContain("لصق");
  });

  it("opens at the click point published by the pointer overlay", () => {
    mount();
    act(() => {
      window.dispatchEvent(new CustomEvent("dar-remote-context-menu", { detail: { x: 320, y: 240 } }));
    });
    expect(document.body.textContent).toContain("نسخ");
    expect(document.body.textContent).toContain("قص");
    expect(document.body.textContent).toContain("لصق");
    expect(document.body.textContent).toContain("تحديد الكل");

    const menu = document.querySelector("[data-remote-context-menu]") as HTMLElement | null;
    expect(menu).toBeTruthy();
    expect(menu!.style.left).toBe("320px");
    expect(menu!.style.top).toBe("240px");
  });

  it("clamps the card inside the viewport when the click is near an edge", () => {
    mount();
    act(() => {
      window.dispatchEvent(new CustomEvent("dar-remote-context-menu", { detail: { x: 1020, y: 760 } }));
    });
    const menu = document.querySelector("[data-remote-context-menu]") as HTMLElement;
    expect(parseInt(menu.style.left, 10)).toBeLessThanOrEqual(1024 - 168 - 8 + 1);
    expect(parseInt(menu.style.top, 10)).toBeLessThanOrEqual(768 - 176 - 8 + 1);
  });

  it("routes each of the four actions to the editor and closes", () => {
    mount();
    act(() => {
      window.dispatchEvent(new CustomEvent("dar-remote-context-menu", { detail: { x: 100, y: 100 } }));
    });
    clickItem("نسخ");
    expect(onAction).toHaveBeenCalledWith("COPY");
    expect(document.body.textContent).not.toContain("تحديد الكل");
  });

  it("routes cut, paste and select-all as well", () => {
    mount();
    act(() => {
      window.dispatchEvent(new CustomEvent("dar-remote-context-menu", { detail: { x: 100, y: 100 } }));
    });
    clickItem("قص");
    expect(onAction).toHaveBeenLastCalledWith("CUT");

    act(() => {
      window.dispatchEvent(new CustomEvent("dar-remote-context-menu", { detail: { x: 100, y: 100 } }));
    });
    clickItem("لصق");
    expect(onAction).toHaveBeenLastCalledWith("PASTE");

    act(() => {
      window.dispatchEvent(new CustomEvent("dar-remote-context-menu", { detail: { x: 100, y: 100 } }));
    });
    clickItem("تحديد الكل");
    expect(onAction).toHaveBeenLastCalledWith("SELECT_ALL");
  });

  it("also opens on a right-button remote click streamed through the bus", () => {
    mount();
    act(() => {
      emitRemoteMouse({ action: "MOUSE_CLICK", button: "right", clicks: 1 });
    });
    expect(document.body.textContent).toContain("تحديد الكل");
  });

  it("closes on a remote press outside the card but not on one inside it", () => {
    mount();
    act(() => {
      window.dispatchEvent(new CustomEvent("dar-remote-context-menu", { detail: { x: 300, y: 300 } }));
    });
    const menu = document.querySelector("[data-remote-context-menu]") as HTMLElement;
    // jsdom has no layout: give the card the real menu geometry.
    menu.getBoundingClientRect = () =>
      ({ left: 300, top: 300, right: 468, bottom: 476, width: 168, height: 176, x: 300, y: 300 }) as DOMRect;

    act(() => {
      window.dispatchEvent(new CustomEvent("dar-remote-pointer-press", { detail: { x: 340, y: 320 } }));
    });
    expect(document.body.textContent).toContain("تحديد الكل");

    act(() => {
      window.dispatchEvent(new CustomEvent("dar-remote-pointer-press", { detail: { x: 40, y: 700 } }));
    });
    expect(document.body.textContent).not.toContain("تحديد الكل");
  });

  it("dismisses on the explicit dismiss event and on an outside left click", () => {
    mount();
    act(() => {
      window.dispatchEvent(new CustomEvent("dar-remote-context-menu", { detail: { x: 200, y: 200 } }));
    });
    act(() => {
      window.dispatchEvent(new CustomEvent("dar-remote-context-dismiss"));
    });
    expect(document.body.textContent).not.toContain("تحديد الكل");

    act(() => {
      window.dispatchEvent(new CustomEvent("dar-remote-context-menu", { detail: { x: 200, y: 200 } }));
    });
    act(() => {
      document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    });
    expect(document.body.textContent).not.toContain("تحديد الكل");
  });
});
