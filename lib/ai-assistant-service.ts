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
  onChunk: (text: string) => void
): Promise<string> {
  const contextBlock = formatStoryContextForAI(storyContext);
  const fullSystemInstruction = `${RAHMA_MOWAFI_SYSTEM_PROMPT}\n\n${contextBlock}`;

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

