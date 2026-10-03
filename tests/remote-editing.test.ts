/** @vitest-environment jsdom */
/**
 * Remote editing surface: caret placement where the phone tapped, remembered
 * caret across keyboard-hide blur, clipboard actions routed to the tablet, and
 * character-exact insertion of large Arabic pastes (the 30k-char contract).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A fake Capacitor bridge: it lets the native clipboard path be exercised
 * exactly as the Android WebView would, and swaps the plugin proxy for a plain
 * object so the native methods can be stubbed.
 */
const platform = vi.hoisted(() => ({ native: false }));
vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => platform.native,
    getPlatform: () => (platform.native ? "android" : "web"),
    isPluginAvailable: () => platform.native,
    convertFileSrc: (value: string) => value,
  },
  registerPlugin: () => ({}),
  WebPlugin: class {},
}));
import {
  LARGE_PASTE_THRESHOLD,
  caretRangeFromPoint,
  clearEditingMemory,
  copySelection,
  currentTargetEditable,
  cutSelection,
  editableFromNode,
  focusEditable,
  getRememberedRange,
  insertLargeText,
  insertPlainText,
  isEditableElement,
  placeCaretAtPoint,
  readClipboardText,
  rememberRange,
  restoreCaretBeforeInsertion,
  selectAllIn,
  selectionText,
} from "../lib/remote-editing";
import { NativeRemoteServer } from "../lib/remote-keyboard-service";

let host: HTMLDivElement;

function makeEditable(content = "دار الحكايات تكتب قصصها"): HTMLDivElement {
  const el = document.createElement("div");
  el.setAttribute("contenteditable", "true");
  el.textContent = content;
  document.body.appendChild(el);
  return el;
}

/** jsdom has no caretRangeFromPoint; the tests install Blink-like behaviour. */
function stubCaretRange(x: number, y: number, range: Range | null) {
  const fn = vi.fn(() => range);
  Object.defineProperty(document, "caretRangeFromPoint", { configurable: true, writable: true, value: fn });
  return fn;
}

beforeEach(() => {
  document.body.innerHTML = "";
  clearEditingMemory();
  host = document.createElement("div");
  document.body.appendChild(host);
});

afterEach(() => {
  platform.native = false;
  delete (NativeRemoteServer as any).setClipboard;
  delete (NativeRemoteServer as any).getClipboard;
  vi.restoreAllMocks();
  clearEditingMemory();
});

describe("Editable resolution", () => {
  it("recognises contenteditable hosts and textareas, not plain divs", () => {
    const editable = makeEditable();
    const plain = document.createElement("div");
    expect(isEditableElement(editable)).toBe(true);
    expect(isEditableElement(document.createElement("textarea"))).toBe(true);
    expect(isEditableElement(plain)).toBe(false);
    expect(isEditableElement(null)).toBe(false);
  });

  it("walks up from a text node to the editable that owns it", () => {
    const editable = makeEditable();
    const inner = document.createElement("span");
    inner.textContent = "داخل";
    editable.appendChild(inner);
    expect(editableFromNode(inner.firstChild)).toBe(editable);
    expect(editableFromNode(null)).toBeNull();
  });

  it("falls back to the last focused editable when nothing is active", () => {
    const editable = makeEditable();
    focusEditable(editable);
    (document.activeElement as HTMLElement | null)?.blur?.();
    expect(currentTargetEditable()).toBe(editable);
  });
});

