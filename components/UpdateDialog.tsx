import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Download,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  ArrowDownToLine,
  X,
  ImageIcon,
} from "lucide-react";
import { useApp } from "../contexts/AppContext";
import { updateBannerAsset } from "../lib/logo-assets";
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
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    let element = document.getElementById("dar-update-dialog-root");
    if (!element) {
      element = document.createElement("div");
      element.id = "dar-update-dialog-root";
      element.style.position = "relative";
      element.style.zIndex = "2147483647";
      document.body.appendChild(element);
    }
    setPortalNode(element);
  }, []);

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
    return (bytes / (1024 * 1024)).toFixed(1) + " م.ب";
  };

  if (!dialogState.isOpen || !dialogState.updateInfo) {
    return null;
  }

  const { updateInfo, isMandatory } = dialogState;

  // Determining sheet surface background & primary button colors based on theme
  const isAppleDark = currentTheme.mode === "apple_dark";
  const isNightWhisper = currentTheme.mode === "night_whisper";
  const sheetBg = isAppleDark
    ? "#1C1C1E"
    : isNightWhisper
    ? "#171F21"
    : currentTheme.isDark
    ? currentTheme.glass
    : "#FFFFFF";

  const sheetBorder = isAppleDark
    ? "rgba(255, 255, 255, 0.12)"
    : isNightWhisper
    ? "rgba(226, 223, 210, 0.12)"
    : currentTheme.border;

  // Primary action button (Solid high-contrast white capsule in dark mode as shown in the reference image)
  const primaryButtonBg = isAppleDark || isNightWhisper
    ? "#FFFFFF"
    : currentTheme.accent;

  const primaryButtonTextColor = isAppleDark || isNightWhisper
    ? "#111718"
    : "#FFFFFF";

  const modalContent = (
    <AnimatePresence>
      <div
        id="dar-update-dialog-overlay"
        dir="rtl"
        className="fixed inset-0 flex items-end justify-center pointer-events-auto select-none"
        style={{
          zIndex: 2147483647,
          isolation: "isolate",
        }}
      >
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed inset-0 bg-black/65 backdrop-blur-md cursor-pointer"
          onClick={() => {
            if (!isMandatory && step === "prompt") {
              handleIgnore();
            }
          }}
        />

        {/* Bottom Sheet Card - matching the exact shape, image position & button in the reference image */}
        <motion.div
          initial={{ y: "100%", opacity: 0.9 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0.9 }}
          transition={{
            type: "spring",
            damping: 32,
            stiffness: 340,
            mass: 0.9,
          }}
          className="relative w-full max-w-[420px] border shadow-2xl z-10 flex flex-col items-center overflow-hidden"
          style={{
            borderTopLeftRadius: "36px",
            borderTopRightRadius: "36px",
            borderBottomLeftRadius: "0px",
            borderBottomRightRadius: "0px",
            backgroundColor: sheetBg,
            borderColor: sheetBorder,
            boxShadow: `0 -16px 50px -10px ${currentTheme.shadow || "rgba(0,0,0,0.5)"}`,
            padding: "14px 18px 20px 18px",
            paddingBottom: "max(env(safe-area-inset-bottom), 20px)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Drag Indicator Pill */}
          <div className="w-10 h-1.5 rounded-full mb-3 opacity-25" style={{ backgroundColor: currentTheme.text }} />

          {/* ─── الموضع المخصص للصورة (The Dedicated Image Container) ─── */}
          {/*
            المقاس الموصى به للصورة:
            - الارتفاع الثابت الصريح: 175 بكسل
            - المقاس الدقيق لتصميم الصورة: 1200 × 550 بكسل (أو 1080 × 500 بكسل)
            - مساحة العرض على الهاتف: 384 × 175 بكسل
          */}
          <div
            id="dar-update-image-slot"
            className="w-full rounded-[24px] overflow-hidden relative mb-3.5 border flex items-center justify-center transition-all select-none"
            style={{
              width: "100%",
              height: "175px",
              backgroundColor: isAppleDark
                ? "#000000"
                : isNightWhisper
                ? "#111718"
                : "#EAE6D2",
              borderColor: isAppleDark
                ? "rgba(255, 255, 255, 0.08)"
                : isNightWhisper
                ? "rgba(226, 223, 210, 0.08)"
                : "rgba(18, 26, 27, 0.08)",
            }}
          >
            {step === "prompt" && (
              <img
                src={updateBannerAsset(currentTheme.mode)}
                alt="تحديث دار الحكايات"
                loading="eager"
                decoding="sync"
                className="w-full h-full object-cover select-none pointer-events-none transition-opacity duration-200"
                style={{
                  width: "100%",
                  height: "175px",
                  objectFit: "cover",
                }}
              />
            )}

            {step === "downloading" && (
              <div className="relative z-10 flex flex-col items-center justify-center text-center p-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-2 border backdrop-blur-sm animate-pulse"
                  style={{
                    backgroundColor: `${currentTheme.accent}20`,
                    borderColor: `${currentTheme.accent}35`,
                    color: currentTheme.accent,
                  }}
                >
                  <ArrowDownToLine className="w-7 h-7 animate-bounce" strokeWidth={2} />
                </div>
                <span
                  className="text-xs font-zain-bold tracking-wider"
                  style={{ color: currentTheme.accent }}
                >
                  {progress.progress}%
                </span>
              </div>
            )}

            {step === "verifying" && (
              <div className="relative z-10 flex flex-col items-center justify-center text-center p-4">
                <Loader2
                  className="w-10 h-10 animate-spin mb-2"
                  style={{ color: currentTheme.accent }}
                  strokeWidth={2}
                />
                <span
                  className="text-xs font-zain-bold opacity-80"
                  style={{ color: currentTheme.text }}
                >
                  فحص سلامة الحزمة...
                </span>
              </div>
            )}

            {step === "ready_to_install" && (
              <div className="relative z-10 flex flex-col items-center justify-center text-center p-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mb-2 text-emerald-400">
                  <CheckCircle2 className="w-8 h-8" strokeWidth={2.2} />
                </div>
                <span className="text-xs font-zain-bold text-emerald-400">
                  الحزمة جاهزة للتثبيت
                </span>
              </div>
            )}

            {step === "permission_required" && (
              <div className="relative z-10 flex flex-col items-center justify-center text-center p-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mb-2 text-amber-400">
                  <ShieldAlert className="w-8 h-8" strokeWidth={2} />
                </div>
                <span className="text-xs font-zain-bold text-amber-400">
                  إذن التثبيت مطلوب
                </span>
              </div>
            )}

            {step === "error" && (
              <div className="relative z-10 flex flex-col items-center justify-center text-center p-4">
                <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center mb-2 text-red-400">
                  <AlertTriangle className="w-8 h-8" strokeWidth={2} />
                </div>
                <span className="text-xs font-zain-bold text-red-400">
                  تعذر إتمام التنزيل
                </span>
              </div>
            )}
          </div>

          {/* ─── الخطوة 1: شاشة العرض الأساسية (Prompt) ─── */}
          {step === "prompt" && (
            <div className="w-full flex flex-col items-center text-center">
              {/* العنوان الرئيسي بخط ثمانية الفاخر */}
              <h2
                className="text-lg sm:text-xl font-bold mb-1 leading-snug px-1"
                style={{
                  fontFamily: "'Thmanyah Serif Display', serif",
                  color: currentTheme.text,
                }}
              >
                تحديث جديد لدَار الحِكَايَات
              </h2>

              {/* شارة الإصدار الأنيقة بتنسيق متوازن ومريح يمنع التصاق الأرقام */}
              <div className="flex items-center justify-center mb-2">
                <span
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-zain-bold border leading-none"
                  style={{
                    backgroundColor: `${currentTheme.accent}14`,
                    borderColor: `${currentTheme.accent}30`,
                    color: currentTheme.accent,
                  }}
                >
                  <span>الإصدار</span>
                  <span dir="ltr" className="tracking-wide">
                    {updateInfo.versionName}
                  </span>
                </span>
              </div>

              {/* سطر الطمأنينة والأمان */}
              <p
                className="text-[11px] font-zain-reg opacity-60 mb-3.5 leading-normal"
                style={{ color: currentTheme.text }}
              >
                نسخة رسمية وموقعة • بياناتك وحكاياتك في أمان تام
              </p>

              {/* الأزرار في المنتصف: زر تثبيت أنيق ومضبوط الحجم، وزر لاحقًا رقيق بجانبه */}
              <div className="flex items-center justify-center gap-3.5 mt-1">
                <button
                  onClick={handleStartUpdate}
                  className="h-10 px-10 min-w-[185px] rounded-full font-zain-bold text-xs shadow-sm active:scale-[0.98] transition-all flex items-center justify-center cursor-pointer whitespace-nowrap"
                  style={{
                    backgroundColor: primaryButtonBg,
                    color: primaryButtonTextColor,
                    minWidth: "185px",
                    paddingLeft: "34px",
                    paddingRight: "34px",
                  }}
                >
                  <span>تثبيت التحديث</span>
                </button>

                {!isMandatory && (
                  <button
                    onClick={handleIgnore}
                    className="px-2.5 py-1.5 text-xs font-zain-bold opacity-65 hover:opacity-100 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                    style={{
                      color: currentTheme.secondary,
                    }}
                  >
                    لاحقًا
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ─── الخطوة 2: شاشة التنزيل والتقدم (Downloading) ─── */}
          {step === "downloading" && (
            <div className="w-full flex flex-col items-center text-center">
              <h2
                className="text-lg font-bold mb-1 leading-snug"
                style={{
                  fontFamily: "'Thmanyah Serif Display', serif",
                  color: currentTheme.text,
                }}
              >
                جاري تنزيل حزمة التحديث
              </h2>

              <p
                className="text-xs font-zain-reg mb-3 opacity-70 leading-relaxed"
                style={{ color: currentTheme.text }}
              >
                يرجى الانتظار حتى اكتمال نقل الملف بأمان إلى جهازك
              </p>

              {/* النسبة والحجم */}
              <div className="w-full flex items-center justify-between text-xs font-zain-bold mb-1 px-1">
                <span style={{ color: currentTheme.accent }}>
                  {progress.progress}%
                </span>
                {progress.totalBytes > 0 && (
                  <span
                    className="font-mono text-[11px] opacity-65"
                    dir="ltr"
                    style={{ color: currentTheme.text }}
                  >
                    {formatMB(progress.bytesDownloaded)} / {formatMB(progress.totalBytes)}
                  </span>
                )}
              </div>

              {/* شريط التقدم الكبسولي */}
              <div
                className="w-full h-2 rounded-full border overflow-hidden p-0.5 mb-4"
                style={{
                  backgroundColor: isAppleDark || isNightWhisper ? "rgba(255, 255, 255, 0.06)" : `${currentTheme.accent}12`,
                  borderColor: isAppleDark || isNightWhisper ? "rgba(255, 255, 255, 0.1)" : currentTheme.border,
                }}
              >
                <div
                  className="h-full rounded-full transition-all duration-200"
                  style={{
                    width: `${Math.max(6, progress.progress)}%`,
                    backgroundColor: currentTheme.accent,
                  }}
                />
              </div>

              {!isMandatory && (
                <button
                  onClick={closeUpdateDialog}
                  className="px-4 py-1.5 text-xs font-zain-bold opacity-65 hover:opacity-100 active:scale-95 transition-all cursor-pointer"
                  style={{
                    color: currentTheme.secondary,
                  }}
                >
                  إلغاء التنزيل
                </button>
              )}
            </div>
          )}

          {/* ─── الخطوة 3: التحقق الأمني (Verifying SHA-256) ─── */}
          {step === "verifying" && (
            <div className="w-full flex flex-col items-center text-center">
              <h2
                className="text-lg font-bold mb-1 leading-snug"
                style={{
                  fontFamily: "'Thmanyah Serif Display', serif",
                  color: currentTheme.text,
                }}
              >
                التحقق من أمان التحديث
              </h2>

              <p
                className="text-xs font-zain-reg opacity-75 leading-relaxed px-2 mb-2"
                style={{ color: currentTheme.text }}
              >
                جاري مطابقة البصمة الرقمية المشفرة (SHA-256) لضمان موثوقية النسخة وأمان حكاياتك...
              </p>
            </div>
          )}

          {/* ─── الخطوة 4: جاهز للتثبيت (Ready to Install) ─── */}
          {step === "ready_to_install" && (
            <div className="w-full flex flex-col items-center text-center">
              <h2
                className="text-lg font-bold mb-1 leading-snug"
                style={{
                  fontFamily: "'Thmanyah Serif Display', serif",
                  color: currentTheme.text,
                }}
              >
                اكتمل التنزيل بنجاح
              </h2>

              <p
                className="text-xs font-zain-reg mb-3.5 opacity-75 leading-relaxed px-2"
                style={{ color: currentTheme.text }}
              >
                اضغط على زر التثبيت للمتابعة وتحديث دار الحكايات فورًا.
              </p>

              <div className="flex items-center justify-center gap-3.5 mt-1">
                <button
                  onClick={handleStartUpdate}
                  className="h-10 px-10 min-w-[185px] rounded-full font-zain-bold text-xs shadow-sm active:scale-[0.98] transition-all flex items-center justify-center cursor-pointer whitespace-nowrap"
                  style={{
                    backgroundColor: primaryButtonBg,
                    color: primaryButtonTextColor,
                    minWidth: "185px",
                    paddingLeft: "34px",
                    paddingRight: "34px",
                  }}
                >
                  <span>تثبيت التحديث الآن</span>
                </button>

                {!isMandatory && (
                  <button
                    onClick={closeUpdateDialog}
                    className="px-2.5 py-1.5 text-xs font-zain-bold opacity-65 hover:opacity-100 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                    style={{
                      color: currentTheme.secondary,
                    }}
                  >
                    إلغاء
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ─── الخطوة 5: إذن التثبيت من أندرويد (Permission Required) ─── */}
          {step === "permission_required" && (
            <div className="w-full flex flex-col items-center text-center">
              <h2
                className="text-lg font-bold mb-1 leading-snug"
                style={{
                  fontFamily: "'Thmanyah Serif Display', serif",
                  color: currentTheme.text,
                }}
              >
                إذن تثبيت التحديثات
              </h2>

              <p
                className="text-xs font-zain-reg mb-3.5 opacity-75 leading-relaxed px-2"
                style={{ color: currentTheme.text }}
              >
                يتطلب نظام أندرويد تفعيل خيار <strong>"السماح بتثبيت التطبيقات من هذا المصدر"</strong> لمرة واحدة فقط.
              </p>

              <div className="flex items-center justify-center gap-3.5 mt-1">
                <button
                  onClick={handleGrantPermission}
                  className="h-10 px-10 min-w-[185px] rounded-full font-zain-bold text-xs shadow-sm active:scale-[0.98] transition-all flex items-center justify-center cursor-pointer whitespace-nowrap"
                  style={{
                    backgroundColor: primaryButtonBg,
                    color: primaryButtonTextColor,
                    minWidth: "185px",
                    paddingLeft: "34px",
                    paddingRight: "34px",
                  }}
                >
                  <span>تفعيل الإذن</span>
                </button>

                <button
                  onClick={() => setStep("prompt")}
                  className="px-2.5 py-1.5 text-xs font-zain-bold opacity-65 hover:opacity-100 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                  style={{
                    color: currentTheme.secondary,
                  }}
                >
                  رجوع
                </button>
              </div>
            </div>
          )}

          {/* ─── الخطوة 6: حالة الخطأ (Error) ─── */}
          {step === "error" && (
            <div className="w-full flex flex-col items-center text-center">
              <h2
                className="text-lg font-bold mb-1 leading-snug text-red-500"
                style={{ fontFamily: "'Thmanyah Serif Display', serif" }}
              >
                تعذر إتمام التحديث
              </h2>

              <p className="text-xs font-zain-reg mb-3.5 opacity-80 leading-relaxed px-2 text-red-400">
                {errorMessage}
              </p>

              <div className="flex items-center justify-center gap-3.5 mt-1">
                <button
                  onClick={handleStartUpdate}
                  className="h-10 px-10 min-w-[185px] rounded-full font-zain-bold text-xs shadow-sm active:scale-[0.98] transition-all flex items-center justify-center cursor-pointer whitespace-nowrap"
                  style={{
                    backgroundColor: primaryButtonBg,
                    color: primaryButtonTextColor,
                    minWidth: "185px",
                    paddingLeft: "34px",
                    paddingRight: "34px",
                  }}
                >
                  <span>إعادة المحاولة</span>
                </button>

                <button
                  onClick={closeUpdateDialog}
                  className="px-2.5 py-1.5 text-xs font-zain-bold opacity-65 hover:opacity-100 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                  style={{
                    color: currentTheme.secondary,
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
  );

  const targetNode =
    portalNode ||
    (typeof document !== "undefined"
      ? document.getElementById("dar-update-dialog-root") || document.body
      : null);

  if (targetNode) {
    return createPortal(modalContent, targetNode);
  }

  return modalContent;
};
