const fs = require('fs');
let content = fs.readFileSync('lib/literary-agent.ts', 'utf8');

content = content.replace(/skipScopeCheck,,\n  requestId,/g, 'skipScopeCheck,\n  requestId,');
content = content.replace(/skipScopeCheck\?: boolean;;\n  requestId\?: string;/g, 'skipScopeCheck?: boolean;\n  requestId?: string;');

fs.writeFileSync('lib/literary-agent.ts', content);
console.log('fixed syntax error again in literary-agent.ts');
