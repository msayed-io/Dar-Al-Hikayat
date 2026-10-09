/** @vitest-environment jsdom */
import { afterEach, expect, it, vi } from 'vitest';
import { generateGeminiDirectly } from '../lib/gemini-direct-client';
afterEach(() => vi.unstubAllGlobals());
it('sends real Google Search transport syntax and preserves returned citation metadata', async () => {
  const groundingMetadata = { groundingChunks: [{ web: { uri: 'https://example.org', title: 'fixture' } }] };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'جواب' }] }, groundingMetadata }] }) }));
  const result = await generateGeminiDirectly({ apiKey: 'test-only-key', useGoogleSearch: true, contents: [{ role: 'user', parts: [{ text: 'سؤال' }] }] });
  const body = JSON.parse((fetch as any).mock.calls[0][1].body); expect(body.tools).toEqual([{ google_search: {} }]); expect(result.groundingMetadata).toEqual(groundingMetadata);
});
it('keeps old function calling transport unchanged when grounding is not requested', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ functionCall: { name: 'delete_text', args: { block_id: 'b_one', step_note: 'مثال' } } }] } }] }) }));
  const tools = [{ name: 'delete_text', parameters: { type: 'OBJECT' } }];
  const result = await generateGeminiDirectly({ apiKey: 'test-only-key', contents: [], tools });
  expect(JSON.parse((fetch as any).mock.calls[0][1].body).tools).toEqual([{ functionDeclarations: tools }]); expect(result.functionCalls[0].name).toBe('delete_text'); expect(result.groundingMetadata).toBeUndefined();
});
it('does not make a new request with an already-cancelled signal', async () => {
  vi.stubGlobal('fetch', vi.fn()); const c = new AbortController(); c.abort();
  await expect(generateGeminiDirectly({ apiKey: 'test-only-key', contents: [], signal: c.signal })).rejects.toMatchObject({ name: 'AbortError' }); expect(fetch).not.toHaveBeenCalled();
});

it('skips unsupported Gemini 1.x only on the new grounded route', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'جواب' }] } }] }) }));
  await generateGeminiDirectly({ apiKey: 'test-only-key', model: 'gemini-1.5-flash', useGoogleSearch: true, contents: [] });
  expect((fetch as any).mock.calls[0][0]).toContain('gemini-3.7-flash');
});
