/**
 * Tashkeel Pipeline Engine (T-C)
 * Orchestrates batch diacritization, punctuation enhancement, and hamza normalization.
 * Strictly guarantees that no text enters the editor DOM without passing invariantHolds.
 */

import {
  invariantHolds,
  parseNumberedBatch,
  isAlreadyVocalized,
} from "./tashkeel-text";
import { globalAuditLog } from "./editor-block-system";
import {
  generateGeminiDirectly,
  buildReasoningConfig,
  GEMINI_PRIMARY_MODEL,
} from "./gemini-direct-client";
import { executeWithSmartRotation } from "./smart-key-rotator";
import type { AgentStepItem } from "./literary-agent";

export const TASHKEEL_BATCH_SIZE = 3;
const MAX_SNAPSHOTS = 3;

// Storage for undo snapshots (retains last 3 jobs)
const jobSnapshots = new Map<string, { html: string; timestamp: number }>();

// Tracking active jobs for cancellation
interface ActiveJobState {
  cancelled: boolean;
  abortController: AbortController;
}
const activeJobs = new Map<string, ActiveJobState>();
let latestActiveJobId: string | null = null;

export function getActiveDiacritizeJobId(): string | null {
  return latestActiveJobId;
}

export function cancelDiacritizeJob(jobId?: string): boolean {
  const targetId = jobId || latestActiveJobId;
  if (!targetId) return false;
  const job = activeJobs.get(targetId);
  if (job) {
    job.cancelled = true;
    try {
      job.abortController.abort();
    } catch {
      // ignore abort errors
    }
    return true;
  }
  return false;
}

export function canUndoDiacritize(jobId: string): boolean {
  return jobSnapshots.has(jobId);
}

export function resetActiveJobs(): void {
  activeJobs.clear();
  latestActiveJobId = null;
}

export function saveJobSnapshotForTest(jobId: string, html: string): void {
  jobSnapshots.set(jobId, {
    html,
    timestamp: Date.now(),
  });
}

export function undoDiacritizeJob(
  jobId: string,
  rootElement: HTMLElement | null,
  onCommit: () => void
): boolean {
  if (!rootElement) return false;
  const snapshot = jobSnapshots.get(jobId);
  if (!snapshot) return false;

  rootElement.innerHTML = snapshot.html;
  jobSnapshots.delete(jobId);

  globalAuditLog.record({
    type: "BATCH_ROLLBACK",
    blockId: "undo_diacritize",
    status: "SUCCESS",
    details: { jobId, timestamp: Date.now() },
  });

  onCommit();
  return true;
}

/**
 * Seven Encoded Rules for Literary Vocalization & Punctuation
 */
export const TASHKEEL_SYSTEM_INSTRUCTION = `أنت خبير الضبط اللغوي والتحرير الأدبي الرفيع في دار الحكايات للكاتبة رحمة السيد موافي.
مهمتك: تطبيق الضبط اللغوي الدقيق (تشكيل جزئي معتمد، فواصل أدبية، وهمزات) على الفقرات المرفقة داخل الدفعة.

القواعد السبع الحاكمة المطلقة (أي إخلال بها يُلغي الدفعة رياضياً):
1. التشكيل الجزئي فقط: التشكيل الكامل لنصوص النثر ممنوع منعاً باتاً لثقله البصري. التشكيل يقتصر حصراً على:
   - الكلمات الملتبسة دلالياً (مثل: عَلِمَ / عُلِمَ / عِلْم).
   - أواخر الكلمات المانعة للحن الإعرابي (الفاعل، المفعول، المضاف إليه الملتبس).
   - أسماء الأعلام أو الأبيات الشعرية إن وُجدت.
2. قاعدة الشك: عند الشك في ضبط أي كلمة أو وجهها الإعرابي، تُترك الكلمة عارية تماماً بلا أي تشكيل.
3. علامات الترقيم والفواصل الأدبية:
   - علامات التنصيص العربية « » إلزامية للحوار والاقتباس الداخلي والخارجي، وتحويل " " أو ' ' إلى « ».
   - التزام نمط الحوار السائد المرفق في التوجيه.
   - إلصاق علامات الترقيم (، ؛ . ؟ ! :) بالكلمة السابقة لها مباشرةً مع مسافة واحدة بعدها.
   - استخدام علامتي الاستفهام والتعجب العربيتين (؟ وليس ?، !).
   - علامة الحذف تكون ثلاث نقاط متتالية فقط (…) دون زيادة.
4. تصحيح الهمزات: تصحيح همزات الوصل والقطع ورسم الهمزة على نبرة أو واو أو سطر ضمن عائلة الهمزة {ا أ إ آ ؤ ئ ء}.
5. إزالة التطويل: حذف أي تطويل أو كشيدة (ـ) داخل الكلمات نهائياً.
6. المحرّمات القطعية:
   - يُمنع منعاً باتاً حذف أو إضافة أو تبديل أي كلمة أو حرف خارج عائلة الهمزة.
   - ممنوع المساس بالحروف ة/ه أو ى/ي نهائياً.
   - ممنوع تغيير ترتيب الكلمات أو إعادة الصياغة إطلاقاً.
7. تنسيق الإخراج الحصري:
   أعد ناتج كل فقرة مرقماً بالترتيب التالي دون أي مقدمات أو شروح أو تعليقات خارجية نهائياً:
   [1] نص الفقرة الأولى بعد الضبط
   [2] نص الفقرة الثانية بعد الضبط
   [3] نص الفقرة الثالثة بعد الضبط`;

