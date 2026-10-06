/** @vitest-environment jsdom */
import React, { act } from "react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { setupDom, theme, click } from "./helpers/handwriting-dom";
import EditorFontSheet from "../components/EditorFontSheet";
let dom: ReturnType<typeof setupDom>;
const apply = vi.fn(),
  close = vi.fn();
beforeEach(() => {
  dom = setupDom();
  apply.mockClear();
  close.mockClear();
});
afterEach(() => {
  delete (document as any).fonts;
  dom.cleanup();
});
async function render() {
  await dom.render(
    <EditorFontSheet
      theme={theme}
      anchor={null}
      scope="التحديد"
      onApply={apply}
      onClose={close}
    />,
  );
}
it("uses a nonmodal lock-style shell, local list fade, and real font weights with back navigation", async () => {
  await render();
  expect(
    document.querySelector('[role="dialog"]')?.getAttribute("aria-modal"),
  ).toBe("false");
  await click('[aria-label="أوزان أميري"]');
  expect(document.querySelectorAll(".editor-font-weight")).toHaveLength(2);
  expect(document.querySelector("#editor-font-title")?.textContent).toBe(
    "أميري",
  );
  await click(".editor-font-weight:last-child");
  expect(apply).toHaveBeenLastCalledWith(
    expect.objectContaining({ id: "amiri" }),
    700,
    false,
  );
  await click('[aria-label="الرجوع إلى الخطوط"]');
  expect(document.querySelectorAll(".editor-font-choice")).toHaveLength(39);
  expect(close).not.toHaveBeenCalled();
  await click(".editor-font-actions button");
  expect(apply).toHaveBeenLastCalledWith(
    expect.objectContaining({ id: "amiri" }),
    700,
    true,
  );
});
it("failed local font load cannot apply a fallback or claim success", async () => {
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { load: vi.fn().mockRejectedValue(new Error("missing")) },
  });
  await render();
  await click(".editor-font-choice");
  expect(apply).not.toHaveBeenCalled();
  expect(document.querySelector('[role="alert"]')?.textContent).toContain(
    "تعذّر",
  );
});
it("Escape closes and pending font loads are ignored after unmount", async () => {
  let resolve: any;
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: {
      load: () =>
        new Promise((r) => {
          resolve = r;
        }),
    },
  });
  await render();
  await click(".editor-font-choice");
  await act(async () => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  });
  expect(close).toHaveBeenCalledTimes(1);
  await dom.render(<div />);
  await act(async () => resolve([{}]));
  expect(apply).not.toHaveBeenCalled();
});
