import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // API routes FIRST
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Helper function to resolve API key
  function resolveApiKey(providedKey?: string): string {
    const key = (providedKey && providedKey.trim()) || process.env.GEMINI_API_KEY || "";
    return key;
  }

  const CANDIDATE_MODELS = ["gemini-2.5-flash", "gemini-3.8-flash"];

  // Key validation endpoint for Settings Page
  app.post("/api/gemini/validate-key", async (req, res) => {
    try {
      const { apiKey } = req.body;
      const keyToTest = (apiKey && apiKey.trim()) || process.env.GEMINI_API_KEY || "";

      if (!keyToTest) {
        res.status(400).json({
          valid: false,
          message: "لم يتم تقديم مفتاح للتحقق منه.",
        });
        return;
      }

      const ai = new GoogleGenAI({
        apiKey: keyToTest,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: "ping" }] }],
        config: {
          maxOutputTokens: 5,
        },
      });

      if (response.text !== undefined) {
        res.json({
          valid: true,
          message: "المفتاح صالح ومتصل بنجاح مع خوادم الذكاء الاصطناعي.",
        });
        return;
      }

      res.status(500).json({
        valid: false,
        message: "لم يُرجع النموذج رداً صالحاً.",
      });
    } catch (err: any) {
      console.warn("[Validate Key Error]:", err?.message || err);
      const status = err?.status || err?.statusCode || 500;
      let userFriendlyMsg = "تعذر التحقق من المفتاح.";

      if (status === 400 || status === 401) {
        userFriendlyMsg = "مفتاح API غير صالح أو غير صحيح (Invalid API Key).";
      } else if (status === 403) {
        userFriendlyMsg = "مفتاح API تنقصه أذونات Gemini API في Google Cloud (The caller does not have permission).";
      } else if (status === 429) {
        userFriendlyMsg = "تم بلوغ الحد الأقصى للحصة لهذا المفتاح (Quota Exceeded / Rate Limit).";
      } else if (status === 503) {
        userFriendlyMsg = "خوادم الذكاء الاصطناعي تشهد ضغطاً مؤقتاً (503 Unavailable).";
      } else if (err?.message) {
        userFriendlyMsg = err.message;
      }

      res.status(status >= 400 && status < 600 ? status : 500).json({
        valid: false,
        code: status,
        message: userFriendlyMsg,
      });
    }
  });

  // Stream route for AI Assistant
  app.post("/api/gemini/stream", async (req, res) => {
    try {
      const { contents, systemInstruction, model, apiKey } = req.body;
      const resolvedKey = resolveApiKey(apiKey);

      if (!resolvedKey) {
        res.status(401).json({
          error: {
            code: 401,
            status: "UNAUTHENTICATED",
            message: "لم يتم العثور على مفتاح Gemini API صالح على الخادم أو في الطلب.",
          },
        });
        return;
      }

      const ai = new GoogleGenAI({
        apiKey: resolvedKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const modelsToTry = Array.from(
        new Set([model || "gemini-2.5-flash", ...CANDIDATE_MODELS])
      );

      let streamStarted = false;
      let lastError: any = null;

      for (const currentModel of modelsToTry) {
        try {
          const streamResponse = await ai.models.generateContentStream({
            model: currentModel,
            contents,
            config: {
              systemInstruction: systemInstruction || undefined,
              temperature: 0.7,
              topP: 0.9,
            },
          });

          for await (const chunk of streamResponse) {
            const text = chunk.text || "";
            if (text) {
              if (!streamStarted) {
                streamStarted = true;
                res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
                res.setHeader("Cache-Control", "no-cache, no-transform");
                res.setHeader("Connection", "keep-alive");
              }
              res.write(`data: ${JSON.stringify({ text })}\n\n`);
            }
          }

          if (streamStarted) {
            res.write("data: [DONE]\n\n");
            res.end();
            return;
          }
        } catch (err: any) {
          lastError = err;
          console.warn(
            `[Server Gemini Stream Error on ${currentModel}]:`,
            err?.message || err
          );

          if (streamStarted) {
            res.write(
              `data: ${JSON.stringify({
                error: {
                  code: err?.status || 500,
                  status: err?.statusText || "STREAM_ERROR",
                  message: err?.message || "Stream interrupted",
                },
              })}\n\n`
            );
            res.end();
            return;
          }

          const isAuthError =
            err?.status === 401 ||
            err?.status === 403 ||
            (err?.message && err.message.toLowerCase().includes("permission denied")) ||
            (err?.message && err.message.toLowerCase().includes("api key not valid"));

          if (!isAuthError) {
            console.log(
              `[Server Gemini Stream] Model ${currentModel} returned ${err?.status || "error"}. Trying next candidate model...`
            );
            continue;
          }

          break;
        }
      }

      const statusCode = lastError?.status || lastError?.statusCode || 500;
      const errorMessage = lastError?.message || "Gemini streaming error";
      const errorStatus =
        lastError?.statusText ||
        (statusCode === 503
          ? "UNAVAILABLE"
          : statusCode === 403
          ? "PERMISSION_DENIED"
          : statusCode === 429
          ? "RESOURCE_EXHAUSTED"
          : "INTERNAL_ERROR");

      if (!res.headersSent) {
        res.status(statusCode).json({
          error: {
            code: statusCode,
            status: errorStatus,
            message: errorMessage,
          },
        });
      } else {
        res.write(
          `data: ${JSON.stringify({
            error: {
              code: statusCode,
              status: errorStatus,
              message: errorMessage,
            },
          })}\n\n`
        );
        res.end();
      }
    } catch (err: any) {
      console.error("[Server Gemini Stream Unexpected Error]:", err?.message || err);
      const statusCode = err?.status || err?.statusCode || 500;
      if (!res.headersSent) {
        res.status(statusCode).json({
          error: {
            code: statusCode,
            status: "INTERNAL_ERROR",
            message: err?.message || "Internal server error",
          },
        });
      } else {
        res.end();
      }
    }
  });

  // Non-streaming generate content route with model fallback
  app.post("/api/gemini/generate", async (req, res) => {
    try {
      const { contents, systemInstruction, model, apiKey } = req.body;
      const resolvedKey = resolveApiKey(apiKey);

      if (!resolvedKey) {
        res.status(401).json({
          error: {
            code: 401,
            status: "UNAUTHENTICATED",
            message: "لم يتم العثور على مفتاح Gemini API صالح على الخادم أو في الطلب.",
          },
        });
        return;
      }

      const ai = new GoogleGenAI({
        apiKey: resolvedKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const modelsToTry = Array.from(
        new Set([model || "gemini-2.5-flash", ...CANDIDATE_MODELS])
      );

      let lastError: any = null;

      for (const currentModel of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model: currentModel,
            contents,
            config: {
              systemInstruction: systemInstruction || undefined,
              temperature: 0.7,
              topP: 0.9,
            },
          });

          return res.json({ text: response.text || "", model: currentModel });
        } catch (err: any) {
          lastError = err;
          console.warn(
            `[Server Gemini Generate Error on ${currentModel}]:`,
            err?.message || err
          );

          const isAuthError =
            err?.status === 401 ||
            err?.status === 403 ||
            (err?.message && err.message.toLowerCase().includes("permission denied")) ||
            (err?.message && err.message.toLowerCase().includes("api key not valid"));

          if (!isAuthError) {
            console.log(
              `[Server Gemini Generate] Model ${currentModel} returned ${err?.status || "error"}. Trying next candidate model...`
            );
            continue;
          }

          break;
        }
      }

      const statusCode = lastError?.status || lastError?.statusCode || 500;
      res.status(statusCode).json({
        error: {
          code: statusCode,
          status:
            lastError?.statusText ||
            (statusCode === 503
              ? "UNAVAILABLE"
              : statusCode === 403
              ? "PERMISSION_DENIED"
              : statusCode === 429
              ? "RESOURCE_EXHAUSTED"
              : "INTERNAL_ERROR"),
          message: lastError?.message || "Gemini generation error",
        },
      });
    } catch (err: any) {
      console.error("[Server Gemini Generate Unexpected Error]:", err?.message || err);
      const statusCode = err?.status || err?.statusCode || 500;
      res.status(statusCode).json({
        error: {
          code: statusCode,
          status: "INTERNAL_ERROR",
          message: err?.message || "Internal server error",
        },
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