export interface DiacritizeJobOptions {
  target: string; // "chapter" | b_xxxx
  rootElement: HTMLElement;
  onStepUpdate?: (steps: AgentStepItem[]) => void;
  stepItemIndex?: number;
  existingStepItems?: AgentStepItem[];
  jobId?: string;
}

export interface DiacritizeJobResult {
  status: "SUCCESS" | "FAILED" | "CANCELLED";
  blockId: string;
  error?: string;
  report?: {
    done: number;
    skipped: number;
    jobId: string;
    skippedReasons?: string[];
  };
}

/**
 * Detects whether quotation marks «» or dash - dominates the text
 */
function detectDominantDialogueStyle(blocks: HTMLElement[]): "quotes" | "dash" {
  let quoteCount = 0;
  let dashCount = 0;

  for (const block of blocks) {
    const text = block.textContent || "";
    if (text.includes("«") || text.includes("»") || text.includes('"')) {
      quoteCount++;
    }
    if (/^\s*[-–—]/.test(text) || text.includes(" - ") || text.includes(" — ")) {
      dashCount++;
    }
  }

  return quoteCount >= dashCount ? "quotes" : "dash";
}

/**
 * Executes a single AI prompt for a batch of blocks (with dual routing)
 */
async function callDiacritizeAI({
  batchTexts,
  beforeContext,
  afterContext,
  dialogueStyle,
  signal,
  retryNote,
}: {
  batchTexts: string[];
  beforeContext: string;
  afterContext: string;
  dialogueStyle: "quotes" | "dash";
  signal: AbortSignal;
  retryNote?: string;
}): Promise<string> {
  const dialogueStyleNote =
    dialogueStyle === "quotes"
      ? "نمط الحوار السائد في العمل: استخدام الأقواس المزدوجة « » للحوار."
      : "نمط الحوار السائد في العمل: استخدام الشرطة (-) للحوار مع ضبط الفواصل الداخلية.";

  let prompt = `${dialogueStyleNote}\n\n`;

  if (beforeContext) {
    prompt += `[سياق القراءة المسبقة - للقراءة فقط ولا تضمنه في الناتج]:\n"${beforeContext}"\n\n`;
  }

  prompt += `[الفقرات المستهدفة للضبط اللغوي]:\n`;
  batchTexts.forEach((t, i) => {
    prompt += `[${i + 1}] ${t}\n`;
  });

  if (afterContext) {
    prompt += `\n[سياق القراءة اللاحقة - للقراءة فقط ولا تضمنه في الناتج]:\n"${afterContext}"\n`;
  }

  if (retryNote) {
    prompt += `\n⚠️ تنبيه إعادة المحاولة: ${retryNote}\n`;
  }

  prompt += `\nأعد ناتج الفقرات فقط بالصيغة المحددة [1]... [2]... إلخ بلا أي نص آخر.`;

  return await executeWithSmartRotation(async (apiKey) => {
    if (apiKey) {
      const res = await generateGeminiDirectly({
        apiKey,
        systemInstruction: TASHKEEL_SYSTEM_INSTRUCTION,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          ...buildReasoningConfig("diacritize", 0.1),
        },
        signal,
      });
      return res.text || "";
    } else {
      const resp = await fetch("/api/gemini/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: TASHKEEL_SYSTEM_INSTRUCTION,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          model: GEMINI_PRIMARY_MODEL,
          temperature: 0.1,
          thinkingLevel: "LOW",
        }),
        signal,
      });

      if (!resp.ok) {
        throw new Error(`خطأ استجابة الخادم: ${resp.status}`);
      }

      const data = await resp.json();
      return data.text || "";
    }
  });
}

