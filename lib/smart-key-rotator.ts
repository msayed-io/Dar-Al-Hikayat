import {
  getManagedKeys,
  loadManagedKeysAsync,
  updateManagedKey,
  type ManagedApiKey,
} from "./api-key-repository";

/**
 * Default duration to keep a rate-limited key paused before auto-reactivating it.
 * Set to 24 hours to align with Gemini daily free-tier quota reset cycles.
 * Easily adjustable constant.
 */
export const RATE_LIMIT_RESET_HOURS = 24;
export const RATE_LIMIT_RESET_MS = RATE_LIMIT_RESET_HOURS * 60 * 60 * 1000;

export class AllKeysExhaustedError extends Error {
  constructor(
    message: string = "عذراً يا أستاذة رحمة، تم استنفاد الحصة المتاحة لكافة مفاتيح الاتصال المضافة حالياً. يرجى المحاولة لاحقاً بعد تجدد الحصص اليومية أو إضافة مفتاح جديد من الإعدادات."
  ) {
    super(message);
    this.name = "AllKeysExhaustedError";
  }
}

export class NoActiveKeysConfiguredError extends Error {
  constructor(
    message: string = "عذراً يا أستاذة رحمة، لم يتم العثور على أي مفتاح اتصال نشط بنموذج الذكاء الاصطناعي. يرجى إضافة مفتاح اتصال من شاشة الإعدادات."
  ) {
    super(message);
    this.name = "NoActiveKeysConfiguredError";
  }
}

/**
 * Checks whether an HTTP status code or response payload indicates quota / rate-limit exhaustion.
 */
