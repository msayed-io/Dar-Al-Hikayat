import { Capacitor, registerPlugin } from "@capacitor/core";

export interface UpdateInfo {
  versionCode: number;
  versionName: string;
  downloadUrl: string;
  directDownloadUrl?: string;
  sha256?: string;
  fileSizeBytes?: number;
  mandatory?: boolean;
  releaseNotes?: string[];
  publishedAt?: string;
}

export interface AppVersion {
  versionCode: number;
  versionName: string;
  packageName?: string;
}

export interface DownloadProgress {
  progress: number;
  bytesDownloaded: number;
  totalBytes: number;
}

export type UpdateCheckResult =
  | {
      hasUpdate: true;
      currentVersion: AppVersion;
      latestInfo: UpdateInfo;
      isMandatory: boolean;
    }
  | {
      hasUpdate: false;
      currentVersion: AppVersion;
      latestInfo?: UpdateInfo;
      reason?: "up_to_date" | "throttled" | "ignored";
      message?: string;
    }
  | {
      hasUpdate: false;
      error: true;
      currentVersion?: AppVersion;
      message: string;
    };

interface NativeAppUpdatePlugin {
  getAppVersionInfo(): Promise<AppVersion>;
  checkInstallPermission(): Promise<{ canInstall: boolean }>;
  openInstallPermissionSettings(): Promise<{ success: boolean }>;
  downloadUpdate(options: {
    url: string;
    sha256?: string;
    versionCode: number;
  }): Promise<{
    success: boolean;
    filePath: string;
    fileSize: number;
    sha256: string;
  }>;
  installApk(options: { filePath: string }): Promise<{ success: boolean }>;
  addListener(
    eventName: "downloadProgress",
    listenerFunc: (progress: DownloadProgress) => void
  ): Promise<{ remove: () => Promise<void> }>;
}

const NativeAppUpdate = registerPlugin<NativeAppUpdatePlugin>("AppUpdate");

const GITHUB_LATEST_JSON_URL =
  "https://github.com/msayed-io/Dar-Al-Hikayat/releases/latest/download/latest.json";

const STORAGE_KEYS = {
  LAST_CHECK_TIME: "dar_app_last_update_check_time",
  IGNORED_VERSION: "dar_app_ignored_update_version_code",
  AUTO_CHECK_ENABLED: "dar_app_auto_update_check_enabled",
};

/**
 * الحصول على بيانات الإصدار الحالي المثبت على الجهاز
 */
export async function getCurrentAppVersion(): Promise<AppVersion> {
  if (Capacitor.isNativePlatform()) {
    try {
      const info = await NativeAppUpdate.getAppVersionInfo();
      if (info && typeof info.versionCode === "number") {
        return info;
      }
    } catch (err) {
      console.warn("Could not retrieve native version info:", err);
    }
  }

  // Fallback for Web/PWA
  return {
    versionCode: 1,
    versionName: "1.0",
    packageName: "com.daralhikayat.app",
  };
}

/**
 * التحقق من وجود تحديث جديد
 */
export async function checkForUpdates(options?: {
  manual?: boolean;
  force?: boolean;
}): Promise<UpdateCheckResult> {
  const isManual = !!options?.manual;
  const isForce = !!options?.force;

  // 1. Check auto check preference & throttling for background automatic checks
  if (!isManual && !isForce) {
    const autoCheckEnabled =
      localStorage.getItem(STORAGE_KEYS.AUTO_CHECK_ENABLED) !== "false";
    if (!autoCheckEnabled) {
      return {
        hasUpdate: false,
        currentVersion: await getCurrentAppVersion(),
        reason: "throttled",
        message: "الفحص التلقائي معطّل في الإعدادات",
      };
    }

    const lastCheckStr = localStorage.getItem(STORAGE_KEYS.LAST_CHECK_TIME);
    if (lastCheckStr) {
      const lastCheckTime = parseInt(lastCheckStr, 10);
      const twelveHoursMs = 12 * 60 * 60 * 1000;
      if (Date.now() - lastCheckTime < twelveHoursMs) {
        return {
          hasUpdate: false,
          currentVersion: await getCurrentAppVersion(),
          reason: "throttled",
          message: "تم الفحص مؤخرًا",
        };
      }
    }
  }

  const currentVersion = await getCurrentAppVersion();

  try {
    let updateData: UpdateInfo | null = null;
    let fetchError: Error | null = null;

    // Read only the immutable metadata published with the latest GitHub Release.
    try {
      const response = await fetch(
        `${GITHUB_LATEST_JSON_URL}?_t=${Date.now()}`,
        {
          headers: { Accept: "application/json" },
          cache: "no-store",
        }
      );
      if (response.ok) {
        updateData = (await response.json()) as UpdateInfo;
      }
    } catch (e: any) {
      fetchError = e;
    }

    if (!updateData) {
      throw (
        fetchError ||
        new Error("تعذر قراءة بيانات ملف التحديث. يرجى التحقق من اتصال الإنترنت.")
      );
    }

    if (
      !Number.isInteger(updateData.versionCode) ||
      updateData.versionCode <= 0 ||
      typeof updateData.versionName !== "string" ||
      !/^https:\/\//i.test(updateData.downloadUrl || "") ||
      !/^[a-f0-9]{64}$/i.test(updateData.sha256 || "") ||
      !Number.isInteger(updateData.fileSizeBytes) ||
      updateData.fileSizeBytes <= 0
    ) {
      throw new Error("بيانات التحديث المنشورة غير مكتملة أو غير آمنة.");
    }

    // Record last successful check time
    localStorage.setItem(STORAGE_KEYS.LAST_CHECK_TIME, Date.now().toString());

    // Compare version codes
    const isNewer = updateData.versionCode > currentVersion.versionCode;

    if (!isNewer) {
      return {
        hasUpdate: false,
        currentVersion,
        latestInfo: updateData,
        reason: "up_to_date",
        message: "أنت تستخدم أحدث إصدار من دار الحكايات",
      };
    }

    // Check if this specific version was ignored by user (unless manual or mandatory)
    const ignoredCode = parseInt(
      localStorage.getItem(STORAGE_KEYS.IGNORED_VERSION) || "0",
      10
    );
    if (
      !isManual &&
      !isForce &&
      !updateData.mandatory &&
      ignoredCode === updateData.versionCode
    ) {
      return {
        hasUpdate: false,
        currentVersion,
        latestInfo: updateData,
        reason: "ignored",
        message: "تم تجاهل هذا الإصدار سابقاً",
      };
    }

    return {
      hasUpdate: true,
      currentVersion,
      latestInfo: updateData,
      isMandatory: !!updateData.mandatory,
    };
  } catch (err: any) {
    return {
      hasUpdate: false,
      error: true,
      currentVersion,
      message: err?.message || "تعذر التحقق من وجود تحديث جديد",
    };
  }
}

