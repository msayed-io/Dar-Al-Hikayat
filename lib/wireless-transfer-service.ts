/**
 * Wireless Transfer Service for Dar Al-Hikayat (دَارُ الحِكَايَاتِ)
 * Facilitates high-speed, zero-file local network transfer of stories
 * using QR code pairing + local Wi-Fi / Hotspot HTTP synchronization.
 */

import { Capacitor } from "@capacitor/core";
import { getDeviceLocalIp, NativeRemoteServer, NetworkIpResult } from "./remote-keyboard-service";

export interface TransferPayloadMeta {
  version: number;
  type: "dar_stories_transfer";
  pin: string;
  ip: string;
  port: number;
  url: string;
  count: number;
  words: number;
  timestamp: number;
}

export interface TransferSessionStatus {
  state: "idle" | "preparing" | "ready" | "connecting" | "transferring" | "completed" | "error";
  progress?: { processed: number; total: number };
  error?: string;
  count?: number;
}

const TRANSFER_CHANNEL_NAME = "dar_wireless_transfer_channel";
const TRANSFER_STORAGE_KEY = "dar_wireless_transfer_active_session";

function transferApiUrl(meta: TransferPayloadMeta, path: string): string {
  try {
    return new URL(path, meta.url).toString();
  } catch {
    return `http://${meta.ip}:${meta.port}${path}`;
  }
}

/**
 * Triggers native haptic vibration if supported on the platform
 */
export function triggerHaptic(type: "success" | "warning" | "scan" = "scan"): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      if (type === "scan") {
        navigator.vibrate([35, 45, 35]);
      } else if (type === "success") {
        navigator.vibrate([40, 60, 40, 60, 80]);
      } else {
        navigator.vibrate(80);
      }
    }
  } catch {
    // Vibration not allowed or not supported in current environment
  }
}

/**
 * Generates a clean 4-digit pairing PIN
 */
export function generateTransferPin(): string {
  const pin = Math.floor(1000 + Math.random() * 9000).toString();
  return pin;
}

/**
 * Encodes the transfer session into a lightweight string for the QR code
 */
export function encodeTransferQrData(meta: TransferPayloadMeta): string {
  return JSON.stringify({
    d: "dar",
    p: meta.pin,
    u: meta.url,
    c: meta.count,
    w: meta.words,
    t: meta.timestamp,
  });
}

/**
 * Decodes the scanned QR code payload
 */
export function decodeTransferQrData(qrText: string): TransferPayloadMeta | null {
  if (!qrText || typeof qrText !== "string") return null;

  const trimmed = qrText.trim();

  // 1. Direct URL check (e.g. http://192.168.1.5:3000/api/transfer/stories?pin=1234)
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const url = new URL(trimmed);
      const pin = url.searchParams.get("pin") || "";
      return {
        version: 1,
        type: "dar_stories_transfer",
        pin,
        ip: url.hostname,
        port: parseInt(url.port, 10) || (url.protocol === "https:" ? 443 : 80),
        url: trimmed,
        count: 0,
        words: 0,
        timestamp: Date.now(),
      };
    } catch {
      // not a standard URL, continue
    }
  }

  // 2. Compact JSON check
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed.d === "dar" || parsed.type === "dar_stories_transfer") {
      const pin = parsed.p || parsed.pin || "";
      const url = parsed.u || parsed.url || "";
      let ip = "";
      let port = 3000;

      if (url) {
        try {
          const u = new URL(url);
          ip = u.hostname;
          port = parseInt(u.port, 10) || port;
        } catch {
          // ignore
        }
      }

      return {
        version: 1,
        type: "dar_stories_transfer",
        pin,
        ip: ip || parsed.ip || "",
        port: port || parsed.port || 3000,
        url,
        count: parsed.c || parsed.count || 0,
        words: parsed.w || parsed.words || 0,
        timestamp: parsed.t || parsed.timestamp || Date.now(),
      };
    }
  } catch {
    // not JSON
  }

  return null;
}

