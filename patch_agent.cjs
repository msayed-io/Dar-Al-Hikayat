const fs = require('fs');
let content = fs.readFileSync('lib/literary-agent.ts', 'utf8');

// 1. Add requestId to executeAgentPlan args
content = content.replace(
  /export async function executeAgentPlan\(\{([\s\S]*?)\}: \{([\s\S]*?)\}\): Promise<AgentExecutionResult> \{/m,
  "export async function executeAgentPlan({\n$1,\n  requestId,\n}: {\n$2;\n  requestId?: string;\n}): Promise<AgentExecutionResult> {"
);

// 2. Add requestId check for idempotency
const idempotencyCode = `
  // فحص تكرار الطلب (Idempotency)
  if (requestId && window.localStorage) {
    const executedRequests = JSON.parse(localStorage.getItem('executed_agent_requests') || '[]');
    if (executedRequests.includes(requestId)) {
      return {
        success: true,
        executedSteps: [],
        error: "تم تنفيذ هذا الطلب مسبقاً (تكرار الطلب).",
        totalMutations: 0,
        auditEntriesCount: 0,
      };
    }
  }
`;

content = content.replace(
  /if \(isAgentEditLocked\(\)\) \{/,
  idempotencyCode + "\n  if (isAgentEditLocked()) {"
);

// 3. Add to executedRequests onCommit
const commitCode = `
    if (stepItems.length > 0) {
      if (requestId && window.localStorage) {
        const executedRequests = JSON.parse(localStorage.getItem('executed_agent_requests') || '[]');
        executedRequests.push(requestId);
        // keep only last 50
        if (executedRequests.length > 50) executedRequests.shift();
        localStorage.setItem('executed_agent_requests', JSON.stringify(executedRequests));
      }
      onCommit();
    }
`;

content = content.replace(
  /if \(stepItems\.length > 0\) \{\s*onCommit\(\);\s*\}/m,
  commitCode
);

// 4. Change validation fail behavior
const newValidationFail = `
    const firstInvalid = validation.results.find((r) => !r.isValid);
    const validCount = validation.results.filter(r => r.isValid).length;
    const failCount = validation.results.length - validCount;
    
    return {
      success: false,
      executedSteps: stepItems.map((s, idx) => ({ ...s, status: validation.results[idx]?.isValid ? "completed" : "failed", stepNote: validation.results[idx]?.error || s.stepNote })),
      error: \`تم إيقاف التنفيذ الذري. نجحت محاكاة \${validCount} عملية، وفشلت \${failCount} بسبب: \${firstInvalid?.error}\`,
      totalMutations: 0,
      auditEntriesCount: 0,
    };
`;

content = content.replace(
  /const firstInvalid = validation\.results\.find\(\(r\) => !r\.isValid\);[\s\S]*?auditEntriesCount: 0,\s*\};\s*\}/m,
  newValidationFail + "\n  }"
);

fs.writeFileSync('lib/literary-agent.ts', content);
console.log('patched executeAgentPlan in literary-agent.ts');
