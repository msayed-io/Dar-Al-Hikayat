/**
 * Remote editing — pointer→caret placement, selection, clipboard and
 * crash-proof plain-text insertion for the wireless keyboard.
 *
 * Why this file exists (root cause, measured in a real browser):
 *  - Synthetic `mousedown/mouseup/click` do NOT move the caret: the browser's
 *    default selection behaviour is reserved for trusted events, so clicking on
 *    the story text did nothing. The caret is therefore placed explicitly with
 *    `caretRangeFromPoint` (Blink/WebKit-Android) or `caretPositionFromPoint`.
 *  - Caret state must survive the tablet IME being hidden (which can blur the
 *    field), so the last valid range inside an editable is remembered and
 *    restored before every inserted character/paste.
 *  - A 30,000-character paste cannot go through `execCommand("insertText")` in
 *    one call, and must never lose a single character: large payloads are
 *    inserted as a DocumentFragment built from text nodes and <br> elements.
 */
import type { Stroke } from "../components/DarAlHikayatHandwriting";

export const EDITABLE_SELECTOR =
  'input, textarea, [contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]';

/** Pastes above this size use fragment insertion instead of execCommand. */
export const LARGE_PASTE_THRESHOLD = 2000;

export function isEditableElement(node: Element | null | undefined): node is HTMLElement {
  return !!node && node instanceof HTMLElement && node.matches(EDITABLE_SELECTOR);
}

/**
 * Resolves any node — element or text node — to the editable that owns it.
 * Text nodes matter: a pasted fragment's container is often a bare text node.
 */
export function editableFromNode(node: Node | null | undefined): HTMLElement | null {
  if (!node) return null;
  const element = node instanceof Element ? node : node.parentElement;
  if (!element) return null;
  if (isEditableElement(element)) return element;
  const closest = element.closest?.(EDITABLE_SELECTOR) || null;
  return isEditableElement(closest) ? closest : null;
}

/** The editable the writer last interacted with (click focus, remote caret, …). */
let lastEditable: HTMLElement | null = null;
let lastRange: Range | null = null;

export function setLastEditable(el: HTMLElement | null): void {
  lastEditable = el;
}

export function getLastEditable(): HTMLElement | null {
  if (lastEditable && lastEditable.isConnected) return lastEditable;
  lastEditable = null;
  return null;
}

export function rememberRange(range: Range | null): void {
  if (range && range.startContainer.isConnected) lastRange = range.cloneRange();
}

export function getRememberedRange(): Range | null {
  if (lastRange && lastRange.startContainer.isConnected) return lastRange.cloneRange();
  return null;
}

export function clearEditingMemory(): void {
  lastEditable = null;
  lastRange = null;
}

/**
 * Focuses an editable without losing the remembered caret. `preventScroll`
 * keeps the tablet from jumping while the phone types.
 */
export function focusEditable(el: HTMLElement): void {
  try {
    el.focus({ preventScroll: true });
  } catch {
    try {
      el.focus();
    } catch {
      /* ignore */
    }
  }
  setLastEditable(el);
}

/** Collects the text nodes of an element in document order. */
function textNodesOf(root: Node): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }
  return nodes;
}

/** caretRangeFromPoint (Blink) with the Firefox fallback and a text-node scan. */
export function caretRangeFromPoint(x: number, y: number, root?: HTMLElement | null): Range | null {
  if (typeof document === "undefined") return null;

  const anyDoc = document as any;
  if (typeof anyDoc.caretRangeFromPoint === "function") {
    const range = anyDoc.caretRangeFromPoint(x, y) as Range | null;
    if (range) return range;
  }
  if (typeof anyDoc.caretPositionFromPoint === "function") {
    const position = anyDoc.caretPositionFromPoint(x, y) as { offsetNode: Node; offset: number } | null;
    if (position?.offsetNode) {
      const range = document.createRange();
      try {
        range.setStart(position.offsetNode, position.offset);
        range.collapse(true);
        return range;
      } catch {
        /* fall through */
      }
    }
  }

  // Last resort: nearest text node inside the requested root.
  const scope = root || document.body;
  if (!scope) return null;
  let best: { node: Text; distance: number } | null = null;
  for (const node of textNodesOf(scope)) {
    const rects: DOMRectList | null = typeof (node as any).getClientRects === "function" ? (node as any).getClientRects() : null;
    for (const rect of Array.from(rects || []) as DOMRect[]) {
      const dx = Math.max(rect.left - x, 0, x - rect.right);
      const dy = Math.max(rect.top - y, 0, y - rect.bottom);
      const distance = dx * dx + dy * dy;
      if (!best || distance < best.distance) best = { node, distance };
    }
  }
  if (!best) return null;
  const range = document.createRange();
  range.setStart(best.node, Math.max(0, Math.min(best.node.length, 0)));
  range.collapse(true);
  return range;
}

