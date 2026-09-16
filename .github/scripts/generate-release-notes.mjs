import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const outputPath = "release-notes.json";
const model = process.env.RELEASE_NOTES_GEMINI_MODEL || "gemini-3.5-flash";
const apiKey = process.env.RELEASE_NOTES_AI_API_KEY?.trim();

function git(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 }).trim();
  } catch {
    return "";
  }
}

const baseTag = git(["describe", "--tags", "--abbrev=0", "HEAD^"]);
const range = baseTag ? `${baseTag}..HEAD` : "HEAD^..HEAD";
const commit = git(["log", "--format=%H%n%s%n%b", range]);
const changedFiles = git(["diff", "--name-status", range]);
const stats = git(["diff", "--stat", range]);
const diff = git(["diff", "--unified=0", range]);
const sourceReport = [
  `آخر إصدار مرجعي: ${baseTag || "غير متاح"}`,
  `Commits الداخلة في الإصدار:\n${commit || "غير متاحة"}`,
  `الملفات التي دخلت في الإصدار:\n${changedFiles || "غير متاحة"}`,
  `إحصائية التغيير:\n${stats || "غير متاحة"}`,
  `التغييرات الفعلية:\n${diff || "غير متاحة"}`,
].join("\n\n").slice(0, 16000);

const fallback = {
  title: "ما الجديد في هذا الإصدار؟",
  items: ["تحسينات عامة على الأداء والاستقرار."],
};

function validNotes(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.items)) return false;
  if (value.items.length < 1 || value.items.length > 5) return false;
  return value.items.every((item) =>
    typeof item === "string" && item.trim().length >= 6 && item.trim().length <= 140 &&
    !/[<>`]/.test(item) && !/https?:\/\//i.test(item),
  );
}

async function generate() {
  if (!apiKey) return fallback;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const prompt = `أنت محرر ملاحظات إصدار لتطبيق عربي. استخدم التقرير التالي فقط. اكتب من 1 إلى 5 نقاط عربية قصيرة، كل نقطة لا تتجاوز 140 حرفًا، للمستخدم العادي. لا تذكر أسماء ملفات أو دوال أو API أو GitHub، ولا تخترع ميزة غير موجودة. إذا كانت التفاصيل التقنية غير واضحة فاكتب تحسينًا عامًا صادقًا. أعد JSON فقط بالشكل: {"title":"ما الجديد في هذا الإصدار؟","items":["..."]}.\n\n${sourceReport}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING" },
            items: { type: "ARRAY", items: { type: "STRING" } },
          },
          required: ["title", "items"],
        },
        temperature: 0.2,
        maxOutputTokens: 600,
      },
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`);
  const payload = await response.json();
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  const parsed = JSON.parse(text || "{}");
  if (!validNotes(parsed)) throw new Error("Gemini returned invalid release notes");
  return { title: "ما الجديد في هذا الإصدار؟", items: parsed.items.map((item) => item.trim()) };
}

let notes = fallback;
try {
  notes = await generate();
  console.log(apiKey ? `Generated release notes with ${model}.` : "Generated safe fallback release notes (Secret not configured).");
} catch (error) {
  console.warn(`AI release notes unavailable; using safe fallback: ${error.message}`);
}

writeFileSync(outputPath, `${JSON.stringify(notes, null, 2)}\n`, "utf8");
writeFileSync("release-body.md", `## ${notes.title}\n\n${notes.items.map((item) => `- ${item}`).join("\n")}\n`, "utf8");
console.log(JSON.stringify(notes));
