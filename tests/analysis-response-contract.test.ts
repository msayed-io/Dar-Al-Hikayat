/** @vitest-environment jsdom */
import { afterEach, expect, it, vi } from 'vitest';
import { analysisResponseSchema, checkAnalysisCompletion, AnalysisResponseError } from '../lib/analysis-response-contract';
import { generateGeminiDirectly } from '../lib/gemini-direct-client';
import { formatAnalysisReports } from '../lib/literary-analysis';
afterEach(() => vi.unstubAllGlobals());
it('enforces the response shape through Gemini generationConfig and preserves the real finishReason', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"summary":' }] }, finishReason: 'MAX_TOKENS' }] }) }));
  const schema = analysisResponseSchema(false);
  const response = await generateGeminiDirectly({ apiKey: 'test-only-key', includeResponseMetadata: true, contents: [], generationConfig: { responseMimeType: 'application/json', responseSchema: schema } });
  const body = JSON.parse((fetch as any).mock.calls[0][1].body);
  expect(body.generationConfig.responseSchema).toEqual(schema); expect(response.finishReason).toBe('MAX_TOKENS');
  expect(() => checkAnalysisCompletion(response)).toThrow('بلغ رد النموذج');
});
it('does not add metadata or schema to old tool requests', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ functionCall: { name: 'delete_text', args: { block_id: 'b_one' } } }] }, finishReason: 'STOP' }] }) }));
  const response = await generateGeminiDirectly({ apiKey: 'test-only-key', contents: [], tools: [{ name: 'delete_text' }] });
  expect(response.functionCalls[0].args.block_id).toBe('b_one'); expect(response).not.toHaveProperty('finishReason');
  expect(JSON.parse((fetch as any).mock.calls[0][1].body)).not.toHaveProperty('generationConfig.responseSchema');
});
it.each(['MAX_TOKENS', 'SAFETY', 'RECITATION', 'OTHER'])('rejects an incomplete response even if its text happens to be valid JSON: %s', finishReason => {
  try { checkAnalysisCompletion({ text: '{}', model: 'fixture', finishReason }); throw new Error('accepted'); } catch (error) {
    expect(error).toBeInstanceOf(AnalysisResponseError); expect((error as AnalysisResponseError).diagnostic).toEqual({ code: 'INCOMPLETE_RESPONSE', model: 'fixture', finishReason, replyCharacters: 2 });
  }
});
it('requires character data only when requested and bounds report collections', () => {
  expect(analysisResponseSchema(false).required).toEqual(['summary', 'findings']);
  expect(analysisResponseSchema(false).properties).not.toHaveProperty('storyBible');
  expect(analysisResponseSchema(true).required).toContain('storyBible');
  expect(analysisResponseSchema(false).properties.findings.maxItems).toBe(6);
});
it('renders natural response text without repeated scope, location, disclaimer, metrics or unrequested character tables', () => {
  const report: any = { tool: 'pacing_and_emotion_analyzer', summary: 'الإيقاع يتسارع في مشهد الإنقاذ.', scope: 'حكاية بدون عنوان', findings: [{ title: 'الإنقاذ', detail: 'مر بسرعة.', suggestion: 'يمكن توسيعه.', evidence: [{ blockId: 'b_x', quote: 'دخلت وصعدت', chapter: 'حكاية بدون عنوان' }, { blockId: 'b_x', quote: 'دخلت وصعدت', chapter: 'حكاية بدون عنوان' }] }], storyBible: [{ name: 'ليلى', facts: [] }], metrics: { words: 209, averageSentenceWords: 10, approximateDialoguePercent: 10 }, limitations: ['نصيحة'] };
  const text = formatAnalysisReports([report]);
  for (const word of ['النطاق:', 'الموضع:', 'حكاية بدون عنوان', 'ملاحظة:', 'مؤشرات', 'ليلى', 'b_x']) expect(text).not.toContain(word);
  expect(text.match(/دخلت وصعدت/g)).toHaveLength(1);
  expect(formatAnalysisReports([{ ...report, showMetrics: true, showStoryBible: true }])).toContain('209');
  expect(formatAnalysisReports([{ ...report, showStoryBible: true }])).toContain('ليلى');
});
