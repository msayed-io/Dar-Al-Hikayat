/** @vitest-environment jsdom */
/**
 * While the wireless Story Keyboard is connected, the tablet must never show
 * its own IME. These tests pin the three protection layers and, above all,
 * that disconnecting restores the DOM exactly (no regression to normal typing).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { isRemoteKeyboardSuppressed, setRemoteKeyboardSuppressed } from "../lib/soft-keyboard-guard";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function addEditable(tag: "div" | "input" | "textarea" = "div", id = "editable") {
  const el = document.createElement(tag);
  el.id = id;
  if (tag === "div") el.setAttribute("contenteditable", "true");
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  setRemoteKeyboardSuppressed(false);
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-remote-keyboard");
  vi.restoreAllMocks();
});

describe("Tablet keyboard suppression while paired", () => {
  it("is inert until the phone connects", () => {
    const editor = addEditable();
    expect(isRemoteKeyboardSuppressed()).toBe(false);
    expect(editor.hasAttribute("inputmode")).toBe(false);
    expect(document.documentElement.hasAttribute("data-remote-keyboard")).toBe(false);
  });

  it("flags the document and stamps existing editable elements", () => {
    const editor = addEditable("div", "story-content");
    addEditable("input", "title-input");
    addEditable("textarea", "notes");
    const staticEl = document.createElement("p");

    setRemoteKeyboardSuppressed(true);

    expect(isRemoteKeyboardSuppressed()).toBe(true);
    expect(document.documentElement.getAttribute("data-remote-keyboard")).toBe("on");
    for (const el of [editor, document.getElementById("title-input")!, document.getElementById("notes")!]) {
      expect(el.getAttribute("inputmode")).toBe("none");
      expect(el.getAttribute("virtualkeyboardpolicy")).toBe("manual");
    }
    expect(staticEl.hasAttribute("inputmode")).toBe(false);
  });

  it("stamps an editor that is mounted after connecting (chapters, modals, handwriting titles)", async () => {
    setRemoteKeyboardSuppressed(true);
    const late = addEditable("div", "late-editor");
    await tick();
    await tick();
    expect(late.getAttribute("inputmode")).toBe("none");
    expect(late.getAttribute("virtualkeyboardpolicy")).toBe("manual");
  });

  it("stamps an editable element on pointerdown BEFORE it can be focused", () => {
    setRemoteKeyboardSuppressed(true);
    const late = addEditable("input", "tap-later");
    expect(late.hasAttribute("inputmode")).toBe(false);

    late.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));

    expect(late.getAttribute("inputmode")).toBe("none");
    expect(late.getAttribute("virtualkeyboardpolicy")).toBe("manual");
  });

  it("hides the virtual keyboard when focus lands on an editable element", () => {
    const hide = vi.fn();
    Object.defineProperty(navigator, "virtualKeyboard", {
      configurable: true,
      value: { hide },
    });
    setRemoteKeyboardSuppressed(true);
    const editor = addEditable();
    editor.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(hide).toHaveBeenCalled();
    expect(editor.getAttribute("inputmode")).toBe("none");
  });

  it("pushes the keyboard back down when the viewport shrinks (IME opened anyway)", async () => {
    const hide = vi.fn();
    Object.defineProperty(navigator, "virtualKeyboard", { configurable: true, value: { hide } });
    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 800 });
    setRemoteKeyboardSuppressed(true);
    // The hide call is throttled; wait past it before simulating the IME.
    await new Promise((resolve) => setTimeout(resolve, 260));
    hide.mockClear();

    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 420 });
    window.dispatchEvent(new Event("resize"));

    expect(hide).toHaveBeenCalled();
  });

  it("restores the exact previous attributes on disconnect", () => {
    const custom = addEditable("input", "custom-input");
    custom.setAttribute("inputmode", "text");
    custom.setAttribute("virtualkeyboardpolicy", "auto");
    const fresh = addEditable("div", "fresh-editor");

    setRemoteKeyboardSuppressed(true);
    expect(custom.getAttribute("inputmode")).toBe("none");

    setRemoteKeyboardSuppressed(false);

    expect(isRemoteKeyboardSuppressed()).toBe(false);
    expect(document.documentElement.hasAttribute("data-remote-keyboard")).toBe(false);
    expect(custom.getAttribute("inputmode")).toBe("text");
    expect(custom.getAttribute("virtualkeyboardpolicy")).toBe("auto");
    expect(fresh.hasAttribute("inputmode")).toBe(false);
    expect(fresh.hasAttribute("virtualkeyboardpolicy")).toBe(false);
  });

  it("stops observing new nodes once disconnected", async () => {
    setRemoteKeyboardSuppressed(true);
    setRemoteKeyboardSuppressed(false);
    const after = addEditable("input", "after-disconnect");
    await tick();
    await tick();
    expect(after.hasAttribute("inputmode")).toBe(false);
  });

  it("tolerates being enabled twice (idempotent)", () => {
    const editor = addEditable();
    expect(() => {
      setRemoteKeyboardSuppressed(true);
      setRemoteKeyboardSuppressed(true);
    }).not.toThrow();
    setRemoteKeyboardSuppressed(false);
    expect(editor.hasAttribute("inputmode")).toBe(false);
  });
});
