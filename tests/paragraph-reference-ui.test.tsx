/** @vitest-environment jsdom */
import React, { act } from 'react';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { setupDom, theme, click, input } from './helpers/handwriting-dom';
const app = vi.hoisted(() => ({ currentTheme: {} as any }));
const service = vi.hoisted(() => ({ stream: vi.fn(), decision: vi.fn() }));
vi.mock('../contexts/AppContext', () => ({ useApp: () => app }));
vi.mock('../lib/ai-assistant-service', async importOriginal => ({ ...await importOriginal<any>(), streamLiteraryAssistantResponse: service.stream }));
vi.mock('../lib/literary-agent', async importOriginal => ({ ...await importOriginal<any>(), askExecutiveAgentForDecision: service.decision }));
import Assistant, { loadStoredConversationsFromStorage } from '../components/DarAlHikayatAIAssistant';
let dom: ReturnType<typeof setupDom>, editor: HTMLElement;
const commit = vi.fn(); const clipboard = vi.fn();
const settle = () => act(async () => { await new Promise(r => setTimeout(r, 350)); });
const view = (id = 'references-A') => <Assistant storyId={id} onClose={() => {}} editorRootElement={editor} onCommitAgentChanges={commit} storyContext={{ title: 'حكاية', fullText: editor.innerHTML }} />;
const send = async (text: string) => { await input('textarea', text); await click('button[aria-label="إرسال"]'); await settle(); };
beforeEach(() => {
  dom = setupDom(); localStorage.clear(); app.currentTheme = theme; vi.clearAllMocks();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: clipboard.mockResolvedValue(undefined) } });
  editor = document.createElement('article'); editor.innerHTML = '<p data-block-id="b_original">نص الفقرة الأصلي</p>'; document.body.append(editor);
  service.stream.mockImplementation(async (_history, _prompt, _context, chunk) => { chunk({ text: 'راجعي الفقرة `[b_original]`', thought: 'تأمل [b_original]', rawParts: [{ text: 'راجعي [b_original]' }] }); });
});
afterEach(() => { dom.cleanup(); editor.remove(); });
it('converts legacy advisory prose visually and on copy, but sends the original IDs and raw parts in subsequent model history', async () => {
  const before = editor.outerHTML; await dom.render(view()); await settle(); await send('قولي رأيك في النص');
  expect(dom.host.textContent).toContain('نص الفقرة الأصلي'); expect(dom.host.textContent).not.toContain('b_original');
  const saved = loadStoredConversationsFromStorage('dar_alhikayat_ai_convs_story_references-A')[0].messages;
  const assistant = saved.find(m => m.role === 'assistant')!;
  expect(assistant.content).toContain('[b_original]'); expect(assistant.rawParts![0].text).toContain('[b_original]'); expect(assistant.paragraphReferences).toEqual({ b_original: 'نص الفقرة الأصلي' });
  await click('button[title="نسخ الإجابة"]');
  expect(clipboard).toHaveBeenCalled(); expect(clipboard.mock.calls.at(-1)?.[0]).toContain('نص الفقرة الأصلي'); expect(clipboard.mock.calls.at(-1)?.[0]).not.toContain('b_original');
  await send('وضحي أكتر');
  expect(service.stream.mock.calls[1][0].find((m: any) => m.role === 'assistant').content).toContain('[b_original]');
  expect(editor.outerHTML).toBe(before); expect(commit).not.toHaveBeenCalled();
});
it('keeps executive question and pending operation identifiers internal while displaying the actual paragraph', async () => {
  service.decision.mockResolvedValue({ functionCalls: [{ name: 'ask_writer', args: { question: 'هل تقصدين [b_original]؟', reason: 'AMBIGUOUS' } }, { name: 'replace_text', args: { block_id: 'b_original', target_text: 'الأصلي', new_text: 'الجديد', step_note: 'مراجعة b_original' } }] });
  const before = editor.outerHTML; await dom.render(view()); await settle(); await send('استبدل الكلمة في الفقرة');
  expect(dom.host.textContent).toContain('هل تقصدين «نص الفقرة الأصلي»'); expect(dom.host.textContent).not.toContain('b_original');
  expect(loadStoredConversationsFromStorage('dar_alhikayat_ai_convs_story_references-A')[0].messages.find(m => m.role === 'assistant')?.content).toContain('[b_original]');
  service.decision.mockResolvedValue({ functionCalls: [], text: 'لم أغيّر النص' }); await send('لا، وضحي السؤال');
  expect(service.decision.mock.calls[1][0].userPrompt).toContain('b_original');
  expect(editor.outerHTML).toBe(before); expect(commit).not.toHaveBeenCalled();
});
it('restores saved snapshots after edits and never resolves another story using the previous story text', async () => {
  await dom.render(view()); await settle(); await send('قولي رأيك');
  await dom.render(<div />); editor.innerHTML = '<p data-block-id="b_original">نص جديد في الحكاية</p>';
  await dom.render(view()); await settle();
  await click('button[aria-label="سجل محادثات هذه الحكاية"]'); await settle();
  const entry = Array.from(document.querySelectorAll('.group')).find(e => e.textContent?.includes('قولي رأيك')); expect(entry).toBeTruthy(); await click(entry as HTMLElement); await settle();
  expect(dom.host.textContent).toContain('نص الفقرة الأصلي'); expect(dom.host.textContent).not.toContain('نص جديد في الحكاية');
  await dom.render(view('references-B')); await settle(); await send('قولي رأيك');
  expect(dom.host.textContent).toContain('نص جديد في الحكاية'); expect(dom.host.textContent).not.toContain('نص الفقرة الأصلي');
});

it('does not replace request-time reference text with new typing before the first advisory response arrives', async () => {
  let chunk: any, finish: any;
  service.stream.mockImplementation((_a, _b, _c, onChunk) => new Promise(resolve => { chunk = onChunk; finish = resolve; }));
  await dom.render(view()); await settle(); await send('قولي رأيك');
  editor.querySelector('p')!.textContent = 'كتابة جديدة أثناء الانتظار';
  await act(async () => { chunk({ text: 'راجعي [b_original]', thought: '', rawParts: [] }); finish(); }); await settle();
  expect(dom.host.textContent).toContain('نص الفقرة الأصلي'); expect(dom.host.textContent).not.toContain('كتابة جديدة أثناء الانتظار');
  expect(editor.textContent).toBe('كتابة جديدة أثناء الانتظار'); expect(editor.querySelector('p')!.dataset.blockId).toBe('b_original'); expect(commit).not.toHaveBeenCalled();
});
