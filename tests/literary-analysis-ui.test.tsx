/** @vitest-environment jsdom */
import React, { act } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { setupDom, theme, click, input } from './helpers/handwriting-dom';
const app = vi.hoisted(() => ({ currentTheme: {} as any }));
vi.mock('../contexts/AppContext', () => ({ useApp: () => app }));
vi.mock('../lib/smart-key-rotator', () => ({ executeWithSmartRotation: (fn: any) => fn(''), AllKeysExhaustedError: class extends Error {}, NoActiveKeysConfiguredError: class extends Error {}, isNetworkConnectionError: () => false, isRateLimitError: () => false, isInvalidKeyError: () => false }));
import Assistant, { loadStoredConversationsFromStorage } from '../components/DarAlHikayatAIAssistant';
let dom: ReturnType<typeof setupDom>; let root: HTMLElement; const commit = vi.fn();
const view = (id = 'analysis-story-A') => <Assistant storyId={id} editorRootElement={root} onCommitAgentChanges={commit} storyContext={{ title: 'قصة الاختبار', fullText: root.innerHTML }} onClose={() => {}} />;
const fixture = { text: JSON.stringify({ summary: 'تقرير الإيقاع التجريبي', storyBible: [], findings: [{ title: 'التوازن', detail: 'تفسير أدبي', suggestion: 'اقتراح فقط', evidence: [{ blockId: 'b_one', quote: 'عينا سلمى خضراوان.' }] }] }), model: 'fixture-model' };
const settle = () => act(async () => { await new Promise(r => setTimeout(r, 350)); });
beforeEach(() => {
  dom = setupDom(); localStorage.clear(); app.currentTheme = theme; commit.mockClear();
  root = document.createElement('article'); root.innerHTML = '<p data-block-id="b_one"><strong>عينا سلمى خضراوان.</strong></p>'; document.body.append(root);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => fixture }));
});
afterEach(() => { dom.cleanup(); root.remove(); vi.unstubAllGlobals(); });
async function send(message: string) { await input('textarea', message); await click('button[aria-label="إرسال"]'); }
it('routes natural-language analysis to the real read-only executor, displays and persists its actual report', async () => {
  const before = root.innerHTML; await dom.render(view()); await settle(); await send('حلل الإيقاع'); await settle();
  expect(fetch).toHaveBeenCalledTimes(1); expect(dom.host.textContent).toContain('تقرير الإيقاع التجريبي'); expect(dom.host.textContent).toContain('عينا سلمى خضراوان.'); expect(dom.host.textContent).toContain('فحص للقراءة فقط');
  expect(dom.host.textContent).not.toContain('تم بحمد الله تطبيق التعديل'); expect(root.innerHTML).toBe(before); expect(commit).not.toHaveBeenCalled();
  const saved = loadStoredConversationsFromStorage('dar_alhikayat_ai_convs_story_analysis-story-A');
  expect(saved[0].messages.some(m => m.analysisReports?.[0]?.summary === 'تقرير الإيقاع التجريبي')).toBe(true);
  expect(saved[0].messages.some(m => m.agentResult?.totalMutations === 0)).toBe(true);
});
it('shows a provider failure rather than a completed analysis or an edited-story message', async () => {
  (fetch as any).mockRejectedValue(new Error('تعذر الاتصال بالخدمة'));
  await dom.render(view()); await settle(); await send('حلل الإيقاع'); await settle();
  expect(dom.host.textContent).toContain('تعذر إكمال الفحص'); expect(dom.host.textContent).not.toContain('اكتمل التقرير'); expect(commit).not.toHaveBeenCalled(); expect(dom.host.querySelector('textarea')!.disabled).toBe(false);
});
it('aborts a pending report on story switch without leaking it to the next story', async () => {
  let finish: any; let signal: AbortSignal;
  (fetch as any).mockImplementation((_url: any, options: any) => { signal = options.signal; return new Promise(r => { finish = r; }); });
  await dom.render(view()); await settle(); await send('حلل الإيقاع'); expect(signal!.aborted).toBe(false);
  await dom.render(view('analysis-story-B')); await settle(); expect(signal!.aborted).toBe(true);
  await act(async () => { finish({ ok: true, json: async () => fixture }); }); await settle();
  expect(dom.host.textContent).not.toContain('تقرير الإيقاع التجريبي'); expect(dom.host.querySelector('textarea')!.disabled).toBe(false); expect(commit).not.toHaveBeenCalled();
  expect(JSON.stringify(loadStoredConversationsFromStorage('dar_alhikayat_ai_convs_story_analysis-story-B'))).not.toContain('تقرير الإيقاع');
});

it.each([
  ['بص على الشخصيات في النص، صفاتهم وتصرفاتهم ثابتة ولا فيه حاجات بتناقض بعض؟ قولّي بس من غير ما تغيّر حاجة.', 'character_continuity_checker'],
  ['حاسّة إن فيه حتت بطيئة وحتت جريت مني، شوف إيقاع النص ومشاعر ليلى وقولّي رأيك، من غير ما تعدّل.', 'pacing_and_emotion_analyzer'],
  ['شوف الأحداث كده، فيه ثغرات في الحبكة أو حاجة حصلت ومش راكبة على اللي قبلها؟ ورّيني مكانها من غير ما تغيّر النص.', 'plot_hole_detector'],
  ['راجع أسلوب الكلام في النص، حاسّة إن فيه حتة نبرتها مختلفة عن الباقي. إنت شايف إيه؟ قولّي بس ومتعدّلش حاجة.', 'voice_and_tone_guardian'],
])('routes the actual Egyptian trial prompt through the intended tool: %s', async (prompt, name) => {
  const before = root.innerHTML; await dom.render(view()); await settle(); await send(prompt); await settle();
  expect(fetch).toHaveBeenCalledTimes(1);
  const saved = loadStoredConversationsFromStorage('dar_alhikayat_ai_convs_story_analysis-story-A');
  expect(saved[0].messages.find(m => m.analysisReports?.length)?.analysisReports?.[0].tool).toBe(name);
  expect(dom.host.textContent).not.toContain('b_one'); expect(root.innerHTML).toBe(before); expect(commit).not.toHaveBeenCalled();
});
it('renders paragraph prose but persists raw reference tokens and a stable source snapshot', async () => {
  (fetch as any).mockResolvedValue({ ok: true, json: async () => ({ ...fixture, text: JSON.stringify({ summary: 'راجعي [b_one]', findings: [] }) }) });
  await dom.render(view()); await settle(); await send('حلل الإيقاع'); await settle();
  const saved = loadStoredConversationsFromStorage('dar_alhikayat_ai_convs_story_analysis-story-A');
  const report = saved[0].messages.find(m => m.analysisReports?.length)!;
  expect(report.content).toContain('b\\_one'); expect(report.paragraphReferences?.b_one).toBe('عينا سلمى خضراوان.');
  expect(dom.host.textContent).toContain('عينا سلمى خضراوان.'); expect(dom.host.textContent).not.toContain('b_one');
  root.innerHTML = '<p data-block-id="b_one">نص جديد مختلف</p>';
  await dom.render(view()); await settle();
  expect(dom.host.textContent).toContain('عينا سلمى خضراوان.'); expect(dom.host.textContent).not.toContain('نص جديد مختلف');
  expect(commit).not.toHaveBeenCalled();
});
