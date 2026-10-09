/** Provider-enforced output contract; not a repair of or guessed completion of model text. */
const string = { type: 'STRING' };
const evidence = { type: 'ARRAY', minItems: 1, maxItems: 4, items: { type: 'OBJECT', properties: { blockId: string, quote: string }, required: ['blockId', 'quote'] } };
export function analysisResponseSchema(includeCharacters: boolean) {
  return {
    type: 'OBJECT',
    properties: {
      summary: { type: 'STRING', description: 'إجابة موجزة مباشرة على طلب الكاتبة؛ ليست إعادة سرد للقصة.' },
      findings: { type: 'ARRAY', maxItems: 6, items: { type: 'OBJECT', properties: { title: string, detail: string, suggestion: string, evidence }, required: ['title', 'detail', 'suggestion', 'evidence'] } },
      ...(includeCharacters ? { storyBible: { type: 'ARRAY', maxItems: 8, items: { type: 'OBJECT', properties: { name: string, facts: { type: 'ARRAY', maxItems: 3, minItems: 1, items: { type: 'OBJECT', properties: { fact: string, evidence }, required: ['fact', 'evidence'] } } }, required: ['name', 'facts'] } } } : {}),
    },
    required: ['summary', 'findings', ...(includeCharacters ? ['storyBible'] : [])],
  };
}
export type AnalysisDiagnostic = { code: 'JSON_INVALID' | 'INCOMPLETE_RESPONSE'; model: string; finishReason: string; replyCharacters: number };
export class AnalysisResponseError extends Error {
  constructor(message: string, readonly diagnostic: AnalysisDiagnostic) { super(message); this.name = 'AnalysisResponseError'; }
}
export function checkAnalysisCompletion(raw: { text?: string; model?: string; finishReason?: string }) {
  if (raw.finishReason && raw.finishReason !== 'STOP') {
    const explanation = raw.finishReason === 'MAX_TOKENS' ? 'بلغ رد النموذج حد المخرجات قبل اكتماله.' : 'أنهت الخدمة الرد دون نتيجة مكتملة.';
    throw new AnalysisResponseError(explanation + ' لم يُعتمد تحليل ناقص، ولم يتغير النص.', {
      code: 'INCOMPLETE_RESPONSE', model: raw.model || 'unknown', finishReason: raw.finishReason, replyCharacters: raw.text?.length || 0,
    });
  }
}