/**
 * تجاهل إصدار معين حتى لا يظهر تلقائياً مرة أخرى
 */
export function ignoreUpdateVersion(versionCode: number) {
  localStorage.setItem(STORAGE_KEYS.IGNORED_VERSION, versionCode.toString());
}

/**
 * فحص إذن تثبيت التطبيقات غير المعروفة على أندرويد
 */
export async function checkInstallPermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await NativeAppUpdate.checkInstallPermission();
      return !!res?.canInstall;
    } catch {
      return true;
    }
  }
  return true;
}

/**
 * فتح إعدادات أندرويد لمنح إذن التثبيت
 */
export async function openInstallSettings(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await NativeAppUpdate.openInstallPermissionSettings();
    } catch (err) {
      console.error("Failed to open install permission settings:", err);
    }
  }
}

/**
 * تنزيل وتثبيت التحديث مع تتبع التقدم والتحقق الأمني
 */
export async function downloadUpdate(
  updateInfo: UpdateInfo,
  onProgress?: (progress: DownloadProgress) => void
): Promise<{ success: boolean; filePath?: string }> {
  if (Capacitor.isNativePlatform()) {
    let progressHandle: { remove: () => Promise<void> } | null = null;

    if (onProgress) {
      try {
        progressHandle = await NativeAppUpdate.addListener(
          "downloadProgress",
          (p) => {
            onProgress(p);
          }
        );
      } catch (listenerErr) {
        console.warn("Could not attach downloadProgress listener:", listenerErr);
      }
    }

    try {
      // 1. Download file and verify SHA-256 on device
      const downloadResult = await NativeAppUpdate.downloadUpdate({
        url: updateInfo.downloadUrl,
        sha256: updateInfo.sha256,
        versionCode: updateInfo.versionCode,
      });

      if (!downloadResult || !downloadResult.success || !downloadResult.filePath) {
        throw new Error("فشل تنزيل ملف التحديث");
      }

      return { success: true, filePath: downloadResult.filePath };
    } finally {
      if (progressHandle) {
        progressHandle.remove().catch(() => {});
      }
    }
  } else {
    // Web Preview Simulation
    let progress = 0;
    const totalBytes = updateInfo.fileSizeBytes || 15 * 1024 * 1024;

    while (progress < 100) {
      await new Promise((resolve) => setTimeout(resolve, 80));
      progress = Math.min(100, progress + 10);
      if (onProgress) {
        onProgress({
          progress,
          bytesDownloaded: (progress / 100) * totalBytes,
          totalBytes,
        });
      }
    }

    // Web fallback trigger
    const downloadUrl = updateInfo.directDownloadUrl || updateInfo.downloadUrl;
    if (downloadUrl) {
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = "dar-al-hikayat.apk";
      a.target = "_blank";
      a.click();
    }

    return { success: true };
  }
}

export async function installDownloadedUpdate(filePath: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (!filePath) throw new Error("ملف التحديث غير موجود");
  await NativeAppUpdate.installApk({ filePath });
}

// ─── Global State & Event Dispatcher for in-app Update Prompts ───
type UpdateDialogListener = (state: {
  isOpen: boolean;
  updateInfo: UpdateInfo | null;
  currentVersion: AppVersion | null;
  isMandatory?: boolean;
}) => void;

const listeners = new Set<UpdateDialogListener>();

export function openUpdateDialog(
  updateInfo: UpdateInfo,
  currentVersion: AppVersion,
  isMandatory = false
) {
  listeners.forEach((fn) =>
    fn({
      isOpen: true,
      updateInfo,
      currentVersion,
      isMandatory,
    })
  );
}

export function closeUpdateDialog() {
  listeners.forEach((fn) =>
    fn({
      isOpen: false,
      updateInfo: null,
      currentVersion: null,
    })
  );
}

export function subscribeToUpdateDialog(listener: UpdateDialogListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
