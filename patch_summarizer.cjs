const fs = require('fs');
let content = fs.readFileSync('lib/ai-assistant-service.ts', 'utf8');

// Replace SummaryCacheEntry and summaryCache
const cacheRegex = /interface SummaryCacheEntry \{[\s\S]*?\nconst summaryCache = new Map<string, SummaryCacheEntry>\(\);/m;
const newCacheStruct = `
export interface StructuredMemory {
  storyDecisions: string[];
  characterFacts: string[];
  plotFacts: string[];
  styleRules: string[];
  writerPreferences: string[];
  openTasks: string[];
  executedEdits: string[];
}

export interface StructuredMemoryEntry {
  memory: StructuredMemory;
  lastIncludedMessageId: string;
}

function getStructuredMemory(key: string): StructuredMemoryEntry {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const stored = localStorage.getItem(\`story_memory_\${key}\`);
      if (stored) return JSON.parse(stored);
    } catch(e) {}
  }
  return {
    memory: {
      storyDecisions: [],
      characterFacts: [],
      plotFacts: [],
      styleRules: [],
      writerPreferences: [],
      openTasks: [],
      executedEdits: []
    },
    lastIncludedMessageId: ""
  };
}

function saveStructuredMemory(key: string, entry: StructuredMemoryEntry) {
  if (typeof window !== "undefined" && window.localStorage) {
    localStorage.setItem(\`story_memory_\${key}\`, JSON.stringify(entry));
  }
}
`;
content = content.replace(cacheRegex, newCacheStruct);

// Replace SUMMARIZE_PROMPT
const promptRegex = /const SUMMARIZE_PROMPT = `[\s\S]*?لا يتجاوز 200 كلمة.`;/m;
const newPrompt = `const SUMMARIZE_PROMPT = \`أنت مساعد تلخيص أدبي احترافي وموجز للغاية.
مهمتك هي مراجعة تاريخ المحادثة السابقة وتحديث الذاكرة التراكمية المنظمة للمحادثة.
قم بدمج المعلومات الجديدة مع الذاكرة السابقة بدقة واحترافية بدون تكرار، وأصلح أي تعارضات.
تأكد من الحفاظ على الحقائق القديمة إذا لم يتم نفيها.
يجب أن تعيد الناتج حصرياً ككائن JSON بالصيغة التالية (بدون أي نصوص إضافية):
{
  "storyDecisions": ["قرار 1", "قرار 2"],
  "characterFacts": ["حقيقة 1"],
  "plotFacts": [],
  "styleRules": [],
  "writerPreferences": [],
  "openTasks": [],
  "executedEdits": []
}\`;`;
content = content.replace(promptRegex, newPrompt);

// Replace generateCumulativeSummary signature and body
const genSumRegex = /async function generateCumulativeSummary\([\s\S]*?\): Promise<string> \{[\s\S]*?return oldSummary;\n  \}\n\}/m;
const newGenSum = `async function generateCumulativeSummary(
  oldMemory: StructuredMemory,
  newMessages: AIMessage[]
): Promise<StructuredMemory> {
  const newMessagesText = newMessages
    .map((m) => \`\${m.role === "user" ? "الكاتبة" : "المساعد"}: \${m.content}\`)
    .join("\\n");

  const userPrompt = \`الذاكرة التراكمية السابقة المنظمة:\n\${JSON.stringify(oldMemory)}\n\nالرسائل الجديدة:\n\${newMessagesText}\n\nيرجى إعادة الذاكرة التراكمية الجديدة بصيغة JSON فقط:\`;

  try {
    return await executeWithSmartRotation(async (apiKey) => {
      let textResponse = "";
      if (apiKey) {
        const directRes = await generateGeminiDirectly({
          apiKey,
          systemInstruction: SUMMARIZE_PROMPT,
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: {
            ...buildReasoningConfig("summary", 0.1),
            responseMimeType: "application/json",
          },
        });
        textResponse = directRes.text || "{}";
      } else {
        const res = await fetch("/api/gemini/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: SUMMARIZE_PROMPT,
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            model: "gemini-2.5-flash",
            temperature: 0.1,
            responseMimeType: "application/json",
          }),
        });
        const data = await res.json();
        textResponse = data.text || "{}";
      }
      
      const parsed = JSON.parse(textResponse);
      return {
        storyDecisions: Array.isArray(parsed.storyDecisions) ? parsed.storyDecisions : [],
        characterFacts: Array.isArray(parsed.characterFacts) ? parsed.characterFacts : [],
        plotFacts: Array.isArray(parsed.plotFacts) ? parsed.plotFacts : [],
        styleRules: Array.isArray(parsed.styleRules) ? parsed.styleRules : [],
        writerPreferences: Array.isArray(parsed.writerPreferences) ? parsed.writerPreferences : [],
        openTasks: Array.isArray(parsed.openTasks) ? parsed.openTasks : [],
        executedEdits: Array.isArray(parsed.executedEdits) ? parsed.executedEdits : []
      };
    });
  } catch (err) {
    console.warn("Failed to generate structured summary:", err);
    return oldMemory;
  }
}`;
content = content.replace(genSumRegex, newGenSum);

