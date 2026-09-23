import express from "express";
import path from "path";
import os from "os";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { getModelsToTry, isModelFallbackError } from "./lib/gemini-models";

// Active SSE client connections for remote keyboard
const remoteKeyboardClients = new Set<express.Response>();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // API routes FIRST
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // PWA Manifest Endpoint for Remote Keyboard
  app.get("/manifest.json", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.json({
      id: "/",
      name: "لوحة الرواية — كيبورد الكاتبة اللاسلكي",
      short_name: "لوحة الرواية",
      description: "كيبورد لاسلكي مخصص للروايات والكاتبات موصول بالتابلت",
      start_url: "/",
      display: "standalone",
      orientation: "landscape",
      background_color: "#141210",
      theme_color: "#1D1A16",
      icons: [
        {
          src: "/pwa-192x192.png",
          sizes: "192x192",
          type: "image/png"
        }
      ]
    });
  });

  // Service Worker for PWA Offline Caching
  app.get("/sw.js", (_req, res) => {
    res.setHeader("Content-Type", "application/javascript");
    res.send(`
      self.addEventListener('install', (e) => self.skipWaiting());
      self.addEventListener('activate', (e) => self.clients.claim());
      self.addEventListener('fetch', (e) => {
        if (e.request.url.includes('/api/')) return;
        e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
      });
    `);
  });

  // Remote Keyboard: Get true local network IPv4 address
  app.get(["/api/ip", "/api/remote-keyboard/ip"], (_req, res) => {
    const interfaces = os.networkInterfaces();
    const ips: string[] = [];
    let primaryIp = "";

    for (const name of Object.keys(interfaces)) {
      const iface = interfaces[name];
      if (!iface) continue;
      const lowerName = name.toLowerCase();
      if (lowerName.includes("tun") || lowerName.includes("p2p") || lowerName.includes("vnet") || lowerName.includes("docker")) {
        continue;
      }
      for (const net of iface) {
        if (net.family === "IPv4" && !net.internal) {
          if (net.address.startsWith("127.") || net.address.startsWith("169.254.")) {
            continue;
          }
          ips.push(net.address);
          if (!primaryIp || lowerName.includes("wlan") || lowerName.includes("wi-fi") || lowerName.includes("eth") || lowerName.includes("en0")) {
            primaryIp = net.address;
          }
        }
      }
    }

    const nativePort = 8080;
    res.json({
      ips,
      primaryIp: primaryIp || ips[0] || "127.0.0.1",
      port: nativePort,
      connectionUrl: `http://${primaryIp || ips[0] || "127.0.0.1"}:${nativePort}/`,
    });
  });

  // Native Lightweight Command API (/api/command)
  const handleCommandRequest = (req: express.Request, res: express.Response) => {
    const startTime = Date.now();
    const query = req.query as Record<string, string>;
    const body = (req.body || {}) as Record<string, string>;

    const action = query.action || body.action || query.type || body.type || "type";
    const char = query.char ?? body.char;
    const text = query.text ?? body.text;
    const delta = query.delta ?? body.delta;

    let payloadType: "KEY" | "TASHKEEL" | "COMMAND" | "PASTE_TEXT" = "COMMAND";
    let commandAction: any = undefined;

    if (action === "type") {
      payloadType = "KEY";
    } else if (action === "tashkeel") {
      payloadType = "TASHKEEL";
    } else if (action === "paste") {
      payloadType = "PASTE_TEXT";
    } else if (action === "backspace") {
      commandAction = "BACKSPACE";
    } else if (action === "newline") {
      commandAction = "NEWLINE";
    } else if (action === "undo") {
      commandAction = "UNDO";
    } else if (action === "redo") {
      commandAction = "REDO";
    } else if (action === "delete_word") {
      commandAction = "DELETE_WORD";
    } else if (action === "cursor_move") {
      commandAction = parseInt(delta as string) < 0 ? "NAVIGATE_LEFT" : "NAVIGATE_RIGHT";
    }

    const payload = {
      sessionPin: query.pin || body.pin || "123456",
      type: payloadType,
      char: char,
      action: commandAction,
      text: text,
      timestamp: Date.now(),
    };

    const dataString = `data: ${JSON.stringify(payload)}\n\n`;
    for (const clientRes of remoteKeyboardClients) {
      try {
        clientRes.write(dataString);
      } catch {
        remoteKeyboardClients.delete(clientRes);
      }
    }

    res.json({
      ok: true,
      action,
      latencyMs: Date.now() - startTime,
      timestamp: Date.now(),
    });
  };

  app.get("/api/command", handleCommandRequest);
  app.post("/api/command", handleCommandRequest);

  // Remote Keyboard: SSE endpoint for receiving instant keystroke events (< 5ms)
  app.get("/api/remote-keyboard/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    res.write(`data: ${JSON.stringify({ type: "INIT_LISTENING", timestamp: Date.now() })}\n\n`);

    remoteKeyboardClients.add(res);

    req.on("close", () => {
      remoteKeyboardClients.delete(res);
    });
  });

  // Remote Keyboard: POST keystroke or command from Mobile Phone
  app.post("/api/remote-keyboard/type", (req, res) => {
    const payload = req.body;
    const dataString = `data: ${JSON.stringify(payload)}\n\n`;

    for (const clientRes of remoteKeyboardClients) {
      try {
        clientRes.write(dataString);
      } catch {
        remoteKeyboardClients.delete(clientRes);
      }
    }

    res.json({ ok: true, timestamp: Date.now() });
  });

  // Remote Keyboard: WebRTC Signaling exchange endpoint
  app.post("/api/remote-keyboard/signal", (req, res) => {
    const { sessionPin, signal, sender } = req.body;
    if (!sessionPin) {
      res.status(400).json({ error: "Missing sessionPin" });
      return;
    }
    const payload = { type: "WEBRTC_SIGNAL", sessionPin, signal, sender, timestamp: Date.now() };
    const dataString = `data: ${JSON.stringify(payload)}\n\n`;

    for (const clientRes of remoteKeyboardClients) {
      try {
        clientRes.write(dataString);
      } catch {
        remoteKeyboardClients.delete(clientRes);
      }
    }

    res.json({ ok: true });
  });

  // Remote Keyboard: Health check & latency test endpoint
  app.get("/api/remote-keyboard/status", (_req, res) => {
    res.json({ status: "active", clientCount: remoteKeyboardClients.size, serverTime: Date.now() });
  });

  // Helper function to resolve API key
  function resolveApiKey(providedKey?: string): string {
    const key = (providedKey && providedKey.trim()) || process.env.GEMINI_API_KEY || "";
    return key;
  }

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
        model: "gemini-3.8-flash",
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
      const { contents, systemInstruction, model, apiKey, thinkingLevel } = req.body;
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
          timeout: 60_000,
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const modelsToTry = getModelsToTry(model);

      let streamStarted = false;
      let lastError: any = null;

      for (const currentModel of modelsToTry) {
        try {
          const config: any = {
            systemInstruction: systemInstruction || undefined,
            temperature: 0.7,
            topP: 0.9,
          };
          const resolvedThinking = (thinkingLevel === "LOW" || thinkingLevel === "MEDIUM" || thinkingLevel === "HIGH") ? thinkingLevel : "HIGH";
          config.thinkingConfig = { thinkingLevel: resolvedThinking, includeThoughts: true };

          let streamResponse;
          try {
            streamResponse = await ai.models.generateContentStream({
              model: currentModel,
              contents,
              config,
            });
          } catch (initialErr: any) {
            const msg = `${initialErr?.message || ""} ${JSON.stringify(initialErr?.data || {})}`;
            if (config.thinkingConfig && /thinking|THINKING_LEVEL|Enterprise/i.test(msg)) {
              console.warn("Thinking level stream rejected by API, falling back to temperature only.");
              delete config.thinkingConfig;
              streamResponse = await ai.models.generateContentStream({
                model: currentModel,
                contents,
                config,
              });
            } else {
              throw initialErr;
            }
          }

          for await (const chunk of streamResponse) {
            const parts = chunk.candidates?.[0]?.content?.parts || [];
            let chunkText = "";
            let chunkThought = "";
            for (const part of parts) {
              if (part.text) {
                if (part.thought) {
                  chunkThought += part.text;
                } else {
                  chunkText += part.text;
                }
              }
            }
            if (chunkText || chunkThought || parts.length > 0) {
              if (!streamStarted) {
                streamStarted = true;
                res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
                res.setHeader("Cache-Control", "no-cache, no-transform");
                res.setHeader("Connection", "keep-alive");
              }
              res.write(`data: ${JSON.stringify({ text: chunkText, thought: chunkThought, rawParts: parts })}\n\n`);
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

          if (isModelFallbackError(err)) {
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
      const { contents, systemInstruction, model, apiKey, tools, temperature, thinkingLevel, responseMimeType } = req.body;
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
          timeout: 60_000,
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const modelsToTry = getModelsToTry(model);

      let lastError: any = null;

      for (const currentModel of modelsToTry) {
        try {
          const config: any = {
            systemInstruction: systemInstruction || undefined,
            temperature: typeof temperature === "number" ? temperature : 0.7,
            topP: 0.9,
          };
          if (responseMimeType) {
            config.responseMimeType = responseMimeType;
          }
          if (thinkingLevel === "LOW" || thinkingLevel === "MEDIUM" || thinkingLevel === "HIGH") {
            config.thinkingConfig = { thinkingLevel, includeThoughts: true };
          }

          if (tools && Array.isArray(tools) && tools.length > 0) {
            config.tools = [{ functionDeclarations: tools }];
          }

          let response;
          try {
            response = await ai.models.generateContent({
              model: currentModel,
              contents,
              config,
            });
          } catch (initialErr: any) {
            const msg = `${initialErr?.message || ""} ${JSON.stringify(initialErr?.data || {})}`;
            if (config.thinkingConfig && /thinking|THINKING_LEVEL|Enterprise/i.test(msg)) {
              console.warn("Thinking level generation rejected by API, falling back to temperature only.");
              delete config.thinkingConfig;
              response = await ai.models.generateContent({
                model: currentModel,
                contents,
                config,
              });
            } else {
              throw initialErr;
            }
          }

          const rawCalls = (response as any).functionCalls;
          const functionCalls = Array.isArray(rawCalls)
            ? rawCalls.map((fc: any) => ({
                name: fc.name,
                args: fc.args || {},
              }))
            : [];

          let responseText = "";
          let responseThought = "";
          let rawParts: any[] = [];
          
          if ((response as any)?.candidates?.[0]?.content?.parts) {
            rawParts = (response as any).candidates[0].content.parts;
            const parts = rawParts;
            for (const p of parts) {
              if (typeof p.text === "string") {
                if (p.thought) {
                  responseThought += p.text;
                } else {
                  responseText += p.text;
                }
              }
            }
            responseText = responseText.trim();
            responseThought = responseThought.trim();
          } else {
            try {
              responseText = response.text || "";
            } catch {
              // ignore
            }
          }

          return res.json({
            text: responseText,
            thought: responseThought,
            rawParts,
            functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
            model: currentModel,
          });
        } catch (err: any) {
          lastError = err;
          console.warn(
            `[Server Gemini Generate Error on ${currentModel}]:`,
            err?.message || err
          );

          if (isModelFallbackError(err)) {
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
