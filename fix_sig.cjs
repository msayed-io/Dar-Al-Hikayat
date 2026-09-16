const fs = require('fs');
let c = fs.readFileSync('lib/literary-agent.ts', 'utf8');

c = c.replace(/export async function executeAgentPlan\(\{[\s\S]*?\}\): Promise<AgentExecutionResult> \{/m, 
`export async function executeAgentPlan({
  rootElement,
  rawCalls,
  onStepUpdate,
  onCommit,
  accentColor = "#D97706",
  skipScopeCheck,
  requestId,
}: {
  rootElement: HTMLElement | null;
  rawCalls: ExecutiveToolCall[];
  onStepUpdate: (steps: AgentStepItem[]) => void;
  onCommit: () => void;
  accentColor?: string;
  skipScopeCheck?: boolean;
  requestId?: string;
}): Promise<AgentExecutionResult> {`);

fs.writeFileSync('lib/literary-agent.ts', c);
