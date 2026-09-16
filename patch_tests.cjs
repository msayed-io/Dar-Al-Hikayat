const fs = require('fs');
let c = fs.readFileSync('tests/editor.test.ts', 'utf8');

c = c.replace(/global\.HTMLElement = dom\.window\.HTMLElement;/m, 
`global.HTMLElement = dom.window.HTMLElement;
    (global as any).NodeFilter = dom.window.NodeFilter;
    global.Node = dom.window.Node;`);

fs.writeFileSync('tests/editor.test.ts', c);
