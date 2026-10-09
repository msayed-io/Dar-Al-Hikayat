/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const transport = vi.hoisted(() => ({ key: '', direct: vi.fn() }));
vi.mock('../lib/smart-key-rotator', () => ({ executeWithSmartRotation: (fn: any) => fn(transport.key), AllKeysExhaustedError: class extends Error {}, NoActiveKeysConfiguredError: class extends Error {}, isNetworkConnectionError: () => false, isRateLimitError: () => false, isInvalidKeyError: () => false }));
vi.mock('../lib/gemini-direct-client', () => ({ generateGeminiDirectly: transport.direct, GEMINI_PRIMARY_MODEL: 'model-under-test', buildReasoningConfig: () => ({}) }));
import { ANALYSIS_TOOLS, captureAnalysisScope, detectAnalysisCalls, formatAnalysisReports, groundedReference, pacingMetrics, parseAnalysisReport, requestAnalysisModel, validAnalysisTarget } from '../lib/literary-analysis';
import { executeAgentPlan } from '../lib/literary-agent';
import { globalAuditLog, acquireAgentEditLock, releaseAgentEditLock, isAgentEditLocked } from '../lib/editor-block-system';
import { requestExecutiveDecision } from '../lib/ai-assistant-service';
let root: HTMLElement;
const raw = { summary: 'فحص محدود بالعينة.', findings: [{ title: 'ملاحظة اختيارية', detail: 'وصف مسند.', suggestion: 'راجعي السياق.', evidence: [{ blockId: 'b_one', quote: 'عينا سلمى خضراوان.' }] }], storyBible: [{ name: 'سلمى', facts: [{ fact: 'عيناها خضراوان في هذا الموضع.', evidence: [{ blockId: 'b_one', quote: 'عينا سلمى خضراوان.' }] }] }] };
const call = (name: keyof typeof ANALYSIS_TOOLS, args: any = { target: 'chapter' }): any => ({ name, args: { ...args, step_note: 'تحليل للقراءة فقط' } });
const response = (data: any = raw) => ({ text: JSON.stringify(data), model: 'fixture-model' });
const send = (calls: any[], extra: any = {}) => { const onCommit = vi.fn(); const onStepUpdate = vi.fn(); return { onCommit, onStepUpdate, result: executeAgentPlan({ rootElement: root, rawCalls: calls, onCommit, onStepUpdate, ...extra }) }; };
beforeEach(() => {
  document.body.innerHTML = '<main id="story"><p data-block-id="b_one"><strong>عينا سلمى خضراوان.</strong></p><p data-block-id="b_two">قالت سلمى: «سأعود غداً».</p></main>';
  root = document.querySelector('main')!; transport.key = ''; vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => response() }));
});
afterEach(() => { releaseAgentEditLock(root); vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('readonly analysis execution', () => {
  it.each(Object.keys(ANALYSIS_TOOLS).filter(n => n !== 'historical_and_cultural_reference_agent'))('%s actually calls the model and returns validated evidence without a DOM commit', async name => {
    const before = root.innerHTML; const nodes = [...root.childNodes]; const audit = vi.spyOn(globalAuditLog, 'record');
    const job = send([call(name as any)]); const result = await job.result;
    expect(fetch).toHaveBeenCalledTimes(1); expect(result.success).toBe(true); expect(result.totalMutations).toBe(0);
    expect(result.analysisReports?.[0].findings[0].evidence[0].quote).toBe('عينا سلمى خضراوان.');
    expect(job.onCommit).not.toHaveBeenCalled(); expect(root.innerHTML).toBe(before); expect([...root.childNodes]).toEqual(nodes); expect(isAgentEditLocked()).toBe(false);
    expect(audit.mock.calls.some(([entry]) => entry.type === 'ANALYSIS' && entry.status === 'SUCCESS')).toBe(true);
    expect(audit.mock.calls.some(([entry]) => entry.type === 'REPLACE' || entry.type === 'BATCH_BEGIN')).toBe(false);
    const payload = JSON.parse((fetch as any).mock.calls[0][1].body); expect(payload.tools).toBeUndefined(); expect(payload.responseMimeType).toBe('application/json');
    expect(result.analysisReports?.[0].model).toBe('fixture-model');
  });
  it('supplies fresh cross-chapter evidence, not cached facts from a different story', async () => {
    root.innerHTML = '<section data-chapter-id="c1"><p data-block-id="b_one">عينا سلمى خضراوان.</p></section><section data-chapter-id="c2"><p data-block-id="b_two">عينا سلمى زرقاوان.</p></section>';
    const blocks = captureAnalysisScope(root, 'story', { chapters: [{ id: 'c1', title: 'الأول', content: '<p>قديم</p>' }, { id: 'c2', title: 'الثاني', content: '<p>قديم</p>' }] }).blocks;
    expect(blocks.map(b => b.id)).toEqual(['c1:b_one', 'c2:b_two']); expect(blocks.map(b => b.text)).toContain('عينا سلمى زرقاوان.');
    expect(() => captureAnalysisScope(root, 'chapter')).toThrow('الفصل المقصود');
    expect(captureAnalysisScope(root, 'chapter', { activeChapterId: 'c2' }).blocks[0].text).toBe('عينا سلمى زرقاوان.');
    root.innerHTML = '<p data-block-id="b_new">عمل مستقل تماماً</p>';
    expect(captureAnalysisScope(root, 'chapter').blocks.map(b => b.text).join('')).not.toContain('سلمى');
  });
  it('honors a selected paragraph without unrelated paragraphs', async () => {
    await send([call('voice_and_tone_guardian', { target: 'b_one' })]).result;
    const payload = JSON.parse((fetch as any).mock.calls[0][1].body); const input = JSON.parse(payload.contents[0].parts[0].text);
    expect(input.blocks).toHaveLength(1); expect(input.blocks[0].id).toBe('b_one');
  });
  it.each(['', 'not-an-id', ' b_one ', 'b_a\"]', 'chapter '])('rejects invalid scope %j before any API call', async target => {
    expect(validAnalysisTarget(target)).toBe(false);
    const job = send([call('plot_hole_detector', { target })]); expect((await job.result).success).toBe(false); expect(fetch).not.toHaveBeenCalled(); expect(job.onCommit).not.toHaveBeenCalled();
  });
  it('rejects missing/duplicate targets, empty documents and excessive scope without silent truncation', () => {
    expect(() => captureAnalysisScope(root, 'b_missing')).toThrow();
    root.innerHTML += '<p data-block-id="b_one">مكرر</p>'; expect(() => captureAnalysisScope(root, 'b_one')).toThrow();
    root.innerHTML = ''; expect(() => captureAnalysisScope(root, 'chapter')).toThrow();
    root.textContent = 'ن'.repeat(120001); expect(() => captureAnalysisScope(root, 'chapter')).toThrow('120');
  });
  it('rejects fabricated quotations and missing Story Bible instead of declaring success', async () => {
    (fetch as any).mockResolvedValue({ ok: true, json: async () => response({ ...raw, findings: [{ ...raw.findings[0], evidence: [{ blockId: 'b_one', quote: 'اقتباس غير موجود' }] }] }) });
    const job = send([call('plot_hole_detector')]); const result = await job.result;
    expect(result.success).toBe(false); expect(result.executedSteps[0].status).toBe('failed'); expect(job.onCommit).not.toHaveBeenCalled();
    expect(() => parseAnalysisReport(JSON.stringify({ summary: 'نص', findings: [] }), 'character_continuity_checker', captureAnalysisScope(root, 'chapter').blocks)).toThrow('سجل الشخصيات');
  });
  it('does not swallow provider errors or malformed JSON', async () => {
    (fetch as any).mockResolvedValueOnce({ ok: false, status: 500 }).mockResolvedValueOnce({ ok: true, json: async () => ({ text: 'not JSON' }) });
    expect((await send([call('pacing_and_emotion_analyzer')]).result).success).toBe(false);
    expect((await send([call('pacing_and_emotion_analyzer')]).result).success).toBe(false);
  });
  it('does not undo user typing that happened while awaiting analysis', async () => {
    let resolve: any; (fetch as any).mockImplementation(() => new Promise(r => { resolve = r; }));
    const job = send([call('plot_hole_detector')]); root.querySelector('strong')!.textContent = 'كتابة جديدة للمستخدم';
    resolve({ ok: true, json: async () => response() }); const result = await job.result;
    expect(result.success).toBe(false); expect(result.error).toContain('تغير النص'); expect(root.textContent).toContain('كتابة جديدة'); expect(job.onCommit).not.toHaveBeenCalled();
  });
  it('does not mix analysis with editing or run while an existing editor lock is held', async () => {
    const before = root.innerHTML;
    const edit: any = { name: 'delete_text', args: { block_id: 'b_one', step_note: 'حذف' } };
    expect((await send([call('plot_hole_detector'), edit]).result).success).toBe(false); expect(root.innerHTML).toBe(before); expect(fetch).not.toHaveBeenCalled();
    acquireAgentEditLock(root); expect((await send([call('plot_hole_detector')]).result).success).toBe(false); expect(isAgentEditLocked()).toBe(true);
  });
  it('allows a read-only retry with the same request id rather than storing a fake edit commit', async () => {
    const c = call('plot_hole_detector'); await send([c], { requestId: 'same' }).result; await send([c], { requestId: 'same' }).result;
    expect(fetch).toHaveBeenCalledTimes(2); expect(localStorage.getItem('executed_agent_requests')).toBeNull();
  });
  it('honors abort and timeout even for an unresponsive transport', async () => {
    vi.useFakeTimers(); (fetch as any).mockImplementation(() => new Promise(() => {}));
    const control = new AbortController(); const first = send([call('plot_hole_detector')], { analysisSignal: control.signal }); control.abort(); expect((await first.result).success).toBe(false);
    const next = send([call('plot_hole_detector')]); await vi.advanceTimersByTimeAsync(100001); expect((await next.result).success).toBe(false); expect(isAgentEditLocked()).toBe(false);
  });
  it('computes transparent approximate metrics and formats sources/evidence', () => {
    expect(pacingMetrics('قالت: «أنا هنا».')).toMatchObject({ words: 3, quotedDialogueWords: 2, approximateDialoguePercent: 67 });
    const report: any = { tool: 'plot_hole_detector', scope: 'الفصل', ...raw, limitations: ['ليس حكماً قطعياً'], model: 'fixture' };
    const markdown = formatAnalysisReports([report]); expect(markdown).toContain('دون تغيير النص'); expect(markdown).toContain('عينا سلمى خضراوان.'); expect(markdown).toContain('b\\_one');
  });
});
describe('real reference data contract', () => {
  const grounded = { text: 'تأسست القاهرة سنة 969 ميلادية.', model: 'fixture-grounded', groundingMetadata: { groundingChunks: [{ web: { uri: 'https://example.org/history', title: 'مرجع اختباري' } }], groundingSupports: [{ segment: { text: 'تأسست القاهرة سنة 969 ميلادية.' }, groundingChunkIndices: [0] }], searchEntryPoint: { renderedContent: '<div>Google search suggestions fixture</div>' } } };
  it('makes a grounded request, returns only supported passages and carries search attribution', async () => {
    (fetch as any).mockResolvedValue({ ok: true, json: async () => grounded });
    const job = send([call('historical_and_cultural_reference_agent', { query: 'متى تأسست القاهرة؟' })]); const result = await job.result;
    expect(result.success).toBe(true); expect(job.onCommit).not.toHaveBeenCalled();
    const body = JSON.parse((fetch as any).mock.calls[0][1].body); expect(body.useGoogleSearch).toBe(true); expect(body.responseMimeType).toBeUndefined(); expect(JSON.stringify(body)).not.toContain('عينا سلمى');
    expect(result.analysisReports![0].verification).toBe('grounded'); expect(result.analysisReports![0].sources![0].url).toBe('https://example.org/history'); expect(result.analysisReports![0].searchSuggestionsHtml).toContain('Google');
  });
  it('does not promote an unsourced or fabricated source to successful verification', async () => {
    (fetch as any).mockResolvedValue({ ok: true, json: async () => ({ text: 'تم التأكد من المصدر https://invented.example' }) });
    const result = await send([call('historical_and_cultural_reference_agent', { query: 'تاريخ القاهرة' })]).result;
    expect(result.success).toBe(false); expect(result.analysisReports![0].verification).toBe('unverified'); expect(result.analysisReports![0].summary).not.toContain('invented');
    expect(groundedReference({ ...grounded, groundingMetadata: { ...grounded.groundingMetadata, groundingChunks: [{ web: { uri: 'javascript:alert(1)' } }] } }).verification).toBe('unverified');
    expect(groundedReference({ ...grounded, text: 'نص آخر' }).verification).toBe('unverified');
  });
  it('uses the direct path with configured keys, including the search flag and abort signal', async () => {
    transport.key = 'test-only-key'; transport.direct.mockResolvedValue(grounded);
    await requestAnalysisModel('تعليمات', 'سؤال', true);
    expect(fetch).not.toHaveBeenCalled(); expect(transport.direct.mock.calls[0][0]).toMatchObject({ useGoogleSearch: true, apiKey: 'test-only-key' }); expect(transport.direct.mock.calls[0][0].signal).toBeInstanceOf(AbortSignal);
  });
  it('does not treat a search-specific permission or quota failure as a reason to disable old-tool keys', async () => {
    transport.key = 'test-only-key'; transport.direct.mockRejectedValue(Object.assign(new Error('permission denied'), { status: 403 }));
    await expect(requestAnalysisModel('تعليمات', 'سؤال', true)).rejects.toMatchObject({ message: expect.stringContaining('لم أغيّر حالة المفتاح') });
    transport.direct.mockRejectedValue(Object.assign(new Error('quota'), { status: 429 }));
    await expect(requestAnalysisModel('تعليمات', 'سؤال', true)).rejects.not.toHaveProperty('status', 429);
  });
  it('does not present an invalid new tool call as a completed plain-text answer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ text: 'تم الفحص', functionCalls: [call('plot_hole_detector', 'wrong-scope')] }) }));
    const result = await requestExecutiveDecision({ contents: [] });
    expect(result.functionCalls).toEqual([]); expect(result.text).toBe(''); expect(result.error).toContain('تعذر تحديد نطاق');
  });
  it('validates the new executive schemas without dropping the nine old tools', async () => {
    transport.key = 'test-only-key'; transport.direct.mockResolvedValue({ text: '', model: 'fixture', functionCalls: [call('plot_hole_detector', { target: 'story' }), call('plot_hole_detector', { target: '   ' }), { name: 'replace_text', args: { block_id: 'b_one', target_text: 'سلمى', new_text: 'ليلى', step_note: 'تغيير الاسم' } }] });
    const result = await requestExecutiveDecision({ contents: [] }); expect(result.functionCalls.map(c => c.name)).toEqual(['plot_hole_detector', 'replace_text']);
  });
});
describe('additive routing', () => {
  it.each([['راجع استمرارية الشخصيات في الرواية', 'character_continuity_checker'], ['حلل الإيقاع والتوتر', 'pacing_and_emotion_analyzer'], ['اكشف ثغرات الحبكة', 'plot_hole_detector'], ['راجع الصوت الأدبي', 'voice_and_tone_guardian'], ['تحقق من دقة هذه المعلومة التاريخية', 'historical_and_cultural_reference_agent']])('routes %s to %s', (message, name) => {
    expect(detectAnalysisCalls(message)[0].name).toBe(name);
  });
  it('keeps unrelated editing/advice requests on their original route and honors explicit negation', () => {
    for (const message of ['استبدل اسم سلمى بليلى', 'احذف الفقرة', 'اقترح عنواناً', 'راجع النص', 'لا تحلل الإيقاع']) expect(detectAnalysisCalls(message)).toEqual([]);
    expect(detectAnalysisCalls('حلل الإيقاع', [{ blockId: 'b_one' }])[0].args).toMatchObject({ target: 'b_one' });
    expect(detectAnalysisCalls('حلل الشخصيات في الرواية')[0].args).toMatchObject({ target: 'story' });
  });
});