/**
 * Prepares the stories on the local server / memory for wireless broadcast
 */
export async function prepareWirelessExport(
  stories: any[],
  pin: string
): Promise<TransferPayloadMeta> {
  const ipInfo = await getDeviceLocalIp();
  const port = ipInfo.port || 3000;
  const ip = ipInfo.primaryIp;

  // Compute total word count
  let totalWords = 0;
  for (const s of stories) {
    if (s.word_count) {
      totalWords += s.word_count;
    } else if (s.content) {
      const plain = s.content.replace(/<[^>]*>/g, " ").trim();
      totalWords += plain ? plain.split(/\s+/).length : 0;
    }
  }

  const serverOrigin = Capacitor.isNativePlatform()
    ? `http://${ip}:${port}`
    : window.location.origin;
  const endpointUrl = `${serverOrigin}/api/transfer/stories?pin=${encodeURIComponent(pin)}`;

  const meta: TransferPayloadMeta = {
    version: 1,
    type: "dar_stories_transfer",
    pin,
    ip,
    port,
    url: endpointUrl,
    count: stories.length,
    words: totalWords,
    timestamp: Date.now(),
  };

  // 1. Native Android: place the payload directly in LocalHttpServer memory.
  // The sender must not POST its complete library to its own HTTP socket.
  try {
    if (Capacitor.isNativePlatform()) {
      const result = await NativeRemoteServer.prepareTransfer({
        pin,
        storiesJson: JSON.stringify(stories),
      });
      if (result?.ok !== true) {
        throw new Error("رفض الخادم الأصلي تجهيز جلسة الحكايات.");
      }
    } else {
      const prepareUrl = transferApiUrl(meta, "/api/transfer/prepare");
      const response = await fetch(prepareUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, stories, meta }),
      });
      if (!response.ok) {
        throw new Error(`تعذر تجهيز خادم النقل (رمز الخطأ: ${response.status})`);
      }
      const result = await response.json();
      if (result?.ok !== true) {
        throw new Error(result?.message || "رفض خادم النقل تجهيز جلسة الحكايات.");
      }
    }
  } catch (e) {
    console.warn("Could not push transfer payload to the device transfer server:", e);
    const detail = e instanceof Error ? e.message : "خطأ غير معروف";
    throw new Error(`تعذر تجهيز قناة نقل الحكايات على الجهاز المرسل: ${detail}`);
  }

  // 2. Broadcast via BroadcastChannel for same-origin tabs / testing
  if (typeof BroadcastChannel !== "undefined") {
    try {
      const bc = new BroadcastChannel(TRANSFER_CHANNEL_NAME);
      bc.postMessage({
        action: "TRANSFER_PREPARED",
        pin,
        stories,
        meta,
      });
      bc.close();
    } catch {
      // ignore
    }
  }

  // 3. Save to localStorage as seamless fallback
  try {
    localStorage.setItem(
      TRANSFER_STORAGE_KEY,
      JSON.stringify({
        pin,
        stories,
        meta,
        createdAt: Date.now(),
      })
    );
  } catch {
    // ignore
  }

  return meta;
}

/**
 * Fetches the stories from the sending device given the scanned metadata
 */
