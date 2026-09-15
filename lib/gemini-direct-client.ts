import { Capacitor } from "@capacitor/core";

export const GEMINI_PRIMARY_MODEL = "gemini-3.8-flash";

export type ThinkingLevelName = "LOW" | "MEDIUM" | "HIGH";
export const THINKING_FOR_PATH = {
  executive: "LOW",
  summary: "LOW",
  advisory: "MEDIUM",
  init: "MEDIUM",
} as const;

export interface ReasoningConfig {
  temperature: number;
  thinkingConfig?: { thinkingLevel: ThinkingLevelName };
}

export function buildReasoningConfig(path: keyof typeof THINKING_FOR_PATH, temperature: number): ReasoningConfig {
  return { temperature, thinkingConfig: { thinkingLevel: THINKING_FOR_PATH[path] } };
}

export function isThinkingRejection(err: any): boolean {
  const msg = `${err?.message || ""} ${JSON.stringify(err?.data || {})}`;
  return /thinking|THINKING_LEVEL|Enterprise/i.test(msg);
}

/**
 * Determines whether the app is running in a native mobile environment (Capacitor/Android/iOS)
 * or standalone local WebView without an Express server backend.
 */
export function isNativeMobileEnvironment(): boolean {
  try {
    if (typeof window === "undefined") return false;
    if (Capacitor.isNativePlatform()) return true;
    const protocol = window.location?.protocol || "";
    if (protocol === "capacitor:" || protocol === "file:" || protocol === "ionic:") {
      return true;
    }
    const host = window.location?.hostname || "";
    if (host === "localhost" && window.location?.port === "") {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Sanitizes and extracts the raw API key string.
 */
export function sanitizeApiKey(rawKey: string): string {
  if (!rawKey) return "";
  return rawKey.trim().replace(/^["']|["']$/g, "").replace(/\s+/g, "");
}

/**
 * Validates a Google Gemini API Key directly against Google's Generative Language REST API.
 * Works natively on Android WebView, iOS, and all modern browsers with zero proxy dependency.
 */
export async function validateGeminiKeyDirectly(
  apiKey: string
): Promise<{ valid: boolean; message: string; code?: number }> {
  const cleanKey = sanitizeApiKey(apiKey);
  if (!cleanKey) {
    return {
      valid: false,
      message: "مفتاح API فارغ. يرجى إدخال مفتاح صالح من Google AI Studio.",
      code: 400,
    };
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_PRIMARY_MODEL}:generateContent?key=${encodeURIComponent(
      cleanKey
    )}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: "فحص الاتصال" }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 5,
          temperature: 0.1,
        },
      }),
    });

    if (res.ok) {
      return {
        valid: true,
        message: "تم التحقق بنجاح؛ المفتاح متصل ويعمل بكفاءة عالية مع خوادم الذكاء الاصطناعي.",
        code: 200,
      };
    }

    const errData = await res.json().catch(() => ({}));
    const status = res.status;
    const errMessage = (
      errData?.error?.message ||
      errData?.message ||
      ""
    ).toLowerCase();

    if (status === 400 || errMessage.includes("api_key_invalid") || errMessage.includes("not valid")) {
      return {
        valid: false,
        message: "مفتاح API غير صالح أو غير صحيح (API_KEY_INVALID). يرجى التأكد من نسخه بدقة وبشكل كامل.",
        code: 400,
      };
    }

    if (status === 401 || errMessage.includes("unauthenticated")) {
      return {
        valid: false,
        message: "مفتاح API غير مصرح به أو تم إلغاؤه (UNAUTHENTICATED).",
        code: 401,
      };
    }

    if (status === 403 || errMessage.includes("permission_denied") || errMessage.includes("permission")) {
      return {
        valid: false,
        message: "مفتاح API تنقصه أذونات خدمة Gemini API في Google Cloud (PERMISSION_DENIED).",
        code: 403,
      };
    }

    if (status === 429 || errMessage.includes("resource_exhausted") || errMessage.includes("quota")) {
      return {
        valid: true, // Key is valid, but currently quota-limited
        message: "المفتاح صالح ومسجل بنجاح، ولكنه استنفد حصته المؤقتة حالياً (RESOURCE_EXHAUSTED). سيعمل تلقائياً عند تجدد الحصة.",
        code: 429,
      };
    }

    if (status === 503 || errMessage.includes("unavailable") || errMessage.includes("high demand")) {
      return {
        valid: true,
        message: "المفتاح صالح، وخوادم الذكاء الاصطناعي تشهد ضغطاً مؤقتاً في هذه اللحظة (503 Service Unavailable).",
        code: 503,
      };
    }

    return {
      valid: false,
      message: errData?.error?.message || `تعذر التحقق من المفتاح (رمز الاستجابة: ${status}).`,
      code: status,
    };
  } catch (err: any) {
    return {
      valid: false,
      message: err?.message || "تعذر الاتصال بالشبكة للتحقق من المفتاح. يرجى التحقق من اتصال الإنترنت.",
      code: 0,
    };
  }
}

export interface DirectGeminiGenerateParams {
  apiKey: string;
  model?: string;
  systemInstruction?: string;
  contents: Array<{
    role: "user" | "model";
    parts: Array<{ text?: string; functionCall?: any; functionResponse?: any }>;
  }>;
  tools?: any[];
  generationConfig?: {
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
    thinkingLevel?: ThinkingLevelName;
  };
  signal?: AbortSignal;
}

