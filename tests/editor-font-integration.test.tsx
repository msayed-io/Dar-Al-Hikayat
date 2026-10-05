/** @vitest-environment jsdom */
import React, { act } from "react";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { setupDom, theme, click } from "./helpers/handwriting-dom";
const app = vi.hoisted(() => ({
  selectedNote: null as any,
  currentTheme: {} as any,
  backToHome: vi.fn(),
  saveNote: vi.fn().mockResolvedValue(true),
  toggleTheme: vi.fn(),
}));
vi.mock("../contexts/AppContext", () => ({ useApp: () => app }));
vi.mock("../lib/storage-service", () => ({
  StorageService: { getStoryBody: vi.fn().mockResolvedValue("") },
}));
vi.mock("../components/DarAlHikayatAIAssistant", () => ({
  default: () => null,
}));
vi.mock("../lib/remote-keyboard-service", () => ({
  listenForRemoteKeystrokes: () => () => {},
  updateRemoteSession: vi.fn(),
  getDeviceLocalIp: vi
    .fn()
    .mockResolvedValue({
      primaryIp: "192.168.1.5",
      connectionUrl: "http://192.168.1.5:8080/",
    }),
}));
import Editor from "../components/DarAlHikayatEditor";
let dom: ReturnType<typeof setupDom>;
beforeEach(() => {
  dom = setupDom();
  Object.defineProperty(Range.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      top: 150,
      bottom: 170,
      left: 100,
      right: 200,
      width: 100,
      height: 20,
    }),
  });
  app.currentTheme = theme;
  app.selectedNote = null;
  app.saveNote.mockClear();
});
afterEach(() => dom.cleanup());
const surface = () => document.querySelector<HTMLElement>(".editor-container")!;
async function seed() {
  await dom.render(<Editor />);
  await act(async () => {
    surface().innerHTML =
      '<p data-block-id="a">رحمة تكتب</p><p data-block-id="b">حكاية جديدة</p>';
    surface().dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertFromPaste",
        data: "رحمة تكتب حكاية جديدة",
      }),
    );
  });
}
async function selectWord() {
  await act(async () => {
    const t = surface().firstChild!.firstChild!;
    window.getSelection()!.setBaseAndExtent(t, 0, t, 4);
    document.dispatchEvent(new Event("selectionchange"));
  });
}
async function chooseAmiri() {
  await click('[aria-label="أوزان أميري"]');
  await click(".editor-font-weight:last-child");
}
it("opens from existing selection capsule, applies only selection, and saves its HTML formatting", async () => {
  await seed();
  await selectWord();
  await click('[aria-label="خط النص المحدد"]');
  await chooseAmiri();
  expect(surface().querySelector("[data-editor-font]")?.textContent).toBe(
    "رحمة",
  );
  expect(surface().lastElementChild?.hasAttribute("data-editor-font")).toBe(
    false,
  );
  await click('[aria-label="إغلاق الخطوط"]');
  await click('[title="حفظ الحكاية"]');
  expect(app.saveNote).toHaveBeenCalled();
  const saved = new DOMParser().parseFromString(
    app.saveNote.mock.calls.at(-1)![0].content,
    "text/html",
  );
  expect(
    saved.querySelector<HTMLElement>("[data-editor-font]")?.style.fontFamily,
  ).toContain("Amiri");
});
it("all-font application is one undo step and redo restores it", async () => {
  await seed();
  await selectWord();
  await click('[aria-label="خط النص المحدد"]');
  await chooseAmiri();
  const selected = surface().innerHTML;
  await click(".editor-font-actions button");
  const all = surface().innerHTML;
  expect(surface().lastElementChild?.getAttribute("data-editor-font")).toBe(
    "amiri",
  );
  await click('[title="تراجع"]');
  expect(document.querySelector(".editor-font-sheet")).toBeNull();
  expect(surface().innerHTML).toBe(selected);
  await click('[title="إعادة"]');
  expect(surface().innerHTML).toBe(all);
});
it("tools entry closes its parent controls and edits the current paragraph, not the document", async () => {
  await seed();
  await act(async () => {
    const t = surface().lastChild!.firstChild!;
    window.getSelection()!.setBaseAndExtent(t, 0, t, 0);
    document.dispatchEvent(new Event("selectionchange"));
  });
  await click('[title="أدوات التنسيق"]');
  await click('[aria-label="الخطوط"]');
  await chooseAmiri();
  expect(document.querySelector(".editor-font-actions span")?.textContent).toBe(
    "الفقرة",
  );
  expect(surface().firstElementChild?.hasAttribute("data-editor-font")).toBe(
    false,
  );
  expect(surface().lastElementChild?.getAttribute("data-editor-font")).toBe(
    "amiri",
  );
});
