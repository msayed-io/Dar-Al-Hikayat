import { Preferences } from "@capacitor/preferences";

export type ApiKeyStatus = "active" | "rate_limited" | "disabled";

export interface ManagedApiKey {
  id: string;
  key: string;
  label?: string;
  status: ApiKeyStatus;
  rateLimitedAt?: number; // ms timestamp when rate limit was encountered
  disabledReason?: string;
  createdAt: number;
}

const STORAGE_KEY = "dar_alhikayat_api_keys_secure";
const STORAGE_SALT = "DarAlHikayat_RahmaMowafi_SecureKeyStorage_2026";
const CHANGE_EVENT_NAME = "dar_api_keys_changed";

/**
 * Obfuscates/encrypts the raw string before saving to local storage / Preferences.
 */
function encryptData(text: string): string {
  try {
    const charCodes: number[] = [];
    for (let i = 0; i < text.length; i++) {
      charCodes.push(text.charCodeAt(i) ^ STORAGE_SALT.charCodeAt(i % STORAGE_SALT.length));
    }
    const binary = String.fromCharCode(...charCodes);
    return btoa(unescape(encodeURIComponent(binary)));
  } catch {
    return btoa(unescape(encodeURIComponent(text)));
  }
}

/**
 * Decrypts/de-obfuscates the stored string.
 */
function decryptData(encoded: string): string {
  try {
    const binary = decodeURIComponent(escape(atob(encoded)));
    const chars: string[] = [];
    for (let i = 0; i < binary.length; i++) {
      chars.push(String.fromCharCode(binary.charCodeAt(i) ^ STORAGE_SALT.charCodeAt(i % STORAGE_SALT.length)));
    }
    return chars.join("");
  } catch {
    try {
      return decodeURIComponent(escape(atob(encoded)));
    } catch {
      return "";
    }
  }
}

/**
 * In-memory cache for synchronous, zero-latency access during API streaming.
 */
let inMemoryKeys: ManagedApiKey[] | null = null;

function notifyKeyChangeListeners(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT_NAME));
  }
}

/**
 * Loads keys synchronously from memory or localStorage.
 */
export function getManagedKeys(): ManagedApiKey[] {
  if (inMemoryKeys !== null) {
    return inMemoryKeys;
  }

  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const decrypted = decryptData(stored);
        if (decrypted) {
          const parsed = JSON.parse(decrypted);
          if (Array.isArray(parsed)) {
            inMemoryKeys = parsed;
            return parsed;
          }
        }
      }
    } catch (e) {
      console.warn("Error reading keys from localStorage:", e);
    }
  }

  // If no stored keys exist, check if an initial environment key is present
  const envKey =
    typeof process !== "undefined" && process.env
      ? process.env.GEMINI_API_KEY || process.env.API_KEY || ""
      : "";

  if (envKey && envKey.trim()) {
    const initialKey: ManagedApiKey = {
      id: "key_initial_env",
      key: envKey.trim(),
      label: "المفتاح الأساسي",
      status: "active",
      createdAt: Date.now(),
    };
    inMemoryKeys = [initialKey];
    persistKeys(inMemoryKeys);
    return inMemoryKeys;
  }

  inMemoryKeys = [];
  return inMemoryKeys;
}

/**
 * Loads keys asynchronously from Capacitor Preferences (backed by Android SharedPreferences)
 * and keeps localStorage and memory in sync.
 */
export async function loadManagedKeysAsync(): Promise<ManagedApiKey[]> {
  try {
    const result = await Preferences.get({ key: STORAGE_KEY });
    if (result.value) {
      const decrypted = decryptData(result.value);
      if (decrypted) {
        const parsed = JSON.parse(decrypted);
        if (Array.isArray(parsed)) {
          inMemoryKeys = parsed;
          if (typeof window !== "undefined") {
            localStorage.setItem(STORAGE_KEY, result.value);
          }
          return inMemoryKeys;
        }
      }
    }
  } catch (err) {
    console.warn("Capacitor Preferences load error, falling back to local:", err);
  }

  return getManagedKeys();
}

/**
 * Persists keys securely to both in-memory cache, localStorage, and Capacitor Preferences.
 */
async function persistKeys(keys: ManagedApiKey[]): Promise<void> {
  inMemoryKeys = [...keys];
  const serialized = JSON.stringify(keys);
  const encrypted = encryptData(serialized);

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, encrypted);
    } catch (e) {
      console.warn("Failed to write keys to localStorage:", e);
    }
  }

  try {
    await Preferences.set({
      key: STORAGE_KEY,
      value: encrypted,
    });
  } catch (e) {
    console.warn("Failed to write keys to Capacitor Preferences:", e);
  }

  notifyKeyChangeListeners();
}

/**
 * Adds a new API key to the repository.
 */
export async function addManagedKey(
  rawKey: string,
  label?: string
): Promise<ManagedApiKey> {
  const trimmed = rawKey.trim().replace(/^["']|["']$/g, "").trim();
  if (!trimmed) {
    throw new Error("قيمة المفتاح لا يمكن أن تكون فارغة");
  }

  const existing = await loadManagedKeysAsync();

  // Prevent duplicate exact keys
  const alreadyExists = existing.find((k) => k.key === trimmed);
  if (alreadyExists) {
    throw new Error("هذا المفتاح مضاف بالفعل في القائمة");
  }

  const newKeyItem: ManagedApiKey = {
    id: `key_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    key: trimmed,
    label: label?.trim() || undefined,
    status: "active",
    createdAt: Date.now(),
  };

  const updated = [...existing, newKeyItem];
  await persistKeys(updated);
  return newKeyItem;
}

/**
 * Validates whether an API key connects and functions successfully with the Gemini API.
 */
export async function testKeyConnection(
  apiKey: string
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch("/api/gemini/validate-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.valid === false) {
      return {
        success: false,
        message: data?.message || `تعذر الاتصال بالمفتاح (رمز: ${res.status})`,
      };
    }

    return {
      success: true,
      message: data?.message || "المفتاح متصل ويعمل بنجاح.",
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "تعذر الاتصال بالخادم لفحص المفتاح.",
    };
  }
}

/**
 * Updates partial properties of a key (e.g. status, rateLimitedAt, label).
 */
export async function updateManagedKey(
  id: string,
  updates: Partial<Omit<ManagedApiKey, "id" | "key" | "createdAt">>
): Promise<void> {
  const existing = await loadManagedKeysAsync();
  const index = existing.findIndex((k) => k.id === id);
  if (index === -1) return;

  existing[index] = {
    ...existing[index],
    ...updates,
  };

  await persistKeys(existing);
}

/**
 * Deletes a key permanently from the repository.
 */
export async function deleteManagedKey(id: string): Promise<void> {
  const existing = await loadManagedKeysAsync();
  const filtered = existing.filter((k) => k.id !== id);
  await persistKeys(filtered);
}

/**
 * Masks an API key for safe visual representation (shows only last 4 digits).
 */
export function maskApiKey(key: string): string {
  if (!key) return "••••";
  const trimmed = key.trim();
  if (trimmed.length <= 4) return "•••• " + trimmed;
  const last4 = trimmed.slice(-4);
  return `•••• •••• •••• ${last4}`;
}

/**
 * Subscribes to changes in API keys (e.g. when added, deleted, or rotated).
 */
export function subscribeToKeyChanges(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const handler = () => listener();
  window.addEventListener(CHANGE_EVENT_NAME, handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT_NAME, handler);
  };
}
