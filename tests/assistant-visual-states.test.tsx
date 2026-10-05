/** @vitest-environment jsdom */
import React, { act } from "react";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { setupDom, theme, click, input } from "./helpers/handwriting-dom";
const app = vi.hoisted(() => ({ currentTheme: {} as any }));
const service = vi.hoisted(() => ({ stream: vi.fn(), decision: vi.fn(), explicit: false }));
vi.mock("../contexts/AppContext", () => ({ useApp: () => app }));
vi.mock("../lib/ai-assistant-service", () => ({ streamLiteraryAssistantResponse: service.stream, generateAgentCompletionSummary: vi.fn(), generateDefaultAgentIntro: vi.fn(), generateDefaultAgentSummary: vi.fn() }));
vi.mock("../lib/literary-agent", () => ({ isExplicitEditIntent: () => service.explicit, formatExecutiveContextForAI: () => '', executeAgentPlan: vi.fn(), askExecutiveAgentForDecision: service.decision }));
import Assistant from "../components/DarAlHikayatAIAssistant";
let dom: ReturnType<typeof setupDom>;
const view = () => <Assistant onClose={() => {}} storyContext={{ title: 'حكاية', fullText: '' }} />;
beforeEach(() => { dom = setupDom(); app.currentTheme = theme; service.explicit = false; service.stream.mockImplementation(() => new Promise(() => {})); service.decision.mockImplementation(() => new Promise(() => {})); });
afterEach(() => dom.cleanup());
const settle = () => act(async () => { await new Promise(r => setTimeout(r, 550)); });
async function send() {
  await input('textarea', 'راجع النص');
  await click('button[aria-label="إرسال"]');
}
it("welcomes the writer without the empty-state icon or quick prompts and rotates on reopening", async () => {
  await dom.render(view()); await settle();
  expect(dom.host.textContent).toContain('السلام عليكم، كاتبتنا رحمة');
  expect(dom.host.textContent).not.toContain('أستاذة');
  expect(dom.host.querySelector('header')!.textContent).toContain('دار الحكايات AI');
  expect(dom.host.querySelector('header .lucide-sparkles')).not.toBeNull();
  expect(dom.host.textContent).not.toContain('اقترح حبكة مشوقة للمشهد');
  const title = dom.host.querySelector('h2')!;
  expect(title.parentElement?.querySelector('svg')).toBeNull();
  const first = title.textContent;
  await dom.render(<div />); await dom.render(view()); await settle();
  expect(dom.host.querySelector('h2')!.textContent).not.toBe(first);
});
it("shows the new indicator while consulting, replaces it on first text, and rotates on new chat", async () => {
  let chunk: any, finish: any;
  service.stream.mockImplementation((_a, _b, _c, onChunk) => new Promise(resolve => { chunk = onChunk; finish = resolve; }));
  await dom.render(view()); await settle();
  const first = dom.host.querySelector('h2')!.textContent;
  await send();
  expect(dom.host.querySelectorAll('.dar-thinking-line')).toHaveLength(1);
  expect(dom.host.querySelector('textarea')!.disabled).toBe(true);
  await act(async () => { chunk({ text: 'إجابة تجريبية', thought: '', rawParts: [] }); });
  expect(dom.host.querySelector('.dar-thinking-line')).toBeNull();
  expect(dom.host.textContent).toContain('إجابة تجريبية');
  await act(async () => { finish(); });
  await click('button[aria-label="محادثة جديدة"]'); await settle();
  expect(dom.host.querySelector('h2')!.textContent).not.toBe(first);
});
it("shows the same orb plus the agent badge and spinner during executive waiting", async () => {
  service.explicit = true;
  await dom.render(view()); await send();
  expect(dom.host.querySelectorAll('.dar-thinking-line')).toHaveLength(1);
  expect(dom.host.querySelector('.dar-thinking-line')?.parentElement?.textContent).toContain('إيجنت');
  expect(dom.host.querySelector('button[aria-label="إرسال"] .animate-spin')).not.toBeNull();
  expect(dom.host.querySelector('textarea')!.placeholder).toBe('جارٍ تنفيذ التعديلات الجراحية في النص...');
});