// Fix the logic inside streamLiteraryAssistantResponse
const logicRegex = /let cached = summaryCache\.get\(sessionKey\);[\s\S]*?if \(cached\.summary\) \{[\s\S]*?\}\n  \}/m;
const newLogic = `
    let cached = getStructuredMemory(sessionKey);
    const lastMsgToSummarize = messagesToSummarize[messagesToSummarize.length - 1];
    if (cached.lastIncludedMessageId !== lastMsgToSummarize.id) {
      let startIndex = 0;
      if (cached.lastIncludedMessageId) {
        const idx = messagesToSummarize.findIndex((m) => m.id === cached.lastIncludedMessageId);
        if (idx !== -1) {
          startIndex = idx + 1;
        }
      }
      const newMessagesForSummary = messagesToSummarize.slice(startIndex);
      if (newMessagesForSummary.length > 0) {
        try {
          console.log(\`[Smart Summarization] Summarizing \${newMessagesForSummary.length} older messages...\`);
          // Note: background summarization doesn't block the immediate request!
          // We fire and forget it to update the cache for the NEXT turn.
          generateCumulativeSummary(cached.memory, newMessagesForSummary).then((updatedMemory) => {
            saveStructuredMemory(sessionKey, {
              memory: updatedMemory,
              lastIncludedMessageId: lastMsgToSummarize.id
            });
          }).catch((err) => console.warn(err));
        } catch (sumErr) {
          console.warn("[Smart Summarization] Background summarization failed:", sumErr);
        }
      }
    }
    
    // Convert structured memory to text for the prompt
    const hasAnyMemory = Object.values(cached.memory).some(arr => arr && arr.length > 0);
    if (hasAnyMemory) {
      let formattedMemory = \`[الذاكرة التراكمية للقصة والقرارات]:\\n\`;
      if (cached.memory.storyDecisions?.length) formattedMemory += \`- قرارات القصة:\\n  * \${cached.memory.storyDecisions.join("\\n  * ")}\\n\`;
      if (cached.memory.characterFacts?.length) formattedMemory += \`- معلومات الشخصيات:\\n  * \${cached.memory.characterFacts.join("\\n  * ")}\\n\`;
      if (cached.memory.plotFacts?.length) formattedMemory += \`- الأحداث والحبكة:\\n  * \${cached.memory.plotFacts.join("\\n  * ")}\\n\`;
      if (cached.memory.styleRules?.length) formattedMemory += \`- قواعد الأسلوب:\\n  * \${cached.memory.styleRules.join("\\n  * ")}\\n\`;
      if (cached.memory.writerPreferences?.length) formattedMemory += \`- تفضيلات الكاتبة:\\n  * \${cached.memory.writerPreferences.join("\\n  * ")}\\n\`;
      if (cached.memory.openTasks?.length) formattedMemory += \`- المهام المفتوحة:\\n  * \${cached.memory.openTasks.join("\\n  * ")}\\n\`;
      if (cached.memory.executedEdits?.length) formattedMemory += \`- التعديلات المنفذة مسبقاً:\\n  * \${cached.memory.executedEdits.join("\\n  * ")}\\n\`;
      enrichedSystemInstruction += \`\\n\\n\${formattedMemory}\\n[نهاية الذاكرة التراكمية]\`;
    }
  }
`;
content = content.replace(logicRegex, newLogic);

fs.writeFileSync('lib/ai-assistant-service.ts', content);
console.log('patched summarizer in ai-assistant-service.ts');
