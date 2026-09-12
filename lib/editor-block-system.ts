/**
 * البنية التحتية لنظام معرّفات الفقرات (Block-ID Infrastructure) — المرحلة الثالثة
 * محرر دار الحكايات — طبقة داخلية لتتبع ومعالجة الفقرات بدقة جراحية
 * 
 * الميزات والإصلاحات:
 * 0️⃣ إصلاحات المرحلة صفر الحاجبة:
 *   - DOM_SYNC_MISMATCH عند فشل التطبيق على DOM الخام مع حذف الفرع الميت
 *   - المطابقة المرنة عبر خريطة المواضع (Index Map) مع ضمان الثابت المقدس byte-identical خارج النطاق
 *   - دمج الفقرات mergeBlocks يُبلِّغ بالمعرّف الفعلي الباقي في الـ DOM
 *   - ensureBlockIdsInElement يُعالج العقد الشاردة دون ابتلاع الفقرات القائمة
 * 1️⃣ تحصينات المرحلة الأولى:
 *   - Two-Phase Validation (validateBatchOperations)
 *   - Concurrency Guard (acquireAgentEditLock / releaseAgentEditLock / isAgentEditLocked)
 *   - Empty Block Normalization & Inclusion in Structured AI Content
 *   - Silent Operation Audit Log (BlockAuditLog / globalAuditLog)
 *   - Batch Reentrancy Guard
 *   - Status-Aware Batch Runner (runCheckedBatch with auto-rollback on non-SUCCESS)
 *   - Multi-Paragraph Insert with clean <br> line breaks
 */

export interface BlockInfo {
  id: string;
  element: HTMLElement;
  rawText: string;
}

export type BlockOperationStatus =
  | "SUCCESS"
  | "BLOCK_NOT_FOUND"
  | "AMBIGUOUS_MATCH"
  | "NO_MATCH_FOUND"
  | "DOM_SYNC_MISMATCH"
  | "CANNOT_DELETE_LAST_BLOCK"
  | "BLOCKS_NOT_ADJACENT"
  | "BATCH_FAILED"
  | "BATCH_ALREADY_ACTIVE"
  | "LOCKED_FOR_EDIT";

export interface BlockRangeInfo {
  startOffset: number;
  endOffset: number;
  node: Node | null;
}

export interface BlockOperationResult {
  status: BlockOperationStatus;
  blockId: string;
  originalText?: string;
  updatedText?: string;
  matchType?: "EXACT" | "NORMALIZED";
  occurrences?: number;
  range?: BlockRangeInfo;
  node?: Node | null;
  startOffset?: number;
  endOffset?: number;
  createdBlockIds?: string[];
  error?: string;
}

// Alias for backward compatibility
export type BlockReplacementStatus = BlockOperationStatus;
export type BlockReplacementResult = BlockOperationResult;

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  type:
    | "REPLACE"
    | "INSERT_AFTER"
    | "INSERT_BEFORE"
    | "DELETE"
    | "MERGE"
    | "BATCH_BEGIN"
    | "BATCH_COMMIT"
    | "BATCH_ROLLBACK"
    | "LOCK_ACQUIRED"
    | "LOCK_RELEASED";
  blockId: string;
  details: Record<string, any>;
  status: BlockOperationStatus | "OK";
  error?: string;
}

/**
 * سجل تدقيق داخلي صامت (Silent Operation Audit Log)
 * مخزن دائري يحتفظ بآخر 200 عملية مع توثيق تفاصيلها
 */
export class BlockAuditLog {
  private static readonly MAX_ENTRIES = 200;
  private entries: AuditLogEntry[] = [];

  record(entry: Omit<AuditLogEntry, "id" | "timestamp">): AuditLogEntry {
    const fullEntry: AuditLogEntry = {
      id: generateBlockId(),
      timestamp: Date.now(),
      ...entry,
    };
    this.entries.push(fullEntry);
    if (this.entries.length > BlockAuditLog.MAX_ENTRIES) {
      this.entries.shift();
    }
    if (typeof console !== "undefined" && typeof console.debug === "function") {
      console.debug(
        `[BlockAuditLog:${fullEntry.type}] status=${fullEntry.status} blockId=${fullEntry.blockId}`,
        fullEntry
      );
    }
    return fullEntry;
  }

  getEntries(): AuditLogEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
  }
}

export const globalAuditLog = new BlockAuditLog();

// ==========================================================================
// Concurrency Guard — قفل تزامني للمحرر أثناء عمليات الوكيل
// ==========================================================================
let isEditorLocked = false;
let lockedElement: HTMLElement | null = null;
let previousContentEditable: string | null = null;

export function acquireAgentEditLock(rootElement: HTMLElement | null): boolean {
  if (isEditorLocked) return false;
  if (!rootElement) return false;
  try {
    previousContentEditable = rootElement.getAttribute("contenteditable");
    rootElement.setAttribute("contenteditable", "false");
    lockedElement = rootElement;
    isEditorLocked = true;
    globalAuditLog.record({
      type: "LOCK_ACQUIRED",
      blockId: "root",
      details: { previousContentEditable },
      status: "OK",
    });
    return true;
  } catch (e: any) {
    console.error("acquireAgentEditLock error:", e);
    return false;
  }
}

export function releaseAgentEditLock(rootElement?: HTMLElement | null): boolean {
  const el = rootElement || lockedElement;
  if (el) {
    try {
      el.setAttribute("contenteditable", previousContentEditable !== null ? previousContentEditable : "true");
    } catch (e) {
      console.error("releaseAgentEditLock error:", e);
    }
  }
  isEditorLocked = false;
  lockedElement = null;
  previousContentEditable = null;
  globalAuditLog.record({
    type: "LOCK_RELEASED",
    blockId: "root",
    details: {},
    status: "OK",
  });
  return true;
}

export function isAgentEditLocked(): boolean {
  return isEditorLocked;
}

/**
 * توليد معرّف فقرة فريد عالمياً وغير قابل للتصادم (Prefix: b_)
 */