/**
 * Main Entry Point: Runs the full diacritize pipeline job
 */
export async function runDiacritizeJob(
  options: DiacritizeJobOptions
): Promise<DiacritizeJobResult> {
  const { target, rootElement, onStepUpdate, stepItemIndex, existingStepItems } = options;
  const jobId = options.jobId || `diacritize_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  latestActiveJobId = jobId;

  // 1. Snapshot creation for undo (Max 3 retained)
  if (jobSnapshots.size >= MAX_SNAPSHOTS) {
    const oldestKey = jobSnapshots.keys().next().value;
    if (oldestKey) jobSnapshots.delete(oldestKey);
  }
  jobSnapshots.set(jobId, {
    html: rootElement.innerHTML,
    timestamp: Date.now(),
  });

  // 2. Abort & Cancellation registration
  const abortController = new AbortController();
  activeJobs.set(jobId, {
    cancelled: false,
    abortController,
  });

  // 3. Resolve Target Blocks
  let targetBlocks: HTMLElement[] = [];
  if (target === "chapter") {
    targetBlocks = Array.from(
      rootElement.querySelectorAll<HTMLElement>("[data-block-id]")
    ).filter((el) => {
      // Exclude special UI blocks or empty elements if needed
      return (el.textContent || "").trim().length > 0;
    });
  } else if (target.startsWith("b_")) {
    const singleEl = rootElement.querySelector<HTMLElement>(`[data-block-id="${target}"]`);
    if (singleEl) targetBlocks.push(singleEl);
  }

  if (targetBlocks.length === 0) {
    activeJobs.delete(jobId);
    return {
      status: "FAILED",
      blockId: target,
      error: "لم يتم العثور على أي فقرات صالحة للضبط اللغوي.",
    };
  }

  const totalBlocks = targetBlocks.length;
  const dialogueStyle = detectDominantDialogueStyle(targetBlocks);

  let doneCount = 0;
  let skippedCount = 0;
  const skippedReasons: string[] = [];

  const updateProgressStep = (currentBlockNum: number) => {
    if (onStepUpdate && existingStepItems && typeof stepItemIndex === "number" && existingStepItems[stepItemIndex]) {
      existingStepItems[stepItemIndex].stepNote = `جاري ضبط الفقرة ${currentBlockNum} من ${totalBlocks}...`;
      existingStepItems[stepItemIndex].status = "active";
      onStepUpdate([...existingStepItems]);
    }
  };

  try {
    // 4. Batch Processing Loop
    for (let i = 0; i < totalBlocks; i += TASHKEEL_BATCH_SIZE) {
      // Check cancellation between batches
      const jobState = activeJobs.get(jobId);
      if (jobState?.cancelled || abortController.signal.aborted) {
        // Rollback to initial snapshot
        const snap = jobSnapshots.get(jobId);
        if (snap) rootElement.innerHTML = snap.html;
        activeJobs.delete(jobId);
        return {
          status: "CANCELLED",
          blockId: target,
          error: "أُلغي الضبط بطلبك — لم يُحفَظ شيء.",
        };
      }

      const batchBlocks = targetBlocks.slice(i, i + TASHKEEL_BATCH_SIZE);
      const batchIndices = batchBlocks.map((_, offset) => i + offset + 1);

      updateProgressStep(batchIndices[0]);

      // Filter out blocks that are already sufficiently vocalized
      const activeBatch: { block: HTMLElement; index: number; origText: string }[] = [];
      for (let bIdx = 0; bIdx < batchBlocks.length; bIdx++) {
        const blk = batchBlocks[bIdx];
        const rawText = blk.textContent || "";
        if (isAlreadyVocalized(rawText)) {
          skippedCount++;
          skippedReasons.push(`الفقرة ${i + bIdx + 1} مشكّلة مسبقاً`);
        } else {
          activeBatch.push({
            block: blk,
            index: i + bIdx + 1,
            origText: rawText,
          });
        }
      }

      if (activeBatch.length === 0) {
        continue;
      }

      // Context Window (Previous Block and Next Block)
      const prevEl = targetBlocks[i - 1];
      const nextEl = targetBlocks[i + TASHKEEL_BATCH_SIZE];
      const beforeContext = prevEl ? (prevEl.textContent || "").slice(-200) : "";
      const afterContext = nextEl ? (nextEl.textContent || "").slice(0, 200) : "";

      const batchTexts = activeBatch.map((item) => item.origText);

      // First AI Attempt
      let parsedResults: string[] | null = null;
      let rawAIOutput = "";
      try {
        rawAIOutput = await callDiacritizeAI({
          batchTexts,
          beforeContext,
          afterContext,
          dialogueStyle,
          signal: abortController.signal,
        });
        parsedResults = parseNumberedBatch(rawAIOutput, activeBatch.length);
      } catch (err: any) {
        if (jobState?.cancelled || abortController.signal.aborted) {
          throw err;
        }
        console.warn("[Tashkeel Batch Error]:", err);
      }

      // Check Invariant for parsed items
      let hasInvariantFailure = false;
      if (parsedResults) {
        for (let k = 0; k < activeBatch.length; k++) {
          const orig = activeBatch[k].origText;
          const voc = parsedResults[k];
          if (!invariantHolds(orig, voc)) {
            hasInvariantFailure = true;
            break;
          }
        }
      }

      // Single Retry if parsing failed or invariant failed
      if (!parsedResults || hasInvariantFailure) {
        try {
          const retryOutput = await callDiacritizeAI({
            batchTexts,
            beforeContext,
            afterContext,
            dialogueStyle,
            signal: abortController.signal,
            retryNote:
              "فشلت الدفعة السابقة بسبب نقص الترقيم [1].. أو تغيير حرف في الكلمات. أعد كتابة الفقرات حصراً مع التشكيل دون تغيير أي كلمة أو حرف نهائياً.",
          });
          const secondParse = parseNumberedBatch(retryOutput, activeBatch.length);
          if (secondParse) {
            parsedResults = secondParse;
            hasInvariantFailure = false;
          }
        } catch {
          // Ignore retry failure
        }
      }

      // Apply valid items or skip with truthful reporting
      for (let k = 0; k < activeBatch.length; k++) {
        const item = activeBatch[k];
        const voc = parsedResults ? parsedResults[k] : null;

        if (voc && invariantHolds(item.origText, voc)) {
          // Safe DOM mutation
          item.block.textContent = voc;
          doneCount++;

          // Audit Log Record
          const blockId = item.block.getAttribute("data-block-id") || `b_${item.index}`;
          globalAuditLog.record({
            type: "DIACRITIZE",
            blockId,
            status: "SUCCESS",
            details: {
              jobId,
              originalLength: item.origText.length,
              vocalizedLength: voc.length,
            },
          });
        } else {
          skippedCount++;
          skippedReasons.push(`الفقرة ${item.index} (تعذر مطابقة الثابت أو التحليل)`);
        }
      }
    }

    // 5. Final Step Note & Result
    const finalStepNote = `ضُبط ${doneCount} فقرة${
      skippedCount ? `، تُخطّي ${skippedCount} (${skippedReasons.slice(0, 2).join("، ")})` : ""
    }`;

    if (onStepUpdate && existingStepItems && typeof stepItemIndex === "number" && existingStepItems[stepItemIndex]) {
      existingStepItems[stepItemIndex].stepNote = finalStepNote;
      existingStepItems[stepItemIndex].status = "completed";
      onStepUpdate([...existingStepItems]);
    }

    activeJobs.delete(jobId);

    return {
      status: "SUCCESS",
      blockId: target,
      report: {
        done: doneCount,
        skipped: skippedCount,
        jobId,
        skippedReasons,
      },
    };
  } catch (err: any) {
    activeJobs.delete(jobId);
    if (abortController.signal.aborted || err?.name === "AbortError") {
      const snap = jobSnapshots.get(jobId);
      if (snap) rootElement.innerHTML = snap.html;
      return {
        status: "CANCELLED",
        blockId: target,
        error: "أُلغي الضبط بطلبك — لم يُحفَظ شيء.",
      };
    }

    return {
      status: "FAILED",
      blockId: target,
      error: err?.message || "تعثر خط إنتاج الضبط اللغوي.",
    };
  }
}
