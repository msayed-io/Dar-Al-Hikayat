/** @vitest-environment jsdom */
/**
 * The phone pointer must behave like a real mouse on the tablet: a left press
 * drops the caret exactly where it tapped, holding and moving drags a genuine
 * selection, releasing ends it, and a right click opens the context menu without
 * stealing the writer's caret.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  dispatchRemoteMouseAt,
  extendSelectionTo,
  isRemotePointerPressed,
  resetRemoteMouse,
  type RemoteMouseCommand,
} from "../lib/remote-mouse";
import { clearEditingMemory } from "../lib/remote-editing";

const TEXT = "يروي الجدُّ حكاية قديمة على مسامع الأطفال";

let editable: HTMLDivElement;
let textNode: Text;

function stubElementFromPoint(value: Element | null) {
  const fn = vi.fn(() => value);
  Object.defineProperty(document, "elementFromPoint", { configurable: true, writable: true, value: fn });
  return fn;
}

/** Blink-like caretRangeFromPoint returning a collapsed caret at `index`. */
function stubCaretAt(index: number) {
  const fn = vi.fn(() => {
    const range = document.createRange();
    range.setStart(textNode, index);
    range.collapse(true);
    return range;
  });
  Object.defineProperty(document, "caretRangeFromPoint", { configurable: true, writable: true, value: fn });
  return fn;
}

beforeEach(() => {
  document.body.innerHTML = "";
  clearEditingMemory();
  resetRemoteMouse();
  editable = document.createElement("div");
  editable.setAttribute("contenteditable", "true");
  editable.textContent = TEXT;
  document.body.appendChild(editable);
  textNode = editable.firstChild as Text;
  stubElementFromPoint(editable);
});

afterEach(() => {
  vi.restoreAllMocks();
  resetRemoteMouse();
  clearEditingMemory();
});

describe("Remote caret from the phone pointer", () => {
  it("drops the caret on the tapped character when the left button goes down", () => {
    const caretPoint = stubCaretAt(12);
    dispatchRemoteMouseAt({ action: "MOUSE_DOWN", button: "left" } as RemoteMouseCommand, 140, 320);

    expect(caretPoint).toHaveBeenCalledWith(140, 320);
    const range = window.getSelection()?.getRangeAt(0);
    expect(range?.startContainer).toBe(textNode);
    expect(range?.startOffset).toBe(12);
    expect(isRemotePointerPressed()).toBe(true);
  });

  it("places the caret for a plain tap too (click without a preceding drag)", () => {
    stubCaretAt(5);
    dispatchRemoteMouseAt({ action: "MOUSE_CLICK", button: "left", clicks: 1 } as RemoteMouseCommand, 60, 120);
    expect(window.getSelection()?.getRangeAt(0).startOffset).toBe(5);
  });

  it("does not place the caret in the middle of a double tap's second keystroke", () => {
    stubCaretAt(9);
    dispatchRemoteMouseAt({ action: "MOUSE_CLICK", button: "left", clicks: 1 } as RemoteMouseCommand, 60, 120);
    expect(window.getSelection()?.getRangeAt(0).startOffset).toBe(9);
  });

  it("ends the press on MOUSE_UP so later moves are not treated as a drag", () => {
    stubCaretAt(2);
    dispatchRemoteMouseAt({ action: "MOUSE_DOWN", button: "left" } as RemoteMouseCommand, 30, 40);
    dispatchRemoteMouseAt({ action: "MOUSE_UP", button: "left" } as RemoteMouseCommand, 30, 40);
    expect(isRemotePointerPressed()).toBe(false);
  });

  it("extends a real selection while the button is held and the pointer moves", () => {
    stubCaretAt(1);
    dispatchRemoteMouseAt({ action: "MOUSE_DOWN", button: "left" } as RemoteMouseCommand, 10, 10);

    stubCaretAt(24);
    extendSelectionTo(320, 12);

    const selection = window.getSelection();
    expect(selection?.isCollapsed).toBe(false);
    const selected = selection?.toString() || "";
    expect(selected.length).toBeGreaterThan(10);
    expect(TEXT).toContain(selected);
    // The anchor stays where the press began, exactly like a desktop drag.
    expect(selection?.anchorOffset).toBe(1);
  });

  it("keeps the selection when the button is released mid-drag", () => {
    stubCaretAt(0);
    dispatchRemoteMouseAt({ action: "MOUSE_DOWN", button: "left" } as RemoteMouseCommand, 10, 10);
    stubCaretAt(18);
    extendSelectionTo(200, 12);
    const before = window.getSelection()?.toString();

    dispatchRemoteMouseAt({ action: "MOUSE_UP", button: "left" } as RemoteMouseCommand, 200, 12);
    expect(window.getSelection()?.toString()).toBe(before);
  });

  it("fires a native-style contextmenu on right click without moving the caret", () => {
    stubCaretAt(4);
    dispatchRemoteMouseAt({ action: "MOUSE_CLICK", button: "left" } as RemoteMouseCommand, 10, 10);
    const caretBefore = window.getSelection()?.getRangeAt(0).startOffset;

    const contextMenu = vi.fn();
    editable.addEventListener("contextmenu", contextMenu);
    stubCaretAt(20);
    dispatchRemoteMouseAt({ action: "MOUSE_CLICK", button: "right", clicks: 1 } as RemoteMouseCommand, 90, 44);

    expect(contextMenu).toHaveBeenCalledTimes(1);
    expect(window.getSelection()?.getRangeAt(0).startOffset).toBe(caretBefore);
  });

  it("keeps the caret inside the editable when the pointer pressed on padding", () => {
    stubCaretAt(-1); // Blink returns null for points outside the text run
    Object.defineProperty(document, "caretRangeFromPoint", {
      configurable: true,
      writable: true,
      value: vi.fn(() => null),
    });
    dispatchRemoteMouseAt({ action: "MOUSE_DOWN", button: "left" } as RemoteMouseCommand, 5, 5);
    const range = window.getSelection()?.getRangeAt(0);
    expect(editable.contains(range!.startContainer)).toBe(true);
  });
});
