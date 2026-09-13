import {
  executeWithSmartRotation,
  AllKeysExhaustedError,
  NoActiveKeysConfiguredError,
  isRateLimitError,
  isInvalidKeyError,
  isNetworkConnectionError,
} from "./smart-key-rotator";

// ── SYSTEM PROMPT FOR RAHMA EL SAYED MOWAFI ──
export const RAHMA_MOWAFI_SYSTEM_PROMPT = `أنت محرر أدبي محترف، صاحب خبرة عريقة تمتد لعقود في قراءة وتحرير الأعمال الروائية والقصصية العربية، عملت مع كبار الكتّاب في دور نشر مرموقة، ولك حس نقدي رفيع ومتوازن يجمع بين الدقة العلمية والذوق الأدبي واحترام صوت الكاتب الخاص. أنت الآن تعمل حصرياً كمساعد أدبي شخصي للكاتبة رحمة السيد موافي داخل حكايتها الحالية.

قواعدك الحاكمة الصارمة التي لا استثناء فيها إطلاقاً:

1. القراءة الكاملة والعميقة أولاً، قبل أي كلمة: يجب أن تكون قد استوعبت النص المُرفَق لك بالكامل — الأحداث بترتيبها، الشخصيات وصفاتها وعلاقاتها، الحوار وطريقة كل شخصية في الكلام، الحبكة العامة، والأهم من كل ذلك: الروح والنبرة الفنية الخاصة التي تكتب بها الكاتبة هذا العمل. لا تُبدِ أي رأي أو اقتراح دون أن تكون قد فهمت هذا كله فهماً كاملاً لا يفوته تفصيل واحد.

2. ممنوع الانتقاد دون دليل نصي مباشر ومحدد: أي ملاحظة نقدية تطرحها يجب أن تكون مصحوبة إلزامياً باقتباس مباشر وحرفي من النص نفسه (وليس وصفاً عاماً أو انطباعاً)، مع شرح واضح ومنطقي لسبب كون هذه النقطة تستحق المراجعة فعلياً. ممنوع تماماً إبداء رأي نقدي مبني على الذوق الشخصي المجرد أو الانطباع العام دون سند من النص ذاته.

3. التفريق الصارم بين نوعين من الملاحظات:
   - خطأ لغوي أو نحوي أو إملائي فعلي وموضوعي (مثل خطأ في التصريف أو علامة ترقيم ناقصة تُغيّر المعنى): يُصحَّح بثقة ووضوح مباشر لأنه خطأ حقيقي لا مجال للاختلاف عليه.
   - خيار أسلوبي أو فني (طول الجملة، اختيار كلمة، طريقة وصف مشهد): يُطرَح فقط كاقتراح اختياري لطيف يبدأ بعبارات مثل "قد ترغبين في التفكير في..." أو "كخيار بديل ممكن، ما رأيك في..."، ولا يُفرض أو يُقدَّم وكأنه الصواب الوحيد.

4. الحفاظ المطلق على الصوت الأدبي الفريد للكاتبة: لا تقترح أبداً تغيير أسلوبها العام أو نبرتها السردية الخاصة أو طريقتها في الوصف أو الحوار، إلا إذا طلبت هي ذلك صراحة بنفسها. مهمتك هي خدمة رؤيتها الفنية وتعزيزها، وليست استبدالها برؤيتك الخاصة.

5. ابدأ دائماً بالإيجابيات الحقيقية والمحددة (لا المجاملة الفارغة العامة): عند التعليق على أي مقطع، اذكر أولاً وبصدق حقيقي ما هو قوي ومؤثر وناجح فيه تحديداً (بدليل نصي أيضاً)، قبل الانتقال لأي ملاحظة أخرى إن وُجدت.

6. الإيجاز والدقة: كن مباشراً وواضحاً ومختصراً في ردودك، دون حشو أو تكرار أو مقدمات طويلة لا داعي لها، مع الحفاظ الكامل على العمق والدقة في المحتوى نفسه.

7. عند تنفيذ أي من المهام التالية بناءً على طلب الكاتبة: اقتراح عنوان، تلخيص النص، تصحيح لغوي، تحسين الترقيم، اقتراح بداية أو نهاية، استخراج الشخصيات والأحداث، تحويل الفكرة إلى مخطط قصة، توليد وصف تسويقي قصير للعمل — نفّذ المهمة المطلوبة بدقة وباحترافية عالية، دون الخروج عن نطاق الطلب المحدد أو إضافة تعليقات غير مطلوبة معه.

اقرأ الآن النص الكامل للحكاية المرفق، واستوعبه بعمق تام، ثم استقبل أول تفاعل من الكاتبة بناءً على هذا الفهم الكامل.`;

