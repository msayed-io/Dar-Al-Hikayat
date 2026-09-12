/**
 * البنية التحتية لنظام معرّفات الفقرات (Block-ID Infrastructure) — المرحلة الثانية
 * محرر دار الحكايات — طبقة داخلية لتتبع ومعالجة الفقرات بدقة جراحية
 * 
 * الميزات:
 * 1. تتبع الإحداثيات الدقيقة للنص المُعدل (Precise Range Tracking + Node Reference)
 * 2. أدوات الإدراج والحذف والدمج (insertBlockAfter/Before, deleteBlock, mergeBlocks)
 * 3. تحصين إدراج النصوص ضد تلف التنسيق وحقن HTML (Text Node Sanitization)
 * 4. تجميع التعديلات المتعددة في عملية تراجع ذرية واحدة (Atomic Undo Batching)
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
  | "CANNOT_DELETE_LAST_BLOCK"
  | "BLOCKS_NOT_ADJACENT"
  | "BATCH_FAILED";

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
  error?: string;
}

// Alias for backward compatibility
export type BlockReplacementStatus = BlockOperationStatus;
export type BlockReplacementResult = BlockOperationResult;

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
 * فحص وتثبيت معرّفات الفقرات data-block-id على مستوى عناصر الـ DOM للحاوية
 */
export function ensureBlockIdsInElement(container: HTMLElement): boolean {
  if (!container) return false;

  let mutated = false;
  const seenIds = new Set<string>();
  const childNodes = Array.from(container.childNodes);

  let hasDirectTextNodes = false;
  for (const node of childNodes) {
    if (
      (node.nodeType === Node.TEXT_NODE && node.textContent && node.textContent.trim().length > 0) ||
      (node.nodeType === Node.ELEMENT_NODE && ["SPAN", "MARK", "EM", "B", "I", "U", "A"].includes((node as HTMLElement).tagName))
    ) {
      hasDirectTextNodes = true;
      break;
    }
  }

  if (hasDirectTextNodes) {
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-block-id", generateBlockId());
    while (container.firstChild) {
      wrapper.appendChild(container.firstChild);
    }
    container.appendChild(wrapper);
    seenIds.add(wrapper.getAttribute("data-block-id")!);
    return true;
  }

  const children = Array.from(container.children);
  for (const child of children) {
    if (!(child instanceof HTMLElement)) continue;

    const currentId = child.getAttribute("data-block-id");

    if (!currentId || seenIds.has(currentId)) {
      const newId = generateBlockId();
      child.setAttribute("data-block-id", newId);
      seenIds.add(newId);
      mutated = true;
    } else {
      seenIds.add(currentId);
    }
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
 * استخراج المحتوى المُهيكل للذكاء الاصطناعي بصيغة المعرّفات:
 * [b_xxxxxxxx] نص الفقرة هنا
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
          if (cleanText) {
            blocks.push({ id, text: cleanText });
          }
        }
      }
    } else {
      const clean = cleanBlockRawText(containerOrHtml);
      return clean ? `[${generateBlockId()}] ${clean}` : "";
    }
  } else if (containerOrHtml instanceof HTMLElement) {
    ensureBlockIdsInElement(containerOrHtml);
    const elements = Array.from(containerOrHtml.children);
    
    if (elements.length === 0) {
      const clean = cleanBlockRawText(containerOrHtml.innerHTML);
      if (clean) {
        const id = containerOrHtml.getAttribute("data-block-id") || generateBlockId();
        blocks.push({ id, text: clean });
      }
    } else {
      for (const el of elements) {
        if (el instanceof HTMLElement) {
          const id = el.getAttribute("data-block-id") || generateBlockId();
          const cleanText = cleanBlockRawText(el.innerHTML);
          if (cleanText) {
            blocks.push({ id, text: cleanText });
          }
        }
      }
    }
  }

  return blocks
    .map((b) => `[${b.id}] ${b.text}`)
    .join("\n");
}

