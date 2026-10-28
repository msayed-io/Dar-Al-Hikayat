/** @vitest-environment jsdom */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setupDom, theme, click } from "./helpers/handwriting-dom";

vi.mock("../components/DarAlHikayatAIAssistant", () => ({
  default: () => <div id="mock-ai-assistant" />,
}));
vi.mock("../components/RemoteKeyboardModal", () => ({ default: () => null }));
vi.mock("../lib/remote-keyboard-service", () => ({
  listenForRemoteKeystrokes: () => () => {},
  updateRemoteSession: vi.fn(),
}));

const { app } = vi.hoisted(() => {
  return {
    app: {
      selectedNote: {
        id: 991,
        title: "حكاية تجريبية",
        content: "<p>محتوى الحكاية التجريبية</p>",
        preview: "محتوى",
        styles: { fontSize: 16, fontWeight: 400, textAlign: "right" as const, paperStyleIndex: 0 },
        created_at: Date.now(),
        updated_at: Date.now(),
      },
      currentTheme: {} as any,
      backToHome: vi.fn(),
      saveNote: vi.fn().mockResolvedValue(true),
      toggleTheme: vi.fn(),
    },
  };
});

vi.mock("../contexts/AppContext", () => ({ useApp: () => app }));

import Editor from "../components/DarAlHikayatEditor";

describe("Editor Header More Menu (Consolidated 3-Dots Dropdown)", () => {
  let dom: ReturnType<typeof setupDom>;

  beforeEach(() => {
    dom = setupDom();
    app.currentTheme = theme;
  });

  afterEach(() => {
    dom.cleanup();
  });

  it("consolidates Lock, Smartphone, and Novel Mode into a unified 3-dots dropdown next to divider", async () => {
    await dom.render(<Editor />);

    // Click story content to enter edit mode (isSavedMode = false)
    await click("#story-content");

    // 1. The 3-dots button is present
    const moreTrigger = dom.host.querySelector<HTMLButtonElement>(".editor-more-menu-trigger");
    expect(moreTrigger).not.toBeNull();
    expect(moreTrigger?.getAttribute("title")).toBe("خيارات إضافية");

    // 2. The dropdown is present with stable fixed width and initially closed
    const dropdown = dom.host.querySelector<HTMLDivElement>(".editor-more-menu");
    expect(dropdown).not.toBeNull();
    expect(dropdown?.classList.contains("w-[178px]")).toBe(true);
    expect(dropdown?.classList.contains("w-max")).toBe(false);
    expect(dropdown?.classList.contains("opacity-0")).toBe(true);

    // 3. Clicking the 3-dots button opens the dropdown
    await click(".editor-more-menu-trigger");
    expect(dropdown?.classList.contains("opacity-100")).toBe(true);

    // 4. Verify options exist inside the dropdown:
    const dropdownText = dropdown?.textContent || "";
    expect(dropdownText).toContain("تفعيل نمط الرواية");
    expect(dropdownText).toContain("كيبورد الحكايات");
    // Strictly verify no brackets or "(عن بُعد)"
    expect(dropdownText).not.toContain("عن بُعد");
    expect(dropdownText).not.toContain("(");
    expect(dropdownText).not.toContain(")");
    expect(dropdownText).toContain("تأمين الحكاية");

    // 5. Clicking outside closes the dropdown
    await click("#story-content");
    expect(dropdown?.classList.contains("opacity-0")).toBe(true);
  });

  it("opens Lock Setup Dialog reliably when clicking تأمين الحكاية without immediately closing", async () => {
    await dom.render(<Editor />);
    await click("#story-content");

    // Open 3-dots menu
    await click(".editor-more-menu-trigger");

    // Click "تأمين الحكاية"
    const lockBtn = dom.host.querySelector<HTMLButtonElement>(".lock-dialog-trigger");
    expect(lockBtn).not.toBeNull();
    await click(".lock-dialog-trigger");

    // Lock dialog should be rendered and visible
    const lockDialog = dom.host.querySelector<HTMLDivElement>(".lock-dialog");
    expect(lockDialog).not.toBeNull();
    expect(lockDialog?.textContent).toContain("تأمين الحكاية");
  });

  it("activates Novel Mode and opens Chapters Index (فهرس الفواصل) reliably", async () => {
    await dom.render(<Editor />);
    await click("#story-content");

    // Open 3-dots menu
    await click(".editor-more-menu-trigger");

    // Click "تفعيل نمط الرواية"
    const novelBtn = Array.from(dom.host.querySelectorAll<HTMLButtonElement>(".editor-more-menu button"))
      .find((b) => b.textContent?.includes("تفعيل نمط الرواية"));
    expect(novelBtn).toBeDefined();
    await click(novelBtn!);

    // Now Novel Mode is active, "فهرس الفواصل" appears inside the menu
    const tocBtn = dom.host.querySelector<HTMLButtonElement>(".toc-toggle");
    expect(tocBtn).not.toBeNull();
    expect(tocBtn?.textContent).toContain("فهرس الفواصل");

    // Click "فهرس الفواصل"
    await click(".toc-toggle");

    // TOC card should now have opacity-100 and pointer-events-auto
    const tocCard = dom.host.querySelector<HTMLDivElement>(".toc-card");
    expect(tocCard).not.toBeNull();
    expect(tocCard?.classList.contains("opacity-100")).toBe(true);
    expect(tocCard?.classList.contains("pointer-events-auto")).toBe(true);
  });
});
