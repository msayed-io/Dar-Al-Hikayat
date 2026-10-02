import { Capacitor, registerPlugin } from "@capacitor/core";

export type RemoteTextAction =
  /** Sent when the phone (or the pairing modal) ends the session. */
  | "disconnect"
  | "NEWLINE"
  | "BACKSPACE"
  | "DELETE_WORD"
  | "UNDO"
  | "REDO"
  | "SELECT_ALL"
  | "NAVIGATE_LEFT"
  | "NAVIGATE_RIGHT"
  | "PING";

/** Mouse gestures sent by the phone's trackpad tab (🖱️) inside the keyboard. */
export type RemoteMouseAction =
  | "MOUSE_MODE"
  | "MOUSE_MOVE"
  | "MOUSE_CLICK"
  | "MOUSE_SCROLL"
  | "MOUSE_DOWN"
  | "MOUSE_UP";

export type RemoteMouseButton = "left" | "right" | "middle";

export interface RemoteKeystrokePayload {
  sessionPin: string;
  type: "KEY" | "TASHKEEL" | "COMMAND" | "PASTE_TEXT" | "MOUSE";
  char?: string;
  action?: RemoteTextAction | RemoteMouseAction;
  text?: string;
  /** Pointer movement in CSS pixels (MOUSE_MOVE only). */
  dx?: number;
  dy?: number;
  /** Wheel delta in CSS pixels (MOUSE_SCROLL only). */
  deltaY?: number;
  button?: RemoteMouseButton;
  /** 1 = single click, 2 = double click. */
  clicks?: number;
  /** MOUSE_MODE only: the phone entered/left the 🖱️ trackpad tab. */
  enabled?: boolean;
  senderId?: string;
  timestamp: number;
}

export interface NetworkIpResult {
  primaryIp: string;
  ips: string[];
  port: number;
  connectionUrl: string;
}

export interface NativeRemoteServerPlugin {
  getLocalIpAddress(): Promise<{
    primaryIp: string;
    ips: string[];
    port: number;
    connectionUrl: string;
    isNativeServerRunning?: boolean;
  }>;
  startServer(): Promise<{ running: boolean; port: number; ip: string }>;
  stopServer(): Promise<{ running: boolean }>;
  updateSession(options: { pin: string; connected: boolean }): Promise<{ ok: boolean }>;
  /** Hides the tablet's own IME (used while the wireless keyboard is paired). */
  hideKeyboard(): Promise<{ ok: boolean }>;
  addListener(
    eventName: "remoteCommand",
    listenerFunc: (data: any) => void
  ): Promise<any>;
}

// Custom event name for local tab sync (when tested in same browser)
const LOCAL_BROADCAST_CHANNEL = "dar_remote_keyboard_channel";

// Register native plugin properly via Capacitor's plugin registry
export const NativeRemoteServer = registerPlugin<NativeRemoteServerPlugin>("RemoteServer");

/**
 * Synchronize session PIN and connected state with the native LocalHttpServer
 */
export async function updateRemoteSession(pin: string, connected: boolean): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await NativeRemoteServer.updateSession({ pin, connected });
    } catch (e) {
      console.warn("Failed to update remote session on native server:", e);
    }
  }
}