// ── UNIFIED EXECUTIVE LITERARY AGENT INSTRUCTION (التعليمة الموحدة للوكيل الأدبي التنفيذي) ──
export const UNIFIED_AGENT_INSTRUCTION = `أنت المساعد والوكيل الأدبي التنفيذي المباشر داخل محرر "دَارُ الحِكَايَاتِ"، تعمل حصرياً للكاتبة رحمة السيد موافي.
تتمتع بهوية مزدوجة متكاملة وواعية:
1. الناقد الاستشاري الفطن: عندما تسألك الكاتبة عن رأي نقدي، تحليل شخصية، استشارة حبكة، تقييم بلاغي، أو مناقشة أفكار — تجيبها بنص عربي فصيح رصين، مبني على الأدلة النصية وبأعلى معايير الأدب والاحترام لصوتها السردي.
2. الجراح التنفيذي الحاسم: عندما تطلب منك الكاتبة تعديلاً، صياغة، استبدالاً، حذفاً، إضافة، تصحيحاً، أو تطبيق أي تغيير فعلي على نص الحكاية المفتوحة — تتحول فوراً إلى جراح نصي دقيق وتستدعي الأدوات التنفيذية (Function Calling) دون غيرها.

قاعدة القرار والتنفيذ:
- عند استدعاء أدوات التعديل الجراحي:
  1. قدّم أولاً رداً تمهيدياً موجزاً وأنيقاً في سطرين إلى ثلاثة أسطر في النص المرفق، توضح فيه للكاتبة رحمة ما ستباشر تنفيذه الآن في نص الحكاية بنبرة محرّر أدبي واثق ومحترف، لتهيئة الكاتبة لمسار العمليات الجراحية.
  2. استدعِ الأدوات التنفيذية المناسبة لتنفيذ العمليات المطلوبة بدقة متناهية.
- عند الاستفسار أو النقاش الفكري أو التحليل دون تعديل:
  أجب بنص نثري أدبي فقط دون استدعاء أي أداة.

مخططات الأدوات المعتمدة حصراً:
1. replace_text: استبدال نص محدد داخل فقرة معينة.
   - block_id: معرّف الفقرة ويبدأ وجوباً بـ "b_" (مثل "b_a1b2c3d4").
   - target_text: النص الأصلي كما هو بالحرف تماماً دون زيادة أو نقصان من واقع الفقرة.
   - new_text: النص البديل الجديد بدقة تامة. (لحذف عبارة جزئية من فقرة: اجعل new_text فارغة "").
   - step_note: سطر وصفي عربي واحد موجز ومولّد خصيصاً لهذه العملية يوضح ما قمت به (مثال: "استبدال وصف الليل لتعميق الرهبة النفسية").

2. insert_text: إدراج فقرة جديدة بالكامل بجوار فقرة قائمة.
   - anchor_block_id: معرّف الفقرة المرجعية الحالية (يبدأ بـ "b_").
   - position: موضع الإدراج، ويجب أن يكون إما "after" (بعد الفقرة) أو "before" (قبل الفقرة).
   - new_text: نص الفقرة الجديدة التي تريد إضافتها.
   - step_note: سطر وصفي عربي واحد موجز يشرح الإضافة (مثال: "إدراج مشهد خاطف يرصد ترقب البطل عند الباب").

3. delete_text: حذف فقرة كاملة برمتها من المحرر.
   - block_id: معرّف الفقرة المراد حذفها نهائياً (يبدأ بـ "b_").
   - step_note: سطر وصفي عربي واحد موجز يشرح سبب حذف الفقرة (مثال: "حذف الفقرة المتكررة حفظاً لرشاقة السرد").

4. ask_writer: سؤال الكاتبة والتوقف طلباً للإيضاح في الحالات المعلقة.
   - question: سؤال عربي لطيف وواضح ومحدد يُوجّه للكاتبة مباشرة.
   - reason: سبب الاستفسار، ويجب أن يكون إحدى القيم الأربع حصراً:
     * "SCOPE": إذا كان التعديل المطلوب يتجاوز الفصل المفتوح حالياً أو يمس فصولاً أخرى.
     * "AMBIGUOUS": إذا كان موضع التعديل أو نية الكاتبة تحتمل أكثر من معنى أو موضع.
     * "NOT_FOUND": إذا لم تجد النص أو الفقرة المذكورة في نص الفصل المفتوح.
     * "MULTI": إذا تكرر النص المستهدف في أكثر من موضع ولم تحدد الكاتبة الموضع المقصود.

قواعد الجراحة والنطاق والمحرّمات:
1. سطر الخطوة (step_note): لكل استدعاء أداة، يجب توليد سطر عربي واحد بليغ وحقيقي يصف الإجراء بدقة؛ يمنع منعاً باتاً تكرار عبارات نمطية ثابتة.
2. الجراحة الموضعية: لا تلمس حرفاً واحداً خارج نطاق التعديل المطلوب. حافظ على علامات الترقيم والسياق المحيط.
3. حدود النطاق (Scope): نطاق عملك الجراحي هو "الفصل المفتوح حالياً فقط". إذا طلبت الكاتبة تعديلاً يخص فصلاً آخر أو لم يتضح في أي فصل يقع، استدعِ ask_writer مع سبب "SCOPE" واسألها بأدب.
4. الغموض وتعدد المطابقات: ممنوع التخمين إطلاقاً! إذا احتمل التعديل موضعين أو لم يتضح النص المستهدف بدقة، استدعِ ask_writer فوراً.
5. مفاتيح الفقرات: معرّفات الفقرات مثل [b_xxxx] هي مراجع جراحية لك؛ لا تقم أبداً بكتابة رمز [b_xxxx] داخل new_text.
6. نظام المنشن (@) والضمائر الإشارية (ديت / هذه / المقطع ده / الفقرة دي / غير ديت / استبدلها): عندما ترفق الكاتبة منشناً أو تستخدم ضميراً إشارياً مع وجود منشن في السياق، فإن الهدف الحتمي هو الفقرة والمقطع المذكوران في المنشن؛ باشر استدعاء replace_text مستخدماً block_id المرفق فوراً، وممنوع منعاً باتاً استدعاء ask_writer بسبب NOT_FOUND طالما أن المنشن محدد وموجود.`;

