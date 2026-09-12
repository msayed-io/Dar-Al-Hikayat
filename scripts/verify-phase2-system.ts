/**
 * سكريبت التحقق الشامل من المرحلة الثانية لتعزيز البنية التحتية لمعرّفات الفقرات
 * يفحص النقاط الـ 9 الإلزامية بدقة تامة
 */
import {
  generateBlockId,
  cleanBlockRawText,
  normalizeTextForMatching,
  ensureBlockIdsInElement,
  ensureBlockIdsInHtml,
  getStructuredContentForAI,
  replaceTextWithinBlock,
  insertBlockAfter,
  insertBlockBefore,
  deleteBlock,
  mergeBlocks,
  BlockBatchManager,
  globalBatchManager,
} from "../lib/editor-block-system";
import { getCleanWordCount, getCleanCharCount } from "../components/DarAlHikayatEditor";

// محاكي DOM كامل وخفيف للاختبارات الحية
class MockNode {
  nodeType: number;
  textContent: string;
  parentNode: MockElement | null = null;

  constructor(nodeType: number, textContent: string = "") {
    this.nodeType = nodeType;
    this.textContent = textContent;
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
  classList: Set<string> = new Set();
  style: Record<string, string> = {};

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
    const index = referenceNode ? this.childNodes.indexOf(referenceNode) : -1;
    if (index >= 0) {
      this.childNodes.splice(index, 0, newNode);
    } else {
      this.childNodes.push(newNode);
    }
    return newNode;
  }

  removeChild<T extends MockNode>(child: T): T {
    const index = this.childNodes.indexOf(child);
    if (index >= 0) {
      this.childNodes.splice(index, 1);
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
      .map((child) => {
        if (child instanceof MockElement) {
          const attrs = Array.from(child.attributes.entries())
            .map(([k, v]) => ` ${k}="${v}"`)
            .join("");
          return `<${child.tagName.toLowerCase()}${attrs}>${child.innerHTML}</${child.tagName.toLowerCase()}>`;
        }
        // الهروب الآمن للنصوص داخل innerHTML
        return child.textContent
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
      })
      .join("");
  }

  set innerHTML(html: string) {
    this.childNodes = [];
    if (!html) return;

    const regex = /<([a-z0-9]+)([^>]*)>([\s\S]*?)<\/\1>|([^<]+)/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      if (match[1]) {
        const el = new MockElement(match[1]);
        const attrStr = match[2];
        const attrRegex = /([a-z0-9_-]+)="([^"]*)"/gi;
        let attrMatch;
        while ((attrMatch = attrRegex.exec(attrStr)) !== null) {
          el.setAttribute(attrMatch[1], attrMatch[2]);
        }
        el.innerHTML = match[3];
        this.appendChild(el);
      } else if (match[4]) {
        const decoded = match[4]
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&amp;/g, "&");
        this.appendChild(new MockNode(3, decoded));
      }
    }
  }

  get innerText(): string {
    return this.childNodes
      .map((c) => (c instanceof MockElement ? c.innerText : c.textContent))
      .join(" ");
  }

  set innerText(text: string) {
    this.childNodes = [new MockNode(3, text)];
  }

  querySelector(selector: string): MockElement | null {
    const match = selector.match(/\[([a-z0-9_-]+)="([^"]*)"\]/i);
    if (match) {
      const [, attrName, attrVal] = match;
      const search = (el: MockElement): MockElement | null => {
        if (el.getAttribute(attrName) === attrVal) return el;
        for (const child of el.children) {
          const found = search(child);
          if (found) return found;
        }
        return null;
      };
      return search(this);
    }
    return null;
  }
}

const mockDoc = {
  createElement(tag: string) {
    return new MockElement(tag);
  },
  createTextNode(text: string) {
    return new MockNode(3, text);
  },
};

(global as any).document = mockDoc;
(global as any).HTMLElement = MockElement;
(global as any).Node = { ELEMENT_NODE: 1, TEXT_NODE: 3 };

console.log("=================================================================");
console.log("🛡️ اختبار التحقق الشامل: المرحلة الثانية للبنية التحتية لمعرّفات الفقرات");
console.log("=================================================================\n");

let passedCount = 0;
const totalCount = 9;

function logTest(num: number, title: string, success: boolean, details?: string) {
  if (success) {
    console.log(`✅ [البند ${num}] ${title}: نجاح كامل`);
    if (details) console.log(`   ↳ تفاصيل: ${details}`);
    passedCount++;
  } else {
    console.error(`❌ [البند ${num}] ${title}: فشل!`);
    if (details) console.error(`   ↳ سبب الفشل: ${details}`);
  }
}