/** Safe integer parse for values arriving as query-string text. */
function toInt(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toTruthy(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const text = String(value ?? "").trim().toLowerCase();
  return text === "1" || text === "true" || text === "on" || text === "yes";
}

/**
 * Maps one native `/api/command?action=...` call into the in-app payload.
 *
 * This is the single source of truth for the phone <-> tablet protocol, so the
 * wireless keyboard (keys, tashkeel, commands, mouse) is decoded in one place
 * and is fully unit-testable. Returns null for "disconnect" (handled as status)
 * and for unknown actions with no character — previously those fell through to
 * a KEY payload that focused the editor and popped the tablet keyboard.
 */
export function mapNativeCommandToPayload(
  action: string,
  data: Record<string, any>,
  sessionPin = ""
): RemoteKeystrokePayload | null {
  const char = typeof data?.char === "string" ? data.char : "";
  const text = typeof data?.text === "string" ? data.text : "";

  const base = (type: RemoteKeystrokePayload["type"]): RemoteKeystrokePayload => ({
    sessionPin,
    type,
    char,
    text,
    timestamp: Date.now(),
  });

  switch (action) {
    case "ping":
      return { ...base("COMMAND"), action: "PING" };
    case "tashkeel":
      return { ...base("TASHKEEL"), char: char || text };
    case "paste":
      return { ...base("PASTE_TEXT"), type: "PASTE_TEXT", text };
    case "backspace":
      return { ...base("COMMAND"), action: "BACKSPACE" };
    case "delete_word":
      return { ...base("COMMAND"), action: "DELETE_WORD" };
    case "newline":
      return { ...base("COMMAND"), action: "NEWLINE" };
    case "undo":
      return { ...base("COMMAND"), action: "UNDO" };
    case "redo":
      return { ...base("COMMAND"), action: "REDO" };
    case "select_all":
      return { ...base("COMMAND"), action: "SELECT_ALL" };
    case "cursor_move": {
      const delta = toInt(data?.delta, 1);
      return { ...base("COMMAND"), action: delta < 0 ? "NAVIGATE_LEFT" : "NAVIGATE_RIGHT" };
    }

    // --- Mouse / trackpad (🖱️ tab in كيبورد الحكايات) ---
    case "mouse":
      return { ...base("MOUSE"), action: "MOUSE_MOVE", dx: toInt(data?.dx), dy: toInt(data?.dy) };
    case "mouse_click": {
      const button = String(data?.button ?? "left");
      return {
        ...base("MOUSE"),
        action: "MOUSE_CLICK",
        button: button === "right" ? "right" : button === "middle" ? "middle" : "left",
        clicks: toInt(data?.count, 1) > 1 ? 2 : 1,
      };
    }
    case "mouse_scroll":
      return { ...base("MOUSE"), action: "MOUSE_SCROLL", deltaY: toInt(data?.deltaY) };
    case "mouse_down":
      return { ...base("MOUSE"), action: "MOUSE_DOWN", button: String(data?.button ?? "left") as any };
    case "mouse_up":
      return { ...base("MOUSE"), action: "MOUSE_UP", button: String(data?.button ?? "left") as any };
    case "mouse_mode":
      return { ...base("MOUSE"), action: "MOUSE_MODE", enabled: toTruthy(data?.enabled) };

    default:
      // A letter/symbol: only meaningful with a real character.
      if (!char) return null;
      return base("KEY");
  }
}

/**
 * Get the real Wi-Fi / Hotspot IPv4 address of this device
 */
export async function getDeviceLocalIp(): Promise<NetworkIpResult> {
  const nativePort = 8080;
  const currentHost = window.location.hostname || "localhost";

  // Try Android native plugin first
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await NativeRemoteServer.getLocalIpAddress();
      if (res && res.primaryIp && res.primaryIp !== "127.0.0.1") {
        const port = res.port || nativePort;
        return {
          primaryIp: res.primaryIp,
          ips: res.ips || [res.primaryIp],
          port,
          connectionUrl: `http://${res.primaryIp}:${port}/`,
        };
      }
    } catch (e) {
      console.warn("NativeRemoteServer error:", e);
    }
  }

  // Try Express / Native server IP endpoint
  try {
    const res = await fetch("/api/remote-keyboard/ip");
    if (res.ok) {
      const data = await res.json();
      if (data.primaryIp && data.primaryIp !== "127.0.0.1") {
        const port = data.port || nativePort;
        return {
          primaryIp: data.primaryIp,
          ips: data.ips || [data.primaryIp],
          port,
          connectionUrl: `http://${data.primaryIp}:${port}/`,
        };
      }
    }
  } catch (e) {
    console.warn("IP endpoint fetch error:", e);
  }

  // Fallback to current location hostname
  const resolvedIp = (currentHost !== "localhost" && currentHost !== "127.0.0.1") ? currentHost : "192.168.1.15";
  return {
    primaryIp: resolvedIp,
    ips: [resolvedIp],
    port: nativePort,
    connectionUrl: `http://${resolvedIp}:${nativePort}/`,
  };
}