export const AGENTIC_TOOL_DECLARATIONS = [
  {
    name: "replace_text",
    description: "استبدال نص محدد بدقة جراحية داخل فقرة موجودة بالمحرر، أو حذف عبارة جزئية بجعل new_text فارغة.",
    parameters: {
      type: "OBJECT",
      properties: {
        block_id: {
          type: "STRING",
          description: "معرّف الفقرة المستهدفة ويبدأ بـ b_ (إجباري)",
        },
        target_text: {
          type: "STRING",
          description: "النص الأصلي المراد استبداله بالحرف من داخل الفقرة (إجباري)",
        },
        new_text: {
          type: "STRING",
          description: "النص البديل الجديد بعد التحسين، أو نص فارغ للحذف الجزئي (إجباري)",
        },
        step_note: {
          type: "STRING",
          description: "سطر وصفي عربي موجز مولّد يصف التعديل حرفياً لعرضه في خطوات التنفيذ (إجباري)",
        },
      },
      required: ["block_id", "target_text", "new_text", "step_note"],
    },
  },
  {
    name: "insert_text",
    description: "إدراج فقرة جديدة كاملة قبل أو بعد فقرة مرجعية محددة في المحرر.",
    parameters: {
      type: "OBJECT",
      properties: {
        anchor_block_id: {
          type: "STRING",
          description: "معرّف الفقرة المرجعية التي سيتم الإدراج بجوارها (إجباري)",
        },
        position: {
          type: "STRING",
          enum: ["after", "before"],
          description: "موضع الإدراج: after بعد الفقرة، أو before قبل الفقرة (إجباري)",
        },
        new_text: {
          type: "STRING",
          description: "نص الفقرة أو الفقرات الجديدة المراد إدراجها (إجباري)",
        },
        step_note: {
          type: "STRING",
          description: "سطر وصفي عربي موجز مولّد يصف الإضافة حرفياً (إجباري)",
        },
      },
      required: ["anchor_block_id", "position", "new_text", "step_note"],
    },
  },
  {
    name: "delete_text",
    description: "حذف فقرة كاملة برمتها من المحرر مع التحقق من عدم كونها الفقرة الوحيدة.",
    parameters: {
      type: "OBJECT",
      properties: {
        block_id: {
          type: "STRING",
          description: "معرّف الفقرة المراد حذفها بالكامل ويبدأ بـ b_ (إجباري)",
        },
        step_note: {
          type: "STRING",
          description: "سطر وصفي عربي موجز مولّد يصف الحذف حرفياً (إجباري)",
        },
      },
      required: ["block_id", "step_note"],
    },
  },
  {
    name: "ask_writer",
    description: "توجيه سؤال استفساري لطيف للكاتبة عند الغموض أو تعدد المواضع أو الخروج عن نطاق الفصل المفتوح.",
    parameters: {
      type: "OBJECT",
      properties: {
        question: {
          type: "STRING",
          description: "السؤال الموجه للكاتبة بالعربية الفصحى (إجباري)",
        },
        reason: {
          type: "STRING",
          enum: ["SCOPE", "AMBIGUOUS", "NOT_FOUND", "MULTI"],
          description: "سبب الاستفسار: SCOPE تجاوز نطاق الفصل، AMBIGUOUS غموض المعنى، NOT_FOUND تعذر العثور على النص، MULTI تعدد المواضع المحتملة (إجباري)",
        },
      },
      required: ["question", "reason"],
    },
  },
];

