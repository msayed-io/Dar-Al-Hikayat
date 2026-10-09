import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { AGENTIC_TOOL_DECLARATIONS } from '../lib/ai-assistant-service';
import { recoverInterruptedAnalysis } from '../lib/literary-analysis';
const legacy = JSON.parse(readFileSync('tests/fixtures/legacy-ai-contract.json', 'utf8'));
it('preserves both original instruction strings byte-for-byte and all nine old tool declarations', () => {
  const source = readFileSync('lib/ai-assistant-service.ts', 'utf8');
  for (const [name, hash] of Object.entries(legacy.prompts)) {
    const a = source.indexOf('export const ' + name + ' = `'); const b = source.indexOf('`;', a) + 2;
    expect(createHash('sha256').update(source.slice(a, b)).digest('hex')).toBe(hash);
  }
  expect(AGENTIC_TOOL_DECLARATIONS.slice(0, 9)).toEqual(legacy.oldTools);
  expect(AGENTIC_TOOL_DECLARATIONS).toHaveLength(14);
});
it('marks interrupted new analysis history honestly without altering legacy operation messages', () => {
  const edit = { role: 'agent_steps', steps: [{ toolName: 'replace_text', status: 'waiting' }] };
  expect(recoverInterruptedAnalysis(edit)).toBe(edit);
  const analysis = { role: 'agent_steps', steps: [{ toolName: 'plot_hole_detector', status: 'active' }] };
  expect(recoverInterruptedAnalysis(analysis).agentResult).toMatchObject({ completed: false, failed: true, totalMutations: 0 });
  const complete = { ...analysis, agentResult: { completed: true } }; expect(recoverInterruptedAnalysis(complete)).toBe(complete);
});
