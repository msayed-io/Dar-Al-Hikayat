import { describeExecution } from '../lib/agent-step-presentation';
import type { AgentStepItem } from '../lib/literary-agent';
import { describe, expect, it } from 'vitest';

const analysis = (status: AgentStepItem['status'] = 'waiting', error?: string): AgentStepItem[] => [{ id: 'a', toolName: 'pacing_and_emotion_analyzer', blockId: 'chapter', stepNote: 'الإيقاع والتوتر السردي', status, error }];
const edit = (status: AgentStepItem['status'] = 'waiting', error?: string): AgentStepItem[] => [{ id: 'e', toolName: 'replace_text', blockId: 'b_one', stepNote: 'استبدال نص', status, error }];

describe('truthful execution tree state', () => {
  it('does not call a restored/persisted unfinished job active', () => {
    const view = describeExecution(analysis('waiting'), undefined, false);
    expect(view.state).toBe('interrupted'); expect(view.running).toBe(false); expect(view.header).toContain('انقطع'); expect(view.rows[0]).toContain('لم تُنفذ');
  });
  it('distinguishes waiting, active and finished read-only analysis', () => {
    expect(describeExecution(analysis('waiting'), undefined, true)).toMatchObject({ state: 'waiting', running: false, busy: true });
    expect(describeExecution(analysis('active'), undefined, true)).toMatchObject({ state: 'running', running: true, header: 'جارٍ فحص النص…' });
    expect(describeExecution(analysis('completed'), { completed: true, totalMutations: 0 }, false)).toMatchObject({ state: 'completed', running: false, terminal: 'اكتمل الفحص' });
  });
  it('reports the exact failed step and does not claim execution continued', () => {
    const view = describeExecution(edit('failed', 'لم يتم العثور على الفقرة b_one.'), { completed: false, failed: true, totalMutations: 0, error: 'لم يتم العثور على الفقرة b_one.' }, false);
    expect(view.state).toBe('failed'); expect(view.running).toBe(false); expect(view.rows[0]).toContain('تعذرت الخطوة'); expect(view.rows[0]).toContain('لم يتم العثور'); expect(view.header).not.toContain('جارٍ');
  });
  it('represents clarification and duplicate results without pretending to execute', () => {
    expect(describeExecution(edit(), { completed: false, totalMutations: 0, awaitingClarification: true }, false)).toMatchObject({ state: 'awaiting', running: false, terminal: 'بانتظار الإجابة' });
    expect(describeExecution(edit(), { completed: false, failed: true, skipped: true, totalMutations: 0 }, false)).toMatchObject({ state: 'skipped', running: false, terminal: 'لم يُعد التنفيذ' });
  });
});