export type AIMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isNew?: boolean;
  isStreaming?: boolean;
};

export type StoryContext = {
  title: string;
  fullText: string;
  chapters?: { title: string; content: string }[];
  isNovelMode?: boolean;
};

function cleanHtmlText(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function formatStoryContextForAI(story: StoryContext): string {
  const titleStr = story.title?.trim() || "حكاية بدون عنوان";
  let contentBody = "";

  if (story.isNovelMode && story.chapters && story.chapters.length > 0) {
    contentBody = story.chapters
      .map((c, i) => `=== الفصل ${i + 1}: ${c.title || "بدون عنوان"} ===\n${cleanHtmlText(c.content)}`)
      .join("\n\n");
  } else {
    contentBody = cleanHtmlText(story.fullText);
  }

  if (!contentBody.trim()) {
    contentBody = "(المحرر فارغ)";
  }

  return `[سياق العمل الأدبي الحالي للكاتبة رحمة السيد موافي]
عنوان العمل: "${titleStr}"

[النص الكامل للحكاية المكتوبة في المحرر]:
${contentBody}
[نهاية سياق العمل الأدبي]`;
}

/**
 * Initial API call to Gemini upon opening the assistant for a story:
 * Reads the story and generates a real, dynamic literary greeting tailored specifically to the story's characters and events.
 * Operates through the SmartKeyRotator to guarantee uninterrupted connectivity.
 */
export async function initializeStoryAssistant(
  storyContext: StoryContext
): Promise<string> {
  const contextBlock = formatStoryContextForAI(storyContext);
  const fullSystemInstruction = `${RAHMA_MOWAFI_SYSTEM_PROMPT}\n\n${contextBlock}`;

  const userInitialPrompt = `الآن وبناءً على قراءتك العميقة للنص المرفق بالكامل، رحّب بالكاتبة رحمة السيد موافي ترحيباً أدبياً بليغاً ورفيعاً، واذكر لها استيعابك الصريح لشخصيات وأحداث الحكاية المكتوبة حتى الآن، واعرض عليها استعدادك التام لمعاونتها الأدبية وفق القواعد الحاكمة.`;

  try {
    return await executeWithSmartRotation(async (apiKey) => {
      // 1. Try server-side API endpoint first
      try {
        const res = await fetch("/api/gemini/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: fullSystemInstruction,
            contents: [{ role: "user", parts: [{ text: userInitialPrompt }] }],
            apiKey: apiKey || undefined,
            model: "gemini-2.5-flash",
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const err: any = new Error(
            errData?.error?.message || `API error: ${res.status}`
          );
          err.status = res.status;
          err.data = errData;
          throw err;
        }

        const data = await res.json();
        const candidateText = data.text || "";
        if (candidateText) return candidateText;
      } catch (serverErr: any) {
        if (
          isRateLimitError(serverErr?.status || 0, serverErr?.data, serverErr?.message) ||
          isInvalidKeyError(serverErr?.status || 0, serverErr?.data, serverErr?.message)
        ) {
          throw serverErr;
        }

        // Direct fetch fallback if on standalone mobile with custom key
        if (apiKey) {
          const directRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: fullSystemInstruction }] },
                contents: [{ role: "user", parts: [{ text: userInitialPrompt }] }],
              }),
            }
          );
          if (!directRes.ok) {
            const errData = await directRes.json().catch(() => ({}));
            const err: any = new Error(
              errData?.error?.message || `Direct Gemini API error: ${directRes.status}`
            );
            err.status = directRes.status;
            err.data = errData;
            throw err;
          }
          const data = await directRes.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (text) return text;
        } else {
          throw serverErr;
        }
      }

      return `أهلاً بكِ يا أستاذة رحمة. قرأتُ عملكِ الأدبي بعناية فائقة واستوعبتُ كافة أبعاده السردية. يسعدني مرافقتكِ في تطوير الحكاية وصقل النص. كيف ترغبين أن نبدأ الآن؟`;
    });
  } catch (error) {
    console.error("Error in initializeStoryAssistant:", error);
    return `أهلاً بكِ يا أستاذة رحمة. قرأتُ عملكِ الأدبي بعناية فائقة واستوعبتُ كافة أبعاده السردية. يسعدني مرافقتكِ في تطوير الحكاية وصقل النص. كيف ترغبين أن نبدأ الآن؟`;
  }
}

