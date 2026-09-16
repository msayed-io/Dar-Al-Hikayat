const fs = require('fs');
let content = fs.readFileSync('lib/literary-agent.ts', 'utf8');

content = content.replace(/skipScopeCheck,\n  ,\n    requestId,/g, 'skipScopeCheck,\n    requestId,');

fs.writeFileSync('lib/literary-agent.ts', content);
console.log('fixed syntax error in literary-agent.ts');