/**
 * Send a keystroke or command from the Mobile Phone to the Tablet
 */
export async function sendRemoteKeystroke(payload: RemoteKeystrokePayload): Promise<{ ok: boolean; latencyMs: number }> {
  const startTime = performance.now();

  // 1. Broadcast locally for same-device / same-origin tabs (0.1ms latency)
  if (typeof BroadcastChannel !== "undefined") {
    try {
      const bc = new BroadcastChannel(LOCAL_BROADCAST_CHANNEL);
      bc.postMessage(payload);
      bc.close();
    } catch {
      // ignore
    }
  }

  // 2. Also save to localStorage briefly as zero-latency local fallback
  try {
    localStorage.setItem("dar_remote_key_event", JSON.stringify({ ...payload, _nonce: Math.random() }));
  } catch {
    // ignore
  }

  // 3. Send HTTP GET/POST to /api/command endpoint
  try {
    let actionParam = "type";
    if (payload.type === "TASHKEEL") actionParam = "tashkeel";
    else if (payload.type === "PASTE_TEXT") actionParam = "paste";
    else if (payload.action === "BACKSPACE") actionParam = "backspace";
    else if (payload.action === "NEWLINE") actionParam = "newline";
    else if (payload.action === "UNDO") actionParam = "undo";
    else if (payload.action === "REDO") actionParam = "redo";
    else if (payload.action === "DELETE_WORD") actionParam = "delete_word";
    else if (payload.action === "NAVIGATE_LEFT") actionParam = "cursor_move&delta=-1";
    else if (payload.action === "NAVIGATE_RIGHT") actionParam = "cursor_move&delta=1";
    else if (payload.action === "MOUSE_MOVE") actionParam = `mouse&dx=${Math.round(payload.dx || 0)}&dy=${Math.round(payload.dy || 0)}`;
    else if (payload.action === "MOUSE_CLICK") actionParam = `mouse_click&button=${payload.button || "left"}${payload.clicks === 2 ? "&count=2" : ""}`;
    else if (payload.action === "MOUSE_SCROLL") actionParam = `mouse_scroll&deltaY=${Math.round(payload.deltaY || 0)}`;
    else if (payload.action === "MOUSE_DOWN") actionParam = `mouse_down&button=${payload.button || "left"}`;
    else if (payload.action === "MOUSE_UP") actionParam = `mouse_up&button=${payload.button || "left"}`;
    else if (payload.action === "MOUSE_MODE") actionParam = `mouse_mode&enabled=${payload.enabled === false ? 0 : 1}`;

    let url = `/api/command?action=${actionParam}&pin=${encodeURIComponent(payload.sessionPin)}`;
    if (payload.char) url += `&char=${encodeURIComponent(payload.char)}`;
    if (payload.text) url += `&text=${encodeURIComponent(payload.text)}`;

    const response = await fetch(url);
    const elapsed = Math.round(performance.now() - startTime);
    if (response.ok) {
      return { ok: true, latencyMs: elapsed };
    }
  } catch (e) {
    // Fallback to POST /api/remote-keyboard/type
    try {
      await fetch("/api/remote-keyboard/type", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      // ignore
    }
  }

  const elapsed = Math.round(performance.now() - startTime);
  return { ok: true, latencyMs: elapsed };
}

/**
 * Listen for remote keystrokes on the Tablet
 */
export function listenForRemoteKeystrokes(
  sessionPin: string,
  onKeystroke: (payload: RemoteKeystrokePayload) => void,
  onStatusChange?: (connected: boolean, clientIp?: string) => void
): () => void {
  let isCleanedUp = false;

  // 1. Listen via BroadcastChannel (for local preview)
  let bc: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== "undefined") {
    try {
      bc = new BroadcastChannel(LOCAL_BROADCAST_CHANNEL);
      bc.onmessage = (event) => {
        if (isCleanedUp) return;
        const payload: RemoteKeystrokePayload = event.data;
        if (payload && (!sessionPin || payload.sessionPin === sessionPin)) {
          onStatusChange?.(true, "الهاتف متصل عبر المزامنة المحلية");
          onKeystroke(payload);
        }
      };
    } catch {
      // ignore
    }
  }

  // 2. Listen via localStorage event
  const handleStorageEvent = (e: StorageEvent) => {
    if (isCleanedUp) return;
    if (e.key === "dar_remote_key_event" && e.newValue) {
      try {
        const payload: RemoteKeystrokePayload = JSON.parse(e.newValue);
        if (payload && (!sessionPin || payload.sessionPin === sessionPin)) {
          onStatusChange?.(true, "الهاتف متصل عبر المتصفح المحلي");
          onKeystroke(payload);
        }
      } catch {
        // ignore
      }
    }
  };
  window.addEventListener("storage", handleStorageEvent);

  // 3. Listen via Native Android LocalHttpServer plugin if running natively
  let nativeListenerHandle: any = null;
  if (Capacitor.isNativePlatform()) {
    try {
      NativeRemoteServer.addListener("remoteCommand", (data: any) => {
        if (isCleanedUp) return;

        // Verify PIN if sessionPin is provided
        const incomingPin = data.pin || data.sessionPin;
        if (sessionPin && incomingPin && incomingPin !== sessionPin) {
          console.warn("Remote keyboard PIN mismatch:", { incomingPin, sessionPin });
          return;
        }

        onStatusChange?.(true, "الهاتف متصل بالسيرفر المباشر");

        const action = data.action || data.type || "type";

        if (action === "disconnect") {
          onStatusChange?.(false, "تم قطع الاتصال");
          return;
        }

        const payload = mapNativeCommandToPayload(action, data, sessionPin);
        if (!payload) return;

        onKeystroke(payload);
      }).then((handle: any) => {
        nativeListenerHandle = handle;
      }).catch((e: any) => {
        console.warn("NativeRemoteServer addListener error:", e);
      });
    } catch (e) {
      console.warn("Native remoteCommand listener error:", e);
    }
  }

  // 4. Listen via Server-Sent Events (SSE)
  let eventSource: EventSource | null = null;
  try {
    eventSource = new EventSource("/api/remote-keyboard/events");
    eventSource.onopen = () => {
      // SSE stream established, waiting for mobile phone connection
    };
    eventSource.onmessage = (event) => {
      if (isCleanedUp) return;
      try {
        const payload = JSON.parse(event.data);
        if (payload && (payload.type === "INIT_CONNECTED" || payload.type === "INIT_LISTENING")) {
          return;
        }
        if (payload && payload.sessionPin && payload.sessionPin === sessionPin) {
          onStatusChange?.(true);
          onKeystroke(payload as RemoteKeystrokePayload);
        }
      } catch {
        // ignore
      }
    };
    eventSource.onerror = () => {
      // EventSource reconnects automatically
    };
  } catch (e) {
    console.warn("EventSource error:", e);
  }

  return () => {
    isCleanedUp = true;
    if (bc) {
      bc.close();
    }
    window.removeEventListener("storage", handleStorageEvent);
    if (nativeListenerHandle && typeof nativeListenerHandle.remove === "function") {
      nativeListenerHandle.remove();
    }
    if (eventSource) {
      eventSource.close();
    }
  };
}
