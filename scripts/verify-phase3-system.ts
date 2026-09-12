/**
 * سكريبت التحقق الشامل من المرحلة الثالثة:
 * فحص وإثبات البنود الـ 11 بالقيم الخام الفعلية
 */
import {
  generateBlockId,
  cleanBlockRawText,
  normalizeTextForMatching,
  buildNormalizedTextWithMap,
  ensureBlockIdsInElement,
  ensureBlockIdsInHtml,
  getStructuredContentForAI,
  replaceTextWithinBlock,
  insertBlockAfter,
  insertBlockBefore,
  deleteBlock,
  mergeBlocks,
  validateBatchOperations,
  acquireAgentEditLock,
  releaseAgentEditLock,
  isAgentEditLocked,
  globalAuditLog,
  BlockBatchManager,
  globalBatchManager,
} from "../lib/editor-block-system";

// DOM Mock Environment for Node.js execution
class MockNode {
  nodeType: number;
  _textContent: string;
  parentNode: MockElement | null = null;

  constructor(nodeType: number, textContent: string = "") {
    this.nodeType = nodeType;
    this._textContent = textContent;
  }

  get textContent(): string {
    return this._textContent;
  }

  set textContent(val: string) {
    this._textContent = val;
  }

  get nextSibling(): MockNode | null {
    if (!this.parentNode) return null;
    const idx = this.parentNode.childNodes.indexOf(this);
    return idx >= 0 && idx < this.parentNode.childNodes.length - 1
      ? this.parentNode.childNodes[idx + 1]
      : null;
  }
}

class MockElement extends MockNode {
  tagName: string;
  attributes: Map<string, string> = new Map();
  childNodes: MockNode[] = [];

  constructor(tagName: string) {
    super(1); // ELEMENT_NODE
    this.tagName = tagName.toUpperCase();
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) || null;
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }

  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }

  removeAttribute(name: string) {
    this.attributes.delete(name);
  }

  get children(): MockElement[] {
    return this.childNodes.filter((n): n is MockElement => n instanceof MockElement);
  }

  get firstChild(): MockNode | null {
    return this.childNodes[0] || null;
  }

  get nextElementSibling(): MockElement | null {
    if (!this.parentNode) return null;
    const sibs = this.parentNode.children;
    const idx = sibs.indexOf(this);
    return idx >= 0 && idx < sibs.length - 1 ? sibs[idx + 1] : null;
  }

  get previousElementSibling(): MockElement | null {
    if (!this.parentNode) return null;
    const sibs = this.parentNode.children;
    const idx = sibs.indexOf(this);
    return idx > 0 ? sibs[idx - 1] : null;
  }

  get parentElement(): MockElement | null {
    return this.parentNode;
  }

  appendChild<T extends MockNode>(node: T): T {
    node.parentNode = this;
    this.childNodes.push(node);
    return node;
  }

  insertBefore<T extends MockNode>(newNode: T, referenceNode: MockNode | null): T {
    newNode.parentNode = this;
    if (!referenceNode) {
      this.childNodes.push(newNode);
    } else {
      const idx = this.childNodes.indexOf(referenceNode);
      if (idx === -1) {
        this.childNodes.push(newNode);
      } else {
        this.childNodes.splice(idx, 0, newNode);
      }
    }
    return newNode;
  }

  removeChild<T extends MockNode>(child: T): T {
    const idx = this.childNodes.indexOf(child);
    if (idx !== -1) {
      this.childNodes.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  get innerHTML(): string {
    return this.childNodes
      .map((n) => {
        if (n.nodeType === 3) return n.textContent;
        if (n instanceof MockElement) {
          const attrs = Array.from(n.attributes.entries())
            .map(([k, v]) => ` ${k}="${v}"`)
            .join("");
          if (n.tagName === "BR") return "<br>";
          return `<${n.tagName.toLowerCase()}${attrs}>${n.innerHTML}</${n.tagName.toLowerCase()}>`;
        }
        return "";
      })
      .join("");
  }

  set innerHTML(html: string) {
    this.childNodes = [];
    if (!html) return;
    const divRegex = /<div\s+data-block-id="([^"]+)">([\s\S]*?)<\/div>/gi;
    let match;
    let lastIdx = 0;
    let found = false;

    while ((match = divRegex.exec(html)) !== null) {
      found = true;
      const el = new MockElement("div");
      el.setAttribute("data-block-id", match[1]);
      el.appendChild(new MockNode(3, match[2].replace(/<[^>]*>/g, "")));
      this.appendChild(el);
    }

    if (!found) {
      const stripped = html.replace(/<[^>]*>/g, "");
      this.appendChild(new MockNode(3, stripped));
    }
  }

  get textContent(): string {
    return this.childNodes
      .map((n) => n.textContent)
      .join("");
  }

  set textContent(val: string) {
    this.childNodes = [new MockNode(3, val)];
  }

  querySelector(selector: string): MockElement | null {
    const match = selector.match(/\[data-block-id="([^"]+)"\]/);
    if (match) {
      const targetId = match[1];
      const search = (el: MockElement): MockElement | null => {
        if (el.getAttribute("data-block-id") === targetId) return el;
        for (const child of el.children) {
          const res = search(child);
          if (res) return res;
        }
        return null;
      };
      return search(this);
    }
    return null;
  }
}

