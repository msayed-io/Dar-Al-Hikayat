var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_os = __toESM(require("os"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");

// lib/gemini-models.ts
var MODEL_LADDER = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash"
];
var GEMINI_PRIMARY_MODEL = MODEL_LADDER[0];
function isModelFallbackError(err) {
  if (err?.isTimeout) return true;
  if (err?.name === "AbortError") return false;
  const status = err?.status ?? err?.code;
  if (status === 429 || status === 404) return true;
  if (typeof status === "number" && status >= 500) return true;
  if (!status && err instanceof TypeError) return true;
  return false;
}
function getModelsToTry(requestedModel) {
  if (!requestedModel) return [...MODEL_LADDER];
  const index = MODEL_LADDER.indexOf(requestedModel);
  if (index !== -1) {
    return MODEL_LADDER.slice(index);
  }
  return [requestedModel, ...MODEL_LADDER];
}

// server.ts
var remoteKeyboardClients = /* @__PURE__ */ new Set();
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json({ limit: "10mb" }));
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.get("/api/remote-keyboard/ip", (_req, res) => {
    const interfaces = import_os.default.networkInterfaces();
    const ips = [];
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
    res.json({
      ips,
      primaryIp: primaryIp || ips[0] || "127.0.0.1",
      port: PORT
    });
  });
  app.get("/api/remote-keyboard/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    res.write(`data: ${JSON.stringify({ type: "INIT_LISTENING", timestamp: Date.now() })}

`);
    remoteKeyboardClients.add(res);
    req.on("close", () => {
      remoteKeyboardClients.delete(res);
    });
  });
  app.post("/api/remote-keyboard/type", (req, res) => {
    const payload = req.body;
    const dataString = `data: ${JSON.stringify(payload)}

`;
    for (const clientRes of remoteKeyboardClients) {
      try {
        clientRes.write(dataString);
      } catch {
        remoteKeyboardClients.delete(clientRes);
      }
    }
    res.json({ ok: true, timestamp: Date.now() });
  });
  app.post("/api/remote-keyboard/signal", (req, res) => {
    const { sessionPin, signal, sender } = req.body;
    if (!sessionPin) {
      res.status(400).json({ error: "Missing sessionPin" });
      return;
    }
    const payload = { type: "WEBRTC_SIGNAL", sessionPin, signal, sender, timestamp: Date.now() };
    const dataString = `data: ${JSON.stringify(payload)}

`;
    for (const clientRes of remoteKeyboardClients) {
      try {
        clientRes.write(dataString);
      } catch {
        remoteKeyboardClients.delete(clientRes);
      }
    }
    res.json({ ok: true });
  });
  app.get("/api/remote-keyboard/status", (_req, res) => {
    res.json({ status: "active", clientCount: remoteKeyboardClients.size, serverTime: Date.now() });
  });
  function resolveApiKey(providedKey) {
    const key = providedKey && providedKey.trim() || process.env.GEMINI_API_KEY || "";
    return key;
  }
  app.post("/api/gemini/validate-key", async (req, res) => {
    try {
      const { apiKey } = req.body;
      const keyToTest = apiKey && apiKey.trim() || process.env.GEMINI_API_KEY || "";
      if (!keyToTest) {
        res.status(400).json({
          valid: false,
          message: "\u0644\u0645 \u064A\u062A\u0645 \u062A\u0642\u062F\u064A\u0645 \u0645\u0641\u062A\u0627\u062D \u0644\u0644\u062A\u062D\u0642\u0642 \u0645\u0646\u0647."
        });
        return;
      }
      const ai = new import_genai.GoogleGenAI({
        apiKey: keyToTest,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: [{ role: "user", parts: [{ text: "ping" }] }],
        config: {
          maxOutputTokens: 5
        }
      });
      if (response.text !== void 0) {
        res.json({
          valid: true,
          message: "\u0627\u0644\u0645\u0641\u062A\u0627\u062D \u0635\u0627\u0644\u062D \u0648\u0645\u062A\u0635\u0644 \u0628\u0646\u062C\u0627\u062D \u0645\u0639 \u062E\u0648\u0627\u062F\u0645 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A."
        });
        return;
      }
      res.status(500).json({
        valid: false,
        message: "\u0644\u0645 \u064A\u064F\u0631\u062C\u0639 \u0627\u0644\u0646\u0645\u0648\u0630\u062C \u0631\u062F\u0627\u064B \u0635\u0627\u0644\u062D\u0627\u064B."
      });
    } catch (err) {
      console.warn("[Validate Key Error]:", err?.message || err);
      const status = err?.status || err?.statusCode || 500;
      let userFriendlyMsg = "\u062A\u0639\u0630\u0631 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0645\u0641\u062A\u0627\u062D.";
      if (status === 400 || status === 401) {
        userFriendlyMsg = "\u0645\u0641\u062A\u0627\u062D API \u063A\u064A\u0631 \u0635\u0627\u0644\u062D \u0623\u0648 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D (Invalid API Key).";
      } else if (status === 403) {
        userFriendlyMsg = "\u0645\u0641\u062A\u0627\u062D API \u062A\u0646\u0642\u0635\u0647 \u0623\u0630\u0648\u0646\u0627\u062A Gemini API \u0641\u064A Google Cloud (The caller does not have permission).";
      } else if (status === 429) {
        userFriendlyMsg = "\u062A\u0645 \u0628\u0644\u0648\u063A \u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0644\u0644\u062D\u0635\u0629 \u0644\u0647\u0630\u0627 \u0627\u0644\u0645\u0641\u062A\u0627\u062D (Quota Exceeded / Rate Limit).";
      } else if (status === 503) {
        userFriendlyMsg = "\u062E\u0648\u0627\u062F\u0645 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u062A\u0634\u0647\u062F \u0636\u063A\u0637\u0627\u064B \u0645\u0624\u0642\u062A\u0627\u064B (503 Unavailable).";
      } else if (err?.message) {
        userFriendlyMsg = err.message;
      }
      res.status(status >= 400 && status < 600 ? status : 500).json({
        valid: false,
        code: status,
        message: userFriendlyMsg
      });
    }
  });
  app.post("/api/gemini/stream", async (req, res) => {
    try {
      const { contents, systemInstruction, model, apiKey, thinkingLevel } = req.body;
      const resolvedKey = resolveApiKey(apiKey);
      if (!resolvedKey) {
        res.status(401).json({
          error: {
            code: 401,
            status: "UNAUTHENTICATED",
            message: "\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0645\u0641\u062A\u0627\u062D Gemini API \u0635\u0627\u0644\u062D \u0639\u0644\u0649 \u0627\u0644\u062E\u0627\u062F\u0645 \u0623\u0648 \u0641\u064A \u0627\u0644\u0637\u0644\u0628."
          }
        });
        return;
      }
      const ai = new import_genai.GoogleGenAI({
        apiKey: resolvedKey,
        httpOptions: {
          timeout: 6e4,
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
      const modelsToTry = getModelsToTry(model);
      let streamStarted = false;
      let lastError = null;
      for (const currentModel of modelsToTry) {
        try {
          const config = {
            systemInstruction: systemInstruction || void 0,
            temperature: 0.7,
            topP: 0.9
          };
          const resolvedThinking = thinkingLevel === "LOW" || thinkingLevel === "MEDIUM" || thinkingLevel === "HIGH" ? thinkingLevel : "HIGH";
          config.thinkingConfig = { thinkingLevel: resolvedThinking, includeThoughts: true };
          let streamResponse;
          try {
            streamResponse = await ai.models.generateContentStream({
              model: currentModel,
              contents,
              config
            });
          } catch (initialErr) {
            const msg = `${initialErr?.message || ""} ${JSON.stringify(initialErr?.data || {})}`;
            if (config.thinkingConfig && /thinking|THINKING_LEVEL|Enterprise/i.test(msg)) {
              console.warn("Thinking level stream rejected by API, falling back to temperature only.");
              delete config.thinkingConfig;
              streamResponse = await ai.models.generateContentStream({
                model: currentModel,
                contents,
                config
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
              res.write(`data: ${JSON.stringify({ text: chunkText, thought: chunkThought, rawParts: parts })}

`);
            }
          }
          if (streamStarted) {
            res.write("data: [DONE]\n\n");
            res.end();
            return;
          }
        } catch (err) {
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
                  message: err?.message || "Stream interrupted"
                }
              })}

`
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
      const errorStatus = lastError?.statusText || (statusCode === 503 ? "UNAVAILABLE" : statusCode === 403 ? "PERMISSION_DENIED" : statusCode === 429 ? "RESOURCE_EXHAUSTED" : "INTERNAL_ERROR");
      if (!res.headersSent) {
        res.status(statusCode).json({
          error: {
            code: statusCode,
            status: errorStatus,
            message: errorMessage
          }
        });
      } else {
        res.write(
          `data: ${JSON.stringify({
            error: {
              code: statusCode,
              status: errorStatus,
              message: errorMessage
            }
          })}

`
        );
        res.end();
      }
    } catch (err) {
      console.error("[Server Gemini Stream Unexpected Error]:", err?.message || err);
      const statusCode = err?.status || err?.statusCode || 500;
      if (!res.headersSent) {
        res.status(statusCode).json({
          error: {
            code: statusCode,
            status: "INTERNAL_ERROR",
            message: err?.message || "Internal server error"
          }
        });
      } else {
        res.end();
      }
    }
  });
  app.post("/api/gemini/generate", async (req, res) => {
    try {
      const { contents, systemInstruction, model, apiKey, tools, temperature, thinkingLevel, responseMimeType } = req.body;
      const resolvedKey = resolveApiKey(apiKey);
      if (!resolvedKey) {
        res.status(401).json({
          error: {
            code: 401,
            status: "UNAUTHENTICATED",
            message: "\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0645\u0641\u062A\u0627\u062D Gemini API \u0635\u0627\u0644\u062D \u0639\u0644\u0649 \u0627\u0644\u062E\u0627\u062F\u0645 \u0623\u0648 \u0641\u064A \u0627\u0644\u0637\u0644\u0628."
          }
        });
        return;
      }
      const ai = new import_genai.GoogleGenAI({
        apiKey: resolvedKey,
        httpOptions: {
          timeout: 6e4,
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
      const modelsToTry = getModelsToTry(model);
      let lastError = null;
      for (const currentModel of modelsToTry) {
        try {
          const config = {
            systemInstruction: systemInstruction || void 0,
            temperature: typeof temperature === "number" ? temperature : 0.7,
            topP: 0.9
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
              config
            });
          } catch (initialErr) {
            const msg = `${initialErr?.message || ""} ${JSON.stringify(initialErr?.data || {})}`;
            if (config.thinkingConfig && /thinking|THINKING_LEVEL|Enterprise/i.test(msg)) {
              console.warn("Thinking level generation rejected by API, falling back to temperature only.");
              delete config.thinkingConfig;
              response = await ai.models.generateContent({
                model: currentModel,
                contents,
                config
              });
            } else {
              throw initialErr;
            }
          }
          const rawCalls = response.functionCalls;
          const functionCalls = Array.isArray(rawCalls) ? rawCalls.map((fc) => ({
            name: fc.name,
            args: fc.args || {}
          })) : [];
          let responseText = "";
          let responseThought = "";
          let rawParts = [];
          if (response?.candidates?.[0]?.content?.parts) {
            rawParts = response.candidates[0].content.parts;
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
            }
          }
          return res.json({
            text: responseText,
            thought: responseThought,
            rawParts,
            functionCalls: functionCalls.length > 0 ? functionCalls : void 0,
            model: currentModel
          });
        } catch (err) {
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
          status: lastError?.statusText || (statusCode === 503 ? "UNAVAILABLE" : statusCode === 403 ? "PERMISSION_DENIED" : statusCode === 429 ? "RESOURCE_EXHAUSTED" : "INTERNAL_ERROR"),
          message: lastError?.message || "Gemini generation error"
        }
      });
    } catch (err) {
      console.error("[Server Gemini Generate Unexpected Error]:", err?.message || err);
      const statusCode = err?.status || err?.statusCode || 500;
      res.status(statusCode).json({
        error: {
          code: statusCode,
          status: "INTERNAL_ERROR",
          message: err?.message || "Internal server error"
        }
      });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
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
//# sourceMappingURL=server.cjs.map