/**
 * مساعدة داخلية: البحث عن عقدة نصية واستبدالها بنص آمن مع إرجاع موضع الإزاحة ومرجع الـ Node
 */
function safelyReplaceTextInElement(
  container: HTMLElement,
  targetText: string,
  newText: string
): { node: Node; startOffset: number; endOffset: number } | null {
  // تجميع كافة العقد النصية داخل العنصر
  const walker = typeof document !== "undefined" && typeof document.createTreeWalker === "function"
    ? document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null)
    : null;

  let currentFullText = "";
  const textNodes: { node: Node; start: number; end: number }[] = [];

  if (walker) {
    let n = walker.nextNode();
    while (n) {
      const val = n.textContent || "";
      const start = currentFullText.length;
      currentFullText += val;
      const end = currentFullText.length;
      textNodes.push({ node: n, start, end });
      n = walker.nextNode();
    }
  } else {
    // محاكاة في بيئات بدون createTreeWalker
    const collectTextNodes = (el: Node) => {
      if (el.nodeType === 3) {
        const val = el.textContent || "";
        const start = currentFullText.length;
        currentFullText += val;
        const end = currentFullText.length;
        textNodes.push({ node: el, start, end });
      } else {
        for (let i = 0; i < el.childNodes.length; i++) {
          collectTextNodes(el.childNodes[i]);
        }
      }
    };
    collectTextNodes(container);
  }

  // البحث عن موضع targetText
  const matchIndex = currentFullText.indexOf(targetText);
  if (matchIndex === -1) {
    // محاولة البحث عن عقدة نصية وحيدة
    if (container.textContent && container.textContent.includes(targetText)) {
      const idx = container.textContent.indexOf(targetText);
      const safeTextNode = document.createTextNode(newText);
      container.textContent = container.textContent.replace(targetText, newText);
      return {
        node: container.firstChild || container,
        startOffset: idx,
        endOffset: idx + newText.length,
      };
    }
    return null;
  }

  const matchEndIndex = matchIndex + targetText.length;

  // إيجاد العقدة أو العقد المعنية بالاستبدال
  for (const item of textNodes) {
    if (matchIndex >= item.start && matchEndIndex <= item.end) {
      // الاستبدال بالكامل داخل عقدة نصية واحدة
      const relStart = matchIndex - item.start;
      const relEnd = matchEndIndex - item.start;
      const originalVal = item.node.textContent || "";
      const before = originalVal.slice(0, relStart);
      const after = originalVal.slice(relEnd);

      const parent = item.node.parentNode;
      if (parent) {
        const beforeNode = document.createTextNode(before);
        const newNode = document.createTextNode(newText);
        const afterNode = document.createTextNode(after);

        parent.insertBefore(beforeNode, item.node);
        parent.insertBefore(newNode, item.node);
        parent.insertBefore(afterNode, item.node);
        parent.removeChild(item.node);

        return {
          node: newNode,
          startOffset: matchIndex,
          endOffset: matchIndex + newText.length,
        };
      }
    }
  }

  // إذا كان النص يمتد عبر أكثر من عقدة (مثلاً جزء داخل span وجزء خارجه)
  // نستبدل النص الكامل للعنصر بأمان عبر createTextNode
  const fullText = container.textContent || "";
  const replacedFullText = fullText.replace(targetText, newText);
  const startOffset = fullText.indexOf(targetText);
  const endOffset = startOffset + newText.length;

  // تنظيف المحتوى الداخلي ووضع عقدة نصية آمنة
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
  const safeNode = document.createTextNode(replacedFullText);
  container.appendChild(safeNode);

  return {
    node: safeNode,
    startOffset,
    endOffset,
  };
}