describe("Caret placement", () => {
  it("places the caret exactly at the tapped character via caretRangeFromPoint", () => {
    const editable = makeEditable();
    const textNode = editable.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, 4);
    range.collapse(true);
    const spy = stubCaretRange(120, 300, range);

    const placement = placeCaretAtPoint(120, 300, { target: editable });

    expect(spy).toHaveBeenCalledWith(120, 300);
    expect(placement).toEqual({ element: editable, placed: true });
    const selection = window.getSelection();
    expect(selection?.rangeCount).toBe(1);
    expect(selection?.getRangeAt(0).startOffset).toBe(4);
    expect(selection?.getRangeAt(0).startContainer).toBe(textNode);
  });

  it("remembers the placed caret so a later remote insert lands in the same spot", () => {
    const editable = makeEditable();
    const textNode = editable.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, 7);
    range.collapse(true);
    stubCaretRange(200, 240, range);

    placeCaretAtPoint(200, 240, { target: editable });

    const remembered = getRememberedRange();
    expect(remembered?.startContainer).toBe(textNode);
    expect(remembered?.startOffset).toBe(7);
  });

  it("extends a selection while the phone button is held (drag-select)", () => {
    const editable = makeEditable("اختيار النص بالكامل");
    const textNode = editable.firstChild as Text;

    const base = document.createRange();
    base.setStart(textNode, 1);
    base.collapse(true);
    stubCaretRange(10, 10, base);
    placeCaretAtPoint(10, 10, { target: editable });

    const extended = document.createRange();
    extended.setStart(textNode, 6);
    extended.collapse(true);
    stubCaretRange(300, 10, extended);
    const placement = placeCaretAtPoint(300, 10, { extend: true, target: editable });

    expect(placement.placed).toBe(true);
    const selection = window.getSelection();
    expect(selection?.isCollapsed).toBe(false);
    const selected = selection?.toString() || "";
    expect(selected.length).toBeGreaterThan(0);
    expect("اختيار النص بالكامل").toContain(selected);
  });

  it("keeps the caret inside the editable when the tap misses the text", () => {
    const editable = makeEditable();
    stubCaretRange(0, 0, null);
    const placement = placeCaretAtPoint(5, 5, { target: editable });
    expect(placement).toEqual({ element: editable, placed: true });
    const range = window.getSelection()?.getRangeAt(0);
    expect(editable.contains(range!.startContainer)).toBe(true);
  });

  it("returns placed:false when the tap is not on any editable", () => {
    const plain = document.createElement("div");
    document.body.appendChild(plain);
    expect(placeCaretAtPoint(1, 1, { target: plain })).toEqual({ element: null, placed: false });
  });

  it("positions the caret proportionally inside a textarea", () => {
    const area = document.createElement("textarea");
    area.value = "أ ب ت ث ج ح";
    document.body.appendChild(area);
    area.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 20, right: 100, bottom: 20 }) as DOMRect;

    placeCaretAtPoint(50, 10, { target: area });
    expect(area.selectionStart).toBeGreaterThan(0);
    expect(area.selectionStart).toBeLessThan(area.value.length);
  });

  it("falls back to caretPositionFromPoint when Blink's API is absent", () => {
    const editable = makeEditable();
    const textNode = editable.firstChild as Text;
    Object.defineProperty(document, "caretRangeFromPoint", { configurable: true, writable: true, value: undefined });
    Object.defineProperty(document, "caretPositionFromPoint", {
      configurable: true,
      writable: true,
      value: vi.fn(() => ({ offsetNode: textNode, offset: 3 })),
    });
    const range = caretRangeFromPoint(10, 20, editable);
    expect(range?.startContainer).toBe(textNode);
    expect(range?.startOffset).toBe(3);
  });

  it("uses the remembered range when the WebView blurs the editable", () => {
    const editable = makeEditable();
    const textNode = editable.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, 5);
    range.collapse(true);
    rememberRange(range);

    window.getSelection()?.removeAllRanges();
    expect(restoreCaretBeforeInsertion(editable)).toBe(true);
    expect(window.getSelection()?.getRangeAt(0).startOffset).toBe(5);
  });
});

describe("Clipboard actions on the tablet", () => {
  it("reports the selected text and copies it to the clipboard", async () => {
    const editable = makeEditable("نص للنسخ");
    const textNode = editable.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 2);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText, readText: vi.fn() } });

    expect(selectionText()).toBe("نص");
    await expect(copySelection()).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("نص");
  });

  it("does nothing when the selection is collapsed", async () => {
    makeEditable();
    window.getSelection()?.collapse(document.body, 0);
    await expect(copySelection()).resolves.toBe(false);
    await expect(cutSelection()).resolves.toBe(false);
  });

  it("reads the tablet clipboard for the 'paste from tablet' choice", async () => {
    const readText = vi.fn().mockResolvedValue("محفظة التابلت");
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { readText } });
    await expect(readClipboardText()).resolves.toBe("محفظة التابلت");
  });

  it("returns null (never throws) when the WebView blocks clipboard reads", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        readText: vi.fn().mockRejectedValue(new Error("blocked")),
      },
    });
    await expect(readClipboardText()).resolves.toBeNull();
  });

  it("selects the whole editable for Ctrl+A", () => {
    const editable = makeEditable("كل النص");
    expect(selectAllIn(editable)).toBe(true);
    expect(window.getSelection()?.toString()).toBe("كل النص");
  });
});

