const fs = require('fs');
let content = fs.readFileSync('lib/literary-agent.ts', 'utf8');

// The file has:
// skipScopeCheck,,
//   requestId,

content = content.replace(/skipScopeCheck,,\s*requestId,/g, 'skipScopeCheck,\n  requestId,');
content = content.replace(/skipScopeCheck\?: boolean;;\s*requestId\?: string;/g, 'skipScopeCheck?: boolean;\n  requestId?: string;');

fs.writeFileSync('lib/literary-agent.ts', content);
console.log('fixed syntax error yet again in literary-agent.ts');
