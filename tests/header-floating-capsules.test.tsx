/** @vitest-environment jsdom */
import React, { act } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

vi.mock("../contexts/AppContext", () => ({ useApp: () => app }));
vi.mock("../lib/ai-assistant-service", () => ({
  streamLiteraryAssistantResponse: vi.fn(),
  generateAgentCompletionSummary: vi.fn(),
  generateDefaultAgentIntro: vi.fn(),
  generateDefaultAgentSummary: vi.fn(),
}));
vi.mock("../lib/literary-agent", () => ({
  isExplicitEditIntent: () => false,
  formatExecutiveContextForAI: () => "",
  executeAgentPlan: vi.fn(),
  askExecutiveAgentForDecision: vi.fn(),
}));

import Assistant, { TwoLinesMenuIcon } from "../components/DarAlHikayatAIAssistant";

describe("AI Assistant Floating Header Capsules System (Matching Uploaded Asset)", () => {
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
  });

  afterEach(() => {
    dom.cleanup();
  });

  it("1. SidebarMenuIcon renders exact reference asset geometry (outer squircle frame + inner sidebar pill)", async () => {
    await dom.render(
      <TwoLinesMenuIcon size={22} color="#ffffff" />
    );
    const circle = dom.host.querySelector("circle");
    expect(circle).toBeNull();

    const rects = dom.host.querySelectorAll("rect");
    expect(rects.length).toBe(2);
    // Outer squircle frame with exact 19:18 aspect and rounded corners
    expect(rects[0].getAttribute("width")).toBe("19");
    expect(rects[0].getAttribute("height")).toBe("18");
    expect(rects[0].getAttribute("rx")).toBe("5");
    // Inner sidebar pill
    expect(rects[1].getAttribute("width")).toBe("2.75");
    expect(rects[1].getAttribute("height")).toBe("11.5");
    expect(rects[1].getAttribute("rx")).toBe("1.375");
  });

  it("2. in empty chat state shows 'دار الحكايات AI' capsule next to drawer, hides new chat button; and removes 'دار الحكايات AI' upon chat start", async () => {
    await dom.render(
      <Assistant
        onClose={() => {}}
        storyContext={{ title: "تصميم موقع 3D بالسكرو", fullText: "" }}
        storyId="test-story-capsules"
      />
    );
    await settle();

    const header = dom.host.querySelector("header");
    expect(header).not.toBeNull();

    // 1. In empty state: "دار الحكايات AI" capsule is present on the right next to drawer (without sparkles icon)
    expect(header?.textContent).toContain("دار الحكايات AI");
    expect(header?.querySelector(".lucide-sparkles")).toBeNull();

    // 2. Middle conversation capsule is completely deleted
    expect(header?.querySelector('button[aria-label="عنوان المحادثة الحالية"]')).toBeNull();

    // 3. New chat button is HIDDEN in empty state (messages.length === 0)
    expect(header?.querySelector('button[aria-label="محادثة جديدة"]')).toBeNull();

    // 4. Standalone Exit / Return button on the left is present
    const exitBtn = header?.querySelector('button[aria-label="إغلاق"]') as HTMLButtonElement;
    expect(exitBtn).not.toBeNull();
    expect(exitBtn.classList.contains("rounded-full")).toBe(true);
  });

  it("3. clicking the drawer button opens the conversation archive drawer with matched SquarePen icon", async () => {
    await dom.render(
      <Assistant
        onClose={() => {}}
        storyContext={{ title: "حكاية الاختبار", fullText: "" }}
        storyId="test-story-capsules"
      />
    );
    await settle();

    const drawerBtn = dom.host.querySelector('button[aria-label="سجل محادثات هذه الحكاية"]') as HTMLButtonElement;
    expect(drawerBtn).not.toBeNull();

    await click(drawerBtn);
    await settle();

    // Drawer is now open in portal
    const drawer = document.body.querySelector("aside[dir='rtl']") as HTMLElement;
    expect(drawer).not.toBeNull();
    expect(drawer.textContent).toContain("محادثات الحكاية");

    // Drawer new chat button has SquarePen icon (lucide-square-pen or matching SVG)
    const newChatBtn = Array.from(drawer.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("محادثة جديدة")
    );
    expect(newChatBtn).toBeDefined();
    expect(newChatBtn?.querySelector(".lucide-square-pen") || newChatBtn?.querySelector("svg")).not.toBeNull();
  });
});