/** Proportional character offset for <input>/<textarea> (they have no text nodes). */
function approximateOffset(el: HTMLInputElement | HTMLTextAreaElement, x: number): number {
  const rect = el.getBoundingClientRect();
  const style = typeof window !== "undefined" && window.getComputedStyle ? window.getComputedStyle(el) : null;
  const paddingLeft = style ? parseFloat(style.paddingLeft || "0") || 0 : 0;
  const paddingRight = style ? parseFloat(style.paddingRight || "0") || 0 : 0;
  const usable = Math.max(1, rect.width - paddingLeft - paddingRight);
  const ratio = Math.min(1, Math.max(0, (x - rect.left - paddingLeft) / usable));
  return Math.round(ratio * (el.value?.length || 0));
}

function applySelection(range: Range, extend: boolean): void {
  const selection = window.getSelection();
  if (!selection) return;
  if (extend && selection.rangeCount > 0) {
    selection.setBaseAndExtent(
      selection.anchorNode || range.startContainer,
      selection.anchorOffset ?? 0,
      range.startContainer,
      range.startOffset,
    );
  } else {
    selection.removeAllRanges();
    selection.addRange(range);
  }
  rememberRange(range);
}

export interface CaretPlacement {
  element: HTMLElement | null;
  placed: boolean;
}

/**
 * Places the caret (or extends the current selection) exactly where the remote
 * pointer clicked — the behaviour every keyboard/mouse expects.
 */
export function placeCaretAtPoint(
  x: number,
  y: number,
  options: { extend?: boolean; target?: Element | null } = {},
): CaretPlacement {
  if (typeof document === "undefined") return { element: null, placed: false };

  const target = options.target === undefined ? elementAtPoint(x, y) : options.target;
  const editable = editableFromNode(target);
  if (!editable) return { element: null, placed: false };

  focusEditable(editable);

  if (editable instanceof HTMLInputElement || editable instanceof HTMLTextAreaElement) {
    const offset = approximateOffset(editable, x);
    const start = options.extend
      ? Math.min(editable.selectionStart ?? offset, offset)
      : offset;
    const end = options.extend ? Math.max(editable.selectionEnd ?? offset, offset) : offset;
    try {
      editable.setSelectionRange(start, end);
    } catch {
      /* ignore */
    }
    return { element: editable, placed: true };
  }

  const range = caretRangeFromPoint(x, y, editable);
  if (!range || !editable.contains(range.startContainer)) {
    // The click landed on padding/whitespace around the text: keep the caret at
    // the closest valid position inside the editable instead of losing focus.
    const fallback = document.createRange();
    fallback.selectNodeContents(editable);
    fallback.collapse(false);
    applySelection(fallback, !!options.extend);
    return { element: editable, placed: true };
  }

  applySelection(range, !!options.extend);
  return { element: editable, placed: true };
}

function elementAtPoint(x: number, y: number): Element | null {
  const fn = (document as any).elementFromPoint;
  return typeof fn === "function" ? (document.elementFromPoint(x, y) as Element | null) : null;
}

/** Selects the whole content of an editable (Ctrl+A semantics inside it). */
export function selectAllIn(editable: HTMLElement): boolean {
  if (!editable) return false;
  if (editable instanceof HTMLInputElement || editable instanceof HTMLTextAreaElement) {
    try {
      editable.select();
      return true;
    } catch {
      return false;
    }
  }
  const range = document.createRange();
  range.selectNodeContents(editable);
  applySelection(range, false);
  return true;
}

/** The selection resolved to the active or last-used editable. */
export function currentTargetEditable(): HTMLElement | null {
  const active = document.activeElement as HTMLElement | null;
  const fromActive = editableFromNode(active);
  if (fromActive) return fromActive;
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const editable = editableFromNode(selection.getRangeAt(0).startContainer.parentElement);
    if (editable) return editable;
  }
  return getLastEditable();
}

/* ------------------------------------------------------------------------- *
 * Clipboard
 * ------------------------------------------------------------------------- */

export function selectionText(): string {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return "";
  return selection.toString();
}

/** Copy: the WebView clipboard API first, execCommand as the fallback. */
export async function copySelection(): Promise<boolean> {
  const text = selectionText();
  if (!text) return false;
  try {
    const clipboard = navigator?.clipboard;
    if (clipboard?.writeText) {
      await clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to execCommand */
  }
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  }
}

