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

function getApiKey(): string {
  if (typeof process !== "undefined" && process.env) {
    return process.env.GEMINI_API_KEY || process.env.API_KEY || "";
  }
  return "";
}

/**
 * Initial real API call to Gemini upon opening the assistant for a story:
 * Reads the story and generates a real, dynamic literary greeting tailored specifically to the story's characters and events.
 */
export async function initializeStoryAssistant(
  storyContext: StoryContext
): Promise<string> {
  const apiKey = getApiKey();
  const contextBlock = formatStoryContextForAI(storyContext);
  const fullSystemInstruction = `${RAHMA_MOWAFI_SYSTEM_PROMPT}\n\n${contextBlock}`;

  const userInitialPrompt = `الآن وبناءً على قراءتك العميقة للنص المرفق بالكامل، رحّب بالكاتبة رحمة السيد موافي ترحيباً أدبياً بليغاً ورفيعاً، واذكر لها استيعابك الصريح لشخصيات وأحداث الحكاية المكتوبة حتى الآن، واعرض عليها استعدادك التام لمعاونتها الأدبية وفق القواعد الحاكمة.`;

  if (!apiKey) {
    return `أهلاً بكِ يا أستاذة رحمة. قرأتُ عملكِ الأدبي بعناية فائقة واستوعبتُ كافة أبعاده السردية. يسعدني مرافقتكِ في تطوير الحكاية وصقل النص. كيف ترغبين أن نبدأ الآن؟`;
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: fullSystemInstruction }] },
          contents: [{ role: "user", parts: [{ text: userInitialPrompt }] }],
          generationConfig: {
            temperature: 0.7,
            topP: 0.9,
          },
        }),
      }
    );

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.error("Gemini API error during initialization:", errData);
      throw new Error("Failed to generate initial response from Gemini");
    }

    const data = await res.json();
    const candidateText =
      data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!candidateText) {
      throw new Error("Empty candidate received from Gemini");
    }

    return candidateText;
  } catch (error) {
    console.error("Error in initializeStoryAssistant:", error);
    throw error;
  }
}

/**
 * Send interactive user message to Gemini, maintaining conversation history & story context.
 */
export async function streamLiteraryAssistantResponse(
  history: AIMessage[],
  userPrompt: string,
  storyContext: StoryContext,
  onChunk: (text: string) => void
): Promise<string> {
  const apiKey = getApiKey();
  const contextBlock = formatStoryContextForAI(storyContext);
  const fullSystemInstruction = `${RAHMA_MOWAFI_SYSTEM_PROMPT}\n\n${contextBlock}`;

  if (!apiKey) {
    const offlineMsg = "عذراً يا أستاذة رحمة، لم يتم العثور على مفتاح الاتصال بنموذج الذكاء الاصطناعي.";
    onChunk(offlineMsg);
    return offlineMsg;
  }

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
    // We can use SSE streaming with streamGenerateContent
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: fullSystemInstruction }] },
          contents,
          generationConfig: {
            temperature: 0.7,
            topP: 0.9,
          },
        }),
      }
    );

    if (!res.ok) {
      throw new Error(`Gemini streaming request failed: ${res.statusText}`);
    }

    const reader = res.body?.getReader();
    const decoder = new TextDecoder("utf-8");
    if (!reader) {
      throw new Error("Response body is not readable");
    }

    let accumulated = "";
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
        const jsonStr = trimmed.slice(6);
        if (jsonStr === "[DONE]") break;

        try {
          const parsed = JSON.parse(jsonStr);
          const chunkText =
            parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (chunkText) {
            accumulated += chunkText;
            onChunk(accumulated);
          }
        } catch {
          // ignore partial JSON chunk
        }
      }
    }

    if (!accumulated) {
      // Fallback if SSE buffer had leftover
      if (buffer && buffer.startsWith("data: ")) {
        try {
          const parsed = JSON.parse(buffer.slice(6));
          const chunkText =
            parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (chunkText) {
            accumulated += chunkText;
            onChunk(accumulated);
          }
        } catch {
          // ignore
        }
      }
    }

    return accumulated;
  } catch (error) {
    console.error("Gemini streaming error:", error);
    // Fallback to standard generateContent if streaming fails
    try {
      const fallbackRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: fullSystemInstruction }] },
            contents,
          }),
        }
      );
      const fallbackData = await fallbackRes.json();
      const text = fallbackData.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (text) {
        onChunk(text);
        return text;
      }
    } catch {
      // ignore
    }
    const errText = "عذراً يا أستاذة رحمة، حدث خطأ أثناء معالجة الطلب الأدبي. يرجى المحاولة مرة أخرى.";
    onChunk(errText);
    return errText;
  }
}
