/**
 * نظام الوكيل الأدبي التنفيذي (Agentic Editing System) — دَارُ الحِكَايَاتِ
 * الربط المعماري الجراحي مع منظومة الأقفال والفقرات والتدقيق
 */

import {
  acquireAgentEditLock,
  releaseAgentEditLock,
  isAgentEditLocked,
  getStructuredContentForAI,
  replaceTextWithinBlock,
  insertBlockAfter,
  insertBlockBefore,
  deleteBlock,
  validateBatchOperations,
  globalBatchManager,
  findTextInContent,
  validateAndHealMentions,
  globalAuditLog,
  PlannedOperation,
  AttachedMention,
  TextMatchItem,
  cleanBlockRawText,
  mergeBlocks,
  moveBlock,
  splitBlock,
} from "./editor-block-system";

import {
  requestExecutiveDecision,
  UNIFIED_AGENT_INSTRUCTION,
  AGENTIC_TOOL_DECLARATIONS,
} from "./ai-assistant-service";
import { runDiacritizeJob } from "./tashkeel-pipeline";

// ============================================================================
// 1. الثوابت والأدوات والأنواع
// ============================================================================

export const EXEC_BRIDGE_TOKEN = "[[EXEC]]";

export const MAX_TOOL_CALLS_PER_REQUEST = 25;
export const MAX_EXPANDED_OPS_PER_REQUEST = 30;
export const MAX_MODEL_ROUNDS_PER_REQUEST = 3;

export type ExecutiveToolCall =
  | {
      name: "replace_text";
      args: {
        block_id: string;
        target_text: string;
        new_text: string;
        step_note: string;
      };
    }
  | {
      name: "insert_text";
      args: {
        anchor_block_id: string;
        position: "after" | "before";
        new_text: string;
        step_note: string;
      };
    }
  | {
      name: "delete_text";
      args: {
        block_id: string;
        step_note: string;
      };
    }
  | {
      name: "ask_writer";
      args: {
        question: string;
        reason: "SCOPE" | "AMBIGUOUS" | "NOT_FOUND" | "MULTI";
      };
    }
  | {
      name: "merge_blocks";
      args: {
        block_id_a: string;
        block_id_b: string;
        step_note: string;
      };
    }
  | {
      name: "move_block";
      args: {
        block_id: string;
        anchor_block_id: string;
        position: "after" | "before";
        step_note: string;
      };
    }
  | {
      name: "split_text";
      args: {
        block_id: string;
        split_after_text: string;
        step_note: string;
      };
    }
  | {
      name: "replace_all";
      args: {
        target_text: string;
        new_text: string;
        scope: "chapter";
        step_note: string;
      };
    }
  | {
      name: "diacritize_scope";
      args: {
        target: string;
        step_note: string;
      };
    };

export interface AgentStepItem {
  id: string;
  toolName: string;
  blockId: string;
  stepNote: string; // النص العربي المولد الآتي من النموذج حرفياً
  status: "waiting" | "active" | "completed" | "failed";
  error?: string;
}

export interface PendingAgentRequest {
  question: string;
  reason: "SCOPE" | "AMBIGUOUS" | "NOT_FOUND" | "MULTI";
  originalMessage: string;
  pendingOperations?: ExecutiveToolCall[];
}

export interface AgentExecutionResult {
  success: boolean;
  executedSteps: AgentStepItem[];
  askWriter?: {
    question: string;
    reason: "SCOPE" | "AMBIGUOUS" | "NOT_FOUND" | "MULTI";
    pendingOperations?: ExecutiveToolCall[];
  };
  error?: string;
  totalMutations: number;
  auditEntriesCount: number;
  duplicate?: boolean;
  diacritizeReport?: {
    done: number;
    skipped: number;
    jobId: string;
    skippedReasons?: string[];
  };
}

// ============================================================================
// 2. كاشف النية الصريحة والجسر الشامل (Intent Heuristic & Bridge)
// ============================================================================

export function normalizeArabicForIntent(s: string): string {
  if (!s) return "";
  return s
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي");
}

const EXPLICIT_EDIT_VERBS = [
  "عدل",
  "عدّل",
  "عدلي",
  "غير",
  "غيّر",
  "غيري",
  "استبدل",
  "استبدلي",
  "احذف",
  "احذفي",
  "امسح",
  "امسحي",
  "أزل",
  "أزيلي",
  "ازل",
  "ازيلي",
  "ضف",
  "ضِف",
  "ضيف",
  "ضيفي",
  "أضف",
  "أضيفي",
  "اضف",
  "اضيفي",
  "أعد صياغة",
  "اعد صياغة",
  "أعيدي صياغة",
  "اعيدي صياغة",
  "صيغ",
  "صيغي",
  "أعد كتابة",
  "اعد كتابة",
  "اجعل",
  "اجعلي",
  "حوّل",
  "حول",
  "حولي",
  "صحح",
  "صححي",
  "صلح",
  "صلحي",
  "ضع بدلاً",
  "ضع بدلا",
  "اكتب بدلاً",
  "اكتب بدلا",
  "بدل",
  "بدّل",
  "ظبط",
  "ظبطي",
  "ادمج",
  "ادمجي",
  "انقل",
  "انقلي",
  "حرّك",
  "حرّكي",
  "اقسم",
  "اقسمي",
  "شكل",
  "شكّل",
  "شكلي",
  "شكّلي",
  "اضبط",
  "اضبطي",
  "أضبط",
  "تشكيل",
  "ضبط",
  "صحح",
  "صححي"
].map(v => normalizeArabicForIntent(v));

