/**
 * Soft keyboard guard — the tablet must NEVER show its own keyboard while the
 * wireless Story Keyboard is connected. Typing happens on the phone; the tablet
 * only receives text and moves the caret.
 *
 * Why the keyboard appeared before: every remote keystroke focuses the editable
 * element to place the caret, and focusing an editable in Android WebView pops
 * the IME. The fix works on three layers, strongest last:
 *
 *  1. `inputmode="none"` + `virtualkeyboardpolicy="manual"` on every editable
 *     element, applied BEFORE focus (sweep + MutationObserver + pointerdown
 *     capture), so the WebView never schedules the IME for that focus.
 *  2. `navigator.virtualKeyboard.hide()` whenever focus lands anyway.
 *  3. Native `RemoteServer.hideKeyboard()` (InputMethodManager) as the final
 *     belt: also re-fired when the viewport shrinks — the visual signature of
 *     a keyboard that managed to open.
 *
 * Disconnecting restores the original attribute values exactly, so normal
 * tablet typing is untouched.
 */
import { Capacitor } from "@capacitor/core";
import { NativeRemoteServer } from "./remote-keyboard-service";

const ATTR_INPUTMODE = "inputmode";
const ATTR_VKP = "virtualkeyboardpolicy";
const EDITABLE_SELECTOR =
  'input, textarea, [contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]';
const ROOT_FLAG = "data-remote-keyboard";
const HIDE_THROTTLE_MS = 220;
const KEYBOARD_DETECT_PX = 90;

let suppressed = false;
let observer: MutationObserver | null = null;
let lastHideAt = 0;
let baselineHeight = 0;
const tagged = new Map<HTMLElement, { inputMode: string | null; vkp: string | null }>();

function isEditable(node: Element | null): node is HTMLElement {
  return !!node && node instanceof HTMLElement && node.matches(EDITABLE_SELECTOR);
}

function tag(node: HTMLElement): void {
  if (!node || tagged.has(node)) return;
  tagged.set(node, {
    inputMode: node.getAttribute(ATTR_INPUTMODE),
    vkp: node.getAttribute(ATTR_VKP),
  });
  node.setAttribute(ATTR_INPUTMODE, "none");
  node.setAttribute(ATTR_VKP, "manual");
}

function tagTree(root: ParentNode | null): void {
  if (!root) return;
  if (root instanceof HTMLElement && root.matches(EDITABLE_SELECTOR)) tag(root);
  const query = (root as ParentNode).querySelectorAll;
  if (typeof query !== "function") return;
  root.querySelectorAll(EDITABLE_SELECTOR).forEach((node) => tag(node as HTMLElement));
}

function restoreAll(): void {
  tagged.forEach((previous, node) => {
    if (previous.inputMode === null) node.removeAttribute(ATTR_INPUTMODE);
    else node.setAttribute(ATTR_INPUTMODE, previous.inputMode);
    if (previous.vkp === null) node.removeAttribute(ATTR_VKP);
    else node.setAttribute(ATTR_VKP, previous.vkp);
  });
  tagged.clear();
}

function hideSoftKeyboardNow(): boolean {
  const now = Date.now();
  if (now - lastHideAt < HIDE_THROTTLE_MS) return false;
  lastHideAt = now;

  let fired = false;
  try {
    const virtualKeyboard = (navigator as any)?.virtualKeyboard;
    if (virtualKeyboard && typeof virtualKeyboard.hide === "function") {
      virtualKeyboard.hide();
      fired = true;
    }
  } catch {
    // not supported
  }

  try {
    if (Capacitor?.isNativePlatform?.()) {
      const call = (NativeRemoteServer as any)?.hideKeyboard?.();
      if (call && typeof call.catch === "function") call.catch(() => undefined);
      fired = true;
    }
  } catch {
    // plugin not ready — layer 1/2 still protect
  }

  return fired;
}

function onPointerDownCapture(event: Event): void {
  if (!suppressed) return;
  const target = event.target as Element | null;
  if (isEditable(target)) {
    tag(target);
    return;
  }
  const closest = target?.closest?.(EDITABLE_SELECTOR);
  if (isEditable(closest || null)) tag(closest as HTMLElement);
}

function onFocusIn(event: Event): void {
  if (!suppressed) return;
  const target = event.target as Element | null;
  if (isEditable(target)) tag(target);
  hideSoftKeyboardNow();
}

function onViewportChange(): void {
  if (!suppressed) return;
  const height = window.innerHeight || 0;
  // A sudden shrink means an IME opened: push it back down immediately.
  if (baselineHeight && height > 0 && baselineHeight - height > KEYBOARD_DETECT_PX) {
    hideSoftKeyboardNow();
  } else {
    baselineHeight = height;
  }
}

/** True while the tablet keyboard is being kept hidden for the remote session. */
export function isRemoteKeyboardSuppressed(): boolean {
  return suppressed;
}

/**
 * Enables/disables the guard. Connected → tablet keyboard stays hidden.
 * Disconnected → every edited attribute is restored to its exact prior value.
 */
export function setRemoteKeyboardSuppressed(on: boolean): void {
  if (typeof document === "undefined") return;
  if (on === suppressed) {
    if (on) hideSoftKeyboardNow();
    return;
  }
  suppressed = on;

  if (on) {
    document.documentElement.setAttribute(ROOT_FLAG, "on");
    tagTree(document);

    if (typeof MutationObserver === "function") {
      observer = new MutationObserver((records) => {
        if (!suppressed) return;
        for (const record of records) {
          record.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement) tagTree(node.parentElement || node);
            else if (node.parentElement) tagTree(node.parentElement);
          });
        }
      });
      observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true,
      });
    }

    // Capture phase: runs BEFORE focus is granted, which is the only moment
    // where the attribute can still stop the IME from opening.
    document.addEventListener("pointerdown", onPointerDownCapture, true);
    document.addEventListener("touchstart", onPointerDownCapture, true);
    document.addEventListener("focusin", onFocusIn, true);
    window.addEventListener("resize", onViewportChange);
    (window as any).visualViewport?.addEventListener?.("resize", onViewportChange);

    baselineHeight = window.innerHeight || 0;
    hideSoftKeyboardNow();
    return;
  }

  document.documentElement.removeAttribute(ROOT_FLAG);
  // Fresh session: the next connect must be able to hide the IME instantly.
  lastHideAt = 0;
  baselineHeight = 0;
  observer?.disconnect();
  observer = null;
  document.removeEventListener("pointerdown", onPointerDownCapture, true);
  document.removeEventListener("touchstart", onPointerDownCapture, true);
  document.removeEventListener("focusin", onFocusIn, true);
  window.removeEventListener("resize", onViewportChange);
  (window as any).visualViewport?.removeEventListener?.("resize", onViewportChange);
  restoreAll();
}