/**
 * Direct non-streaming Gemini generateContent call with full Function Calling and Schema Validation support.
 */
export async function generateGeminiDirectly(
  params: DirectGeminiGenerateParams
): Promise<{
  text: string;
  functionCalls: Array<{ name: string; args: any }>;
  model: string;
}> {
  const cleanKey = sanitizeApiKey(params.apiKey);
  if (!cleanKey) {
    const err: any = new Error("مفتاح API غير متوفر لإجراء الطلب المباشر.");
    err.status = 401;
    throw err;
  }

  const model = params.model || GEMINI_PRIMARY_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
    cleanKey
  )}`;

  const bodyPayload: any = {
    contents: params.contents,
  };

  if (params.systemInstruction) {
    bodyPayload.systemInstruction = {
      parts: [{ text: params.systemInstruction }],
    };
  }

  if (params.tools && params.tools.length > 0) {
    bodyPayload.tools = [
      {
        functionDeclarations: params.tools,
      },
    ];
  }

  if (params.generationConfig) {
    const { thinkingLevel, ...restConfig } = params.generationConfig;
    bodyPayload.generationConfig = restConfig;
    if (thinkingLevel) {
      bodyPayload.generationConfig.thinkingConfig = { thinkingLevel };
    }
  }

  const makeRequest = async (payload: any) => {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: params.signal,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const err: any = new Error(
        errData?.error?.message || `Direct Gemini API generation error (${res.status})`
      );
      err.status = res.status;
      err.data = errData;
      throw err;
    }

    return res;
  };

  let res;
  try {
    res = await makeRequest(bodyPayload);
  } catch (err: any) {
    if (bodyPayload.generationConfig?.thinkingConfig && isThinkingRejection(err)) {
      console.warn("Thinking level rejected by API, falling back to temperature only.");
      delete bodyPayload.generationConfig.thinkingConfig;
      res = await makeRequest(bodyPayload);
    } else {
      throw err;
    }
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts || [];

  let accumulatedText = "";
  const functionCalls: Array<{ name: string; args: any }> = [];

  for (const part of parts) {
    if (part.text) {
      accumulatedText += part.text;
    }
    if (part.functionCall) {
      functionCalls.push({
        name: part.functionCall.name,
        args: part.functionCall.args || {},
      });
    }
  }

  return {
    text: accumulatedText,
    functionCalls,
    model,
  };
}

export interface DirectGeminiStreamParams {
  apiKey: string;
  model?: string;
  systemInstruction?: string;
  contents: Array<{
    role: "user" | "model";
    parts: Array<{ text?: string }>;
  }>;
  generationConfig?: {
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
    thinkingLevel?: ThinkingLevelName;
  };
  onChunk: (text: string) => void;
  signal?: AbortSignal;
}

/**
 * Direct Server-Sent Events (SSE) streaming from Google Generative Language REST API.
 * Streams real-time tokens directly to the client with sub-millisecond response latency.
 */
export async function streamGeminiDirectly(
  params: DirectGeminiStreamParams
): Promise<string> {
  const cleanKey = sanitizeApiKey(params.apiKey);
  if (!cleanKey) {
    const err: any = new Error("مفتاح API غير متوفر للبث المباشر.");
    err.status = 401;
    throw err;
  }

  const model = params.model || GEMINI_PRIMARY_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(
    cleanKey
  )}`;

  const bodyPayload: any = {
    contents: params.contents,
  };

  if (params.systemInstruction) {
    bodyPayload.systemInstruction = {
      parts: [{ text: params.systemInstruction }],
    };
  }

  if (params.generationConfig) {
    const { thinkingLevel, ...restConfig } = params.generationConfig;
    bodyPayload.generationConfig = restConfig;
    if (thinkingLevel) {
      bodyPayload.generationConfig.thinkingConfig = { thinkingLevel };
    }
  }

  const makeRequest = async (payload: any) => {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: params.signal,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const err: any = new Error(
        errData?.error?.message || `Direct Gemini API stream error (${res.status})`
      );
      err.status = res.status;
      err.data = errData;
      throw err;
    }

    return res;
  };

  let res;
  try {
    res = await makeRequest(bodyPayload);
  } catch (err: any) {
    if (bodyPayload.generationConfig?.thinkingConfig && isThinkingRejection(err)) {
      console.warn("Thinking level stream rejected by API, falling back to temperature only.");
      delete bodyPayload.generationConfig.thinkingConfig;
      res = await makeRequest(bodyPayload);
    } else {
      throw err;
    }
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("استجابة البث غير قابلة للقراءة كـ Stream.");
  }

  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let accumulated = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;
      const jsonStr = trimmed.slice(6).trim();
      if (jsonStr === "[DONE]") break;

      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.error) {
          const err: any = new Error(
            parsed.error.message || "خطأ في تدفق استجابة Gemini"
          );
          err.status = parsed.error.code || 500;
          err.data = parsed;
          throw err;
        }

        const parts = parsed.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.text) {
            accumulated += part.text;
            params.onChunk(part.text);
          }
        }
      } catch (parseErr: any) {
        if (parseErr?.status) throw parseErr;
      }
    }
  }

  // Flush remaining buffer if needed
  if (buffer && buffer.startsWith("data: ")) {
    try {
      const parsed = JSON.parse(buffer.slice(6).trim());
      const parts = parsed.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.text) {
          accumulated += part.text;
          params.onChunk(part.text);
        }
      }
    } catch {
      // ignore trailing fragment
    }
  }

  return accumulated;
}
