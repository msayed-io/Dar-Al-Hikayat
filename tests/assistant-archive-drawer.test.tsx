/** @vitest-environment jsdom */
import React, { act } from "react";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { setupDom, theme, click } from "./helpers/handwriting-dom";

const app = vi.hoisted(() => ({
  currentTheme: {
    mode: "apple_dark" as const,
    bg: "#000000",
    text: "#F5F5F5",
    accent: "#F5F5F5",
    secondary: "#8E8E93",
    glass: "#1C1C1E",
    border: "rgba(255, 255, 255, 0.08)",
    shadow: "0 4px 30px rgba(0, 0, 0, 0.4)",
    isDark: true,
  },
}));

const service = vi.hoisted(() => ({
  stream: vi.fn(),
  decision: vi.fn(),
  explicit: false,
}));

vi.mock("../contexts/AppContext", () => ({ useApp: () => app }));
vi.mock("../lib/ai-assistant-service", () => ({
  streamLiteraryAssistantResponse: service.stream,
  generateAgentCompletionSummary: vi.fn(),
  generateDefaultAgentIntro: vi.fn(),
  generateDefaultAgentSummary: vi.fn(),
}));
vi.mock("../lib/literary-agent", () => ({
  isExplicitEditIntent: () => service.explicit,
  formatExecutiveContextForAI: () => "",
  executeAgentPlan: vi.fn(),
  askExecutiveAgentForDecision: service.decision,
}));

import Assistant from "../components/DarAlHikayatAIAssistant";

let dom: ReturnType<typeof setupDom>;
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 350)); });

beforeEach(() => {
  dom = setupDom();
  app.currentTheme = {
    mode: "apple_dark",
    bg: "#000000",
    text: "#F5F5F5",
    accent: "#F5F5F5",
    secondary: "#8E8E93",
    glass: "#1C1C1E",
    border: "rgba(255, 255, 255, 0.08)",
    shadow: "0 4px 30px rgba(0, 0, 0, 0.4)",
    isDark: true,
  };
  service.explicit = false;
});

afterEach(() => {
  dom.cleanup();
});

it("opens drawer with fixed width, rounded borders, and compact readable new chat button", async () => {
  await dom.render(<Assistant onClose={() => {}} storyContext={{ title: "حكاية تجريبية", fullText: "" }} storyId="test-story-1" />);
  await settle();

  // Open the drawer by clicking the archive icon in the header
  const openArchiveBtn = dom.host.querySelector('button[aria-label="سجل محادثات هذه الحكاية"]') as HTMLButtonElement;
  expect(openArchiveBtn).not.toBeNull();

  await click(openArchiveBtn);
  await settle();

  // Check drawer presence in document.body (portal)
  const drawer = document.body.querySelector("aside[dir='rtl']") as HTMLElement;
  expect(drawer).not.toBeNull();
  expect(drawer.textContent).toContain("محادثات الحكاية");

  // Check fixed width and rounded corners
  expect(drawer.className).toContain("w-[260px]");
  expect(drawer.className).toContain("min-w-[260px]");
  expect(drawer.className).toContain("rounded-[24px]");
  expect(drawer.className).toContain("top-3");
  expect(drawer.className).toContain("bottom-3");
  expect(drawer.className).toContain("right-3");

  // Check the New Chat button in drawer
  const newChatBtn = Array.from(drawer.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("محادثة جديدة")
  ) as HTMLButtonElement;
  expect(newChatBtn).not.toBeNull();
  expect(newChatBtn.style.color).toBe("rgb(245, 245, 245)"); // #F5F5F5 readable text

  // Check backdrop presence in body
  const backdrop = document.body.querySelector(".backdrop-blur-\\[2px\\]") as HTMLElement;
  expect(backdrop).not.toBeNull();

  // Clicking backdrop closes the drawer
  await click(backdrop);
  await settle();

  expect(document.body.querySelector("aside[dir='rtl']")).toBeNull();
});

it("closes drawer when pressing Escape or clicking outside on window", async () => {
  await dom.render(<Assistant onClose={() => {}} storyContext={{ title: "حكاية ثانية", fullText: "" }} storyId="test-story-2" />);
  await settle();

  const openArchiveBtn = dom.host.querySelector('button[aria-label="سجل محادثات هذه الحكاية"]') as HTMLButtonElement;
  await click(openArchiveBtn);
  await settle();

  expect(document.body.querySelector("aside[dir='rtl']")).not.toBeNull();

  // Press Escape
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  });
  await settle();

  expect(document.body.querySelector("aside[dir='rtl']")).toBeNull();
});

it("renders 3-dots menu floating above conversations and outside the item capsule without expanding it", async () => {
  const dummyConv = [
    {
      id: "c1",
      title: "محادثة صقل الحوار",
      lastMessageAt: new Date().toISOString(),
      messages: [],
    },
  ];
  localStorage.setItem("dar_alhikayat_ai_convs_story_test-story-3", JSON.stringify(dummyConv));

  await dom.render(<Assistant onClose={() => {}} storyContext={{ title: "حكاية ثالثة", fullText: "" }} storyId="test-story-3" />);
  await settle();

  const openArchiveBtn = dom.host.querySelector('button[aria-label="سجل محادثات هذه الحكاية"]') as HTMLButtonElement;
  await click(openArchiveBtn);
  await settle();

  const drawer = document.body.querySelector("aside[dir='rtl']") as HTMLElement;
  expect(drawer).not.toBeNull();

  // Find the conversation item
  const convRow = drawer.querySelector(".space-y-1 > div") as HTMLElement;
  expect(convRow).not.toBeNull();
  expect(convRow.textContent).toContain("محادثة صقل الحوار");

  // Verify NO date is rendered at all
  expect(convRow.textContent).not.toContain("أكتوبر");

  // Verify NO capsule border is rendered (borderless list row matching Screenshot_20261009_143826.jpg)
  expect(convRow.className).not.toMatch(/\bborder\b/);
  expect(convRow.className).toContain("px-3.5");
  expect(convRow.className).toContain("py-3");

  // Find 3 dots button
  const moreBtn = convRow.querySelector('button[aria-label="إجراءات محادثة صقل الحوار"]') as HTMLButtonElement;
  expect(moreBtn).not.toBeNull();

  await click(moreBtn);
  await settle();

  // Check that the floating menu is rendered at drawer level
  const floatingMenu = drawer.querySelector(".z-\\[80\\]") as HTMLElement;
  expect(floatingMenu).not.toBeNull();
  expect(floatingMenu.textContent).toContain("مشاركة المحادثة");
  expect(floatingMenu.textContent).toContain("تثبيت");
  expect(floatingMenu.textContent).toContain("إعادة التسمية");
  expect(floatingMenu.textContent).toContain("حذف");

  // Verify that the conversation row does NOT contain the menu (it remains isolated)
  expect(convRow.querySelector(".z-\\[80\\]")).toBeNull();
});