export function isExplicitEditIntent(
  message: string,
  hasMentions: boolean
): boolean {
  if (!message) return false;
  const clean = normalizeArabicForIntent(message.trim().toLowerCase());

  // فحص الأفعال الصريحة
  for (const verb of EXPLICIT_EDIT_VERBS) {
    if (clean.includes(verb)) {
      return true;
    }
  }

  // إذا أرفق منشن مصحوب بكلمات إجرائية (مثل: هذي، هذه، دي، الفقرة، مكانها)
  if (hasMentions) {
    const triggerWords = ["هذه", "هذي", "دي", "ده", "الفقرة", "بدل", "مكان", "لتكون", "لتصبح"].map(w => normalizeArabicForIntent(w));
    for (const w of triggerWords) {
      if (clean.includes(w)) {
        return true;
      }
    }
  }

  return false;
}

// ============================================================================
// 3. بناء السياق التنفيذي (Executive Context Formatter)
// ============================================================================

/**
 * البحث عن جميع الفقرات التي تحتوي على النص المستهدف لاستبدالها شمولياً (replace_all)
 */
export function findReplaceAllMatches(
  rootElement: HTMLElement | null,
  targetText: string
): { matches: string[]; skipped: string[] } {
  if (!rootElement || !targetText) return { matches: [], skipped: [] };
  const matches: string[] = [];
  const skipped: string[] = [];

  const rawBlocks = Array.from(
    rootElement.querySelectorAll<HTMLElement>("[data-block-id]")
  );
  const blocks: HTMLElement[] = [];
  const seenIds = new Set<string>();
  if (rootElement.getAttribute("data-block-id")) {
    blocks.push(rootElement);
    const rid = rootElement.getAttribute("data-block-id");
    if (rid) seenIds.add(rid);
  }
  for (const b of rawBlocks) {
    const bid = b.getAttribute("data-block-id");
    if (bid && !seenIds.has(bid)) {
      seenIds.add(bid);
      blocks.push(b);
    }
  }

  for (const block of blocks) {
    const blockId = block.getAttribute("data-block-id");
    if (!blockId) continue;

    const rawText = cleanBlockRawText(block.innerHTML);

    let rawOccurrences = 0;
    let p = rawText.indexOf(targetText);
    while (p !== -1 && targetText.length > 0) {
      rawOccurrences++;
      p = rawText.indexOf(targetText, p + 1);
    }

    if (rawOccurrences === 1) {
      matches.push(blockId);
    } else if (rawOccurrences > 1) {
      skipped.push(blockId);
    } else {
      // الصفر الخام: فحص المطبّع الوحيد
      const normRaw = normalizeArabicForIntent(rawText);
      const normTarget = normalizeArabicForIntent(targetText);
      let normOccurrences = 0;
      if (normTarget.length > 0) {
        let np = normRaw.indexOf(normTarget);
        while (np !== -1) {
          normOccurrences++;
          np = normRaw.indexOf(normTarget, np + 1);
        }
      }

      if (normOccurrences === 1) {
        matches.push(blockId);
      } else if (normOccurrences > 1) {
        skipped.push(blockId);
      }
    }
  }

  return { matches, skipped };
}

export function formatExecutiveContextForAI({
  chapterHtmlOrEl,
  chapterTitle,
  chapterIndex,
  pendingMentions,
  allChaptersSummary,
}: {
  chapterHtmlOrEl: HTMLElement | string;
  chapterTitle?: string;
  chapterIndex?: number;
  pendingMentions?: AttachedMention[];
  allChaptersSummary?: Array<{ index: number; title: string }>;
}): string {
  const structuredBlocks = getStructuredContentForAI(chapterHtmlOrEl);
  const title = (chapterTitle && chapterTitle.trim()) || "بدون عنوان";
  const indexDisplay = typeof chapterIndex === "number" ? `=== الفصل ${chapterIndex + 1}: ${title} ===\n` : `=== ${title} ===\n`;

  let out = `[سياق التحرير الجراحي التنفيذي — الفصل المفتوح حالياً]\n`;
  out += indexDisplay;
  out += `${structuredBlocks}\n`;
  out += `[نهاية نص الفصل المفتوح]\n`;

  // فهرس فصول الرواية الأخرى لكشف العبور (Cross-Chapter Scope)
  if (allChaptersSummary && allChaptersSummary.length > 1) {
    out += `\n[فهرس فصول العمل الأدبي الأخرى (للعلم بالنطاق فقط — محظور التعديل عليها دون استدعاء ask_writer)]:\n`;
    for (const chap of allChaptersSummary) {
      if (typeof chapterIndex !== "number" || chap.index !== chapterIndex) {
        out += `- الفصل ${chap.index + 1}: "${chap.title || "بدون عنوان"}"\n`;
      }
    }
  }

  // إضافة المنشنات المحققة كمراسٍ محلولة
  if (pendingMentions && pendingMentions.length > 0) {
    const valid = pendingMentions.filter((m) => m.status !== "DROPPED");
    if (valid.length > 0) {
      out += `\n[الفقرات والمقاطع المحددة بدقة عبر المنشن (@) من الكاتبة رحمة]:\n`;
      out += `تنبيه حاسم: الكاتبة قامت بتحديد هذه المقاطع صراحةً للعمل عليها. أي ضمير إشاري في رسالتها (مثل "ديت"، "هذه"، "المقطع ده"، "الفقرة دي"، "غير ديت"، "استبدل ديت"، "ايه رايك في ديت") يعود حتماً ومباشرةً على هذا المقطع:\n`;
      for (const m of valid) {
        out += `- معرّف الفقرة المستهدفة: block_id = "${m.blockId}" | النص المستهدف بدقة: target_text = "${m.selectedText}"\n`;
      }
      out += `توجيه إلزامي: عند طلب الكاتبة تعديل أو تغيير أو استبدال أو إبداء الرأي في المنشن، استخدم block_id والنص الموضح أعلاه ونفّذ أداة replace_text مباشرة دون التساؤل أو الشك في وجود النص.\n`;
    }
  }

  return out;
}