/** Cut = copy + remove the selected ranges (execCommand is unreliable offline). */
export async function cutSelection(): Promise<boolean> {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return false;
  const copied = await copySelection();
  try {
    if (document.execCommand("cut")) return true;
  } catch {
    /* fall through */
  }
  const container = selection.getRangeAt(0).commonAncestorContainer;
  const editable = editableFromNode(container.parentElement) || editableFromNode(container as Element);
  try {
    for (let i = selection.rangeCount - 1; i >= 0; i--) selection.getRangeAt(i).deleteContents();
  } catch {
    return false;
  }
  if (editable) {
    editable.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteByCut" }));
  }
  return copied;
}

/** Reads the tablet's own clipboard (used by "paste from tablet"). */
export async function readClipboardText(): Promise<string | null> {
  try {
    const clipboard = navigator?.clipboard;
    if (clipboard?.readText) {
      const text = await clipboard.readText();
      return typeof text === "string" ? text : null;
    }
  } catch {
    /* Android WebView may block clipboard reads for synthetic taps */
  }
  return null;
}

/* ------------------------------------------------------------------------- *
 * Insertion
 * ------------------------------------------------------------------------- */

/** Inserts plain text at the remembered/current caret, newlines included. */
export function insertPlainText(text: string, editable: HTMLElement | null): boolean {
  if (!text) return true;
  const target = editable || currentTargetEditable();
  if (!target) return false;

  focusEditable(target);

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? start;
    target.setRangeText(text, start, end, "end");
    target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    return true;
  }

  if (text.length <= LARGE_PASTE_THRESHOLD) {
    try {
      if (document.execCommand("insertText", false, text)) return true;
    } catch {
      /* fall through to the fragment path */
    }
    // A short payload (a single letter from the phone's keyboard) is *typing*,
    // not a paste: keep the input type so word-level undo grouping still works.
    return insertLargeText(target, text, "insertText");
  }

  return insertLargeText(target, text);
}

/**
 * Character-exact insertion of a large payload: text nodes + <br> for newlines,
 * inserted as a single fragment so nothing is truncated or re-encoded.
 */
export function insertLargeText(
  editable: HTMLElement,
  text: string,
  inputType: "insertFromPaste" | "insertText" = "insertFromPaste",
): boolean {
  const selection = window.getSelection();
  let range: Range | null = null;

  if (selection && selection.rangeCount > 0) {
    const candidate = selection.getRangeAt(0);
    if (editable.contains(candidate.startContainer)) range = candidate;
  }
  if (!range) {
    const remembered = getRememberedRange();
    if (remembered && editable.contains(remembered.startContainer)) range = remembered;
  }
  if (!range) {
    range = document.createRange();
    range.selectNodeContents(editable);
    range.collapse(false);
  }

  const container = range.commonAncestorContainer;
  const editableRoot = editableFromNode(container.parentElement) || editableFromNode(container as Element);
  if (!editableRoot) return false;

  try {
    range.deleteContents();
  } catch {
    return false;
  }

  const fragment = document.createDocumentFragment();
  const segments = text.split("\n");
  segments.forEach((segment, index) => {
    if (index > 0) fragment.appendChild(document.createElement("br"));
    if (segment) fragment.appendChild(document.createTextNode(segment));
  });

  const lastNode = fragment.lastChild;
  try {
    range.insertNode(fragment);
  } catch {
    return false;
  }

  const after = document.createRange();
  if (lastNode) {
    after.setStartAfter(lastNode);
  } else {
    after.selectNodeContents(editableRoot);
    after.collapse(false);
  }
  after.collapse(true);
  const sel = window.getSelection();
  if (sel) {
    sel.removeAllRanges();
    sel.addRange(after);
  }
  rememberRange(after);

  editableRoot.dispatchEvent(new InputEvent("input", { bubbles: true, inputType, data: text }));
  return true;
}

/** The caret insertion point restored from memory (used by plain typing). */
export function restoreCaretBeforeInsertion(editable: HTMLElement): boolean {
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    if (editable.contains(range.startContainer)) {
      rememberRange(range);
      return true;
    }
  }
  const remembered = getRememberedRange();
  if (remembered && editable.contains(remembered.startContainer) && selection) {
    selection.removeAllRanges();
    selection.addRange(remembered);
    return true;
  }
  return false;
}

/** Keeps the handwriting page type importable without a runtime cycle. */
export type { Stroke };
