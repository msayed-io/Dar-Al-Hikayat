const fs = require('fs');
const content = fs.readFileSync('lib/editor-block-system.ts', 'utf8');

const regex = /export function validateBatchOperations\([\s\S]*?\)\s*:\s*\{\s*isValid:\s*boolean;\s*results:\s*ValidationItemResult\[\]\s*\}\s*\{[\s\S]*?(?=\nexport |\n\/\*\*|\Z)/m;

const replacement = `export function validateBatchOperations(
  ops: PlannedOperation[],
  rootElement?: HTMLElement | null
): { isValid: boolean; results: ValidationItemResult[] } {
  const originalRoot = rootElement || (typeof document !== "undefined" ? document.body : null);
  const results: ValidationItemResult[] = [];
  let allValid = true;

  if (!originalRoot || !(originalRoot instanceof HTMLElement)) {
    return {
      isValid: false,
      results: ops.map((op, i) => ({
        opIndex: i,
        opType: op.type,
        blockId: op.blockId,
        status: "BLOCK_NOT_FOUND",
        isValid: false,
        error: "Root element not found or not an HTMLElement",
      })),
    };
  }

  // محاكاة العمليات على نسخة مؤقتة لضمان التنفيذ الذري (Transactional Simulation)
  const simulationRoot = originalRoot.cloneNode(true) as HTMLElement;

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    let el = simulationRoot.querySelector(\`[data-block-id="\${op.blockId}"]\`);
    if (!el && simulationRoot.getAttribute("data-block-id") === op.blockId) {
      el = simulationRoot;
    }

    if (!el) {
      allValid = false;
      results.push({
        opIndex: i,
        opType: op.type,
        blockId: op.blockId,
        status: "BLOCK_NOT_FOUND",
        isValid: false,
        error: \`الفقرة "\${op.blockId}" غير موجودة.\`,
      });
      continue;
    }

    if (op.type === "REPLACE") {
      const targetText = op.targetText || "";
      const newText = op.newText || "";

      if (targetText === newText) {
        allValid = false;
        results.push({
          opIndex: i,
          opType: op.type,
          blockId: op.blockId,
          status: "IDENTICAL_REPLACEMENT",
          isValid: false,
          error: \`النص البديل مطابق تمامًا للنص المستهدف في الفقرة "\${op.blockId}".\`,
        });
        continue;
      }

      const rawText = cleanBlockRawText(el.innerHTML);
      let occurrences = 0;
      let p = rawText.indexOf(targetText);
      while (p !== -1 && targetText.length > 0) {
        occurrences++;
        p = rawText.indexOf(targetText, p + 1);
      }

      let matchType = "EXACT";
      if (occurrences === 0) {
        const normRaw = normalizeTextForMatching(rawText);
        const normTarget = normalizeTextForMatching(targetText);
        let nOcc = 0;
        let np = normRaw.indexOf(normTarget);
        while (np !== -1 && normTarget.length > 0) {
          nOcc++;
          np = normRaw.indexOf(normTarget, np + 1);
        }
        if (nOcc === 0) {
          allValid = false;
          results.push({
            opIndex: i,
            opType: op.type,
            blockId: op.blockId,
            status: "NO_MATCH_FOUND",
            isValid: false,
            error: \`النص المستهدف غير موجود في الفقرة "\${op.blockId}".\`,
          });
          continue;
        } else if (nOcc > 1) {
          allValid = false;
          results.push({
            opIndex: i,
            opType: op.type,
            blockId: op.blockId,
            status: "AMBIGUOUS_MATCH",
            isValid: false,
            error: \`النص المستهدف مكرر \${nOcc} مرات بعد التطبيع في الفقرة "\${op.blockId}".\`,
          });
          continue;
        }
        matchType = "NORMALIZED";
      } else if (occurrences > 1) {
        allValid = false;
        results.push({
          opIndex: i,
          opType: op.type,
          blockId: op.blockId,
          status: "AMBIGUOUS_MATCH",
          isValid: false,
          error: \`النص المستهدف مكرر \${occurrences} مرات في الفقرة "\${op.blockId}".\`,
        });
        continue;
      }

      // Simulation application
      const replaceResult = safelyReplaceTextInElement(el as HTMLElement, targetText, newText);
      if (!replaceResult) {
        allValid = false;
        results.push({
          opIndex: i,
          opType: op.type,
          blockId: op.blockId,
          status: "SIMULATION_FAILED",
          isValid: false,
          error: \`تعذر محاكاة استبدال النص في الفقرة "\${op.blockId}".\`,
        });
        continue;
      }
    } else if (op.type === "DELETE") {
      const parent = el.parentElement;
      if (parent) {
        const blocks = Array.from(parent.children).filter((c) => c.hasAttribute("data-block-id"));
        if (blocks.length <= 1) {
          allValid = false;
          results.push({
            opIndex: i,
            opType: op.type,
            blockId: op.blockId,
            status: "LAST_BLOCK",
            isValid: false,
            error: \`لا يمكن حذف الفقرة "\${op.blockId}" لأنها الفقرة الوحيدة المتبقية.\`,
          });
          continue;
        }
      }
      el.remove(); // Simulate delete
    } else if (op.type === "INSERT_AFTER" || op.type === "INSERT_BEFORE") {
      const newEl = document.createElement("p");
      newEl.setAttribute("data-block-id", "sim-" + Date.now());
      newEl.className = "editor-block";
      newEl.textContent = op.newText || "";
      if (op.type === "INSERT_AFTER") {
        el.after(newEl);
      } else {
        el.before(newEl);
      } // Simulate insert
    }

    results.push({
      opIndex: i,
      opType: op.type,
      blockId: op.blockId,
      status: "SUCCESS",
      isValid: true,
    });
  }

  return { isValid: allValid, results };
}
`;

const newContent = content.replace(regex, replacement + "\n\n");
fs.writeFileSync('lib/editor-block-system.ts', newContent);
console.log('validateBatchOperations replaced successfully!');