export async function fetchRemoteStories(
  meta: TransferPayloadMeta,
  onProgress?: (progress: number) => void
): Promise<any[]> {
  onProgress?.(10);

  // 1. Try BroadcastChannel / localStorage first if on same device/browser tab
  try {
    const localRaw = localStorage.getItem(TRANSFER_STORAGE_KEY);
    if (localRaw) {
      const parsed = JSON.parse(localRaw);
      if (parsed?.pin === meta.pin && Array.isArray(parsed?.stories) && parsed.stories.length > 0) {
        onProgress?.(50);
        return parsed.stories;
      }
    }
  } catch {
    // continue to network fetch
  }

  // 2. Network Fetch via target URL
  const targetUrl = meta.url || `http://${meta.ip}:${meta.port}/api/transfer/stories?pin=${encodeURIComponent(meta.pin)}`;
  
  onProgress?.(30);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    clearTimeout(timeoutId);
    onProgress?.(70);

    if (!res.ok) {
      throw new Error(`تعذر جلب الحكايات من الجهاز المرسل (رمز الخطأ: ${res.status})`);
    }

    const data = await res.json();
    onProgress?.(90);

    if (Array.isArray(data)) {
      return data;
    }
    if (data && Array.isArray(data.stories)) {
      return data.stories;
    }

    throw new Error("تنسيق بيانات الحكايات المستلمة غير صالح");
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === "AbortError") {
      throw new Error("انتهت مهلة الاتصال بالجهاز المرسل. تأكد من اتصال الجهازين بنفس شبكة الـ Wi-Fi.");
    }
    throw err;
  }
}

/**
 * Notifies the sender that transfer completed successfully
 */
export async function notifyTransferCompleted(meta: TransferPayloadMeta): Promise<void> {
  // 1. Notify via BroadcastChannel
  if (typeof BroadcastChannel !== "undefined") {
    try {
      const bc = new BroadcastChannel(TRANSFER_CHANNEL_NAME);
      bc.postMessage({
        action: "TRANSFER_COMPLETED",
        pin: meta.pin,
        timestamp: Date.now(),
      });
      bc.close();
    } catch {
      // ignore
    }
  }

  // 2. Notify local server
  try {
    const response = await fetch(transferApiUrl(meta, "/api/transfer/complete"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: meta.pin }),
    });
    if (!response.ok) {
      throw new Error(`تعذر تأكيد اكتمال النقل (رمز الخطأ: ${response.status})`);
    }
    const result = await response.json();
    if (result?.ok !== true) {
      throw new Error(result?.message || "رفض خادم النقل تأكيد الإكمال.");
    }
  } catch (error) {
    console.warn("Could not confirm transfer completion:", error);
    throw error instanceof Error ? error : new Error("تعذر تأكيد اكتمال النقل.");
  }

  // 3. Trigger receiver haptic
  triggerHaptic("success");
}

/**
 * Subscribes to transfer events on the sender side
 */
export function subscribeToTransferEvents(
  meta: TransferPayloadMeta,
  onStatusChange: (status: "transferring" | "completed") => void
): () => void {
  let isCancelled = false;
  let lastStatus: "transferring" | "completed" | null = null;
  const pin = meta.pin;

  const emitStatus = (status: "transferring" | "completed") => {
    if (isCancelled || lastStatus === status) return;
    lastStatus = status;
    onStatusChange(status);
  };

  // 1. BroadcastChannel listener
  let bc: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== "undefined") {
    try {
      bc = new BroadcastChannel(TRANSFER_CHANNEL_NAME);
      bc.onmessage = (event) => {
          if (event.data?.pin === pin) {
            if (event.data.action === "TRANSFER_STARTED") {
              emitStatus("transferring");
          } else if (event.data.action === "TRANSFER_COMPLETED") {
              emitStatus("completed");
          }
        }
      };
    } catch {
      // ignore
    }
  }

  // 2. Lightweight Server Polling for status
  const intervalId = setInterval(async () => {
    if (isCancelled) return;
    try {
      const res = await fetch(
        `${transferApiUrl(meta, "/api/transfer/status")}?pin=${encodeURIComponent(pin)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.status === "transferring") {
          emitStatus("transferring");
        } else if (data.status === "completed") {
          emitStatus("completed");
        }
      }
    } catch {
      // ignore network blips
    }
  }, 1200);

  return () => {
    isCancelled = true;
    clearInterval(intervalId);
    if (bc) {
      bc.close();
    }
  };
}
