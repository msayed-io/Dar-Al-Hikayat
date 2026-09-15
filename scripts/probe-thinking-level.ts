import { GoogleGenAI } from "@google/genai";
import { generateGeminiDirectly, streamGeminiDirectly } from "../lib/gemini-direct-client";

async function main() {
  const apiKey = process.env.GEMINI_PROBE_KEY;
  if (!apiKey) {
    console.error("المفتاح مطلوب");
    process.exit(2);
  }

  console.log("=== بدء المسبار الحي لـ thinkingLevel ===");

  let allPassed = true;

  // Test 1: Direct REST Generate (LOW)
  try {
    console.log("\n[اختبار 1] REST توليد مباشر (LOW)");
    const res = await generateGeminiDirectly({
      apiKey,
      contents: [{ role: "user", parts: [{ text: "Hello, just reply with 'Hi'" }] }],
      generationConfig: {
        temperature: 0.2,
        thinkingLevel: "LOW",
      },
    });
    console.log("-> نجاح: تم التوليد بنجاح.");
    // We can't directly inspect thoughtsTokenCount from generateGeminiDirectly 
    // unless we modified it to return usageMetadata. We will just report success.
  } catch (err: any) {
    console.error("-> فشل:", err?.message || err);
    allPassed = false;
  }

  // Test 2: Direct REST Stream (MEDIUM)
  try {
    console.log("\n[اختبار 2] REST بث مباشر (MEDIUM)");
    let firstChunkReceived = false;
    await streamGeminiDirectly({
      apiKey,
      contents: [{ role: "user", parts: [{ text: "Hello, reply with 3 words" }] }],
      generationConfig: {
        temperature: 0.2,
        thinkingLevel: "MEDIUM",
      },
      onChunk: (text) => {
        if (!firstChunkReceived && text) {
          firstChunkReceived = true;
          console.log("-> نجاح: وصلت أول قطعة.");
        }
      },
    });
    if (!firstChunkReceived) {
      console.log("-> تحذير: اكتمل البث دون استلام قطع نصية.");
    }
  } catch (err: any) {
    console.error("-> فشل:", err?.message || err);
    allPassed = false;
  }

  // Test 3: Server SDK simulation (LOW)
  try {
    console.log("\n[اختبار 3] شكل كونفيج الخادم (SDK) بمستوى LOW");
    const ai = new GoogleGenAI({ apiKey });
    
    const LADDER = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash"];
    let answeredModel = "";
    
    for (const currentModel of LADDER) {
      const config: any = {
        temperature: 0.2,
        thinkingConfig: { thinkingLevel: "LOW" },
      };

      let response;
      let fallbackTriggered = false;
      try {
        try {
          response = await ai.models.generateContent({
            model: currentModel,
            contents: [{ role: "user", parts: [{ text: "Hi" }] }],
            config,
          });
        } catch (initialErr: any) {
          const msg = `${initialErr?.message || ""} ${JSON.stringify(initialErr?.data || {})}`;
          if (config.thinkingConfig && /thinking|THINKING_LEVEL|Enterprise/i.test(msg)) {
            console.warn("-> تدخل التراجع (Fallback) بعد الرفض.");
            fallbackTriggered = true;
            delete config.thinkingConfig;
            response = await ai.models.generateContent({
              model: currentModel,
              contents: [{ role: "user", parts: [{ text: "Hi" }] }],
              config,
            });
          } else {
            throw initialErr;
          }
        }

        answeredModel = currentModel;
        console.log(`-> نجاح: تم التوليد بواسطة ${answeredModel}. (تدخل التراجع؟ ${fallbackTriggered ? "نعم" : "لا"})`);
        const metadata = (response as any)?.usageMetadata;
        if (metadata?.promptTokenCount !== undefined) {
           console.log(`-> tokens: prompt=${metadata.promptTokenCount}, candidates=${metadata.candidatesTokenCount}`);
        }
        break;
      } catch (err: any) {
        const status = err?.status ?? err?.code;
        if (status === 429 || status === 404 || (typeof status === "number" && status >= 500) || (!status && err instanceof TypeError)) {
          console.warn(`-> فشل ${currentModel} بضغط/عطل، انتقال للتالي...`);
          continue;
        }
        throw err;
      }
    }
    
    if (!answeredModel) {
      throw new Error("استنفدنا السلم ولم يجب أي نموذج.");
    }
  } catch (err: any) {
    console.error("-> فشل:", err?.message || err);
    allPassed = false;
  }

  // Test 4: Ladder Fallback
  try {
    console.log("\n[اختبار 4] السلم الاحتياطي (Fallback Ladder) مع نموذج وهمي");
    const res = await generateGeminiDirectly({
      apiKey,
      model: "gemini-9.9-fake",
      contents: [{ role: "user", parts: [{ text: "Hello, reply 'Ladder OK'" }] }],
      generationConfig: {
        temperature: 0.2,
        thinkingLevel: "LOW",
      },
    });
    
    const LADDER = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash"];
    if (LADDER.includes(res.model) && res.model !== "gemini-9.9-fake") {
      console.log(`-> نجاح: تم التراجع من النموذج الوهمي وأجاب النموذج ${res.model} بنجاح.`);
    } else {
      console.error(`-> فشل: عاد بنموذج غير متوقع (${res.model}).`);
      allPassed = false;
    }
  } catch (err: any) {
    console.error("-> فشل السلم الاحتياطي:", err?.message || err);
    allPassed = false;
  }

  console.log("\n=== النتيجة النهائية ===");
  if (allPassed) {
    console.log("جميع الاختبارات اجتازت بنجاح (خروج 0).");
    process.exit(0);
  } else {
    console.error("بعض الاختبارات فشلت (خروج 1).");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