// ============================================================================
// 4. محرك التأثيرات البصرية الحية (Live Visual FX Engine)
// ============================================================================

const STYLE_TAG_ID = "dar-alhikayat-agent-fx-style";

function ensureAgentFxStyle() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_TAG_ID)) return;

  const styleEl = document.createElement("style");
  styleEl.id = STYLE_TAG_ID;
  styleEl.textContent = `
    @keyframes agent-shimmer-sweep {
      0% {
        background-position: 100% 0;
      }
      100% {
        background-position: -100% 0;
      }
    }
    [data-agent-fx="1"] {
      background-size: 200% 100% !important;
      transition: background-color 0.3s ease, opacity 0.3s ease !important;
    }
  `;
  document.head.appendChild(styleEl);
}

function hexToRgba(hex: string, alpha: number): string {
  if (!hex || typeof hex !== "string") return `rgba(202, 138, 4, ${alpha})`;
  let c = hex.replace("#", "");
  if (c.length === 3) {
    c = c.split("").map((x) => x + x).join("");
  }
  if (c.length !== 6) return `rgba(202, 138, 4, ${alpha})`;
  const num = parseInt(c, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * تنظيف شامل لكافة وسوم التأثير البصري وفكها normalize
 * ممنوع بقاء وسم data-agent-fx واحد في الـ DOM
 */
export function cleanupAgentFx(rootElement?: HTMLElement | null) {
  if (typeof document === "undefined") return;
  const root = rootElement || document;
  const spans = Array.from(root.querySelectorAll<HTMLElement>('[data-agent-fx="1"]'));

  for (const span of spans) {
    const parent = span.parentNode;
    if (!parent) continue;
    while (span.firstChild) {
      parent.insertBefore(span.firstChild, span);
    }
    parent.removeChild(span);
  }

  if (rootElement instanceof HTMLElement) {
    rootElement.normalize();
  }
}

/**
 * تطبيق تظليل الوكيل التنفيذي الجراحي (مطابق لهندسة applyHighlight القائمة)
 */
export function applyAgentHighlight(
  range: Range,
  accentColor: string = "#D97706"
): HTMLElement {
  ensureAgentFxStyle();

  const span = document.createElement("span");
  span.setAttribute("data-agent-fx", "1");
  span.className = "highlight";
  span.style.backgroundImage = `linear-gradient(90deg, ${hexToRgba(accentColor, 0.25)} 0%, ${hexToRgba(accentColor, 0.6)} 50%, ${hexToRgba(accentColor, 0.25)} 100%)`;
  span.style.backgroundSize = "200% 100%";
  span.style.color = "transparent"; // النص الأصلي يختفي مع الحفاظ على التخطيط
  span.style.borderRadius = "3px";
  span.style.padding = "1px 5px";
  span.style.margin = "0 1px";
  span.style.fontWeight = "600";
  span.style.boxDecorationBreak = "clone";
  (span.style as any).webkitBoxDecorationBreak = "clone";
  span.style.animation = "agent-shimmer-sweep 1.2s ease-in-out infinite";

  try {
    range.surroundContents(span);
  } catch (e) {
    const extract = range.extractContents();
    span.appendChild(extract);
    range.insertNode(span);
  }

  return span;
}

/**
 * كشف تدريجي Typewriter بمقاطع الكلمات (~35ms) مع التثبيت البايت-مثالي
 */
export async function typewriterReveal(
  targetElement: HTMLElement,
  newText: string,
  accentColor: string = "#D97706"
): Promise<void> {
  if (!targetElement) return;

  // إذا كنا في بيئة اختبار Node.js بدون نافذة حقيقية
  if (typeof window === "undefined" || !targetElement.animate) {
    targetElement.textContent = newText;
    if (typeof targetElement.normalize === "function") {
      targetElement.normalize();
    }
    return;
  }

  const words = newText.split(/(\s+)/);
  targetElement.textContent = "";
  targetElement.style.transition = "background-color 0.25s ease";
  targetElement.style.backgroundColor = hexToRgba(accentColor, 0.25);

  let accumulated = "";
  for (const w of words) {
    accumulated += w;
    targetElement.textContent = accumulated;
    await new Promise((r) => setTimeout(r, 35));
  }

  // التثبيت البايت-مثالي الصارم (Byte-Perfect Stabilization)
  targetElement.textContent = newText;
  targetElement.normalize();
  if (targetElement.textContent !== newText) {
    targetElement.textContent = newText;
  }

  // تلاشي الظل تدريجياً
  targetElement.style.backgroundColor = "transparent";
  await new Promise((r) => setTimeout(r, 120));
  targetElement.style.removeProperty("background-color");
  targetElement.style.removeProperty("transition");
}

// ============================================================================
// 5. محرك التنفيذ الجراحي (The Surgical Execution Engine)
// ============================================================================

export async function executeAgentPlan({
  rootElement,
  rawCalls,
  onStepUpdate,
  onCommit,
  accentColor = "#D97706",
  skipScopeCheck,
  requestId,
}: {
  rootElement: HTMLElement | null;
  rawCalls: ExecutiveToolCall[];
  onStepUpdate: (steps: AgentStepItem[]) => void;
  onCommit: () => void;
  accentColor?: string;
  skipScopeCheck?: boolean;
  requestId?: string;
}): Promise<AgentExecutionResult> {
  // 1. فحص التزامن والقفل (Concurrency Guard)
  
  // فحص تكرار الطلب (Idempotency)
  if (requestId && typeof window !== "undefined" && window.localStorage) {
    try {
      const executedRequests = JSON.parse(localStorage.getItem('executed_agent_requests') || '[]');
      if (Array.isArray(executedRequests) && executedRequests.includes(requestId)) {
        return {
          success: true,
          duplicate: true,
          executedSteps: [],
          totalMutations: 0,
          auditEntriesCount: 0,
        };
      }
    } catch {
      // Ignore corrupted localStorage item
    }
  }

  if (isAgentEditLocked()) {
    return {
      success: false,
      executedSteps: [],
      error: "أنا مشغول بتعديلك الحالي داخل المحرر، يرجى الانتظار لحظة...",
      totalMutations: 0,
      auditEntriesCount: 0,
    };
  }

  if (!rootElement) {
    return {
      success: false,
      executedSteps: [],
      error: "لم يتم العثور على عنصر المحرر المطلوب لتطبيق التعديلات.",
      totalMutations: 0,
      auditEntriesCount: 0,
    };
  }

  // فحص سقف الأمان (F5-3: سطر تدقيق عند قص الخطة)
  const safeCalls = rawCalls.slice(0, MAX_TOOL_CALLS_PER_REQUEST);
  if (rawCalls.length > MAX_TOOL_CALLS_PER_REQUEST) {
    globalAuditLog.record({
      type: "BATCH_BEGIN",
      blockId: "plan_limit",
      details: { note: `قُصَّت الخطة إلى ${MAX_TOOL_CALLS_PER_REQUEST} عمليات كحد أقصى للأمان` },
      status: "SUCCESS",
    });
  }

  // إذا كان هناك استدعاء ask_writer في البداية (F4: حفظ التعديلات المعلّقة دون إسقاطها)
  const askCall = safeCalls.find((c) => c.name === "ask_writer");
  if (askCall && askCall.name === "ask_writer") {
    const remainingOps = safeCalls.filter((c) => c.name !== "ask_writer");
    let questionText = askCall.args.question;
    if (remainingOps.length > 0 && !questionText.includes("تعديل") && !questionText.includes("خطوة")) {
      questionText += ` (هناك ${remainingOps.length} تعديلات معلّقة بانتظار توضيحك)`;
    }
    return {
      success: true,
      executedSteps: [],
      askWriter: {
        ...askCall.args,
        question: questionText,
        pendingOperations: remainingOps,
      },
      totalMutations: 0,
      auditEntriesCount: 0,
    };
  }

  if (!skipScopeCheck) {
    // فحص النطاق متعدد الفصول (Multi-Chapter Scope Check - F2)
    const chaptersInvolved = new Set<string>();
    const chapterNames: string[] = [];
  
    for (const c of safeCalls) {
      let targetBlockId = "";
      if (c.name === "replace_text" || c.name === "delete_text" || c.name === "split_text") {
        targetBlockId = c.args.block_id;
      } else if (c.name === "insert_text") {
        targetBlockId = c.args.anchor_block_id;
      } else if (c.name === "move_block") {
        targetBlockId = c.args.block_id;
      } else if (c.name === "merge_blocks") {
        targetBlockId = c.args.block_id_a;
      }
  
      if (targetBlockId) {
        const el = rootElement.querySelector<HTMLElement>(`[data-block-id="${targetBlockId}"]`);
        if (el) {
          const chapterParent = (typeof el.closest === "function" ? el.closest("[data-chapter-id]") : null) ||
                                (typeof el.closest === "function" ? el.closest(".editor-container") : null);
          const chapterId = chapterParent?.getAttribute("data-chapter-id");
          if (chapterId) {
            if (!chaptersInvolved.has(chapterId)) {
              chaptersInvolved.add(chapterId);
              const titleInput = chapterParent?.parentElement?.querySelector<HTMLInputElement>("input");
              const chTitle = titleInput?.value || `فصل (${chapterId})`;
              chapterNames.push(chTitle);
            }
          }
        }
      }
    }
  
    // إذا كانت الخطة تمتد عبر أكثر من فصل في آن واحد دون موافقة مسبقة
    if (chaptersInvolved.size > 1) {
      return {
        success: true,
        executedSteps: [],
        askWriter: {
          question: `الخطة المقترحة تشمل تعديلات تمتد عبر عدة فصول (${chapterNames.join("، ")}). لتأكيد الدقة، هل تودين تطبيق هذه التعديلات عبر الفصول مجتمعة؟`,
          reason: "SCOPE",
          pendingOperations: safeCalls,
        },
        totalMutations: 0,
        auditEntriesCount: 0,
      };
    }
  } else {
    globalAuditLog.record({
      type: "BATCH_BEGIN",
      blockId: "scope_approved",
      details: { note: "تجاوز فحص النطاق بموافقة الكاتبة الصريحة (تنفيذ واحد)" },
      status: "SUCCESS",
    });
  }

  // فحص سقف الاستبدال الشامل (replace_all 30 ops limit)
  for (const c of safeCalls) {
    if (c.name === "replace_all") {
      const { matches, skipped } = findReplaceAllMatches(rootElement, c.args.target_text);
      if (matches.length === 0) {
        return {
          success: true,
          executedSteps: [],
          askWriter: {
            question: `لم أجد "${c.args.target_text}" في أي فقرة من الفصل — هل تودين إملاء الصيغة الدقيقة؟`,
            reason: "NOT_FOUND",
            pendingOperations: rawCalls,
          },
          totalMutations: 0,
          auditEntriesCount: 0,
        };
      }
      if (!skipScopeCheck && matches.length > MAX_EXPANDED_OPS_PER_REQUEST) {
        return {
          success: true,
          executedSteps: [],
          askWriter: {
            question: `وجدت ${matches.length} موضعاً (الحد 30) — أؤكد المتابعة؟`,
            reason: "MULTI",
            pendingOperations: rawCalls,
          },
          totalMutations: 0,
          auditEntriesCount: 0,
        };
      }
    }
  }

  // تحضير قائمة الخطوات للعرض الحركي 1:1
  const stepItems: AgentStepItem[] = safeCalls.map((c, idx) => ({
    id: `step-${idx}-${Date.now()}`,
    toolName: c.name,
    blockId:
      (c.args as any)?.block_id ||
      (c.args as any)?.anchor_block_id ||
      (c.args as any)?.block_id_a ||
      (c.name === "diacritize_scope" ? (c.args as any).target : (c.name === "replace_all" ? "الفصل" : "writer")),
    stepNote: (c.args as any).step_note || "تنفيذ تعديل أدبي",
    status: "waiting",
  }));

  onStepUpdate([...stepItems]);

  // تحويل الاستدعاءات إلى PlannedOperation للتحقق الشامل أولاً
  const plannedOps: PlannedOperation[] = [];
  for (const c of safeCalls) {
    if (c.name === "replace_text") {
      plannedOps.push({
        type: "REPLACE",
        blockId: c.args.block_id,
        targetText: c.args.target_text,
        newText: c.args.new_text,
      });
    } else if (c.name === "insert_text") {
      plannedOps.push({
        type: c.args.position === "after" ? "INSERT_AFTER" : "INSERT_BEFORE",
        blockId: c.args.anchor_block_id,
        newText: c.args.new_text,
      });
    } else if (c.name === "delete_text") {
      plannedOps.push({
        type: "DELETE",
        blockId: c.args.block_id,
      });
    } else if (c.name === "merge_blocks") {
      plannedOps.push({
        type: "MERGE",
        blockId: c.args.block_id_a,
        targetBlockIdB: c.args.block_id_b,
      });
    } else if (c.name === "move_block") {
      plannedOps.push({
        type: "MOVE",
        blockId: c.args.block_id,
        anchorBlockId: c.args.anchor_block_id,
        position: c.args.position,
      });
    } else if (c.name === "split_text") {
      plannedOps.push({
        type: "SPLIT",
        blockId: c.args.block_id,
        splitAfterText: c.args.split_after_text,
      });
    } else if (c.name === "replace_all") {
      const { matches } = findReplaceAllMatches(rootElement, c.args.target_text);
      for (const mBlockId of matches) {
        plannedOps.push({
          type: "REPLACE",
          blockId: mBlockId,
          targetText: c.args.target_text,
          newText: c.args.new_text,
        });
      }
    }
  }

  // 2. التحقق المسبق الشامل (Two-Phase Validation) قبل أي مساس بالـ DOM
  if (plannedOps.length > 0) {
    const validation = validateBatchOperations(plannedOps, rootElement);
    if (!validation.isValid) {
      const firstInvalid = validation.results.find((r) => !r.isValid);
      const validCount = validation.results.filter((r) => r.isValid).length;
      const failCount = validation.results.length - validCount;

      let reason: "SCOPE" | "AMBIGUOUS" | "NOT_FOUND" | "MULTI" = "NOT_FOUND";
      if (firstInvalid?.status === "AMBIGUOUS_MATCH") {
        reason = "AMBIGUOUS";
      } else if (firstInvalid?.status === "BLOCK_NOT_FOUND") {
        reason = "NOT_FOUND";
      } else {
        reason = "NOT_FOUND";
      }

      const rawError = (firstInvalid?.error || "تعذر تحديد الموضع بدقة").trim().replace(/\.+$/, "");
      const question = `نجحت محاكاة ${validCount} عملية وفشلت ${failCount} بسبب: ${rawError}. فهل تحددين الموضع المطلوب بوضوح؟`;

      return {
        success: false,
        executedSteps: stepItems.map((s) => ({
          ...s,
          status: "failed" as const,
        })),
        askWriter: {
          question,
          reason,
          pendingOperations: rawCalls,
        },
        totalMutations: 0,
        auditEntriesCount: 0,
      };
    }
  }

  // 3. حجز القفل الجراحي (Agent Lock) داخل try/finally
  const lockAcquired = acquireAgentEditLock(rootElement);
  if (!lockAcquired) {
    return {
      success: false,
      executedSteps: [],
      error: "تعذر حجز قفل التحرير الآمن للمحرر.",
      totalMutations: 0,
      auditEntriesCount: 0,
    };
  }

  const initialSnapshot = {
    html: rootElement.innerHTML,
    timestamp: Date.now(),
  };

  let totalSuccessfulMutations = 0;
  let lastDiacritizeReport: { done: number; skipped: number; jobId: string; skippedReasons?: string[] } | undefined;

  try {
    // تشغيل الدفعة عبر runCheckedBatch
    const batchOps: Array<() => Promise<any>> = safeCalls.map((call, idx) => {
      return async () => {
        // تحديث حالة الخطوة إلى نشطة (Active)
        stepItems[idx].status = "active";
        onStepUpdate([...stepItems]);

        if (call.name === "replace_text") {
          // 1. تحديد (Read-Only Identification)
          const targetBlock = rootElement.querySelector<HTMLElement>(
            `[data-block-id="${call.args.block_id}"]`
          );
          if (!targetBlock) {
            stepItems[idx].status = "failed";
            onStepUpdate([...stepItems]);
            return {
              status: "BLOCK_NOT_FOUND",
              blockId: call.args.block_id,
              error: `الفقرة ${call.args.block_id} غير موجودة.`,
            };
          }

          // 2. تطبيق تأثير بصري وتعديل
          let fxSpan: HTMLElement | null = null;
          if (typeof window !== "undefined" && typeof Range !== "undefined") {
            try {
              const textNodes: Text[] = [];
              const walker = document.createTreeWalker(
                targetBlock,
                NodeFilter.SHOW_TEXT
              );
              let node: Node | null;
              while ((node = walker.nextNode())) {
                if (node instanceof Text) textNodes.push(node);
              }

              for (const tn of textNodes) {
                const idxInNode = tn.textContent?.indexOf(call.args.target_text) ?? -1;
                if (idxInNode !== -1) {
                  const range = document.createRange();
                  range.setStart(tn, idxInNode);
                  range.setEnd(tn, idxInNode + call.args.target_text.length);
                  fxSpan = applyAgentHighlight(range, accentColor);
                  break;
                }
              }
            } catch (e) {
              // تجاوز الخطأ البصري لمتابعة العملية الجراحية
            }
          }

          // وقفة خفيفة لإظهار التظليل الجراحي
          await new Promise((r) => setTimeout(r, 120));

          // 3. تطبيق العملية الجراحية
          const opRes = replaceTextWithinBlock(
            call.args.block_id,
            call.args.target_text,
            call.args.new_text,
            { rootElement }
          );

          if (opRes.status === "SUCCESS") {
            // 4. كشف تدريجي وتثبيت (F1: قراءة النص الكامل للفقرة بعد الاستبدال الجزئي لمنع مسح بقية النص)
            const updatedBlock = rootElement.querySelector<HTMLElement>(
              `[data-block-id="${call.args.block_id}"]`
            );
            if (updatedBlock) {
              const fullBlockText =
                updatedBlock.textContent || cleanBlockRawText(updatedBlock.innerHTML);
              await typewriterReveal(updatedBlock, fullBlockText, accentColor);
            }

            // 5. تدقيق
            globalAuditLog.record({
              type: "REPLACE",
              blockId: call.args.block_id,
              details: {
                targetText: call.args.target_text,
                newText: call.args.new_text,
                stepNote: call.args.step_note,
                matchType: opRes.matchType,
              },
              status: "SUCCESS",
            });

            stepItems[idx].status = "completed";
            totalSuccessfulMutations++;
            onStepUpdate([...stepItems]);
          } else {
            stepItems[idx].status = "failed";
            onStepUpdate([...stepItems]);
          }

          cleanupAgentFx(rootElement);
          return opRes;
        } else if (call.name === "insert_text") {
          // نبضة على الفقرة المرجعية
          const anchorEl = rootElement.querySelector<HTMLElement>(
            `[data-block-id="${call.args.anchor_block_id}"]`
          );
          if (anchorEl) {
            anchorEl.style.transition = "opacity 0.2s ease";
            anchorEl.style.opacity = "0.7";
            await new Promise((r) => setTimeout(r, 100));
            anchorEl.style.opacity = "1";
          }

          const opRes =
            call.args.position === "after"
              ? insertBlockAfter(call.args.anchor_block_id, call.args.new_text, {
                  rootElement,
                })
              : insertBlockBefore(call.args.anchor_block_id, call.args.new_text, {
                  rootElement,
                });

          if (opRes.status === "SUCCESS") {
            const newBlockId = opRes.blockId || opRes.createdBlockIds?.[0];
            const newBlockEl = newBlockId
              ? rootElement.querySelector<HTMLElement>(`[data-block-id="${newBlockId}"]`)
              : null;
            if (newBlockEl) {
              await typewriterReveal(newBlockEl, call.args.new_text, accentColor);
            }

            globalAuditLog.record({
              type: call.args.position === "after" ? "INSERT_AFTER" : "INSERT_BEFORE",
              blockId: call.args.anchor_block_id,
              details: {
                newText: call.args.new_text,
                stepNote: call.args.step_note,
                createdBlockIds: opRes.createdBlockIds,
              },
              status: "SUCCESS",
            });

            stepItems[idx].status = "completed";
            totalSuccessfulMutations++;
            onStepUpdate([...stepItems]);
          } else {
            stepItems[idx].status = "failed";
            onStepUpdate([...stepItems]);
          }

          cleanupAgentFx(rootElement);
          return opRes;
        } else if (call.name === "delete_text") {
          const targetBlock = rootElement.querySelector<HTMLElement>(
            `[data-block-id="${call.args.block_id}"]`
          );
          if (targetBlock) {
            targetBlock.style.transition = "opacity 0.25s ease, transform 0.25s ease";
            targetBlock.style.opacity = "0.2";
            targetBlock.style.transform = "scale(0.98)";
            await new Promise((r) => setTimeout(r, 150));
          }

          const opRes = deleteBlock(call.args.block_id, { rootElement });

          if (opRes.status === "SUCCESS") {
            globalAuditLog.record({
              type: "DELETE",
              blockId: call.args.block_id,
              details: {
                stepNote: call.args.step_note,
              },
              status: "SUCCESS",
            });

            stepItems[idx].status = "completed";
            totalSuccessfulMutations++;
            onStepUpdate([...stepItems]);
          } else {
            stepItems[idx].status = "failed";
            onStepUpdate([...stepItems]);
          }

          cleanupAgentFx(rootElement);
          return opRes;
        } else if (call.name === "merge_blocks") {
          const elA = rootElement.querySelector<HTMLElement>(`[data-block-id="${call.args.block_id_a}"]`);
          const elB = rootElement.querySelector<HTMLElement>(`[data-block-id="${call.args.block_id_b}"]`);
          if (!elA || !elB) {
            stepItems[idx].status = "failed";
            onStepUpdate([...stepItems]);
            return {
              status: "BLOCK_NOT_FOUND",
              blockId: !elA ? call.args.block_id_a : call.args.block_id_b,
              error: `إحدى الفقرتين المراد دمجهما غير موجودة.`,
            };
          }

          if (elA) {
            elA.style.transition = "opacity 0.2s ease";
            elA.style.opacity = "0.7";
          }
          if (elB) {
            elB.style.transition = "opacity 0.2s ease";
            elB.style.opacity = "0.7";
          }
          await new Promise((r) => setTimeout(r, 120));
          if (elA) elA.style.opacity = "1";
          if (elB) elB.style.opacity = "1";

          const opRes = mergeBlocks(call.args.block_id_a, call.args.block_id_b, { rootElement });
          if (opRes.status === "SUCCESS") {
            const mergedEl = opRes.node as HTMLElement;
            if (mergedEl && opRes.updatedText) {
              await typewriterReveal(mergedEl, opRes.updatedText, accentColor);
            }
            stepItems[idx].status = "completed";
            totalSuccessfulMutations++;
            onStepUpdate([...stepItems]);
          } else {
            stepItems[idx].status = "failed";
            onStepUpdate([...stepItems]);
          }
          cleanupAgentFx(rootElement);
          return opRes;
        } else if (call.name === "move_block") {
          const targetEl = rootElement.querySelector<HTMLElement>(`[data-block-id="${call.args.block_id}"]`);
          const anchorEl = rootElement.querySelector<HTMLElement>(`[data-block-id="${call.args.anchor_block_id}"]`);
          if (!targetEl || !anchorEl) {
            stepItems[idx].status = "failed";
            onStepUpdate([...stepItems]);
            return {
              status: "BLOCK_NOT_FOUND",
              blockId: !targetEl ? call.args.block_id : call.args.anchor_block_id,
              error: `تعذر العثور على الفقرة أو المرجع لنقلها.`,
            };
          }

          targetEl.style.transition = "opacity 0.2s ease, transform 0.2s ease";
          targetEl.style.opacity = "0.5";
          targetEl.style.transform = "translateX(4px)";
          await new Promise((r) => setTimeout(r, 120));
          targetEl.style.opacity = "1";
          targetEl.style.transform = "none";

          const opRes = moveBlock(call.args.block_id, call.args.anchor_block_id, call.args.position, { rootElement });
          if (opRes.status === "SUCCESS") {
            stepItems[idx].status = "completed";
            totalSuccessfulMutations++;
            onStepUpdate([...stepItems]);
          } else {
            stepItems[idx].status = "failed";
            onStepUpdate([...stepItems]);
          }
          cleanupAgentFx(rootElement);
          return opRes;
        } else if (call.name === "split_text") {
          const targetEl = rootElement.querySelector<HTMLElement>(`[data-block-id="${call.args.block_id}"]`);
          if (!targetEl) {
            stepItems[idx].status = "failed";
            onStepUpdate([...stepItems]);
            return {
              status: "BLOCK_NOT_FOUND",
              blockId: call.args.block_id,
              error: `الفقرة ${call.args.block_id} غير موجودة للشطر.`,
            };
          }

          targetEl.style.transition = "opacity 0.2s ease";
          targetEl.style.opacity = "0.6";
          await new Promise((r) => setTimeout(r, 120));
          targetEl.style.opacity = "1";

          const opRes = splitBlock(call.args.block_id, call.args.split_after_text, { rootElement });
          if (opRes.status === "SUCCESS") {
            const newBlockId = opRes.createdBlockIds?.[0];
            const newBlockEl = newBlockId
              ? rootElement.querySelector<HTMLElement>(`[data-block-id="${newBlockId}"]`)
              : null;
            if (newBlockEl) {
              const secondText = newBlockEl.textContent || cleanBlockRawText(newBlockEl.innerHTML);
              await typewriterReveal(newBlockEl, secondText, accentColor);
            }
            stepItems[idx].status = "completed";
            totalSuccessfulMutations++;
            onStepUpdate([...stepItems]);
          } else {
            stepItems[idx].status = "failed";
            onStepUpdate([...stepItems]);
          }
          cleanupAgentFx(rootElement);
          return opRes;
        } else if (call.name === "replace_all") {
          const { matches, skipped } = findReplaceAllMatches(rootElement, call.args.target_text);
          if (matches.length === 0) {
            stepItems[idx].status = "failed";
            onStepUpdate([...stepItems]);
            return {
              status: "NO_MATCH_FOUND",
              blockId: "chapter",
              error: `لم يتم العثور على أي موضع للعبارة "${call.args.target_text}".`,
            };
          }

          let lastRes: any = { status: "SUCCESS", blockId: "chapter" };
          for (const mBlockId of matches) {
            const opRes = replaceTextWithinBlock(mBlockId, call.args.target_text, call.args.new_text, { rootElement });
            if (opRes.status !== "SUCCESS") {
              stepItems[idx].status = "failed";
              onStepUpdate([...stepItems]);
              cleanupAgentFx(rootElement);
              return opRes;
            }
            totalSuccessfulMutations++;
            lastRes = opRes;
          }

          stepItems[idx].stepNote += ` (${matches.length} موضعاً${skipped.length ? `، تُخطّي ${skipped.length} للتكرار` : ""})`;
          stepItems[idx].status = "completed";
          onStepUpdate([...stepItems]);
          cleanupAgentFx(rootElement);
          return lastRes;
        } else if (call.name === "diacritize_scope") {
          const diacritizeRes = await runDiacritizeJob({
            target: call.args.target,
            rootElement,
            onStepUpdate,
            stepItemIndex: idx,
            existingStepItems: stepItems,
          });

          if (diacritizeRes.status === "SUCCESS") {
            lastDiacritizeReport = diacritizeRes.report;
            totalSuccessfulMutations += (diacritizeRes.report?.done || 1);
            stepItems[idx].status = "completed";
            onStepUpdate([...stepItems]);
            cleanupAgentFx(rootElement);
            return { status: "SUCCESS", blockId: call.args.target };
          } else if (diacritizeRes.status === "CANCELLED") {
            stepItems[idx].status = "failed";
            stepItems[idx].stepNote = diacritizeRes.error || "أُلغي الضبط بطلبك — لم يُحفَظ شيء.";
            onStepUpdate([...stepItems]);
            cleanupAgentFx(rootElement);
            return {
              status: "CANCELLED",
              blockId: call.args.target,
              error: diacritizeRes.error,
            };
          } else {
            stepItems[idx].status = "failed";
            onStepUpdate([...stepItems]);
            cleanupAgentFx(rootElement);
            return {
              status: "EXECUTION_ERROR",
              blockId: call.args.target,
              error: diacritizeRes.error,
            };
          }
        }

        return { status: "SUCCESS", blockId: "noop" };
      };
    });

    const batchResult = await globalBatchManager.runCheckedBatch(
      rootElement,
      initialSnapshot,
      batchOps,
      (snapshot) => {
        if (rootElement) {
          rootElement.innerHTML = snapshot.html;
        }
      }
    );

    if (!batchResult.success) {
      cleanupAgentFx(rootElement);
      return {
        success: false,
        executedSteps: stepItems,
        error: batchResult.error || "تعثرت إحدى العمليات وتم التراجع الآمن عن الدفعة بالكامل.",
        totalMutations: 0,
        auditEntriesCount: totalSuccessfulMutations,
      };
    }

    // 4. التثبيت الواحد لحالة المحرر (Single Atomic Commit to State & History)
    cleanupAgentFx(rootElement);
    
    if (stepItems.length > 0) {
      if (requestId && typeof window !== "undefined" && window.localStorage) {
        try {
          const executedRequests = JSON.parse(localStorage.getItem('executed_agent_requests') || '[]');
          const list = Array.isArray(executedRequests) ? executedRequests : [];
          list.push(requestId);
          // keep only last 50
          if (list.length > 50) list.shift();
          localStorage.setItem('executed_agent_requests', JSON.stringify(list));
        } catch {
          // Ignore localStorage errors
        }
      }
      onCommit();
    }


    return {
      success: true,
      executedSteps: stepItems,
      totalMutations: totalSuccessfulMutations,
      auditEntriesCount: totalSuccessfulMutations,
      diacritizeReport: lastDiacritizeReport,
    };
  } finally {
    cleanupAgentFx(rootElement);
    releaseAgentEditLock(rootElement);
  }
}

/**
 * طلب القرار التنفيذي عالي المستوى وتجهيز سياق الحوار والتعليمات التنفيذية
 */
export async function askExecutiveAgentForDecision({
  history,
  userPrompt,
  structuredDocContext,
  mentions,
}: {
  history: Array<{ role: "user" | "assistant"; content: string }>;
  userPrompt: string;
  structuredDocContext: string;
  mentions?: AttachedMention[];
}): Promise<{
  functionCalls: ExecutiveToolCall[];
  text?: string;
  error?: string;
}> {
  const contents = history
    .filter((m) => m.content && m.content.trim())
    .map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    }));

  contents.push({
    role: "user",
    parts: [{ text: userPrompt }],
  });

  const fullExecutiveInstruction = `${UNIFIED_AGENT_INSTRUCTION}\n\n${structuredDocContext}`;

  const res = await requestExecutiveDecision({
    contents,
    executiveInstruction: fullExecutiveInstruction,
    tools: AGENTIC_TOOL_DECLARATIONS,
  });

  return {
    functionCalls: (res.functionCalls || []) as ExecutiveToolCall[],
    text: res.text,
    error: res.error,
  };
}