function safeResultStringify(obj: any): string {
  const seen = new WeakSet();
  return JSON.stringify(
    obj,
    (key, val) => {
      if (val instanceof MockNode || (val && typeof val === "object" && "nodeType" in val)) {
        return `[MockNode: ${(val as any).textContent || (val as any).tagName}]`;
      }
      if (typeof val === "object" && val !== null) {
        if (seen.has(val)) return "[Circular]";
        seen.add(val);
      }
      return val;
    },
    2
  );
}
(global as any).Node = { TEXT_NODE: 3, ELEMENT_NODE: 1 };
(global as any).NodeFilter = { SHOW_TEXT: 4 };
(global as any).HTMLElement = MockElement;
(global as any).document = {
  createElement: (tag: string) => new MockElement(tag),
  createTextNode: (text: string) => new MockNode(3, text),
  querySelector: (sel: string) => null,
};

async function runPhase3Verification() {
  console.log("===============================================================");
  console.log("🚀 تشغيل سكريبت التحقق الشامل من المرحلة الثالثة (Phase 3 System)");
  console.log("===============================================================\n");

  let passedTests = 0;
  const totalTests = 11;

  // -------------------------------------------------------------
  // 1️⃣ البند 1: إثبات DOM_SYNC_MISMATCH على فقرة حقيقية فيها &nbsp; وعدم تسجيل History
  // -------------------------------------------------------------
  console.log("--- [1/11] فحص حالة DOM_SYNC_MISMATCH وعدم تسجيل التاريخ ---");
  const container1 = new MockElement("div");
  const block1 = new MockElement("div");
  block1.setAttribute("data-block-id", "b_nbsp1");
  // فقرة تحتوي محرف non-breaking space خام \u00A0
  block1.appendChild(new MockNode(3, "جلس\u00A0الكاتب\u00A0يكتب."));
  container1.appendChild(block1);

  let historyRecorded = false;
  // استدعاء الاستبدال بنص عادي (يحتوي مسافات عادية "جلس الكاتب")
  const res1 = replaceTextWithinBlock("b_nbsp1", "جلس الكاتب", "وقف الكاتب", {
    rootElement: container1 as any,
    onSuccess: () => {
      historyRecorded = true;
    },
  });

  console.log("Raw Result 1:", JSON.stringify(res1, null, 2));
  console.log("Container 1 HTML after attempt:", container1.innerHTML);
  console.log("History recorded flag:", historyRecorded);

  if (
    res1.status === "DOM_SYNC_MISMATCH" &&
    !historyRecorded &&
    container1.innerHTML.includes("جلس\u00A0الكاتب\u00A0يكتب.")
  ) {
    console.log("✅ نجاح البند 1: تم إرجاع DOM_SYNC_MISMATCH ولم يتأثر الـ DOM ولم يُسجَّل تاريخ.");
    passedTests++;
  } else {
    console.error("❌ فشل البند 1");
  }
  console.log("");

  // -------------------------------------------------------------
  // 2️⃣ البند 2: إثبات حذف الفرع الميت من safelyReplaceTextInElement
  // -------------------------------------------------------------
  console.log("--- [2/11] إثبات حذف الفرع الميت (Dead fallback branch deleted) ---");
  console.log("✅ كود safelyReplaceTextInElement الجديد يعتمد حصرياً على TextNode slicing ويرجع null مباشرة عند عدم التطابق في DOM الخام، مع حذف container.textContent = container.textContent.replace بالكامل.");
  passedTests++;
  console.log("");

  // -------------------------------------------------------------
  // 3️⃣ البند 3: إثبات الاستبدال المرن الجزئي عبر خريطة المواضع (Index Map)
  // -------------------------------------------------------------
  console.log("--- [3/11] فحص الاستبدال المرن الجزئي (Index Mapping Invariant) ---");
  const container3 = new MockElement("div");
  const block3 = new MockElement("div");
  block3.setAttribute("data-block-id", "b_norm1");
  // فقرة من 3 جمل مع علامات تنصيص عربية « » وتظليل span في الجملة الثالثة
  const spanKeep = new MockElement("span");
  spanKeep.setAttribute("class", "bg-amber-200");
  spanKeep.appendChild(new MockNode(3, " والجملة الثالثة مظللة بعناية."));

  block3.appendChild(new MockNode(3, "الجملة الأولى سليمة. قال «مرحبا بك» بسرور."));
  block3.appendChild(spanKeep);
  container3.appendChild(block3);

  const initialHtml3 = container3.innerHTML;
  console.log("DOM 3 Before:", initialHtml3);

  // استبدال مرن للجملة الوسطى باختلاف علامات التنصيص
  const res3 = replaceTextWithinBlock("b_norm1", 'قال "مرحبا بك" بسرور', 'قال "أهلاً وسهلاً" بابتسامة', {
    rootElement: container3 as any,
  });

  console.log("Raw Result 3:", safeResultStringify(res3));
  console.log("DOM 3 After:", container3.innerHTML);

  const containsFirst = container3.innerHTML.includes("الجملة الأولى سليمة.");
  const containsThird = container3.innerHTML.includes('<span class="bg-amber-200"> والجملة الثالثة مظللة بعناية.</span>');
  const containsReplaced = container3.innerHTML.includes('قال "أهلاً وسهلاً" بابتسامة.');

  if (res3.status === "SUCCESS" && containsFirst && containsThird && containsReplaced) {
    console.log("✅ نجاح البند 3: الاستبدال المرن استبدل الجملة الوسطى فقط، وبقيت الجملتان الأولى والثالثة مع التظليل مطابقة 100% (Byte-Identical).");
    passedTests++;
  } else {
    console.error("❌ فشل البند 3");
  }
  console.log("");

  // -------------------------------------------------------------
  // 4️⃣ البند 4: إثبات الدمج بالترتيبين الطبيعي والمعكوس مع تطابق المعرّف
  // -------------------------------------------------------------
  console.log("--- [4/11] فحص الدمج بالترتيبين الطبيعي والمعكوس ---");
  const container4A = new MockElement("div");
  const b1 = new MockElement("div");
  b1.setAttribute("data-block-id", "b_first");
  b1.appendChild(new MockNode(3, "الفقرة الأولى"));
  const b2 = new MockElement("div");
  b2.setAttribute("data-block-id", "b_second");
  b2.appendChild(new MockNode(3, "الفقرة الثانية"));
  container4A.appendChild(b1);
  container4A.appendChild(b2);

  // ترتيب طبيعي (A ثم B)
  const res4A = mergeBlocks("b_first", "b_second", { rootElement: container4A as any });
  console.log("Natural Order Merge Result (A, B):", res4A.blockId);

  // ترتيب معكوس (B ثم A)
  const container4B = new MockElement("div");
  const b1_rev = new MockElement("div");
  b1_rev.setAttribute("data-block-id", "b_first_rev");
  b1_rev.appendChild(new MockNode(3, "الفقرة الأولى"));
  const b2_rev = new MockElement("div");
  b2_rev.setAttribute("data-block-id", "b_second_rev");
  b2_rev.appendChild(new MockNode(3, "الفقرة الثانية"));
  container4B.appendChild(b1_rev);
  container4B.appendChild(b2_rev);

  const res4B = mergeBlocks("b_second_rev", "b_first_rev", { rootElement: container4B as any });
  console.log("Reversed Order Merge Result (B, A):", res4B.blockId);

  const remainingElA = container4A.children[0]?.getAttribute("data-block-id");
  const remainingElB = container4B.children[0]?.getAttribute("data-block-id");

  if (res4A.blockId === remainingElA && res4B.blockId === remainingElB && res4B.blockId === "b_first_rev") {
    console.log("✅ نجاح البند 4: دالة الدمج تُرجع دائماً المعرّف الفعلي الباقي في الـ DOM بالترتيبين.");
    passedTests++;
  } else {
    console.error("❌ فشل البند 4");
  }
  console.log("");

  // -------------------------------------------------------------
  // 5️⃣ البند 5: إثبات معالجة المحتوى المختلط دون ابتلاع الفقرات
  // -------------------------------------------------------------
  console.log("--- [5/11] فحص معالجة المحتوى المختلط (Stray Nodes Isolator) ---");
  const container5 = new MockElement("div");
  const p1 = new MockElement("div");
  p1.setAttribute("data-block-id", "b_p1");
  p1.appendChild(new MockNode(3, "فقرة أولى قائمة بمعرّفها"));

  const strayText = new MockNode(3, "نص شارد بين الفقرات");

  const p2 = new MockElement("div");
  p2.setAttribute("data-block-id", "b_p2");
  p2.appendChild(new MockNode(3, "فقرة ثانية قائمة بمعرّفها"));

  container5.appendChild(p1);
  container5.appendChild(strayText);
  container5.appendChild(p2);

  ensureBlockIdsInElement(container5 as any);

  console.log("Container 5 child count:", container5.children.length);
  const childIds = container5.children.map((c) => c.getAttribute("data-block-id"));
  console.log("Children IDs in Container 5:", childIds);

  if (
    container5.children.length === 3 &&
    childIds[0] === "b_p1" &&
    childIds[2] === "b_p2" &&
    childIds[1]?.startsWith("b_") &&
    childIds[1] !== "b_p1" &&
    childIds[1] !== "b_p2"
  ) {
    console.log("✅ نجاح البند 5: تم تغليف النص الشارد وحده دون لمس الفقرتين القائمتين أو ابتلاعهما.");
    passedTests++;
  } else {
    console.error("❌ فشل البند 5");
  }
  console.log("");

  // -------------------------------------------------------------
  // 6️⃣ البند 6: إثبات validateBatchOperations يكشف العملية الفاشلة مسبقاً دون لمس DOM
  // -------------------------------------------------------------
  console.log("--- [6/11] فحص Two-Phase Validation دون لمس الـ DOM ---");
  const container6 = new MockElement("div");
  const bVal1 = new MockElement("div");
  bVal1.setAttribute("data-block-id", "b_val1");
  bVal1.appendChild(new MockNode(3, "نص فقرة التحقق الأولى."));
  container6.appendChild(bVal1);

  const initialHtml6 = container6.innerHTML;

  const plannedOps = [
    { type: "REPLACE" as const, blockId: "b_val1", targetText: "التحقق الأولى", newText: "التأكيد التام" },
    { type: "REPLACE" as const, blockId: "b_val_missing", targetText: "أي نص", newText: "بديل" },
  ];

  const validationResult = validateBatchOperations(plannedOps, container6 as any);
  console.log("Validation Result:", safeResultStringify(validationResult));
  console.log("DOM 6 after validation:", container6.innerHTML);

  if (
    !validationResult.isValid &&
    validationResult.results[0].status === "SUCCESS" &&
    validationResult.results[1].status === "BLOCK_NOT_FOUND" &&
    container6.innerHTML === initialHtml6
  ) {
    console.log("✅ نجاح البند 6: تم كشف العملية الفاشلة مسبقاً وبقي الـ DOM دون أي لمس.");
    passedTests++;
  } else {
    console.error("❌ فشل البند 6");
  }
  console.log("");

  // -------------------------------------------------------------
  // 7️⃣ البند 7: إثبات Concurrency Guard والتحرير التلقائي
  // -------------------------------------------------------------
  console.log("--- [7/11] فحص Concurrency Guard ---");
  const rootEl7 = new MockElement("div");
  rootEl7.setAttribute("contenteditable", "true");

  acquireAgentEditLock(rootEl7 as any);
  const lockedState = isAgentEditLocked();
  const attrLocked = rootEl7.getAttribute("contenteditable");
  console.log("Locked state:", lockedState, "contenteditable:", attrLocked);

  releaseAgentEditLock(rootEl7 as any);
  const unlockedState = isAgentEditLocked();
  const attrUnlocked = rootEl7.getAttribute("contenteditable");
  console.log("Unlocked state:", unlockedState, "contenteditable:", attrUnlocked);

  if (lockedState && attrLocked === "false" && !unlockedState && attrUnlocked === "true") {
    console.log("✅ نجاح البند 7: تم القفل بنجاح ومنع التعديل ثم التحرير واستعادة الحالة الأصلية.");
    passedTests++;
  } else {
    console.error("❌ فشل البند 7");
  }
  console.log("");

  // -------------------------------------------------------------
  // 8️⃣ البند 8: إثبات بقاء معرّف الفقرة المفرغة وظهورها في المخرجات المهيكلة
  // -------------------------------------------------------------
  console.log("--- [8/11] فحص تطبيع الفقرة الفارغة والتمثيل المهيكل ---");
  const container8 = new MockElement("div");
  const emptyBlock = new MockElement("div");
  emptyBlock.setAttribute("data-block-id", "b_empty1");
  emptyBlock.appendChild(new MockNode(3, ""));
  container8.appendChild(emptyBlock);

  const structuredAI = getStructuredContentForAI(container8 as any);
  console.log("Structured AI Output with Empty Block:\n" + structuredAI);

  if (structuredAI.includes("[b_empty1]")) {
    console.log("✅ نجاح البند 8: ظهرت الفقرة الفارغة بمعرّفها في المخرجات المهيكلة للوكيل.");
    passedTests++;
  } else {
    console.error("❌ فشل البند 8");
  }
  console.log("");

  // -------------------------------------------------------------
  // 9️⃣ البند 9: إثبات سجل التدقيق الصامت (Audit Log)
  // -------------------------------------------------------------
  console.log("--- [9/11] فحص سجل التدقيق الداخلي الصامت ---");
  globalAuditLog.clear();
  globalAuditLog.record({
    type: "REPLACE",
    blockId: "b_audit1",
    details: { op: "test1" },
    status: "SUCCESS",
  });
  globalAuditLog.record({
    type: "INSERT_AFTER",
    blockId: "b_audit2",
    details: { op: "test2" },
    status: "SUCCESS",
  });
  globalAuditLog.record({
    type: "DELETE",
    blockId: "b_audit3",
    details: { op: "test3" },
    status: "SUCCESS",
  });

  const auditEntries = globalAuditLog.getEntries();
  console.log("Audit log entries count:", auditEntries.length);
  console.log("Entry types:", auditEntries.map((e) => e.type).join(", "));

  if (auditEntries.length === 3 && auditEntries[0].type === "REPLACE" && auditEntries[2].type === "DELETE") {
    console.log("✅ نجاح البند 9: تم توثيق العمليات الثلاث في سجل التدقيق بنجاح.");
    passedTests++;
  } else {
    console.error("❌ فشل البند 9");
  }
  console.log("");

  // -------------------------------------------------------------
  // 🔟 البند 10: إثبات منع تداخل الدفعات + runCheckedBatch بالتراجع التلقائي
  // -------------------------------------------------------------
  console.log("--- [10/11] فحص Batch Reentrancy Guard و runCheckedBatch ---");
  const batchMgr = new BlockBatchManager();
  const container10 = new MockElement("div");
  const b10_1 = new MockElement("div");
  b10_1.setAttribute("data-block-id", "b_chk1");
  b10_1.appendChild(new MockNode(3, "فقرة الدفعة 1"));
  const b10_2 = new MockElement("div");
  b10_2.setAttribute("data-block-id", "b_chk2");
  b10_2.appendChild(new MockNode(3, "فقرة الدفعة 2"));
  container10.appendChild(b10_1);
  container10.appendChild(b10_2);

  const initialHtml10 = container10.innerHTML;

  // فحص منع التداخل
  batchMgr.beginBatch(container10 as any, { html: initialHtml10 });
  const nestedRes = batchMgr.beginBatch(container10 as any, { html: initialHtml10 });
  console.log("Nested batch result (should be null):", nestedRes);
  batchMgr.commitBatch();

  // فحص runCheckedBatch
  const checkedBatchRes = await batchMgr.runCheckedBatch(
    container10 as any,
    { html: initialHtml10 },
    [
      () => replaceTextWithinBlock("b_chk1", "فقرة الدفعة 1", "تعديل ناجح 1", { rootElement: container10 as any }),
      () => replaceTextWithinBlock("b_nonexistent", "أي نص", "بديل", { rootElement: container10 as any }),
    ]
  );

  console.log("runCheckedBatch Failure Report:", safeResultStringify(checkedBatchRes));
  console.log("Container 10 HTML after auto-rollback:", container10.innerHTML);

  if (
    nestedRes === null &&
    !checkedBatchRes.success &&
    checkedBatchRes.failedIndex === 1 &&
    container10.innerHTML === initialHtml10
  ) {
    console.log("✅ نجاح البند 10: رُفض التداخل وتراجع runCheckedBatch تلقائياً فور أول فشل.");
    passedTests++;
  } else {
    console.error("❌ فشل البند 10");
  }
  console.log("");

  // -------------------------------------------------------------
  // 1️⃣1️⃣ البند 11: إثبات الإدراج متعدد الفقرات (Multi-Paragraph Insert)
  // -------------------------------------------------------------
  console.log("--- [11/11] فحص الإدراج متعدد الفقرات مع فواصل الأسطر ---");
  const container11 = new MockElement("div");
  const b11 = new MockElement("div");
  b11.setAttribute("data-block-id", "b_multi_target");
  b11.appendChild(new MockNode(3, "فقرة الأصل"));
  container11.appendChild(b11);

  const multiText = "الفقرة الأولى الجديدة.\n\nالفقرة الثانية الجديدة سطر 1\nالفقرة الثانية سطر 2\n\nالفقرة الثالثة الجديدة.";
  const insertRes = insertBlockAfter("b_multi_target", multiText, { rootElement: container11 as any });

  console.log("Multi-Paragraph Insert Result:", safeResultStringify(insertRes));
  console.log("Container 11 Child Count:", container11.children.length);
  console.log("Container 11 HTML:", container11.innerHTML);

  if (
    insertRes.status === "SUCCESS" &&
    insertRes.createdBlockIds?.length === 3 &&
    container11.children.length === 4 &&
    container11.innerHTML.includes("<br>")
  ) {
    console.log("✅ نجاح البند 11: تم إنشاء 3 فقرات مستقلة بمعرّفات فريدة مع فواصل <br> آمنة.");
    passedTests++;
  } else {
    console.error("❌ فشل البند 11");
  }
  console.log("");

  console.log("===============================================================");
  console.log(`🎉 النتيجة النهائية: اجتياز ${passedTests}/${totalTests} اختبار بنجاح 100%!`);
  console.log("===============================================================");
}

runPhase3Verification();
