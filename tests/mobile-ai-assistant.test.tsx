/** @vitest-environment jsdom */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setupDom, theme, click } from "./helpers/handwriting-dom";
import { checkIsTabletOrWideScreen } from "../lib/screen-classifier";

const mockAssistantProps = vi.fn();
vi.mock("../components/DarAlHikayatAIAssistant", () => ({
  default: (props: any) => {
    mockAssistantProps(props);
    return (
      <div id="mock-ai-assistant">
        <button id="mock-close-assistant-btn" onClick={props.onClose}>
          خروج
        </button>
        <div id="mock-assistant-title">{props.storyContext?.title}</div>
      </div>
    );
  },
}));

vi.mock("../components/RemoteKeyboardModal", () => ({ default: () => null }));
vi.mock("../lib/remote-keyboard-service", () => ({
  listenForRemoteKeystrokes: () => () => {},
  updateRemoteSession: vi.fn(),
}));

const { sample55Words, app } = vi.hoisted(() => {
  const words =
    "كانت المدينة القديمة تنام بهدوء تحت ضوء القمر الفضي الناعم والنسيم العليل يداعب أشجار الزيتون العتيقة في أطراف الوادي الساحر حيث اعتادت سارة الجلوس كل ليلة لتكتب فصول حكايتها الجديدة وتستلهم من سكون الليل أفكارها البديعة التي تنبض بالحياة والأمل وتبث في قلوب القراء شغف المعرفة والجمال وتفتح لهم آفاقا رحبة للتأمل والتفكير في معاني الوجود والإبداع الأدبي الراقي";
  return {
    sample55Words: words,
    app: {
      selectedNote: {
        id: 991,
        title: "رواية الصحراء",
        content: `<p>${words}</p>`,
        preview: words,
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
vi.mock("../lib/storage-service", () => ({
  StorageService: { getStoryBody: vi.fn().mockResolvedValue(sample55Words) },
}));

import Editor from "../components/DarAlHikayatEditor";

describe("Mobile AI Assistant & Wide-Screen Persistence", () => {
  let dom: ReturnType<typeof setupDom>;

  beforeEach(() => {
    dom = setupDom();
    app.currentTheme = theme;
    mockAssistantProps.mockClear();
  });

  afterEach(() => {
    dom.cleanup();
  });

  it("1. screen-classifier reports canOpenAssistant: true across mobile and wide screens", () => {
    const classification = checkIsTabletOrWideScreen();
    expect(classification.canOpenAssistant).toBe(true);
  });

  it("2. on mobile phone, clicking AI button opens assistant directly without size tooltip error", async () => {
    // Simulate mobile viewport (375x667, portrait)
    window.innerWidth = 375;
    window.innerHeight = 667;
    window.dispatchEvent(new Event("resize"));

    await dom.render(<Editor />);
    // Click story content to transition from reading mode to edit mode
    await click("#story-content");

    const aiButton = dom.host.querySelector<HTMLButtonElement>("#dar-alhikayat-ai-toggle-btn");
    expect(aiButton).not.toBeNull();

    // Verify no size tooltip is present
    expect(dom.host.querySelector("#ai-screen-size-tooltip")).toBeNull();

    // Click the AI Assistant button
    await click("#dar-alhikayat-ai-toggle-btn");

    // Assistant container is now opened
    const container = dom.host.querySelector<HTMLElement>("#dar-alhikayat-ai-container");
    expect(container).not.toBeNull();

    // Verify it uses mobile overlay classes (fixed inset-0, z-[60])
    expect(container?.classList.contains("fixed")).toBe(true);
    expect(container?.classList.contains("inset-0")).toBe(true);
    expect(container?.style.visibility).toBe("visible");
    expect(container?.style.opacity).toBe("1");

    // Still no size error tooltip displayed!
    expect(dom.host.querySelector("#ai-screen-size-tooltip")).toBeNull();
  });

  it("3. on mobile phone, clicking close button hides assistant but keeps it mounted in DOM with state preserved", async () => {
    window.innerWidth = 375;
    window.innerHeight = 667;
    window.dispatchEvent(new Event("resize"));

    await dom.render(<Editor />);
    await click("#story-content");

    // Open assistant
    await click("#dar-alhikayat-ai-toggle-btn");
    expect(dom.host.querySelector("#mock-ai-assistant")).not.toBeNull();

    const container = dom.host.querySelector<HTMLElement>("#dar-alhikayat-ai-container");
    expect(container?.style.visibility).toBe("visible");

    // Click the assistant's exit button
    await click("#mock-close-assistant-btn");

    // Crucial requirement: component is NOT destroyed/unmounted! It remains in DOM!
    expect(dom.host.querySelector("#mock-ai-assistant")).not.toBeNull();
    // But it is hidden with translateY(100%), opacity 0, visibility hidden, pointer-events none
    expect(container?.style.visibility).toBe("hidden");
    expect(container?.style.opacity).toBe("0");
    expect(container?.style.transform).toBe("translateY(100%)");

    // Reopen assistant by tapping AI button again
    await click("#dar-alhikayat-ai-toggle-btn");
    expect(container?.style.visibility).toBe("visible");
    expect(container?.style.opacity).toBe("1");
    expect(container?.style.transform).toBe("translateY(0)");
  });

  it("4. preserves wide-screen split layout on tablets in landscape (width: 420px aside)", async () => {
    // Simulate tablet landscape (1024x768)
    window.innerWidth = 1024;
    window.innerHeight = 768;
    window.dispatchEvent(new Event("resize"));

    await dom.render(<Editor />);
    await click("#story-content");

    // Open assistant
    await click("#dar-alhikayat-ai-toggle-btn");

    const container = dom.host.querySelector<HTMLElement>("#dar-alhikayat-ai-container");
    expect(container).not.toBeNull();

    // Verify wide-screen split aside styles
    expect(container?.classList.contains("border-l")).toBe(true);
    expect(container?.style.width).toBe("420px");
    expect(container?.style.minWidth).toBe("420px");
    expect(container?.style.maxWidth).toBe("420px");
    expect(container?.style.display).toBe("flex");
  });
});