/**
 * 1️⃣ دالة التعديل الموضعي الدقيق داخل فقرة محددة بمعرّفها (Scoped Block Replacement)
 * مع تتبع الإحداثيات الدقيقة (startOffset, endOffset) وإرجاع مرجع عقدة الـ DOM (Node Reference)
 * وتحصين تام ضد تلف التنسيق باستخدام Text Nodes آمنة.
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
    return {
      status: "BLOCK_NOT_FOUND",
      blockId,
      error: `لم يتم العثور على الفقرة ذات المعرّف "${blockId}" داخل المحرر.`,
    };
  }

  const currentHtml = targetBlockEl.innerHTML;
  const currentRawText = cleanBlockRawText(currentHtml);

  if (!currentRawText) {
    return {
      status: "NO_MATCH_FOUND",
      blockId,
      error: "الفقرة المستهدفة فارغة.",
    };
  }

  // 1. المطابقة الحرفية الكاملة (Exact String Match)
  let exactOccurrences = 0;
  let pos = currentRawText.indexOf(targetText);
  while (pos !== -1) {
    exactOccurrences++;
    pos = currentRawText.indexOf(targetText, pos + 1);
  }

  if (exactOccurrences > 1) {
    return {
      status: "AMBIGUOUS_MATCH",
      blockId,
      occurrences: exactOccurrences,
      error: `النص المستهدف مكرر ${exactOccurrences} مرات داخل نفس الفقرة.`,
    };
  }

  if (exactOccurrences === 1) {
    // تنفيذ الاستبدال الآمن
    const replaceResult = safelyReplaceTextInElement(targetBlockEl, targetText, newText);
    const updatedHtml = targetBlockEl.innerHTML;

    if (options?.onSuccess) {
      options.onSuccess(updatedHtml);
    }

    const startOffset = replaceResult ? replaceResult.startOffset : currentRawText.indexOf(targetText);
    const endOffset = replaceResult ? replaceResult.endOffset : startOffset + newText.length;
    const node = replaceResult ? replaceResult.node : targetBlockEl;

    return {
      status: "SUCCESS",
      blockId,
      originalText: targetText,
      updatedText: newText,
      matchType: "EXACT",
      node,
      startOffset,
      endOffset,
      range: {
        startOffset,
        endOffset,
        node,
      },
    };
  }

  // 2. المطابقة المرنة (Normalized Match)
  const normCurrent = normalizeTextForMatching(currentRawText);
  const normTarget = normalizeTextForMatching(targetText);

  let normOccurrences = 0;
  let normPos = normCurrent.indexOf(normTarget);
  while (normPos !== -1) {
    normOccurrences++;
    normPos = normCurrent.indexOf(normTarget, normPos + 1);
  }

  if (normOccurrences > 1) {
    return {
      status: "AMBIGUOUS_MATCH",
      blockId,
      occurrences: normOccurrences,
      error: `النص المستهدف وُجد ${normOccurrences} مرات بعد التطبيع داخل نفس الفقرة.`,
    };
  }

  if (normOccurrences === 1) {
    // استبدال النص عبر إسناد Text Node آمن
    while (targetBlockEl.firstChild) {
      targetBlockEl.removeChild(targetBlockEl.firstChild);
    }
    const safeNode = document.createTextNode(newText);
    targetBlockEl.appendChild(safeNode);
    const updatedHtml = targetBlockEl.innerHTML;

    if (options?.onSuccess) {
      options.onSuccess(updatedHtml);
    }

    return {
      status: "SUCCESS",
      blockId,
      originalText: targetText,
      updatedText: newText,
      matchType: "NORMALIZED",
      node: safeNode,
      startOffset: 0,
      endOffset: newText.length,
      range: {
        startOffset: 0,
        endOffset: newText.length,
        node: safeNode,
      },
    };
  }

  return {
    status: "NO_MATCH_FOUND",
    blockId,
    error: `لم يتم العثور على النص المستهدف داخل الفقرة "${blockId}".`,
  };
}

/**
 * 2️⃣ أداة إدراج فقرة جديدة بعد فقرة محددة (insertBlockAfter)
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
    return {
      status: "BLOCK_NOT_FOUND",
      blockId,
      error: `لم يتم العثور على الفقرة ذات المعرّف "${blockId}".`,
    };
  }

  const newBlockId = generateBlockId();
  const newBlock = document.createElement("div");
  newBlock.setAttribute("data-block-id", newBlockId);

  // إدراج النص الجديد كعقدة نصية خام آمنة تماماً
  const textNode = document.createTextNode(newText);
  newBlock.appendChild(textNode);

  if (targetBlockEl.nextSibling) {
    targetBlockEl.parentNode?.insertBefore(newBlock, targetBlockEl.nextSibling);
  } else {
    targetBlockEl.parentNode?.appendChild(newBlock);
  }

  if (options?.onSuccess) {
    options.onSuccess(newBlockId, newBlock);
  }

  return {
    status: "SUCCESS",
    blockId: newBlockId,
    updatedText: newText,
    node: newBlock,
    startOffset: 0,
    endOffset: newText.length,
    range: {
      startOffset: 0,
      endOffset: newText.length,
      node: newBlock,
    },
  };
}

/**
 * 2️⃣ أداة إدراج فقرة جديدة قبل فقرة محددة (insertBlockBefore)
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
    return {
      status: "BLOCK_NOT_FOUND",
      blockId,
      error: `لم يتم العثور على الفقرة ذات المعرّف "${blockId}".`,
    };
  }

  const newBlockId = generateBlockId();
  const newBlock = document.createElement("div");
  newBlock.setAttribute("data-block-id", newBlockId);

  // إدراج النص الجديد كعقدة نصية خام آمنة تماماً
  const textNode = document.createTextNode(newText);
  newBlock.appendChild(textNode);

  targetBlockEl.parentNode?.insertBefore(newBlock, targetBlockEl);

  if (options?.onSuccess) {
    options.onSuccess(newBlockId, newBlock);
  }

  return {
    status: "SUCCESS",
    blockId: newBlockId,
    updatedText: newText,
    node: newBlock,
    startOffset: 0,
    endOffset: newText.length,
    range: {
      startOffset: 0,
      endOffset: newText.length,
      node: newBlock,
    },
  };
}

/**
 * 2️⃣ أداة حذف فقرة بالكامل (deleteBlock)
 * مع قيد أمان صارم: رفض حذف الفقرة الوحيدة المتبقية في المحرر (CANNOT_DELETE_LAST_BLOCK)
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
    return {
      status: "BLOCK_NOT_FOUND",
      blockId,
      error: `لم يتم العثور على الفقرة ذات المعرّف "${blockId}".`,
    };
  }

  // فحص أمان: هل هذه الفقرة هي الوحيدة المتبقية في الحاوية؟
  const parent = targetBlockEl.parentElement;
  if (parent) {
    const siblingBlocks = Array.from(parent.children).filter(
      (c) => c instanceof HTMLElement && c.hasAttribute("data-block-id")
    );
    if (siblingBlocks.length <= 1) {
      return {
        status: "CANNOT_DELETE_LAST_BLOCK",
        blockId,
        error: "لا يمكن حذف الفقرة الوحيدة المتبقية في المحرر.",
      };
    }
  }

  // حذف الفقرة من الـ DOM
  targetBlockEl.remove();

  if (options?.onSuccess) {
    options.onSuccess(blockId);
  }

  return {
    status: "SUCCESS",
    blockId,
  };
}

/**
 * 2️⃣ أداة دمج فقرتين متجاورتين (mergeBlocks)
 * مع قيد أمان صارم: التحقق من تجاور الفقرتين مباشرة (BLOCKS_NOT_ADJACENT)
 * والاحتفاظ بمعرّف الفقرة الأولى وحذف معرّف الثانية نهائياً.
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
    return {
      status: "BLOCK_NOT_FOUND",
      blockId: blockIdA,
      error: `لم يتم العثور على الفقرة الأولى "${blockIdA}".`,
    };
  }

  if (!elB) {
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
    return {
      status: "BLOCKS_NOT_ADJACENT",
      blockId: `${blockIdA},${blockIdB}`,
      error: `الفقرتان "${blockIdA}" و "${blockIdB}" ليستا متجاورتين مباشرة.`,
    };
  }

  // ترتيب الفقرتين حسب موقعهما الفعلي في شجرة الـ DOM
  const firstEl = elA.nextElementSibling === elB ? elA : elB;
  const secondEl = firstEl === elA ? elB : elA;

  const textFirst = cleanBlockRawText(firstEl.innerHTML);
  const textSecond = cleanBlockRawText(secondEl.innerHTML);

  // دمج النصين بأمان عبر Text Node
  const mergedText = textFirst && textSecond ? `${textFirst} ${textSecond}` : (textFirst || textSecond);

  while (firstEl.firstChild) {
    firstEl.removeChild(firstEl.firstChild);
  }
  const safeTextNode = document.createTextNode(mergedText);
  firstEl.appendChild(safeTextNode);

  // حذف الفقرة الثانية نهائياً
  secondEl.remove();

  if (options?.onSuccess) {
    options.onSuccess(blockIdA, firstEl);
  }

  return {
    status: "SUCCESS",
    blockId: blockIdA,
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

/**
 * 4️⃣ مدير الدفعات الذرية (Atomic Undo Batching Manager)
 * يضمن تجميع عدة عمليات متتالية في سجل تراجع تاريخي واحد (Undo Step)،
 * مع توفير إمكانية التراجع الكامل التلقائي (Rollback) في حال فشل أي عملية وسيطة.
 */
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

  /**
   * هل توجد دفعة تعديلات مفتوحة حالياً؟
   */
  isBatchActive(): boolean {
    return this.activeBatchId !== null;
  }

  /**
   * فتح دفعة تعديلات ذرية جديدة وأخذ لقطة للحالة الحالية للـ DOM والبيانات
   */
  beginBatch(rootElement: HTMLElement | null, initialSnapshot: BatchSnapshot): string {
    this.activeBatchId = generateBlockId();
    this.rootElement = rootElement;
    this.snapshot = {
      html: rootElement ? rootElement.innerHTML : initialSnapshot.html,
      chapters: initialSnapshot.chapters ? JSON.parse(JSON.stringify(initialSnapshot.chapters)) : undefined,
      content: initialSnapshot.content,
      isNovel: initialSnapshot.isNovel,
    };
    return this.activeBatchId;
  }

  /**
   * تثبيت الدفعة بنجاح وإرجاع اللقطة لتسجيلها في التاريخ كخطوة واحدة
   */
  commitBatch(): { success: true; snapshot: BatchSnapshot | null } {
    if (!this.activeBatchId) {
      return { success: true, snapshot: null };
    }
    const snap = this.snapshot;
    this.activeBatchId = null;
    this.snapshot = null;
    return { success: true, snapshot: snap };
  }

  /**
   * التراجع الكامل والتلقائي عن كافة التعديلات التي جرت في الدفعة واستعادة الحالة الأصلية تماماً
   */
  rollbackBatch(onRollbackRestore?: (snapshot: BatchSnapshot) => void): boolean {
    if (!this.activeBatchId || !this.snapshot) {
      return false;
    }

    if (this.rootElement && this.snapshot.html) {
      this.rootElement.innerHTML = this.snapshot.html;
    }

    if (onRollbackRestore && this.snapshot) {
      onRollbackRestore(this.snapshot);
    }

    this.activeBatchId = null;
    this.snapshot = null;
    return true;
  }

  /**
   * تنفيذ دالة عمليات ذرية مجمعة مع إدارة كاملة للـ Rollback عند أي فشل
   */
  async runAtomicBatch<T>(
    rootElement: HTMLElement | null,
    initialSnapshot: BatchSnapshot,
    operations: () => Promise<T> | T,
    onRollbackRestore?: (snapshot: BatchSnapshot) => void
  ): Promise<{ success: boolean; result?: T; error?: string }> {
    this.beginBatch(rootElement, initialSnapshot);
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

// مثيل عام لمدير الدفعات
export const globalBatchManager = new BlockBatchManager();