export function generateBlockId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `b_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
  }
  const rand = Math.random().toString(36).slice(2, 6);
  const time = Date.now().toString(36).slice(-4);
  return `b_${rand}${time}`;
}

/**
 * تنظيف النص الداخلي للفقرة من أي وسوم HTML أو فراغات غير منضبطة
 */
export function cleanBlockRawText(htmlOrText: string): string {
  if (!htmlOrText) return "";
  return htmlOrText
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\u00A0/g, " ")
    .replace(/[\r\t]+/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();
}

/**
 * تطبيع النص للمقارنة المرنة
 */
export function normalizeTextForMatching(text: string): string {
  if (!text) return "";
  return text
    .replace(/[\u00A0\s]+/g, " ")
    .replace(/[«»“”"']/g, '"')
    .replace(/[،,]/g, "،")
    .replace(/[؛;]/g, "؛")
    .replace(/\.{2,}/g, "...")
    .trim();
}

/**
 * خريطة المواضع (Index Map) للمطابقة المرنة:
 * تربط كل موضع في النص المطبَّع بالموضع المقابل في النص الخام بدقة حرفية
 */
export interface NormalizedIndexMapping {
  normalizedText: string;
  normToRawMap: number[];
}

export function buildNormalizedTextWithMap(rawText: string): NormalizedIndexMapping {
  if (!rawText) return { normalizedText: "", normToRawMap: [] };

  let normalizedText = "";
  const normToRawMap: number[] = [];

  let inWhitespace = false;
  let i = 0;
  while (i < rawText.length) {
    const ch = rawText[i];

    // فراغات أو مسافات غير منقسمة
    if (/\s|\u00A0/.test(ch)) {
      if (!inWhitespace) {
        if (normalizedText.length > 0) {
          normalizedText += " ";
          normToRawMap.push(i);
          inWhitespace = true;
        }
      }
      i++;
      continue;
    }

    inWhitespace = false;

    // علامات التنصيص
    if (/[«»“”"']/.test(ch)) {
      normalizedText += '"';
      normToRawMap.push(i);
      i++;
      continue;
    }

    // الفواصل العربية واللاتينية
    if (/[،,]/.test(ch)) {
      normalizedText += "،";
      normToRawMap.push(i);
      i++;
      continue;
    }

    // الفواصل المنقوطة
    if (/[؛;]/.test(ch)) {
      normalizedText += "؛";
      normToRawMap.push(i);
      i++;
      continue;
    }

    // النقاط المتعددة (Ellipses)
    if (ch === ".") {
      let dotCount = 0;
      const startDotIdx = i;
      while (i < rawText.length && rawText[i] === ".") {
        dotCount++;
        i++;
      }
      if (dotCount >= 2) {
        normalizedText += "...";
        normToRawMap.push(startDotIdx);
        normToRawMap.push(startDotIdx + 1);
        normToRawMap.push(i - 1);
      } else {
        normalizedText += ".";
        normToRawMap.push(startDotIdx);
      }
      continue;
    }

    // حرف عادي
    normalizedText += ch;
    normToRawMap.push(i);
    i++;
  }

  // إزالة أي مسافة زائدة في النهاية مع مزامنة الخريطة
  while (normalizedText.endsWith(" ")) {
    normalizedText = normalizedText.slice(0, -1);
    normToRawMap.pop();
  }

  return { normalizedText, normToRawMap };
}

/**
 * 0.4 فحص وتثبيت معرّفات الفقرات data-block-id على مستوى عناصر الـ DOM للحاوية
 * مُحصّن بالكامل: يعالج العقد الشاردة بتغليفها وحدها دون ابتلاع أي فقرة قائمة
 */
export function ensureBlockIdsInElement(container: HTMLElement): boolean {
  if (!container) return false;

  let mutated = false;
  const seenIds = new Set<string>();

  const isInlineOrStrayNode = (n: Node): boolean => {
    if (n.nodeType === Node.TEXT_NODE) {
      return (n.textContent || "").trim().length > 0;
    }
    if (n.nodeType === Node.ELEMENT_NODE) {
      const el = n as HTMLElement;
      if (el.hasAttribute("data-block-id")) return false;
      const tag = el.tagName.toUpperCase();
      if (["SPAN", "MARK", "EM", "B", "I", "U", "A", "STRONG", "SMALL", "SUB", "SUP", "CODE", "BR"].includes(tag)) {
        return true;
      }
      return false;
    }
    return false;
  };

  const childNodes = Array.from(container.childNodes);
  let pendingStrayNodes: Node[] = [];

  const flushPendingStrayNodes = (beforeNode: Node | null) => {
    if (pendingStrayNodes.length === 0) return;
    const wrapper = document.createElement("div");
    const newId = generateBlockId();
    wrapper.setAttribute("data-block-id", newId);
    seenIds.add(newId);

    if (beforeNode) {
      container.insertBefore(wrapper, beforeNode);
    } else {
      container.appendChild(wrapper);
    }

    for (const stray of pendingStrayNodes) {
      wrapper.appendChild(stray);
    }

    pendingStrayNodes = [];
    mutated = true;
  };

  for (const node of childNodes) {
    if (isInlineOrStrayNode(node)) {
      pendingStrayNodes.push(node);
    } else {
      if (node.nodeType === Node.TEXT_NODE && !(node.textContent || "").trim()) {
        if (pendingStrayNodes.length > 0) {
          pendingStrayNodes.push(node);
        }
        continue;
      }

      flushPendingStrayNodes(node);

      if (node instanceof HTMLElement) {
        const currentId = node.getAttribute("data-block-id");
        if (!currentId || seenIds.has(currentId)) {
          const newId = generateBlockId();
          node.setAttribute("data-block-id", newId);
          seenIds.add(newId);
          mutated = true;
        } else {
          seenIds.add(currentId);
        }
      }
    }
  }

  flushPendingStrayNodes(null);

  if (container.children.length === 0) {
    const emptyWrapper = document.createElement("div");
    const newId = generateBlockId();
    emptyWrapper.setAttribute("data-block-id", newId);
    emptyWrapper.appendChild(document.createElement("br"));
    container.appendChild(emptyWrapper);
    mutated = true;
  }

  return mutated;
}

/**
 * فحص وتثبيت معرّفات الفقرات على سلسلة HTML نصية
 */
export function ensureBlockIdsInHtml(html: string): string {
  if (!html || !html.trim()) return html;
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return html;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const body = doc.body;

    const mutated = ensureBlockIdsInElement(body);
    if (mutated) {
      return body.innerHTML;
    }
  } catch (e) {
    console.warn("ensureBlockIdsInHtml error:", e);
  }

  return html;
}

/**
 * 1.3 استخراج المحتوى المُهيكل للذكاء الاصطناعي بصيغة المعرّفات:
 * [b_xxxxxxxx] نص الفقرة هنا
 * (يشمل الفقرات الفارغة صراحة لضمان الرؤية الهيكلية الكاملة للوكيل)
 */
export function getStructuredContentForAI(
  containerOrHtml: HTMLElement | string
): string {
  if (!containerOrHtml) return "";

  const blocks: { id: string; text: string }[] = [];

  if (typeof containerOrHtml === "string") {
    if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
      const parser = new DOMParser();
      const doc = parser.parseFromString(containerOrHtml, "text/html");
      ensureBlockIdsInElement(doc.body);
      const elements = Array.from(doc.body.children);
      for (const el of elements) {
        if (el instanceof HTMLElement) {
          const id = el.getAttribute("data-block-id") || generateBlockId();
          const cleanText = cleanBlockRawText(el.innerHTML);
          blocks.push({ id, text: cleanText });
        }
      }
    } else {
      const clean = cleanBlockRawText(containerOrHtml);
      return `[${generateBlockId()}] ${clean}`;
    }
  } else if (containerOrHtml instanceof HTMLElement) {
    ensureBlockIdsInElement(containerOrHtml);
    const elements = Array.from(containerOrHtml.children);

    if (elements.length === 0) {
      const clean = cleanBlockRawText(containerOrHtml.innerHTML);
      const id = containerOrHtml.getAttribute("data-block-id") || generateBlockId();
      blocks.push({ id, text: clean });
    } else {
      for (const el of elements) {
        if (el instanceof HTMLElement) {
          const id = el.getAttribute("data-block-id") || generateBlockId();
          const cleanText = cleanBlockRawText(el.innerHTML);
          blocks.push({ id, text: cleanText });
        }
      }
    }
  }

  return blocks.map((b) => `[${b.id}] ${b.text}`).join("\n");
}

// ==========================================================================
// مساعدات المعالجة النصية الدقيقة لشجرة الـ DOM
// ==========================================================================
interface TextNodeChunk {
  node: Text;
  start: number;
  end: number;
}

function collectTextNodes(container: HTMLElement): { fullText: string; chunks: TextNodeChunk[] } {
  const chunks: TextNodeChunk[] = [];
  let fullText = "";

  const walker =
    typeof document !== "undefined" && typeof document.createTreeWalker === "function"
      ? document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null)
      : null;

  if (walker) {
    let n = walker.nextNode();
    while (n) {
      if (n.nodeType === Node.TEXT_NODE) {
        const val = n.textContent || "";
        const start = fullText.length;
        fullText += val;
        const end = fullText.length;
        chunks.push({ node: n as Text, start, end });
      }
      n = walker.nextNode();
    }
  } else {
    const walk = (el: Node) => {
      if (el.nodeType === 3) {
        const val = el.textContent || "";
        const start = fullText.length;
        fullText += val;
        const end = fullText.length;
        chunks.push({ node: el as Text, start, end });
      } else {
        for (let i = 0; i < el.childNodes.length; i++) {
          walk(el.childNodes[i]);
        }
      }
    };
    walk(container);
  }

  return { fullText, chunks };
}

/**
 * استبدال نطاق خام دقيق [rawStart, rawEnd) داخل عنصر DOM مع الحفاظ التام
 * على كل العقد والتنسيقات والتظليلات خارج النطاق (Byte-Identical outside range)
 */
function safelyReplaceRawRangeInElement(
  container: HTMLElement,
  rawStart: number,
  rawEnd: number,
  newText: string
): { node: Node; startOffset: number; endOffset: number } | null {
  const { fullText, chunks } = collectTextNodes(container);

  if (rawStart < 0 || rawEnd > fullText.length || rawStart > rawEnd) {
    return null;
  }

  // استبدال نطاق فارغ في فقرة فارغة
  if (chunks.length === 0) {
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    const newNode = document.createTextNode(newText);
    container.appendChild(newNode);
    return { node: newNode, startOffset: 0, endOffset: newText.length };
  }

  // إيجاد العقد التي تتقاطع مع [rawStart, rawEnd)
  const overlappingChunks = chunks.filter((c) => c.start < rawEnd && c.end > rawStart);
  if (overlappingChunks.length === 0) {
    return null;
  }

  if (overlappingChunks.length === 1) {
    const chunk = overlappingChunks[0];
    const origText = chunk.node.textContent || "";
    const relStart = Math.max(0, rawStart - chunk.start);
    const relEnd = Math.min(origText.length, rawEnd - chunk.start);

    const beforeText = origText.slice(0, relStart);
    const afterText = origText.slice(relEnd);

    const parent = chunk.node.parentNode;
    if (!parent) return null;

    const newNode = document.createTextNode(newText);

    if (beforeText.length > 0 && afterText.length > 0) {
      const beforeNode = document.createTextNode(beforeText);
      const afterNode = document.createTextNode(afterText);
      parent.insertBefore(beforeNode, chunk.node);
      parent.insertBefore(newNode, chunk.node);
      parent.insertBefore(afterNode, chunk.node);
      parent.removeChild(chunk.node);
    } else if (beforeText.length > 0) {
      const beforeNode = document.createTextNode(beforeText);
      parent.insertBefore(beforeNode, chunk.node);
      parent.insertBefore(newNode, chunk.node);
      parent.removeChild(chunk.node);
    } else if (afterText.length > 0) {
      const afterNode = document.createTextNode(afterText);
      parent.insertBefore(newNode, chunk.node);
      parent.insertBefore(afterNode, chunk.node);
      parent.removeChild(chunk.node);
    } else {
      parent.insertBefore(newNode, chunk.node);
      parent.removeChild(chunk.node);
    }

    return {
      node: newNode,
      startOffset: rawStart,
      endOffset: rawStart + newText.length,
    };
  }

  // استبدال يمتد عبر عقد نصية متعددة (مع الاحتفاظ بالتنسيقات الخارجية)
  const firstChunk = overlappingChunks[0];
  const lastChunk = overlappingChunks[overlappingChunks.length - 1];

  const firstOrig = firstChunk.node.textContent || "";
  const lastOrig = lastChunk.node.textContent || "";

  const firstKeep = firstOrig.slice(0, rawStart - firstChunk.start);
  const lastKeep = lastOrig.slice(rawEnd - lastChunk.start);

  const newNode = document.createTextNode(newText);
  const firstParent = firstChunk.node.parentNode;
  if (!firstParent) return null;

  if (firstKeep.length > 0) {
    const firstKeepNode = document.createTextNode(firstKeep);
    firstParent.insertBefore(firstKeepNode, firstChunk.node);
    firstParent.insertBefore(newNode, firstChunk.node);
    firstParent.removeChild(firstChunk.node);
  } else {
    firstParent.insertBefore(newNode, firstChunk.node);
    firstParent.removeChild(firstChunk.node);
  }

  // حذف العقد المتوسطة بالكامل
  for (let i = 1; i < overlappingChunks.length - 1; i++) {
    const midNode = overlappingChunks[i].node;
    midNode.parentNode?.removeChild(midNode);
  }

  // معالجة العقدة الأخيرة
  const lastParent = lastChunk.node.parentNode;
  if (lastParent) {
    if (lastKeep.length > 0) {
      const lastKeepNode = document.createTextNode(lastKeep);
      lastParent.insertBefore(lastKeepNode, lastChunk.node);
      lastParent.removeChild(lastChunk.node);
    } else {
      lastParent.removeChild(lastChunk.node);
    }
  }

  return {
    node: newNode,
    startOffset: rawStart,
    endOffset: rawStart + newText.length,
  };
}

/**
 * مساعدة استبدال مطابقة حرفية في الـ DOM الخام
 * (ملاحظة هامة: تم حذف الفرع الميت container.textContent نهائياً لمنع تلف التنسيق)
 */
function safelyReplaceTextInElement(
  container: HTMLElement,
  targetText: string,
  newText: string
): { node: Node; startOffset: number; endOffset: number } | null {
  const { fullText } = collectTextNodes(container);
  const matchIndex = fullText.indexOf(targetText);
  if (matchIndex === -1) {
    return null;
  }
  return safelyReplaceRawRangeInElement(container, matchIndex, matchIndex + targetText.length, newText);
}

/**
 * 0.1 & 0.2 دالة التعديل الموضعي الدقيق داخل فقرة محددة بمعرّفها (replaceTextWithinBlock)
 * - تفحص وتُرجِع DOM_SYNC_MISMATCH صراحة عند عجز التطبيق على الـ DOM الخام
 * - تطبق المطابقة المرنة عبر خريطة المواضع مع الحفاظ التام على ما خارج النطاق
 */
export function replaceTextWithinBlock(
  blockId: string,
  targetText: string,
  newText: string,
  options?: {
    rootElement?: HTMLElement | null;
    onSuccess?: (updatedHtml: string) => void;
  }
): BlockOperationResult {
  if (!blockId) {
    return { status: "BLOCK_NOT_FOUND", blockId: blockId || "unknown" };
  }

  let targetBlockEl: HTMLElement | null = null;
  const searchRoot = options?.rootElement || (typeof document !== "undefined" ? document : null);

  if (searchRoot) {
    targetBlockEl = searchRoot.querySelector(`[data-block-id="${blockId}"]`);
  }

  if (!targetBlockEl) {
    globalAuditLog.record({
      type: "REPLACE",
      blockId,
      details: { targetText, newText },
      status: "BLOCK_NOT_FOUND",
      error: `لم يتم العثور على الفقرة ذات المعرّف "${blockId}" داخل المحرر.`,
    });
    return {
      status: "BLOCK_NOT_FOUND",
      blockId,
      error: `لم يتم العثور على الفقرة ذات المعرّف "${blockId}" داخل المحرر.`,
    };
  }

  const { fullText: rawFullText } = collectTextNodes(targetBlockEl);
  const cleanedRawText = cleanBlockRawText(targetBlockEl.innerHTML);

  if (!cleanedRawText && targetText !== "") {
    globalAuditLog.record({
      type: "REPLACE",
      blockId,
      details: { targetText, newText },
      status: "NO_MATCH_FOUND",
      error: "الفقرة المستهدفة فارغة.",
    });
    return {
      status: "NO_MATCH_FOUND",
      blockId,
      error: "الفقرة المستهدفة فارغة.",
    };
  }

  // 1. المطابقة الحرفية الكاملة (Exact Match)
  let exactOccurrences = 0;
  let pos = cleanedRawText.indexOf(targetText);
  while (pos !== -1 && targetText.length > 0) {
    exactOccurrences++;
    pos = cleanedRawText.indexOf(targetText, pos + 1);
  }

  if (exactOccurrences > 1) {
    globalAuditLog.record({
      type: "REPLACE",
      blockId,
      details: { targetText, newText, exactOccurrences },
      status: "AMBIGUOUS_MATCH",
      error: `النص المستهدف مكرر ${exactOccurrences} مرات داخل نفس الفقرة.`,
    });
    return {
      status: "AMBIGUOUS_MATCH",
      blockId,
      occurrences: exactOccurrences,
      error: `النص المستهدف مكرر ${exactOccurrences} مرات داخل نفس الفقرة.`,
    };
  }

  if (exactOccurrences === 1) {
    const replaceResult = safelyReplaceTextInElement(targetBlockEl, targetText, newText);

    // 0.1 إذا تعذّر التطبيق في DOM الخام (مثلاً لوجود &nbsp; أو تباين في المحارف)
    if (!replaceResult) {
      globalAuditLog.record({
        type: "REPLACE",
        blockId,
        details: { targetText, newText, reason: "DOM_SYNC_MISMATCH" },
        status: "DOM_SYNC_MISMATCH",
        error: "النص مطابَق منطقياً لكن تعذّر تطبيقه على بنية الـ DOM الخام.",
      });
      return {
        status: "DOM_SYNC_MISMATCH",
        blockId,
        error: "النص مطابَق منطقياً لكن تعذّر تطبيقه على بنية الـ DOM الخام.",
      };
    }

    const updatedHtml = targetBlockEl.innerHTML;
    if (options?.onSuccess) {
      options.onSuccess(updatedHtml);
    }

    globalAuditLog.record({
      type: "REPLACE",
      blockId,
      details: { targetText, newText, matchType: "EXACT" },
      status: "SUCCESS",
    });

    return {
      status: "SUCCESS",
      blockId,
      originalText: targetText,
      updatedText: newText,
      matchType: "EXACT",
      node: replaceResult.node,
      startOffset: replaceResult.startOffset,
      endOffset: replaceResult.endOffset,
      range: {
        startOffset: replaceResult.startOffset,
        endOffset: replaceResult.endOffset,
        node: replaceResult.node,
      },
    };
  }

  // 2. المطابقة المرنة عبر خريطة المواضع (0.2 Normalized Match with Index Mapping)
  const { normalizedText: normFull, normToRawMap } = buildNormalizedTextWithMap(rawFullText);
  const normTarget = normalizeTextForMatching(targetText);

  let normOccurrences = 0;
  let normPos = normFull.indexOf(normTarget);
  let singleMatchPos = -1;
  while (normPos !== -1 && normTarget.length > 0) {
    normOccurrences++;
    singleMatchPos = normPos;
    normPos = normFull.indexOf(normTarget, normPos + 1);
  }

  if (normOccurrences > 1) {
    globalAuditLog.record({
      type: "REPLACE",
      blockId,
      details: { targetText, newText, normOccurrences },
      status: "AMBIGUOUS_MATCH",
      error: `النص المستهدف وُجد ${normOccurrences} مرات بعد التطبيع داخل نفس الفقرة.`,
    });
    return {
      status: "AMBIGUOUS_MATCH",
      blockId,
      occurrences: normOccurrences,
      error: `النص المستهدف وُجد ${normOccurrences} مرات بعد التطبيع داخل نفس الفقرة.`,
    };
  }

  if (normOccurrences === 1) {
    const normStart = singleMatchPos;
    const normEnd = singleMatchPos + normTarget.length;

    const rawStart = normToRawMap[normStart];
    const rawEndCharIdx = normToRawMap[normEnd - 1];
    const rawEnd = rawEndCharIdx !== undefined ? rawEndCharIdx + 1 : rawFullText.length;

    const replaceResult = safelyReplaceRawRangeInElement(targetBlockEl, rawStart, rawEnd, newText);
    if (!replaceResult) {
      globalAuditLog.record({
        type: "REPLACE",
        blockId,
        details: { targetText, newText, reason: "DOM_SYNC_MISMATCH_NORMALIZED" },
        status: "DOM_SYNC_MISMATCH",
        error: "تعذر تطبيق الاستبدال المرن على بنية الـ DOM الخام.",
      });
      return {
        status: "DOM_SYNC_MISMATCH",
        blockId,
        error: "تعذر تطبيق الاستبدال المرن على بنية الـ DOM الخام.",
      };
    }

    const updatedHtml = targetBlockEl.innerHTML;
    if (options?.onSuccess) {
      options.onSuccess(updatedHtml);
    }

    globalAuditLog.record({
      type: "REPLACE",
      blockId,
      details: { targetText, newText, matchType: "NORMALIZED", rawStart, rawEnd },
      status: "SUCCESS",
    });

    return {
      status: "SUCCESS",
      blockId,
      originalText: rawFullText.slice(rawStart, rawEnd),
      updatedText: newText,
      matchType: "NORMALIZED",
      node: replaceResult.node,
      startOffset: replaceResult.startOffset,
      endOffset: replaceResult.endOffset,
      range: {
        startOffset: replaceResult.startOffset,
        endOffset: replaceResult.endOffset,
        node: replaceResult.node,
      },
    };
  }

  globalAuditLog.record({
    type: "REPLACE",
    blockId,
    details: { targetText, newText },
    status: "NO_MATCH_FOUND",
    error: `لم يتم العثور على النص المستهدف داخل الفقرة "${blockId}".`,
  });

  return {
    status: "NO_MATCH_FOUND",
    blockId,
    error: `لم يتم العثور على النص المستهدف داخل الفقرة "${blockId}".`,
  };
}

/**
 * مساعدة داخلية لإنشاء فقرة/فقرات جديدة مع دعم فواصل الأسطر الآمنة <br>
 */
function createBlockElementsFromText(text: string): { elements: HTMLElement[]; ids: string[] } {
  // تقسيم النص على فواصل الفقرات (سطرين متتاليين أو أكثر)
  const paraTexts = text.split(/\n\s*\n+/);
  const elements: HTMLElement[] = [];
  const ids: string[] = [];

  for (const para of paraTexts) {
    const blockEl = document.createElement("div");
    const blockId = generateBlockId();
    blockEl.setAttribute("data-block-id", blockId);

    // معالجة الأسطر المنفردة داخل نفس الفقرة عبر <br> آمن
    const lines = para.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) {
        blockEl.appendChild(document.createElement("br"));
      }
      blockEl.appendChild(document.createTextNode(lines[i]));
    }

    elements.push(blockEl);
    ids.push(blockId);
  }

  return { elements, ids };
}

/**
 * 1.7 أداة إدراج فقرة/فقرات بعد فقرة محددة (insertBlockAfter)
 * تدعم الإدراج متعدد الفقرات مع فواصل أسطر آمنة
 */
export function insertBlockAfter(
  blockId: string,
  newText: string,
  options?: {
    rootElement?: HTMLElement | null;
    onSuccess?: (newBlockId: string, newBlockEl: HTMLElement) => void;
  }
): BlockOperationResult {
  if (!blockId) {
    return { status: "BLOCK_NOT_FOUND", blockId: blockId || "unknown" };
  }

  let targetBlockEl: HTMLElement | null = null;
  const searchRoot = options?.rootElement || (typeof document !== "undefined" ? document : null);

  if (searchRoot) {
    targetBlockEl = searchRoot.querySelector(`[data-block-id="${blockId}"]`);
  }

  if (!targetBlockEl) {
    globalAuditLog.record({
      type: "INSERT_AFTER",
      blockId,
      details: { newText },
      status: "BLOCK_NOT_FOUND",
      error: `لم يتم العثور على الفقرة ذات المعرّف "${blockId}".`,
    });
    return {
      status: "BLOCK_NOT_FOUND",
      blockId,
      error: `لم يتم العثور على الفقرة ذات المعرّف "${blockId}".`,
    };
  }

  const { elements, ids } = createBlockElementsFromText(newText);
  let referenceNode: Node | null = targetBlockEl.nextSibling;
  const parentNode = targetBlockEl.parentNode;

  for (const el of elements) {
    if (referenceNode) {
      parentNode?.insertBefore(el, referenceNode);
    } else {
      parentNode?.appendChild(el);
    }
  }

  const primaryBlockId = ids[0];
  const primaryBlockEl = elements[0];

  if (options?.onSuccess) {
    options.onSuccess(primaryBlockId, primaryBlockEl);
  }

  globalAuditLog.record({
    type: "INSERT_AFTER",
    blockId: primaryBlockId,
    details: { targetBlockId: blockId, createdCount: ids.length, createdBlockIds: ids },
    status: "SUCCESS",
  });

  return {
    status: "SUCCESS",
    blockId: primaryBlockId,
    createdBlockIds: ids,
    updatedText: newText,
    node: primaryBlockEl,
    startOffset: 0,
    endOffset: newText.length,
    range: {
      startOffset: 0,
      endOffset: newText.length,
      node: primaryBlockEl,
    },
  };
}

/**
 * 1.7 أداة إدراج فقرة/فقرات قبل فقرة محددة (insertBlockBefore)
 * تدعم الإدراج متعدد الفقرات مع فواصل أسطر آمنة
 */
export function insertBlockBefore(
  blockId: string,
  newText: string,
  options?: {
    rootElement?: HTMLElement | null;
    onSuccess?: (newBlockId: string, newBlockEl: HTMLElement) => void;
  }
): BlockOperationResult {
  if (!blockId) {
    return { status: "BLOCK_NOT_FOUND", blockId: blockId || "unknown" };
  }

  let targetBlockEl: HTMLElement | null = null;
  const searchRoot = options?.rootElement || (typeof document !== "undefined" ? document : null);

  if (searchRoot) {
    targetBlockEl = searchRoot.querySelector(`[data-block-id="${blockId}"]`);
  }

  if (!targetBlockEl) {
    globalAuditLog.record({
      type: "INSERT_BEFORE",
      blockId,
      details: { newText },
      status: "BLOCK_NOT_FOUND",
      error: `لم يتم العثور على الفقرة ذات المعرّف "${blockId}".`,
    });
    return {
      status: "BLOCK_NOT_FOUND",
      blockId,
      error: `لم يتم العثور على الفقرة ذات المعرّف "${blockId}".`,
    };
  }

  const { elements, ids } = createBlockElementsFromText(newText);
  const parentNode = targetBlockEl.parentNode;

  for (const el of elements) {
    parentNode?.insertBefore(el, targetBlockEl);
  }

  const primaryBlockId = ids[0];
  const primaryBlockEl = elements[0];

  if (options?.onSuccess) {
    options.onSuccess(primaryBlockId, primaryBlockEl);
  }

  globalAuditLog.record({
    type: "INSERT_BEFORE",
    blockId: primaryBlockId,
    details: { targetBlockId: blockId, createdCount: ids.length, createdBlockIds: ids },
    status: "SUCCESS",
  });

  return {
    status: "SUCCESS",
    blockId: primaryBlockId,
    createdBlockIds: ids,
    updatedText: newText,
    node: primaryBlockEl,
    startOffset: 0,
    endOffset: newText.length,
    range: {
      startOffset: 0,
      endOffset: newText.length,
      node: primaryBlockEl,
    },
  };
}

/**
 * أداة حذف فقرة بالكامل (deleteBlock)
 * مع قيد أمان صارم: رفض حذف الفقرة الوحيدة المتبقية (CANNOT_DELETE_LAST_BLOCK)
 */
export function deleteBlock(
  blockId: string,
  options?: {
    rootElement?: HTMLElement | null;
    onSuccess?: (deletedBlockId: string) => void;
  }
): BlockOperationResult {
  if (!blockId) {
    return { status: "BLOCK_NOT_FOUND", blockId: blockId || "unknown" };
  }

  let targetBlockEl: HTMLElement | null = null;
  const searchRoot = options?.rootElement || (typeof document !== "undefined" ? document : null);

  if (searchRoot) {
    targetBlockEl = searchRoot.querySelector(`[data-block-id="${blockId}"]`);
  }

  if (!targetBlockEl) {
    globalAuditLog.record({
      type: "DELETE",
      blockId,
      details: {},
      status: "BLOCK_NOT_FOUND",
      error: `لم يتم العثور على الفقرة ذات المعرّف "${blockId}".`,
    });
    return {
      status: "BLOCK_NOT_FOUND",
      blockId,
      error: `لم يتم العثور على الفقرة ذات المعرّف "${blockId}".`,
    };
  }

  const parent = targetBlockEl.parentElement;
  if (parent) {
    const siblingBlocks = Array.from(parent.children).filter(
      (c) => c instanceof HTMLElement && c.hasAttribute("data-block-id")
    );
    if (siblingBlocks.length <= 1) {
      globalAuditLog.record({
        type: "DELETE",
        blockId,
        details: {},
        status: "CANNOT_DELETE_LAST_BLOCK",
        error: "لا يمكن حذف الفقرة الوحيدة المتبقية في المحرر.",
      });
      return {
        status: "CANNOT_DELETE_LAST_BLOCK",
        blockId,
        error: "لا يمكن حذف الفقرة الوحيدة المتبقية في المحرر.",
      };
    }
  }

  targetBlockEl.remove();

  if (options?.onSuccess) {
    options.onSuccess(blockId);
  }

  globalAuditLog.record({
    type: "DELETE",
    blockId,
    details: {},
    status: "SUCCESS",
  });

  return {
    status: "SUCCESS",
    blockId,
  };
}

/**
 * 0.3 أداة دمج فقرتين متجاورتين (mergeBlocks)
 * تُبلِّغ صراحة بالمعرّف الفعلي الباقي في الـ DOM (firstEl) أياً كان ترتيب المعاملات
 */
export function mergeBlocks(
  blockIdA: string,
  blockIdB: string,
  options?: {
    rootElement?: HTMLElement | null;
    onSuccess?: (mergedBlockId: string, mergedBlockEl: HTMLElement) => void;
  }
): BlockOperationResult {
  if (!blockIdA || !blockIdB) {
    return {
      status: "BLOCK_NOT_FOUND",
      blockId: !blockIdA ? blockIdA : blockIdB,
      error: "معرّف الفقرة غير صالح.",
    };
  }

  let elA: HTMLElement | null = null;
  let elB: HTMLElement | null = null;
  const searchRoot = options?.rootElement || (typeof document !== "undefined" ? document : null);

  if (searchRoot) {
    elA = searchRoot.querySelector(`[data-block-id="${blockIdA}"]`);
    elB = searchRoot.querySelector(`[data-block-id="${blockIdB}"]`);
  }

  if (!elA) {
    globalAuditLog.record({
      type: "MERGE",
      blockId: blockIdA,
      details: { blockIdB },
      status: "BLOCK_NOT_FOUND",
      error: `لم يتم العثور على الفقرة الأولى "${blockIdA}".`,
    });
    return {
      status: "BLOCK_NOT_FOUND",
      blockId: blockIdA,
      error: `لم يتم العثور على الفقرة الأولى "${blockIdA}".`,
    };
  }

  if (!elB) {
    globalAuditLog.record({
      type: "MERGE",
      blockId: blockIdB,
      details: { blockIdA },
      status: "BLOCK_NOT_FOUND",
      error: `لم يتم العثور على الفقرة الثانية "${blockIdB}".`,
    });
    return {
      status: "BLOCK_NOT_FOUND",
      blockId: blockIdB,
      error: `لم يتم العثور على الفقرة الثانية "${blockIdB}".`,
    };
  }

  // التحقق من التجاور المباشر
  const isDirectlyAdjacent =
    elA.nextElementSibling === elB || elB.nextElementSibling === elA;

  if (!isDirectlyAdjacent) {
    globalAuditLog.record({
      type: "MERGE",
      blockId: `${blockIdA},${blockIdB}`,
      details: {},
      status: "BLOCKS_NOT_ADJACENT",
      error: `الفقرتان "${blockIdA}" و "${blockIdB}" ليستا متجاورتين مباشرة.`,
    });
    return {
      status: "BLOCKS_NOT_ADJACENT",
      blockId: `${blockIdA},${blockIdB}`,
      error: `الفقرتان "${blockIdA}" و "${blockIdB}" ليستا متجاورتين مباشرة.`,
    };
  }

  // ترتيب الفقرتين حسب موقعهما الفعلي في شجرة الـ DOM
  const firstEl = elA.nextElementSibling === elB ? elA : elB;
  const secondEl = firstEl === elA ? elB : elA;
  const remainingBlockId = firstEl.getAttribute("data-block-id") || (firstEl === elA ? blockIdA : blockIdB);
  const removedBlockId = secondEl.getAttribute("data-block-id") || (secondEl === elA ? blockIdA : blockIdB);

  const textFirst = cleanBlockRawText(firstEl.innerHTML);
  const textSecond = cleanBlockRawText(secondEl.innerHTML);

  const mergedText = textFirst && textSecond ? `${textFirst} ${textSecond}` : (textFirst || textSecond);

  while (firstEl.firstChild) {
    firstEl.removeChild(firstEl.firstChild);
  }
  const safeTextNode = document.createTextNode(mergedText);
  firstEl.appendChild(safeTextNode);

  secondEl.remove();

  if (options?.onSuccess) {
    options.onSuccess(remainingBlockId, firstEl);
  }

  globalAuditLog.record({
    type: "MERGE",
    blockId: remainingBlockId,
    details: { removedBlockId, inputBlockA: blockIdA, inputBlockB: blockIdB },
    status: "SUCCESS",
  });

  return {
    status: "SUCCESS",
    blockId: remainingBlockId,
    updatedText: mergedText,
    node: firstEl,
    startOffset: textFirst.length,
    endOffset: mergedText.length,
    range: {
      startOffset: textFirst.length,
      endOffset: mergedText.length,
      node: firstEl,
    },
  };
}

// ==========================================================================
// 1.1 التحقق المسبق قبل التنفيذ (Two-Phase Validation)
// ==========================================================================
export interface PlannedOperation {
  type: "REPLACE" | "INSERT_AFTER" | "INSERT_BEFORE" | "DELETE" | "MERGE";
  blockId: string;
  targetText?: string;
  newText?: string;
  targetBlockIdB?: string;
}

export interface ValidationItemResult {
  opIndex: number;
  opType: string;
  blockId: string;
  status: BlockOperationStatus;
  isValid: boolean;
  error?: string;
}

export function validateBatchOperations(
  ops: PlannedOperation[],
  rootElement?: HTMLElement | null
): { isValid: boolean; results: ValidationItemResult[] } {
  const searchRoot = rootElement || (typeof document !== "undefined" ? document : null);
  const results: ValidationItemResult[] = [];
  let allValid = true;

  if (!searchRoot) {
    return {
      isValid: false,
      results: ops.map((op, i) => ({
        opIndex: i,
        opType: op.type,
        blockId: op.blockId,
        status: "BLOCK_NOT_FOUND",
        isValid: false,
        error: "Root element not found",
      })),
    };
  }

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    const el = searchRoot.querySelector(`[data-block-id="${op.blockId}"]`);
    if (!el) {
      allValid = false;
      results.push({
        opIndex: i,
        opType: op.type,
        blockId: op.blockId,
        status: "BLOCK_NOT_FOUND",
        isValid: false,
        error: `الفقرة "${op.blockId}" غير موجودة.`,
      });
      continue;
    }

    if (op.type === "REPLACE") {
      const targetText = op.targetText || "";
      const rawText = cleanBlockRawText(el.innerHTML);
      let occurrences = 0;
      let p = rawText.indexOf(targetText);
      while (p !== -1 && targetText.length > 0) {
        occurrences++;
        p = rawText.indexOf(targetText, p + 1);
      }

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
            error: `النص المستهدف غير موجود في الفقرة "${op.blockId}".`,
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
            error: `النص المستهدف مكرر ${nOcc} مرات بعد التطبيع في الفقرة "${op.blockId}".`,
          });
          continue;
        }
      } else if (occurrences > 1) {
        allValid = false;
        results.push({
          opIndex: i,
          opType: op.type,
          blockId: op.blockId,
          status: "AMBIGUOUS_MATCH",
          isValid: false,
          error: `النص المستهدف مكرر ${occurrences} مرات في الفقرة "${op.blockId}".`,
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
            status: "CANNOT_DELETE_LAST_BLOCK",
            isValid: false,
            error: "لا يمكن حذف الفقرة الوحيدة المتبقية.",
          });
          continue;
        }
      }
    } else if (op.type === "MERGE") {
      const elB = op.targetBlockIdB
        ? (searchRoot.querySelector(`[data-block-id="${op.targetBlockIdB}"]`) as HTMLElement | null)
        : null;
      if (!elB) {
        allValid = false;
        results.push({
          opIndex: i,
          opType: op.type,
          blockId: op.blockId,
          status: "BLOCK_NOT_FOUND",
          isValid: false,
          error: `الفقرة الثانية "${op.targetBlockIdB}" غير موجودة للدمج.`,
        });
        continue;
      }
      const isAdjacent = el.nextElementSibling === elB || elB.nextElementSibling === el;
      if (!isAdjacent) {
        allValid = false;
        results.push({
          opIndex: i,
          opType: op.type,
          blockId: op.blockId,
          status: "BLOCKS_NOT_ADJACENT",
          isValid: false,
          error: "الفقرتان ليستا متجاورتين مباشرة.",
        });
        continue;
      }
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

// ==========================================================================
// 1.5 & 1.6 مدير الدفعات الذرية وعدّاء الدفعات الفطين (BlockBatchManager)
// ==========================================================================
export interface BatchSnapshot {
  html: string;
  chapters?: any[];
  content?: string;
  isNovel?: boolean;
}

export class BlockBatchManager {
  private activeBatchId: string | null = null;
  private snapshot: BatchSnapshot | null = null;
  private rootElement: HTMLElement | null = null;

  isBatchActive(): boolean {
    return this.activeBatchId !== null;
  }

  getActiveBatchId(): string | null {
    return this.activeBatchId;
  }

  /**
   * 1.5 فتح دفعة تعديلات جديدة مع حماية منع التداخل (Batch Reentrancy Guard)
   */
  beginBatch(rootElement: HTMLElement | null, initialSnapshot: BatchSnapshot): string | null {
    if (this.activeBatchId !== null) {
      console.warn("beginBatch rejected: A batch is already active:", this.activeBatchId);
      globalAuditLog.record({
        type: "BATCH_BEGIN",
        blockId: this.activeBatchId,
        details: { rejected: true, reason: "BATCH_ALREADY_ACTIVE" },
        status: "BATCH_ALREADY_ACTIVE",
      });
      return null;
    }

    this.activeBatchId = generateBlockId();
    this.rootElement = rootElement;
    this.snapshot = {
      html: rootElement ? rootElement.innerHTML : initialSnapshot.html,
      chapters: initialSnapshot.chapters ? JSON.parse(JSON.stringify(initialSnapshot.chapters)) : undefined,
      content: initialSnapshot.content,
      isNovel: initialSnapshot.isNovel,
    };

    globalAuditLog.record({
      type: "BATCH_BEGIN",
      blockId: this.activeBatchId,
      details: {},
      status: "SUCCESS",
    });

    return this.activeBatchId;
  }

  commitBatch(): { success: boolean; snapshot: BatchSnapshot | null; error?: string } {
    if (!this.activeBatchId) {
      return { success: true, snapshot: null };
    }
    const snap = this.snapshot;
    const batchId = this.activeBatchId;
    this.activeBatchId = null;
    this.snapshot = null;
    this.rootElement = null;

    globalAuditLog.record({
      type: "BATCH_COMMIT",
      blockId: batchId,
      details: {},
      status: "SUCCESS",
    });

    return { success: true, snapshot: snap };
  }

  rollbackBatch(onRollbackRestore?: (snapshot: BatchSnapshot) => void): boolean {
    if (!this.activeBatchId || !this.snapshot) {
      return false;
    }
    const batchId = this.activeBatchId;
    const snap = this.snapshot;

    if (this.rootElement && snap.html) {
      this.rootElement.innerHTML = snap.html;
    }

    if (onRollbackRestore && snap) {
      onRollbackRestore(snap);
    }

    this.activeBatchId = null;
    this.snapshot = null;
    this.rootElement = null;

    globalAuditLog.record({
      type: "BATCH_ROLLBACK",
      blockId: batchId,
      details: {},
      status: "SUCCESS",
    });

    return true;
  }

  /**
   * 1.6 عدّاء دفعات يفهم حالات الفشل (Status-Aware Batch Runner)
   * يفحص حالة كل عملية فور تنفيذها: أول حالة غير SUCCESS تطلق rollbackBatch تلقائياً
   */
  async runCheckedBatch(
    rootElement: HTMLElement | null,
    initialSnapshot: BatchSnapshot,
    operations: Array<() => BlockOperationResult | Promise<BlockOperationResult>>,
    onRollbackRestore?: (snapshot: BatchSnapshot) => void
  ): Promise<{ success: boolean; results: BlockOperationResult[]; failedIndex?: number; error?: string }> {
    const batchId = this.beginBatch(rootElement, initialSnapshot);
    if (!batchId) {
      return { success: false, results: [], error: "BATCH_ALREADY_ACTIVE" };
    }

    const executedResults: BlockOperationResult[] = [];

    for (let i = 0; i < operations.length; i++) {
      try {
        const res = await operations[i]();
        executedResults.push(res);
        if (res.status !== "SUCCESS") {
          this.rollbackBatch(onRollbackRestore);
          return {
            success: false,
            results: executedResults,
            failedIndex: i,
            error: res.error || `Operation ${i} failed with status ${res.status}`,
          };
        }
      } catch (err: any) {
        this.rollbackBatch(onRollbackRestore);
        return {
          success: false,
          results: executedResults,
          failedIndex: i,
          error: err?.message || String(err),
        };
      }
    }

    this.commitBatch();
    return { success: true, results: executedResults };
  }

  async runAtomicBatch<T>(
    rootElement: HTMLElement | null,
    initialSnapshot: BatchSnapshot,
    operations: () => Promise<T> | T,
    onRollbackRestore?: (snapshot: BatchSnapshot) => void
  ): Promise<{ success: boolean; result?: T; error?: string }> {
    const batchId = this.beginBatch(rootElement, initialSnapshot);
    if (!batchId) {
      return { success: false, error: "BATCH_ALREADY_ACTIVE" };
    }
    try {
      const result = await operations();
      this.commitBatch();
      return { success: true, result };
    } catch (err: any) {
      this.rollbackBatch(onRollbackRestore);
      return { success: false, error: err?.message || String(err) };
    }
  }
}

export const globalBatchManager = new BlockBatchManager();