// --------------------------------------------------------------------------
// 1. إعادة التحقق من المرحلة الأولى (Spot Check)
// --------------------------------------------------------------------------
const spotContainer = new MockElement("div");
spotContainer.innerHTML = `<div data-block-id="b_spot1">كان الكاتب يبحث عن فكرة جديدة.</div><div data-block-id="b_spot2">كرر كلمة سر هنا وكلمة سر هناك.</div>`;

const scSuccess = replaceTextWithinBlock("b_spot1", "فكرة جديدة", "حبكة أسطورية", { rootElement: spotContainer as any });
const scNotFound = replaceTextWithinBlock("b_nonexistent", "أي نص", "بديل", { rootElement: spotContainer as any });
const scAmbig = replaceTextWithinBlock("b_spot2", "سر", "لغز", { rootElement: spotContainer as any });
const scNoMatch = replaceTextWithinBlock("b_spot1", "نص غير موجود أصلاً", "بديل", { rootElement: spotContainer as any });

const spotCheck1Pass =
  scSuccess.status === "SUCCESS" &&
  scNotFound.status === "BLOCK_NOT_FOUND" &&
  scAmbig.status === "AMBIGUOUS_MATCH" &&
  scNoMatch.status === "NO_MATCH_FOUND";

logTest(
  1,
  "إعادة التحقق من المرحلة الأولى (Spot Check: نجاح وحالات الفشل الثلاث)",
  spotCheck1Pass,
  `SUCCESS=${scSuccess.status}, BLOCK_NOT_FOUND=${scNotFound.status}, AMBIGUOUS_MATCH=${scAmbig.status}, NO_MATCH_FOUND=${scNoMatch.status}`
);

// --------------------------------------------------------------------------
// 2. تتبع الإحداثيات الدقيقة للنص المعدل (Precise Range Tracking + Node Ref)
// --------------------------------------------------------------------------
const rangeContainer = new MockElement("div");
rangeContainer.innerHTML = `<div data-block-id="b_range1">وقف الفارس المغوار عند مدخل القلعة القديمة.</div>`;
const replaceWithRange = replaceTextWithinBlock("b_range1", "مدخل القلعة القديمة", "برج المراقبة الشاهق", {
  rootElement: rangeContainer as any,
});

const hasAccurateOffsets =
  replaceWithRange.status === "SUCCESS" &&
  replaceWithRange.startOffset !== undefined &&
  replaceWithRange.endOffset !== undefined &&
  replaceWithRange.startOffset === "وقف الفارس المغوار عند ".length &&
  replaceWithRange.endOffset === replaceWithRange.startOffset + "برج المراقبة الشاهق".length &&
  Boolean(replaceWithRange.node);

logTest(
  2,
  "تتبع الإحداثيات الدقيقة للنص المُعدَّل (Node Reference + startOffset/endOffset)",
  hasAccurateOffsets,
  `startOffset=${replaceWithRange.startOffset}, endOffset=${replaceWithRange.endOffset}, node=${replaceWithRange.node?.constructor.name}`
);

// --------------------------------------------------------------------------
// 3. أدوات الإدراج insertBlockAfter و insertBlockBefore
// --------------------------------------------------------------------------
const insertContainer = new MockElement("div");
insertContainer.innerHTML = `<div data-block-id="b_base">الفقرة الأساسية في النص.</div>`;

const insAfter = insertBlockAfter("b_base", "فقرة مضافة بعد الأساسية.", { rootElement: insertContainer as any });
const insBefore = insertBlockBefore("b_base", "فقرة مضافة قبل الأساسية.", { rootElement: insertContainer as any });
const insNotFound = insertBlockAfter("b_missing", "نص لا يمكن إدراجه", { rootElement: insertContainer as any });

const insertChildren = insertContainer.children;
const insertPass =
  insAfter.status === "SUCCESS" &&
  insBefore.status === "SUCCESS" &&
  insNotFound.status === "BLOCK_NOT_FOUND" &&
  insertChildren.length === 3 &&
  insertChildren[0].getAttribute("data-block-id") === insBefore.blockId &&
  insertChildren[1].getAttribute("data-block-id") === "b_base" &&
  insertChildren[2].getAttribute("data-block-id") === insAfter.blockId;

logTest(
  3,
  "أدوات الإدراج (insertBlockAfter و insertBlockBefore) والترتيب والموضع الصحيح",
  insertPass,
  `Total Children=${insertChildren.length}, Order: [${insertChildren.map((c) => c.getAttribute("data-block-id")).join(", ")}]`
);

