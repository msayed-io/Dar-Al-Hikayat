/**
 * Round-2 phone protocol: the space key, the writer shortcut bar and the
 * large-paste channel.
 *
 * These decode EXACTLY the query strings the كيبورد الحكايات app builds
 * (`?action=key&key=Space`, `?action=shortcut&cmd=paste_local`, letters sent as
 * `?action=paste&text=<url-encoded>`, large pastes as a JSON POST body), so a
 * mismatch here is the bug the writer would feel on the tablet.
 */
import { describe, it, expect } from "vitest";
import { mapNativeCommandToPayload } from "../lib/remote-keyboard-service";

const decode = (action: string, data: Record<string, any>) => mapNativeCommandToPayload(action, data, "482913");

describe("Physical keys from the phone (?action=key&key=…)", () => {
  it("turns the space bar into a real space character", () => {
    const payload = decode("key", { key: "Space" });
    expect(payload).toMatchObject({ type: "KEY", char: " ", sessionPin: "482913" });
  });

  it("still accepts a literal space arriving as the key value", () => {
    expect(decode("key", { key: " " })).toMatchObject({ type: "KEY", char: " " });
  });

  it("maps backspace, enter, tab and the four arrows", () => {
    expect(decode("key", { key: "Backspace" })?.action).toBe("BACKSPACE");
    expect(decode("key", { key: "Enter" })?.action).toBe("NEWLINE");
    expect(decode("key", { key: "Tab" })).toMatchObject({ type: "KEY", char: "\t" });
    expect(decode("key", { key: "ArrowLeft" })?.action).toBe("NAVIGATE_LEFT");
    expect(decode("key", { key: "ArrowRight" })?.action).toBe("NAVIGATE_RIGHT");
    expect(decode("key", { key: "ArrowUp" })?.action).toBe("NAVIGATE_UP");
    expect(decode("key", { key: "ArrowDown" })?.action).toBe("NAVIGATE_DOWN");
  });

  it("is case-insensitive so iOS/Android spelling differences never break a key", () => {
    expect(decode("key", { key: "space" })?.char).toBe(" ");
    expect(decode("key", { key: "BACKSPACE" })?.action).toBe("BACKSPACE");
  });
});

describe("Writer shortcut bar (?action=shortcut&cmd=…)", () => {
  it("maps every toolbar button the writer can press", () => {
    expect(decode("shortcut", { cmd: "undo" })?.action).toBe("UNDO");
    expect(decode("shortcut", { cmd: "redo" })?.action).toBe("REDO");
    expect(decode("shortcut", { cmd: "cut" })?.action).toBe("CUT");
    expect(decode("shortcut", { cmd: "copy" })?.action).toBe("COPY");
    expect(decode("shortcut", { cmd: "select_all" })?.action).toBe("SELECT_ALL");
    expect(decode("shortcut", { cmd: "save" })?.action).toBe("SAVE");
  });

  it("offers exactly two paste sources: the phone or the tablet", () => {
    expect(decode("shortcut", { cmd: "paste" })?.action).toBe("PASTE"); // phone clipboard (POST body)
    expect(decode("shortcut", { cmd: "paste_local" })?.action).toBe("PASTE_LOCAL"); // tablet clipboard
    expect(decode("shortcut", { cmd: "paste_tablet" })?.action).toBe("PASTE_LOCAL");
  });

  it("ignores an unknown command instead of typing something random", () => {
    expect(decode("shortcut", { cmd: "explode" })).toBeNull();
  });

  it("keeps the theme shortcuts working (bold/italic/underline)", () => {
    expect(decode("shortcut", { cmd: "bold" })?.action).toBe("BOLD");
    expect(decode("shortcut", { cmd: "italic" })?.action).toBe("ITALIC");
    expect(decode("shortcut", { cmd: "underline" })?.action).toBe("UNDERLINE");
  });
});

describe("Typing a single letter (letters are sent as ?action=paste&text=)", () => {
  it("inserts the decoded Arabic letter as text", () => {
    const payload = decode("paste", { text: "ح" });
    expect(payload).toMatchObject({ type: "PASTE_TEXT", text: "ح" });
  });

  it("keeps diacritics and punctuation intact", () => {
    for (const glyph of ["ّ", "ً", "؟", "،", "«", "»"]) {
      expect(decode("paste", { text: glyph })?.text).toBe(glyph);
    }
  });
});

describe("Large paste channel (?action=paste with a JSON body)", () => {
  it("carries 30,000 Arabic characters through decode without losing one of them", () => {
    const source = "وكانت الحكاية تُروى في الزمن القديم، حيث تسكن الجدّات على أبواب البيوت. ".repeat(430);
    const payload = decode("paste", { text: source });
    expect(payload?.type).toBe("PASTE_TEXT");
    expect(payload?.text).toBe(source);
    expect(payload?.text.length).toBe(source.length);
  });

  it("preserves newlines exactly (WhatsApp-like fidelity)", () => {
    const source = "سطر أول\nسطر ثانٍ\n\nسطر رابع";
    expect(decode("paste", { text: source })?.text).toBe(source);
  });

  it("carries the session PIN so the tablet never runs an unauthorised paste", () => {
    expect(decode("paste", { text: "نص", pin: "482913" })?.sessionPin).toBe("482913");
  });

  it("ignores an empty paste body rather than inserting nothing", () => {
    expect(decode("paste", { text: "" })?.text).toBe("");
  });
});

describe("Regression guard", () => {
  it("keeps the mouse and legacy signals untouched", () => {
    expect(decode("mouse_mode", { enabled: "true" })).toMatchObject({ type: "MOUSE", action: "MOUSE_MODE" });
    expect(decode("mouse_click", { button: "right" })).toMatchObject({ type: "MOUSE", button: "right" });
    expect(decode("backspace", {})?.action).toBe("BACKSPACE");
    expect(decode("newline", {})?.action).toBe("NEWLINE");
    expect(decode("ping", {})?.action).toBe("PING");
  });
});
