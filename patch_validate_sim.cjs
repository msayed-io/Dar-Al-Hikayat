const fs = require('fs');
let c = fs.readFileSync('lib/editor-block-system.ts', 'utf8');

c = c.replace(/const replaceResult = safelyReplaceTextInElement\(el as HTMLElement, targetText, newText\);\s+if \(\!replaceResult\) \{/m, 
`const replaceResult = replaceTextWithinBlock(op.blockId, targetText, newText, { rootElement: simulationRoot });
      if (replaceResult.status !== "SUCCESS") {`);

fs.writeFileSync('lib/editor-block-system.ts', c);
console.log('patched sim');