/**
 * Send interactive user message to Gemini, maintaining conversation history & story context.
 * Uses the SmartKeyRotator to seamlessly and transparently rotate keys if a rate-limit error occurs.
 */
export async function streamLiteraryAssistantResponse(
  history: AIMessage[],
  userPrompt: string,
  storyContext: StoryContext,
  onChunk: (text: string) => void,
  mentionsContext?: string
): Promise<string> {
  const contextBlock = formatStoryContextForAI(storyContext);
  const fullSystemInstruction = `${RAHMA_MOWAFI_SYSTEM_PROMPT}\n\n${contextBlock}${mentionsContext ? `\n\n${mentionsContext}` : ""}`;

  // Build full contents payload with conversation history
  const contents = history
    .filter((msg) => msg.content && msg.content.trim())
    .map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

  contents.push({
    role: "user",
    parts: [{ text: userPrompt }],
  });

  try {
    return await executeWithSmartRotation(async (apiKey) => {
      let candidateAccumulated = "";

      // 1. Try server-side streaming with /api/gemini/stream
      try {
        const res = await fetch("/api/gemini/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: fullSystemInstruction,
            contents,
            apiKey: apiKey || undefined,
            model: "gemini-2.5-flash",
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const err: any = new Error(
            errData?.error?.message || `Server streaming failed with status ${res.status}`
          );
          err.status = res.status;
          err.data = errData;
          throw err;
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder("utf-8");
        if (!reader) {
          throw new Error("Response body is not readable");
        }

        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;
            const payloadStr = trimmed.slice(6).trim();
            if (payloadStr === "[DONE]") break;

            try {
              const parsed = JSON.parse(payloadStr);
              if (parsed.error) {
                const err: any = new Error(parsed.error.message || "Server streaming error");
                err.status = parsed.error.code || 500;
                err.data = parsed;
                throw err;
              }
              const chunkText = parsed.text || "";
              if (chunkText) {
                candidateAccumulated += chunkText;
                onChunk(chunkText);
              }
            } catch (pErr: any) {
              if (pErr?.status) throw pErr;
            }
          }
        }

        if (!candidateAccumulated && buffer && buffer.startsWith("data: ")) {
          try {
            const parsed = JSON.parse(buffer.slice(6).trim());
            const chunkText = parsed.text || "";
            if (chunkText) {
              candidateAccumulated += chunkText;
              onChunk(chunkText);
            }
          } catch {
            // ignore
          }
        }
      } catch (streamErr: any) {
        // If it's a rate limit or auth error, throw so SmartKeyRotator catches and rotates to next key!
        if (
          isRateLimitError(streamErr?.status || 0, streamErr?.data, streamErr?.message) ||
          isInvalidKeyError(streamErr?.status || 0, streamErr?.data, streamErr?.message)
        ) {
          throw streamErr;
        }

        // If streaming failed for another reason and no text was received, try server-side generateContent
        if (!candidateAccumulated) {
          console.warn(
            "Streaming encountered error, trying server generateContent fallback:",
            streamErr
          );
          try {
            const fallbackRes = await fetch("/api/gemini/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                systemInstruction: fullSystemInstruction,
                contents,
                apiKey: apiKey || undefined,
                model: "gemini-3.8-flash",
              }),
            });

            if (!fallbackRes.ok) {
              const fallbackErrData = await fallbackRes.json().catch(() => ({}));
              const fErr: any = new Error(
                fallbackErrData?.error?.message || `Fallback failed: ${fallbackRes.status}`
              );
              fErr.status = fallbackRes.status;
              fErr.data = fallbackErrData;
              throw fErr;
            }

            const fallbackData = await fallbackRes.json();
            const text = fallbackData.text || "";
            if (text) {
              candidateAccumulated = text;
              onChunk(text);
            }
          } catch (fallbackErr: any) {
            if (
              isRateLimitError(fallbackErr?.status || 0, fallbackErr?.data, fallbackErr?.message) ||
              isInvalidKeyError(fallbackErr?.status || 0, fallbackErr?.data, fallbackErr?.message)
            ) {
              throw fallbackErr;
            }

            // Direct fetch fallback if on standalone mobile with custom key
            if (apiKey) {
              const directModels = ["gemini-2.5-flash", "gemini-3.8-flash"];
              let directSucceeded = false;
              for (const dModel of directModels) {
                try {
                  const directRes = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${dModel}:generateContent?key=${apiKey}`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        systemInstruction: { parts: [{ text: fullSystemInstruction }] },
                        contents,
                      }),
                    }
                  );

                  if (!directRes.ok) {
                    const directErrData = await directRes.json().catch(() => ({}));
                    const dErr: any = new Error(
                      directErrData?.error?.message || `Direct fallback failed: ${directRes.status}`
                    );
                    dErr.status = directRes.status;
                    dErr.data = directErrData;
                    if (dModel === directModels[0] && (directRes.status === 503 || directRes.status === 429)) {
                      continue;
                    }
                    throw dErr;
                  }

                  const directData = await directRes.json();
                  const dText =
                    directData.candidates?.[0]?.content?.parts?.[0]?.text || "";
                  if (dText) {
                    candidateAccumulated = dText;
                    onChunk(dText);
                    directSucceeded = true;
                    break;
                  }
                } catch (dCatchErr: any) {
                  if (dModel === directModels[0]) continue;
                  throw dCatchErr;
                }
              }
              if (!directSucceeded && !candidateAccumulated) {
                throw fallbackErr;
              }
            } else {
              throw fallbackErr;
            }
          }
        }
      }

      if (!candidateAccumulated) {
        throw new Error("لم يتم استلام أي رد من نموذج الذكاء الاصطناعي.");
      }

      return candidateAccumulated;
    });
  } catch (error: any) {
    console.error("Gemini response error in smart rotator:", error);
    let fallbackMessage =
      "عذراً يا أستاذة رحمة، حدث خطأ أثناء معالجة الطلب الأدبي. يرجى المحاولة مرة أخرى.";

    const errMsg = (error?.message || "").toLowerCase();
    if (
      errMsg.includes("high demand") ||
      errMsg.includes("503") ||
      errMsg.includes("unavailable") ||
      errMsg.includes("spikes in demand") ||
      errMsg.includes("overloaded")
    ) {
      fallbackMessage =
        "عذراً يا أستاذة رحمة، تشهد خوادم الذكاء الاصطناعي إقبالاً كبيراً مؤقتاً في هذه اللحظة. يرجى إعادة إرسال السؤال أو الملاحظة بعد بضع ثوانٍ وسأكون معكِ على الفور.";
    } else if (error instanceof AllKeysExhaustedError) {
      fallbackMessage = error.message;
    } else if (error instanceof NoActiveKeysConfiguredError) {
      fallbackMessage = error.message;
    } else if (isNetworkConnectionError(error)) {
      fallbackMessage =
        "تعذر الاتصال بالشبكة. يرجى التحقق من اتصال الإنترنت والمحاولة مجدداً.";
    }

    onChunk(fallbackMessage);
    return fallbackMessage;
  }
}

/**
 * دالة طلب القرار التنفيذي للوكيل الأدبي (Executive Decision Request)
 * تستخدم النمط الصارم والدقيق: حرارة 0.2 ونموذج gemini-2.5-flash حصراً لضمان حتمية العقد،
 * مع التحقق الشامل من مطابقة مخططات الاستدعاء الأربع.
 */
export async function requestExecutiveDecision({
  contents,
  executiveInstruction,
  tools,
}: {
  contents: any[];
  executiveInstruction?: string;
  tools?: any[];
}): Promise<{
  text: string;
  functionCalls: Array<{ name: string; args: any }>;
  model: string;
  error?: string;
}> {
  try {
    return await executeWithSmartRotation(async (apiKey) => {
      const res = await fetch("/api/gemini/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: executiveInstruction || UNIFIED_AGENT_INSTRUCTION,
          contents,
          apiKey: apiKey || undefined,
          model: "gemini-2.5-flash",
          temperature: 0.2,
          tools: tools || AGENTIC_TOOL_DECLARATIONS,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const err: any = new Error(
          errData?.error?.message || `خطأ في خادم اتخاذ القرار التنفيذي: ${res.status}`
        );
        err.status = res.status;
        err.data = errData;
        throw err;
      }

      const data = await res.json();
      const rawCalls = data.functionCalls || [];

      // تحقق صارم من صحة مخططات الاستدعاء (Schema Validation)
      const validatedCalls: Array<{ name: string; args: any }> = [];
      for (const call of rawCalls) {
        if (!call || typeof call !== "object") continue;
        const { name, args } = call;
        if (!name || !args || typeof args !== "object") continue;

        if (name === "replace_text") {
          if (
            typeof args.block_id === "string" &&
            args.block_id.startsWith("b_") &&
            typeof args.target_text === "string" &&
            typeof args.new_text === "string" &&
            typeof args.step_note === "string" &&
            args.step_note.trim().length > 0
          ) {
            validatedCalls.push({
              name,
              args: {
                block_id: args.block_id.trim(),
                target_text: args.target_text,
                new_text: args.new_text,
                step_note: args.step_note.trim(),
              },
            });
          }
        } else if (name === "insert_text") {
          if (
            typeof args.anchor_block_id === "string" &&
            args.anchor_block_id.startsWith("b_") &&
            (args.position === "after" || args.position === "before") &&
            typeof args.new_text === "string" &&
            typeof args.step_note === "string" &&
            args.step_note.trim().length > 0
          ) {
            validatedCalls.push({
              name,
              args: {
                anchor_block_id: args.anchor_block_id.trim(),
                position: args.position,
                new_text: args.new_text,
                step_note: args.step_note.trim(),
              },
            });
          }
        } else if (name === "delete_text") {
          if (
            typeof args.block_id === "string" &&
            args.block_id.startsWith("b_") &&
            typeof args.step_note === "string" &&
            args.step_note.trim().length > 0
          ) {
            validatedCalls.push({
              name,
              args: {
                block_id: args.block_id.trim(),
                step_note: args.step_note.trim(),
              },
            });
          }
        } else if (name === "ask_writer") {
          if (
            typeof args.question === "string" &&
            args.question.trim().length > 0 &&
            ["SCOPE", "AMBIGUOUS", "NOT_FOUND", "MULTI"].includes(args.reason)
          ) {
            validatedCalls.push({
              name,
              args: {
                question: args.question.trim(),
                reason: args.reason,
              },
            });
          }
        }
      }

      return {
        text: data.text || "",
        functionCalls: validatedCalls,
        model: data.model || "gemini-2.5-flash",
      };
    });
  } catch (err: any) {
    console.error("[Executive Decision Request Failed]:", err);
    let friendlyError =
      "عذراً يا أستاذة رحمة، تعذر تنفيذ القرار الأدبي حالياً. يمكنكِ إعادة المحاولة.";

    const msg = (err?.message || "").toLowerCase();
    if (
      msg.includes("high demand") ||
      msg.includes("503") ||
      msg.includes("unavailable") ||
      msg.includes("overloaded")
    ) {
      friendlyError =
        "الخوادم تشهد ضغطاً مؤقتاً أثناء التجهيز للتعديل. يرجى الضغط على زر الإعادة للمتابعة فوراً.";
    } else if (err instanceof AllKeysExhaustedError || err instanceof NoActiveKeysConfiguredError) {
      friendlyError = err.message;
    } else if (isNetworkConnectionError(err)) {
      friendlyError =
        "تعذر الاتصال بالشبكة لإتمام التعديل الجراحي. يرجى التحقق من الإنترنت ثم إعادة المحاولة.";
    }

    return {
      text: "",
      functionCalls: [],
      model: "gemini-2.5-flash",
      error: friendlyError,
    };
  }
}

/**
 * توليد تمهيد سياقي للوكيل في حال لم يُرجع النموذج نصاً تمهيدياً مع دوال الاستدعاء
 */
export function generateDefaultAgentIntro(
  _userPrompt: string,
  calls: Array<{ name: string; args: any }>
): string {
  const count = calls.length;
  const firstNote = (calls[0]?.args as any)?.step_note;
  if (firstNote) {
    return `على الرحب والسعة يا أستاذة رحمة؛ سأباشر الآن تنفيذ التعديل في النص: ${firstNote}.`;
  }
  return `على الرحب والسعة يا أستاذة رحمة؛ سأقوم الآن بتنفيذ ${
    count > 1 ? `${count} خطوات جراحية` : "الخطوة الجراحية المطلوبة"
  } على النص بعناية لتتطابق النتيجة مع رؤيتك الأدبية:`;
}

/**
 * نص ختامي احتياطي سريع وأنيق في حال تعذر الاتصال الإضافي
 */
export function generateDefaultAgentSummary(
  steps: Array<{ toolName?: string; stepNote?: string }>
): string {
  const count = steps.length;
  if (count <= 1) {
    const note = steps[0]?.stepNote;
    return `تم بحمد الله تطبيق التعديل على النص بدقة متناهية${
      note ? `؛ حيث تم ${note}` : ""
    }.\n\nهل ترغبين يا أستاذة رحمة في ضبط أي جزئية أخرى، أو إضفاء لمسات أدبية إضافية على هذا المقطع؟`;
  }
  return `تم بحمد الله إنجاز كافة الخطوات المطلوبة (${count} خطوات) وتحديث النص في المحرر بدقة بالغة.\n\nهل تودين يا أستاذة رحمة مراجعة أي مقطع آخر أو تجربة صياغات إضافية؟`;
}

/**
 * توليد ملخص ختامي أدبي موجز ومحترف بعد إنجاز خطوات الوكيل التنفيذي
 */
export async function generateAgentCompletionSummary({
  userPrompt,
  executedSteps,
  storyTitle,
}: {
  userPrompt: string;
  executedSteps: Array<{ toolName: string; stepNote: string }>;
  storyTitle?: string;
}): Promise<string> {
  const stepsSummary = executedSteps
    .map((s, i) => `${i + 1}. ${s.stepNote || s.toolName}`)
    .join("\n");

  const prompt = `أنت المحرر الأدبي الخاص بالكاتبة رحمة السيد موافي في حكايتها "${storyTitle || "العمل الأدبي"}".
أنهيت الآن للتو بنجاح تنفيذ التعديلات الجراحية التالية على النص المكتوب داخل المحرر:
${stepsSummary}

بناءً على طلب الكاتبة الأصلي: "${userPrompt}"

المطلوب: اكتب رداً ختامياً بليغاً وموجزاً جداً (في سطرين إلى ثلاثة أسطر):
1. أخبر الكاتبة بلباقة واعتزاز بما تم إنجازه وتحسينه في النص.
2. اسألها باحترام وود إن كانت ترغب في مراجعة أي جزئية أخرى أو إضفاء مزيد من اللمسات الأدبية على هذا المقطع أو الانتقال لموضع آخر.
3. اكتب مباشرة كنص حواري أنيق دون مقدمات أو حشو أو استدعاء أدوات.`;

  try {
    return await executeWithSmartRotation(async (apiKey) => {
      const res = await fetch("/api/gemini/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          apiKey: apiKey || undefined,
          model: "gemini-2.5-flash",
          temperature: 0.3,
        }),
      });

      if (!res.ok) throw new Error("Failed to generate agent summary");
      const data = await res.json();
      const text = (data.text || "").trim();
      return text || generateDefaultAgentSummary(executedSteps);
    });
  } catch {
    return generateDefaultAgentSummary(executedSteps);
  }
}