export function isRateLimitError(
  status: number,
  bodyData?: any,
  errorMessage?: string
): boolean {
  if (status === 429 || status === 503) {
    return true;
  }

  const rawString = [
    typeof bodyData === "string" ? bodyData : JSON.stringify(bodyData || {}),
    errorMessage || "",
  ]
    .join(" ")
    .toLowerCase();

  if (
    rawString.includes("resource_exhausted") ||
    rawString.includes("quota") ||
    rawString.includes("rate_limit") ||
    rawString.includes("rate limit") ||
    rawString.includes("exhausted") ||
    rawString.includes("too many requests") ||
    rawString.includes("high demand") ||
    rawString.includes("spikes in demand") ||
    rawString.includes("unavailable") ||
    rawString.includes("service unavailable") ||
    rawString.includes("temporarily unavailable") ||
    rawString.includes("overloaded")
  ) {
    return true;
  }

  if (bodyData && typeof bodyData === "object") {
    const errObj = bodyData.error || bodyData;
    if (
      errObj.code === 429 ||
      errObj.code === 503 ||
      errObj.status === "RESOURCE_EXHAUSTED" ||
      errObj.status === "UNAVAILABLE"
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Checks whether an HTTP status code or response payload indicates an invalid / deleted / unauthenticated / unpermitted key.
 */
export function isInvalidKeyError(
  status: number,
  bodyData?: any,
  errorMessage?: string
): boolean {
  if (status === 401 || status === 403) {
    return true;
  }

  const rawString = [
    typeof bodyData === "string" ? bodyData : JSON.stringify(bodyData || {}),
    errorMessage || "",
  ]
    .join(" ")
    .toLowerCase();

  if (
    rawString.includes("api_key_invalid") ||
    rawString.includes("api key not valid") ||
    rawString.includes("unauthenticated") ||
    rawString.includes("permission_denied") ||
    rawString.includes("permission denied") ||
    rawString.includes("caller does not have permission") ||
    rawString.includes("the caller does not have permission") ||
    rawString.includes("invalid api key") ||
    rawString.includes("key expired") ||
    rawString.includes("forbidden")
  ) {
    return true;
  }

  if (bodyData && typeof bodyData === "object") {
    const errObj = bodyData.error || bodyData;
    if (
      errObj.status === "UNAUTHENTICATED" ||
      errObj.status === "PERMISSION_DENIED" ||
      errObj.code === 403 ||
      errObj.code === 401
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Checks whether an error is a general internet / network connection failure.
 */
export function isNetworkConnectionError(error: any): boolean {
  if (!error) return false;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return true;
  }
  const msg = (error.message || "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("network error") ||
    msg.includes("net::err") ||
    msg.includes("connection refused") ||
    msg.includes("abort") ||
    msg.includes("timeout")
  );
}

/**
 * Returns candidate active keys after auto-reactivating any keys whose 24-hour rate-limit duration has passed.
 */
export async function getActiveCandidates(): Promise<ManagedApiKey[]> {
  const allKeys = await loadManagedKeysAsync();
  const now = Date.now();
  const activeCandidates: ManagedApiKey[] = [];

  for (const item of allKeys) {
    // If rate-limited, check if 24 hours have elapsed for auto-reactivation
    if (item.status === "rate_limited") {
      const elapsed = item.rateLimitedAt ? now - item.rateLimitedAt : Infinity;
      if (elapsed >= RATE_LIMIT_RESET_MS) {
        // Auto-reactivate
        await updateManagedKey(item.id, {
          status: "active",
          rateLimitedAt: undefined,
        });
        activeCandidates.push({ ...item, status: "active", rateLimitedAt: undefined });
        continue;
      }
    } else if (item.status === "active") {
      activeCandidates.push(item);
    }
  }

  return activeCandidates;
}

export type KeyOperationCallback<T> = (
  apiKey: string,
  keyInfo: ManagedApiKey
) => Promise<T>;

/**
 * Executes a Gemini API operation using the Smart Key Rotator.
 * If a rate limit error is encountered, it marks the key as rate_limited and transparently
 * continues with the next active key until one succeeds or all keys are exhausted.
 */
export async function executeWithSmartRotation<T>(
  operation: KeyOperationCallback<T>
): Promise<T> {
  const candidates = await getActiveCandidates();

  // Always append a server default candidate as fallback if not already using native offline
  const serverFallbackCandidate: ManagedApiKey = {
    id: "server_default",
    key: "",
    label: "المفتاح الأساسي للخادم",
    status: "active",
    createdAt: 0,
  };

  // User-configured keys take priority; server fallback ensures zero downtime
  const candidateQueue = [...candidates, serverFallbackCandidate];

  let lastError: any = null;

  for (const candidate of candidateQueue) {
    try {
      // Attempt with candidate key
      const result = await operation(candidate.key, candidate);
      return result;
    } catch (err: any) {
      lastError = err;

      // Inspect error details
      const status = err?.status || err?.statusCode || 0;
      const responseData = err?.data || err?.responseBody;
      const message = err?.message || "";

      if (isRateLimitError(status, responseData, message)) {
        console.warn(
          `[SmartKeyRotator] Key ${candidate.label || candidate.id} hit rate limit / quota exhaustion. Rotating to next candidate.`
        );
        if (candidate.id !== "server_default") {
          await updateManagedKey(candidate.id, {
            status: "rate_limited",
            rateLimitedAt: Date.now(),
          });
        }
        // Continue silently to next candidate in loop!
        continue;
      }

      if (isInvalidKeyError(status, responseData, message)) {
        const isPermissionDenied =
          status === 403 ||
          (message && message.toLowerCase().includes("permission")) ||
          (message && message.toLowerCase().includes("caller does not have permission"));

        console.warn(
          `[SmartKeyRotator] Key ${candidate.label || candidate.id} is invalid or unauthenticated (${
            isPermissionDenied ? "The caller does not have permission" : "Invalid Key"
          }). Marking as disabled.`
        );
        if (candidate.id !== "server_default") {
          await updateManagedKey(candidate.id, {
            status: "disabled",
            disabledReason: isPermissionDenied
              ? "مفتاح غير مصرح له أو تنقصه الأذونات (The caller does not have permission)"
              : "مفتاح غير صالح أو ملغى",
          });
        }
        // Continue to next candidate
        continue;
      }

      if (isNetworkConnectionError(err)) {
        // General network error - do NOT rotate keys or disable anything
        throw err;
      }

      // If it's another non-quota error, rethrow or log
      throw err;
    }
  }

  // If we reach here and had keys that were rate-limited or exhausted
  const all = getManagedKeys();
  if (all.length > 0 && all.every((k) => k.status === "rate_limited")) {
    throw new AllKeysExhaustedError();
  }

  if (lastError) {
    throw lastError;
  }

  throw new AllKeysExhaustedError();
}

/**
 * Returns user-friendly diagnostics on current key availability.
 */
export function getKeyAvailabilityStatus(): {
  total: number;
  activeCount: number;
  rateLimitedCount: number;
  disabledCount: number;
} {
  const keys = getManagedKeys();
  return {
    total: keys.length,
    activeCount: keys.filter((k) => k.status === "active").length,
    rateLimitedCount: keys.filter((k) => k.status === "rate_limited").length,
    disabledCount: keys.filter((k) => k.status === "disabled").length,
  };
}
