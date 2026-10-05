/** @vitest-environment jsdom */
import { afterEach, expect, it } from "vitest";
import { EDITOR_FONTS } from "../lib/editor-fonts";
import {
  applyFontToAll,
  applyFontToTarget,
  captureFontTargets,
  rangeForTarget,
} from "../lib/editor-font-formatting";
const font = EDITOR_FONTS.find((f) => f.id === "amiri")!;
function root(html: string) {
  const e = document.createElement("div");
  e.innerHTML = html;
  e.contentEditable = "true";
  document.body.append(e);
  return e;
}
afterEach(() => {
  document.body.innerHTML = "";
  window.getSelection()?.removeAllRanges();
});
it("formats exactly the selected word without losing adjacent Arabic or block ID", () => {
  const e = root('<p data-block-id="one">قالت رحمة مرحبًا</p>');
  const text = e.firstChild!.firstChild!;
  const r = document.createRange();
  r.setStart(text, 5);
  r.setEnd(text, 9);
  const t = captureFontTargets([e], r)[0];
  expect(applyFontToTarget(t, font, 700)).toBe(true);
  expect(e.textContent).toBe("قالت رحمة مرحبًا");
  expect(e.querySelector("[data-editor-font]")?.textContent).toBe("رحمة");
  expect(e.firstElementChild?.getAttribute("data-block-id")).toBe("one");
  expect(rangeForTarget(t).toString()).toBe("رحمة");
});
it("repeated font previews update the same selection without growing nested wrappers", () => {
  const e = root("رحمة");
  const r = document.createRange();
  r.selectNodeContents(e);
  const t = captureFontTargets([e], r)[0];
  for (let i = 0; i < 12; i++) applyFontToTarget(t, font, i % 2 ? 400 : 700);
  expect(e.querySelectorAll("span")).toHaveLength(1);
  expect(e.textContent).toBe("رحمة");
  expect(rangeForTarget(t).toString()).toBe("رحمة");
});
it("preserves highlights and links across paragraphs and keeps text byte-exact", () => {
  const e = root(
    '<p data-block-id="a">قبل <mark style="background:yellow">مُشَكَّل</mark></p><p data-block-id="b"><a href="#x">رابط</a> بعد</p>',
  );
  const text = e.textContent;
  const r = document.createRange();
  r.selectNodeContents(e);
  applyFontToTarget(captureFontTargets([e], r)[0], font, 400);
  expect(e.textContent).toBe(text);
  expect(e.querySelector("mark")?.style.background).toBe("yellow");
  expect(e.querySelector("a")?.getAttribute("href")).toBe("#x");
  expect(e.querySelectorAll("p")).toHaveLength(2);
});
it("all overrides earlier different weights, including an empty paragraph for future typing", () => {
  const a = root(
      '<p><b>نص</b><span style="font-family:Arial;font-weight:900">آخر</span></p><p><br></p>',
    ),
    b = root("<h2>عنوان</h2>");
  applyFontToAll([a, b], font, 400);
  for (const e of [
    ...a.querySelectorAll<HTMLElement>("*"),
    ...b.querySelectorAll<HTMLElement>("*"),
  ]) {
    expect(e.style.fontWeight).toBe("400");
    expect(e.style.getPropertyPriority("font-family")).toBe("important");
  }
  const saved = a.innerHTML;
  const reopened = root(saved);
  expect(reopened.querySelector("p")?.style.fontFamily).toContain("Amiri");
});
it("collapsed caret applies to the current paragraph only", () => {
  const e = root("<p>أول</p><p>ثاني</p>");
  const r = document.createRange();
  r.setStart(e.lastChild!.firstChild!, 1);
  r.collapse(true);
  applyFontToTarget(captureFontTargets([e], r)[0], font, 700);
  expect(e.firstElementChild?.hasAttribute("data-editor-font")).toBe(false);
  expect(e.lastElementChild?.getAttribute("data-editor-font")).toBe("amiri");
});
it("empty editor gets a persistent font-bearing block without invisible text characters", () => {
  const e = root("");
  const r = document.createRange();
  r.selectNodeContents(e);
  r.collapse(true);
  applyFontToTarget(captureFontTargets([e], r)[0], font, 700);
  expect(e.textContent).toBe("");
  expect(e.querySelector("div")?.style.fontWeight).toBe("700");
  expect(e.querySelector("br")).not.toBeNull();
});
it("rejects invented weights and detached selection targets", () => {
  const e = root("نص");
  const r = document.createRange();
  r.selectNodeContents(e);
  const t = captureFontTargets([e], r)[0];
  expect(applyFontToTarget(t, font, 500)).toBe(false);
  expect(applyFontToAll([e], font, 900)).toBe(false);
  expect(e.innerHTML).toBe("نص");
  e.remove();
  expect(applyFontToTarget(t, font, 400)).toBe(false);
});
it("selection across two chapter bodies formats only the intersecting portions", () => {
  const a = root("أول فصل"),
    b = root("ثاني فصل");
  const r = document.createRange();
  r.setStart(a.firstChild!, 4);
  r.setEnd(b.firstChild!, 4);
  const targets = captureFontTargets([a, b], r);
  expect(targets).toHaveLength(2);
  targets.forEach((t) => applyFontToTarget(t, font, 700));
  expect(a.querySelector("span")?.textContent).toBe("فصل");
  expect(b.querySelector("span")?.textContent).toBe("ثاني");
});
it("restores a collapsed caret at the start of a later paragraph, not the previous end", () => {
  const e = root("<p>أول</p><p>ثاني</p>");
  const r = document.createRange();
  r.setStart(e.lastChild!.firstChild!, 0);
  r.collapse(true);
  const t = captureFontTargets([e], r)[0];
  applyFontToTarget(t, font, 700);
  const restored = rangeForTarget(t);
  expect(restored.startContainer).toBe(e.lastChild!.firstChild);
  expect(restored.startOffset).toBe(0);
});
it("restores the caret inside an empty paragraph between nonempty paragraphs", () => {
  const e = root("<p>أول</p><p><br></p><p>آخر</p>");
  const middle = e.children[1];
  const r = document.createRange();
  r.setStart(middle, 0);
  r.collapse(true);
  const t = captureFontTargets([e], r)[0];
  applyFontToTarget(t, font, 400);
  expect(rangeForTarget(t).startContainer).toBe(middle);
});
