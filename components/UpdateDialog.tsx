import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Download,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Loader2,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  ArrowDownToLine,
  X,
} from "lucide-react";
import { useApp } from "../contexts/AppContext";
import {
  type UpdateInfo,
  type AppVersion,
  type DownloadProgress,
  subscribeToUpdateDialog,
  closeUpdateDialog,
  downloadUpdate,
  installDownloadedUpdate,
  ignoreUpdateVersion,
  checkInstallPermission,
  openInstallSettings,
} from "../lib/app-updater";
import { Capacitor } from "@capacitor/core";

export const UpdateDialog: React.FC = () => {
  const { currentTheme } = useApp();

  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    updateInfo: UpdateInfo | null;
    currentVersion: AppVersion | null;
    isMandatory?: boolean;
  }>({
    isOpen: false,
    updateInfo: null,
    currentVersion: null,
    isMandatory: false,
  });

  const [step, setStep] = useState<
    "prompt" | "downloading" | "verifying" | "ready_to_install" | "permission_required" | "error"
  >("prompt");

  const [progress, setProgress] = useState<DownloadProgress>({
    progress: 0,
    bytesDownloaded: 0,
    totalBytes: 0,
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadedFilePath, setDownloadedFilePath] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToUpdateDialog((state) => {
      setDialogState(state);
      if (state.isOpen) {
        setStep("prompt");
        setProgress({ progress: 0, bytesDownloaded: 0, totalBytes: 0 });
        setErrorMessage(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleStartUpdate = async () => {
    if (!dialogState.updateInfo) return;

    if (step === "ready_to_install" && downloadedFilePath) {
      try {
        await installDownloadedUpdate(downloadedFilePath);
      } catch (err: any) {
        setErrorMessage(err?.message || "تعذر فتح شاشة تثبيت التحديث.");
        setStep("error");
      }
      return;
    }

    // Check Android unknown sources permission first if native
    if (Capacitor.isNativePlatform()) {
      const hasPermission = await checkInstallPermission();
      if (!hasPermission) {
        setStep("permission_required");
        return;
      }
    }

    setStep("downloading");
    setErrorMessage(null);
    setProgress({ progress: 0, bytesDownloaded: 0, totalBytes: 0 });

    try {
      const result = await downloadUpdate(
        dialogState.updateInfo,
        (p) => {
          setProgress(p);
          if (p.progress >= 99) {
            setStep("verifying");
          }
        }
      );

      if (result.success) {
        setDownloadedFilePath(result.filePath || null);
        setStep("ready_to_install");
      }
    } catch (err: any) {
      console.error("Update process failed:", err);
      setErrorMessage(
        err?.message || "حدث خطأ غير متوقع أثناء تنزيل التحديث. يرجى إعادة المحاولة."
      );
      setStep("error");
    }
  };

  const handleGrantPermission = async () => {
    await openInstallSettings();
    // After user returns from settings, resume download
    setStep("prompt");
  };

  const handleIgnore = () => {
    if (dialogState.updateInfo) {
      ignoreUpdateVersion(dialogState.updateInfo.versionCode);
    }
    closeUpdateDialog();
  };

  const formatMB = (bytes: number) => {
    if (!bytes || bytes <= 0) return "";
    return (bytes / (1024 * 1024)).toFixed(1) + " ميجابايت";
  };

  if (!dialogState.isOpen || !dialogState.updateInfo) {
    return null;
  }

  const { updateInfo, currentVersion, isMandatory } = dialogState;

  return createPortal(
    (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[2147483000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
        dir="rtl"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", stiffness: 260, damping: 25 }}
          className="relative w-full max-w-sm border shadow-2xl overflow-hidden rounded-[28px] p-6 flex flex-col items-center text-center"
          style={{
            backgroundColor: currentTheme.bg,
            borderColor: currentTheme.border,
            boxShadow: `0 24px 48px -12px ${currentTheme.shadow || "rgba(0,0,0,0.35)"}`,
          }}
        >
          {/* Close button for non-mandatory updates */}
          {!isMandatory && step === "prompt" && (
            <button
              onClick={handleIgnore}
              className="absolute top-4 left-4 w-8 h-8 rounded-full border flex items-center justify-center opacity-60 hover:opacity-100 transition-all cursor-pointer active:scale-90"
              style={{
                backgroundColor: `${currentTheme.bg}80`,
                borderColor: currentTheme.border,
                color: currentTheme.text,
              }}
              title="إغلاق"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* ─── STEP 1: Prompt & Release Notes ─── */}
          {step === "prompt" && (
            <div className="w-full flex flex-col items-center">
              {/* Badge Icon */}
              <div
                className="w-16 h-16 rounded-3xl border flex items-center justify-center mb-4 shadow-md transition-all"
                style={{
                  backgroundColor: `${currentTheme.accent}18`,
                  borderColor: `${currentTheme.accent}35`,
                }}
              >
                <Sparkles
                  className="w-8 h-8 animate-pulse"
                  style={{ color: currentTheme.accent }}
                  strokeWidth={2.2}
                />
              </div>

              {/* Title & Version */}
              <h2
                className="text-xl font-zain-xbold mb-1.5 leading-snug"
                style={{ color: currentTheme.text }}
              >
                يوجد تحديث جديد لدار الحكايات
              </h2>

              <div className="flex items-center gap-2 mb-4">
                <span
                  className="px-3 py-0.5 rounded-full text-xs font-zain-bold border"
                  style={{
                    backgroundColor: `${currentTheme.accent}15`,
                    borderColor: `${currentTheme.accent}30`,
                    color: currentTheme.accent,
                  }}
                >
                  الإصدار الجديد: {updateInfo.versionName}
                </span>

                {currentVersion && (
                  <span
                    className="text-[11px] font-zain-reg opacity-60"
                    style={{ color: currentTheme.text }}
                  >
                    (الحالي: {currentVersion.versionName})
                  </span>
                )}
              </div>

              {/* Release Notes Card */}
              {updateInfo.releaseNotes && updateInfo.releaseNotes.length > 0 && (
                <div
                  className="w-full text-right p-3.5 rounded-2xl border mb-5 max-h-48 overflow-y-auto"
                  style={{
                    backgroundColor: `${currentTheme.glass}`,
                    borderColor: currentTheme.border,
                  }}
                >
                  <p
                    className="text-xs font-zain-bold mb-2 flex items-center gap-1.5"
                    style={{ color: currentTheme.accent }}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>أبرز التحسينات والمستجدات:</span>
                  </p>
                  <ul className="space-y-1.5 pr-2">
                    {updateInfo.releaseNotes.map((note, index) => (
                      <li
                        key={index}
                        className="text-xs font-zain-reg opacity-85 leading-relaxed flex items-start gap-1.5"
                        style={{ color: currentTheme.text }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                          style={{ backgroundColor: currentTheme.accent }}
                        />
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Security guarantee note */}
              <div
                className="flex items-center justify-center gap-1.5 text-[11px] font-zain-reg opacity-65 mb-5"
                style={{ color: currentTheme.text }}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>نسخة رسمية وموقعة • تبقى كافة رواياتك وبياناتك آمنة</span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-center gap-3 w-full">
                <button
                  onClick={handleStartUpdate}
                  className="flex-1 h-11 rounded-full font-zain-bold text-sm text-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  style={{
                    backgroundColor: currentTheme.accent,
                    boxShadow: `0 8px 20px -4px ${currentTheme.accent}40`,
                  }}
                >
                  <Download className="w-4 h-4" />
                  <span>تحديث الآن</span>
                </button>

                {!isMandatory && (
                  <button
                    onClick={handleIgnore}
                    className="h-11 px-5 rounded-full font-zain-bold text-xs border active:scale-95 transition-all opacity-70 hover:opacity-100 cursor-pointer flex items-center justify-center"
                    style={{
                      backgroundColor: `${currentTheme.bg}90`,
                      borderColor: currentTheme.border,
                      color: currentTheme.text,
                    }}
                  >
                    لاحقًا
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ─── STEP 2: Downloading Progress ─── */}
          {step === "downloading" && (
            <div className="w-full flex flex-col items-center py-2">
              <div
                className="w-16 h-16 rounded-3xl border flex items-center justify-center mb-4 relative"
                style={{
                  backgroundColor: `${currentTheme.accent}15`,
                  borderColor: `${currentTheme.accent}30`,
                }}
              >
                <ArrowDownToLine
                  className="w-8 h-8 animate-bounce"
                  style={{ color: currentTheme.accent }}
                  strokeWidth={2.2}
                />
              </div>

              <h2
                className="text-lg font-zain-xbold mb-1 leading-snug"
                style={{ color: currentTheme.text }}
              >
                جاري تنزيل التحديث...
              </h2>

              <p
                className="text-xs font-zain-reg opacity-70 mb-4 leading-normal"
                style={{ color: currentTheme.text }}
              >
                يرجى الانتظار بينما يتم تنزيل حزمة التحديث الرسمية
              </p>

              {/* Percentage & Sizes */}
              <div className="w-full flex items-center justify-between text-xs font-zain-bold mb-1.5 px-1">
                <span style={{ color: currentTheme.accent }}>
                  {progress.progress}%
                </span>
                {progress.totalBytes > 0 && (
                  <span
                    className="font-mono text-[11px] opacity-60"
                    dir="ltr"
                    style={{ color: currentTheme.text }}
                  >
                    {formatMB(progress.bytesDownloaded)} / {formatMB(progress.totalBytes)}
                  </span>
                )}
              </div>

              {/* Progress Track */}
              <div
                className="w-full h-3 rounded-full border overflow-hidden p-0.5 mb-6"
                style={{
                  backgroundColor: `${currentTheme.border}40`,
                  borderColor: currentTheme.border,
                }}
              >
                <motion.div
                  className="h-full rounded-full transition-all duration-200"
                  style={{
                    width: `${Math.max(5, progress.progress)}%`,
                    backgroundColor: currentTheme.accent,
                  }}
                />
              </div>

              {/* Cancel Button */}
              {!isMandatory && (
                <button
                  onClick={closeUpdateDialog}
                  className="h-9 px-6 rounded-full text-xs font-zain-bold border opacity-60 hover:opacity-100 transition-all cursor-pointer active:scale-95"
                  style={{
                    backgroundColor: `${currentTheme.bg}90`,
                    borderColor: currentTheme.border,
                    color: currentTheme.text,
                  }}
                >
                  إلغاء التنزيل
                </button>
              )}
            </div>
          )}

          {/* ─── STEP 3: Verifying SHA-256 Checksum ─── */}
          {step === "verifying" && (
            <div className="w-full flex flex-col items-center py-4">
              <Loader2
                className="w-12 h-12 animate-spin mb-4"
                style={{ color: currentTheme.accent }}
              />
              <h2
                className="text-base font-zain-xbold mb-1.5 leading-snug"
                style={{ color: currentTheme.text }}
              >
                التحقق الأمني من سلامة الحزمة...
              </h2>
              <p
                className="text-xs font-zain-reg opacity-70 leading-relaxed text-center px-4"
                style={{ color: currentTheme.text }}
              >
                فحص البصمة الرقمية (SHA-256) للتأكد من سلامة الملف ومطابقته للأصل
              </p>
            </div>
          )}

          {/* ─── STEP 4: Ready To Install ─── */}
          {step === "ready_to_install" && (
            <div className="w-full flex flex-col items-center py-2">
              <div
                className="w-16 h-16 rounded-3xl border flex items-center justify-center mb-4"
                style={{
                  backgroundColor: "rgba(16, 185, 129, 0.15)",
                  borderColor: "rgba(16, 185, 129, 0.35)",
                }}
              >
                <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>

              <h2
                className="text-lg font-zain-xbold mb-1.5 leading-snug"
                style={{ color: currentTheme.text }}
              >
                اكتمل تنزيل التحديث بنجاح!
              </h2>

              <p
                className="text-xs font-zain-reg opacity-75 mb-6 leading-relaxed"
                style={{ color: currentTheme.text }}
              >
                اضغط على زر التثبيت أدناه، ثم اختر <strong>"تثبيت"</strong> في نافذة أندرويد لإتمام التحديث فورًا.
              </p>

              <button
                onClick={handleStartUpdate}
                className="w-full h-11 rounded-full font-zain-bold text-sm text-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                style={{
                  backgroundColor: currentTheme.accent,
                  boxShadow: `0 8px 20px -4px ${currentTheme.accent}40`,
                }}
              >
                <ExternalLink className="w-4 h-4" />
                <span>فتح شاشة التثبيت الآن</span>
              </button>
            </div>
          )}

          {/* ─── STEP 5: Unknown App Sources Permission Required ─── */}
          {step === "permission_required" && (
            <div className="w-full flex flex-col items-center py-2">
              <div
                className="w-16 h-16 rounded-3xl border flex items-center justify-center mb-4"
                style={{
                  backgroundColor: "rgba(245, 158, 11, 0.15)",
                  borderColor: "rgba(245, 158, 11, 0.35)",
                }}
              >
                <ShieldAlert className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              </div>

              <h2
                className="text-base font-zain-xbold mb-1.5 leading-snug"
                style={{ color: currentTheme.text }}
              >
                إذن تثبيت التحديثات
              </h2>

              <p
                className="text-xs font-zain-reg opacity-75 mb-6 leading-relaxed"
                style={{ color: currentTheme.text }}
              >
                لتثبيت التحديثات مباشرة من داخل دار الحكايات، يتطلب نظام أندرويد تفعيل خيار <strong>"السماح بتثبيت التطبيقات من هذا المصدر"</strong> لمرة واحدة فقط.
              </p>

              <div className="flex items-center justify-center gap-3 w-full">
                <button
                  onClick={handleGrantPermission}
                  className="flex-1 h-11 rounded-full font-zain-bold text-xs text-white shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  style={{ backgroundColor: currentTheme.accent }}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>تفعيل الإذن في الإعدادات</span>
                </button>

                <button
                  onClick={() => setStep("prompt")}
                  className="h-11 px-4 rounded-full font-zain-bold text-xs border opacity-70 hover:opacity-100 transition-all cursor-pointer active:scale-95"
                  style={{
                    backgroundColor: `${currentTheme.bg}90`,
                    borderColor: currentTheme.border,
                    color: currentTheme.text,
                  }}
                >
                  رجوع
                </button>
              </div>
            </div>
          )}

          {/* ─── STEP 6: Error State ─── */}
          {step === "error" && (
            <div className="w-full flex flex-col items-center py-2">
              <div
                className="w-16 h-16 rounded-3xl border flex items-center justify-center mb-4"
                style={{
                  backgroundColor: "rgba(239, 68, 68, 0.15)",
                  borderColor: "rgba(239, 68, 68, 0.35)",
                }}
              >
                <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>

              <h2
                className="text-base font-zain-xbold mb-1 leading-snug"
                style={{ color: currentTheme.text }}
              >
                تعذر إتمام التحديث
              </h2>

              <p
                className="text-xs font-zain-reg opacity-80 mb-6 leading-relaxed text-red-600 dark:text-red-400 px-2"
              >
                {errorMessage}
              </p>

              <div className="flex items-center justify-center gap-3 w-full">
                <button
                  onClick={handleStartUpdate}
                  className="flex-1 h-11 rounded-full font-zain-bold text-xs text-white shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  style={{ backgroundColor: currentTheme.accent }}
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>إعادة المحاولة</span>
                </button>

                <button
                  onClick={closeUpdateDialog}
                  className="h-11 px-5 rounded-full font-zain-bold text-xs border opacity-70 hover:opacity-100 transition-all cursor-pointer active:scale-95"
                  style={{
                    backgroundColor: `${currentTheme.bg}90`,
                    borderColor: currentTheme.border,
                    color: currentTheme.text,
                  }}
                >
                  إغلاق
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
    ),
    document.body,
  );
};