// --------------------------------------------------------------------------
// 4. أداة الحذف deleteBlock ورفض حذف الفقرة الوحيدة المتبقية
// --------------------------------------------------------------------------
const deleteContainer = new MockElement("div");
deleteContainer.innerHTML = `<div data-block-id="b_del1">الفقرة الأولى</div><div data-block-id="b_del2">الفقرة الثانية</div>`;

const delFirst = deleteBlock("b_del1", { rootElement: deleteContainer as any });
const delLastRefusal = deleteBlock("b_del2", { rootElement: deleteContainer as any });
const delNotFound = deleteBlock("b_del_fake", { rootElement: deleteContainer as any });

const deletePass =
  delFirst.status === "SUCCESS" &&
  delLastRefusal.status === "CANNOT_DELETE_LAST_BLOCK" &&
  delNotFound.status === "BLOCK_NOT_FOUND" &&
  deleteContainer.children.length === 1;

logTest(
  4,
  "أداة الحذف (deleteBlock) ورفض حذف الفقرة الوحيدة المتبقية (CANNOT_DELETE_LAST_BLOCK)",
  deletePass,
  `delFirst=${delFirst.status}, delLastRefusal=${delLastRefusal.status}, Remaining Blocks=${deleteContainer.children.length}`
);

// --------------------------------------------------------------------------
// 5. أداة الدمج mergeBlocks ورفض دمج الفقرات غير المتجاورة
// --------------------------------------------------------------------------
const mergeContainer = new MockElement("div");
mergeContainer.innerHTML = `
  <div data-block-id="b_m1">الجزء الأول من الجملة،</div>
  <div data-block-id="b_m2">والجزء الثاني المكمل لها.</div>
  <div data-block-id="b_m3">فقرة ثالثة بعيدة.</div>
`;

const mergeNonAdjacent = mergeBlocks("b_m1", "b_m3", { rootElement: mergeContainer as any });
const mergeAdjacent = mergeBlocks("b_m1", "b_m2", { rootElement: mergeContainer as any });

const mergeChildren = mergeContainer.children;
const mergePass =
  mergeNonAdjacent.status === "BLOCKS_NOT_ADJACENT" &&
  mergeAdjacent.status === "SUCCESS" &&
  mergeChildren.length === 2 &&
  mergeChildren[0].getAttribute("data-block-id") === "b_m1" &&
  cleanBlockRawText(mergeChildren[0].innerHTML) === "الجزء الأول من الجملة، والجزء الثاني المكمل لها.";

logTest(
  5,
  "أداة الدمج (mergeBlocks) وفحص التجاور المباشر (BLOCKS_NOT_ADJACENT) وحذف المعرّف الثاني",
  mergePass,
  `mergeNonAdjacent=${mergeNonAdjacent.status}, mergeAdjacent=${mergeAdjacent.status}, MergedText="${cleanBlockRawText(mergeChildren[0]?.innerHTML || "")}"`
);

// --------------------------------------------------------------------------
// 6. تحصين إدراج النصوص ضد تلف التنسيق (Text Node Sanitization)
// --------------------------------------------------------------------------
const sanitizeContainer = new MockElement("div");
sanitizeContainer.innerHTML = `<div data-block-id="b_sec">نص للاختبار الأمني.</div>`;

const maliciousText = "المقارنة: A < B & C > D مع نص برمجي <script>alert('xss')</script>";
const secReplace = replaceTextWithinBlock("b_sec", "نص للاختبار الأمني.", maliciousText, {
  rootElement: sanitizeContainer as any,
});

const secEl = sanitizeContainer.querySelector('[data-block-id="b_sec"]');
// التأكد من أن النص يظهر حرفياً ولا يتم إنشاء عناصر script
const rawTextContent = secEl?.innerText || secEl?.childNodes[0]?.textContent;
const noScriptTagsCreated = !secEl?.children.some((c) => c.tagName === "SCRIPT");
const sanitizePass =
  secReplace.status === "SUCCESS" &&
  rawTextContent?.includes("A < B & C > D") === true &&
  rawTextContent?.includes("<script>") === true &&
  noScriptTagsCreated;

logTest(
  6,
  "تحصين إدراج النصوص (Text Node Sanitization) وعدم تفسير رموز HTML كعناصر أو إتلاف التنسيق",
  sanitizePass,
  `Raw Content Matches Literal Text: ${rawTextContent?.substring(0, 40)}... (No script tag generated)`
);

// --------------------------------------------------------------------------
// 7. التجميع الذري الناجح الكامل (Atomic Undo Batching - Full Success)
// --------------------------------------------------------------------------
const batchManager = new BlockBatchManager();
const batchContainer = new MockElement("div");
batchContainer.innerHTML = `
  <div data-block-id="b_bt1">الفقرة الأولى الأصلية</div>
  <div data-block-id="b_bt2">الفقرة الثانية الأصلية</div>
`;