describe("Insertion fidelity", () => {
  it("inserts short text at the remembered caret", () => {
    const editable = makeEditable("مرحبا");
    const textNode = editable.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, 5);
    range.collapse(true);
    rememberRange(range);
    window.getSelection()?.removeAllRanges();

    expect(insertPlainText(" يا", editable)).toBe(true);
    expect(editable.textContent).toContain(" يا");
  });

  it("keeps newlines as <br> and loses not one character of a 30k Arabic paste", () => {
    const editable = makeEditable("بداية");
    const paragraph = "كان يا ما كان في قديم الزمان حكايةٌ تُروى ولا تنتهي. ";
    const payload = paragraph.repeat(Math.ceil(32000 / paragraph.length)).slice(0, 30_000);
    expect(payload.length).toBe(30_000);

    expect(insertLargeText(editable, payload)).toBe(true);

    const inserted = editable.textContent || "";
    expect(inserted).toContain("بداية");
    expect(inserted.length).toBe("بداية".length + payload.length);
    expect(inserted.slice("بداية".length)).toBe(payload);
    // Character-exact: Arabic diacritics and spaces survive untouched.
    expect((inserted.match(/حكايةٌ/g) || []).length).toBe((payload.match(/حكايةٌ/g) || []).length);
  });

  it("preserves every newline as a real line break", () => {
    const editable = makeEditable("");
    const text = "سطر أول\nسطر ثانٍ\nسطر ثالث";
    insertLargeText(editable, text);
    expect(editable.querySelectorAll("br").length).toBe(2);
    // <br> keeps the break in the DOM; the text itself is untouched.
    expect(editable.textContent).toBe(text.replace(/\n/g, ""));
  });

  it("routes long payloads through the fragment path (execCommand is not used)", () => {
    const editable = makeEditable("");
    const execCommand = vi.fn(() => true);
    (document as any).execCommand = execCommand;
    const long = "ط".repeat(LARGE_PASTE_THRESHOLD + 1);
    insertPlainText(long, editable);
    expect(execCommand).not.toHaveBeenCalled();
    expect(editable.textContent).toBe(long);
  });

  it("keeps typing semantics for short fallbacks (word-level undo still works)", () => {
    // No execCommand here: force the fragment path a WebView may take.
    delete (document as any).execCommand;
    const editable = makeEditable("");
    const events: InputEvent[] = [];
    editable.addEventListener("input", (event) => events.push(event as InputEvent));
    insertPlainText("ا", editable);
    expect(events.length).toBe(1);
    expect(events[0].inputType).toBe("insertText");
  });

  it("announces the insertion with insertFromPaste so undo sees one discrete step", () => {
    const editable = makeEditable("");
    const events: InputEvent[] = [];
    editable.addEventListener("input", (event) => events.push(event as InputEvent));
    insertLargeText(editable, "لصق كبير");
    expect(events.length).toBe(1);
    expect(events[0].inputType).toBe("insertFromPaste");
  });

  it("places the caret after the pasted block, ready for the next word", () => {
    const editable = makeEditable("قبل");
    insertLargeText(editable, "بعد");
    const selection = window.getSelection();
    const range = selection?.getRangeAt(0);
    expect(editable.contains(range!.startContainer)).toBe(true);
    expect(range!.startOffset).toBeGreaterThan(0);
  });

  it("refuses an empty target instead of throwing", () => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    document.body.innerHTML = "";
    clearEditingMemory();
    expect(insertPlainText("نص", null)).toBe(false);
  });
});

describe("Native clipboard layer (Android WebView without focus)", () => {
  it("uses the native clipboard first when running on a device", async () => {
    const setClipboard = vi.fn().mockResolvedValue({ ok: true });
    platform.native = true;
    (NativeRemoteServer as any).setClipboard = setClipboard;

    const editable = makeEditable("نص للنسخ");
    const textNode = editable.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 4);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    await expect(copySelection()).resolves.toBe(true);
    expect(setClipboard).toHaveBeenCalledWith({ text: "نص ل" });
  });

  it("reads the tablet clipboard natively on a device", async () => {
    platform.native = true;
    (NativeRemoteServer as any).getClipboard = vi.fn().mockResolvedValue({ text: "محفظة التابلت الأصلية" });
    await expect(readClipboardText()).resolves.toBe("محفظة التابلت الأصلية");
  });

  it("falls back to the Web clipboard in a browser (and never throws)", async () => {
    platform.native = false;
    delete (NativeRemoteServer as any).getClipboard;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { readText: vi.fn().mockRejectedValue(new Error("blocked")), writeText: vi.fn() },
    });
    await expect(readClipboardText()).resolves.toBeNull();
  });
});