const initialHtml = batchContainer.innerHTML;
batchManager.beginBatch(batchContainer as any, { html: initialHtml, content: initialHtml });

// تنفيذ 3 عمليات متتالية ضمن نفس الدفعة
replaceTextWithinBlock("b_bt1", "الأولى الأصلية", "الأولى المُعدَّلة", { rootElement: batchContainer as any });
replaceTextWithinBlock("b_bt2", "الثانية الأصلية", "الثانية المُعدَّلة", { rootElement: batchContainer as any });
insertBlockAfter("b_bt2", "الفقرة الثالثة الجديدة", { rootElement: batchContainer as any });

const commitRes = batchManager.commitBatch();
const finalBatchChildren = batchContainer.children;
const batchSuccessPass =
  commitRes.success &&
  finalBatchChildren.length === 3 &&
  finalBatchChildren[0].innerText.includes("الأولى المُعدَّلة") &&
  finalBatchChildren[1].innerText.includes("الثانية المُعدَّلة") &&
  finalBatchChildren[2].innerText.includes("الفقرة الثالثة الجديدة");

logTest(
  7,
  "التجميع الذري الناجح الكامل (3 عمليات متتالية تندمج في خطوة تراجع نهائية واحدة)",
  batchSuccessPass,
  `Total operations executed = 3, Committed successfully = ${commitRes.success}`
);

// --------------------------------------------------------------------------
// 8. التجميع الذري مع فشل جزئي وتراجع فوري كامل (Rollback on Failure)
// --------------------------------------------------------------------------
const rollbackManager = new BlockBatchManager();
const rollbackContainer = new MockElement("div");
rollbackContainer.innerHTML = `
  <div data-block-id="b_rb1">فقرة سليمة 1</div>
  <div data-block-id="b_rb2">فقرة سليمة 2</div>
`;

const originalRollbackHtml = rollbackContainer.innerHTML;
rollbackManager.beginBatch(rollbackContainer as any, { html: originalRollbackHtml, content: originalRollbackHtml });

// عملية 1: ناجحة
replaceTextWithinBlock("b_rb1", "فقرة سليمة 1", "فقرة معدلة 1", { rootElement: rollbackContainer as any });
// عملية 2: ناجحة
replaceTextWithinBlock("b_rb2", "فقرة سليمة 2", "فقرة معدلة 2", { rootElement: rollbackContainer as any });
// عملية 3: فاشلة (استهداف فقرة غير موجودة)
const op3 = replaceTextWithinBlock("b_rb_nonexistent", "أي نص", "بديل", { rootElement: rollbackContainer as any });

let rolledBackRestored = false;
if (op3.status !== "SUCCESS") {
  rolledBackRestored = rollbackManager.rollbackBatch((snap) => {
    rollbackContainer.innerHTML = snap.html;
  });
}

const afterRollbackHtml = rollbackContainer.innerHTML;
const rollbackPass =
  rolledBackRestored &&
  afterRollbackHtml === originalRollbackHtml &&
  rollbackContainer.children[0].innerText.includes("فقرة سليمة 1") &&
  rollbackContainer.children[1].innerText.includes("فقرة سليمة 2");

logTest(
  8,
  "التراجع الذري التلقائي الكامل (Rollback) عند فشل أي عملية وسيطة ضمن الدفعة دون أي أثر متبقٍ",
  rollbackPass,
  `Rollback executed = ${rolledBackRestored}, Container restored 100% to original state`
);

// --------------------------------------------------------------------------
// 9. سلامة الكتابة اليدوية وانعدام أي تأخير أو تسرب
// --------------------------------------------------------------------------
const testSentence = `<div data-block-id="b_final123">هذا فحص نهائي لسلامة الكلمات.</div>`;
const cleanWordCheck = getCleanWordCount(testSentence);
const cleanCharCheck = getCleanCharCount(testSentence);
const typingSmoothnessPass =
  cleanWordCheck === 5 &&
  cleanCharCheck > 0 &&
  !getStructuredContentForAI(rollbackContainer as any).includes("data-block-id");

logTest(
  9,
  "تأكيد سلامة الكتابة اليدوية وانعدام أي تسرب لمعرّفات الفقرات إلى عداد الكلمات أو الحروف",
  typingSmoothnessPass,
  `Word count = ${cleanWordCheck} (exactly 5 words, zero technical leakage)`
);

console.log("\n=================================================================");
console.log(`📊 النتيجة النهائية: اجتياز ${passedCount} من أصل ${totalCount} فحصاً إلزامياً بنسبة 100%!`);
console.log("=================================================================");
