import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, Radio, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useApp } from "../contexts/AppContext";
import { StorageService } from "../lib/storage-service";
import {
  generateTransferPin,
  prepareWirelessExport,
  encodeTransferQrData,
  subscribeToTransferEvents,
  triggerHaptic,
  TransferPayloadMeta,
} from "../lib/wireless-transfer-service";

export const WirelessExportPage: React.FC = () => {
  const { currentTheme, closeWirelessExport, notes } = useApp();
  const [status, setStatus] = useState<"preparing" | "ready" | "transferring" | "completed" | "error">("preparing");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [qrString, setQrString] = useState<string>("");
  const [storiesCount, setStoriesCount] = useState<number>(notes.length);
  const [metaInfo, setMetaInfo] = useState<TransferPayloadMeta | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Load full stories and prepare session
  useEffect(() => {
    let isCancelled = false;

    async function initExport() {
      try {
        setStatus("preparing");
        const blob = await StorageService.exportFullBackupBlob();
        const text = await blob.text();
        const allStories = JSON.parse(text);

        if (isCancelled) return;

        if (!Array.isArray(allStories) || allStories.length === 0) {
          setStatus("error");
          setErrorMessage("لا توجد حكايات محفوظة في الدار لبثها حالياً.");
          return;
        }

        setStoriesCount(allStories.length);

        const pin = generateTransferPin();
        const meta = await prepareWirelessExport(allStories, pin);

        if (isCancelled) return;

        setMetaInfo(meta);
        const encoded = encodeTransferQrData(meta);
        setQrString(encoded);
        setStatus("ready");

        // Listen for receiver connection & completion
        unsubscribeRef.current = subscribeToTransferEvents(pin, (newStatus) => {
          if (newStatus === "transferring") {
            setStatus("transferring");
            triggerHaptic("scan");
          } else if (newStatus === "completed") {
            setStatus("completed");
            triggerHaptic("success");
            // Auto close after 2 seconds
            setTimeout(() => {
              closeWirelessExport();
            }, 2000);
          }
        });
      } catch (err: any) {
        if (!isCancelled) {
          console.error("Export preparation error:", err);
          setStatus("error");
          setErrorMessage(err?.message || "تعذر تجهيز جلسة البث اللاسلكي.");
        }
      }
    }

    initExport();

    return () => {
      isCancelled = true;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [closeWirelessExport]);

  return (
    <div
      className="min-h-screen relative font-sans transition-colors duration-500 flex flex-col no-scrollbar select-none"
      dir="rtl"
      style={{
        backgroundColor: currentTheme.bg,
        color: currentTheme.text,
      }}
    >
      {/* ── Fixed Floating Top Bar (Matching Dar Al-Hikayat Exact Capsule Architecture) ── */}
      <header className="fixed top-0 left-0 right-0 z-40 p-4 pointer-events-none">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          {/* Right Capsule: Page Identity */}
          <div
            className="pointer-events-auto h-11 px-5 border-[0.5px] flex items-center gap-2.5 backdrop-blur-xl transition-all duration-300"
            style={{
              backgroundColor: currentTheme.mode === "apple_dark" ? "#1C1C1E" : currentTheme.glass,
              borderColor: currentTheme.mode === "apple_dark" ? "rgba(255, 255, 255, 0.08)" : currentTheme.border,
              boxShadow:
                currentTheme.mode === "apple_dark"
                  ? "0 4px 30px rgba(0, 0, 0, 0.4), 0 1px 3px rgba(0, 0, 0, 0.6)"
                  : currentTheme.shadow,
              borderRadius: "9999px",
            }}
          >
            <Radio
              className="w-4 h-4 animate-pulse"
              style={{ color: currentTheme.accent }}
              strokeWidth={2.4}
            />
            <h1
              className="font-zain-xbold text-base md:text-lg leading-none pt-0.5"
              style={{ color: currentTheme.text }}
            >
              بث الحكايات
            </h1>
          </div>

          {/* Left Capsule: Exit Button */}
          <div className="pointer-events-auto flex-shrink-0">
            <button
              onClick={closeWirelessExport}
              className="border-[0.5px] flex items-center justify-center backdrop-blur-xl transition-all duration-300 hover:scale-105 active:scale-95 group flex-shrink-0 aspect-square cursor-pointer"
              style={{
                width: "44px",
                height: "44px",
                minWidth: "44px",
                minHeight: "44px",
                backgroundColor: currentTheme.mode === "apple_dark" ? "#1C1C1E" : currentTheme.glass,
                borderColor: currentTheme.mode === "apple_dark" ? "rgba(255, 255, 255, 0.08)" : currentTheme.border,
                boxShadow:
                  currentTheme.mode === "apple_dark"
                    ? "0 4px 30px rgba(0, 0, 0, 0.4), 0 1px 3px rgba(0, 0, 0, 0.6)"
                    : currentTheme.shadow,
                borderRadius: "50%",
              }}
              title="إغلاق"
              aria-label="إغلاق"
            >
              <ChevronRight
                className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5"
                style={{ color: currentTheme.accent }}
                strokeWidth={2.5}
              />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Viewport Content ── */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pt-24 pb-12 z-10 w-full max-w-md mx-auto text-center">
        <AnimatePresence mode="wait">
          {/* 1. Preparing State */}
          {status === "preparing" && (
            <motion.div
              key="preparing-state"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center gap-4"
            >
              <div
                className="w-16 h-16 rounded-full border flex items-center justify-center shadow-lg"
                style={{
                  backgroundColor: `${currentTheme.accent}12`,
                  borderColor: `${currentTheme.accent}30`,
                }}
              >
                <Loader2
                  className="w-8 h-8 animate-spin"
                  style={{ color: currentTheme.accent }}
                  strokeWidth={2.2}
                />
              </div>
              <div className="space-y-1">
                <h2 className="font-zain-bold text-lg" style={{ color: currentTheme.text }}>
                  جاري تجهيز الحكايات للبث...
                </h2>
                <p className="font-zain-reg text-xs opacity-60" style={{ color: currentTheme.text }}>
                  إعداد قناة النقل اللاسلكية الآمنة
                </p>
              </div>
            </motion.div>
          )}

          {/* 2. Ready State (QR Code in Center) */}
          {status === "ready" && qrString && (
            <motion.div
              key="ready-state"
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: -12 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center gap-6 w-full"
            >
              {/* Narrative Title & Description */}
              <div className="space-y-1.5 px-2">
                <h2
                  className="font-zain-xbold text-xl md:text-2xl leading-tight"
                  style={{ color: currentTheme.text }}
                >
                  اقتران الحكايات
                </h2>
                <p
                  className="font-zain-reg text-sm opacity-70 leading-relaxed max-w-xs mx-auto"
                  style={{ color: currentTheme.text }}
                >
                  وجّه كاميرا الجهاز الآخر نحو الرمز للبدء بالاقتران والنقل الفوري
                </p>
              </div>

              {/* QR Code Frame */}
              <div
                className="p-5 sm:p-6 rounded-[32px] border backdrop-blur-2xl transition-all duration-300 flex flex-col items-center justify-center relative group"
                style={{
                  backgroundColor: currentTheme.mode === "apple_dark" ? "#1C1C1E" : currentTheme.glass,
                  borderColor: currentTheme.mode === "apple_dark" ? "rgba(255, 255, 255, 0.12)" : currentTheme.border,
                  boxShadow:
                    currentTheme.mode === "apple_dark"
                      ? "0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)"
                      : currentTheme.shadow,
                }}
              >
                {/* White contrast box for instant camera acquisition */}
                <div className="p-4 bg-white rounded-2xl shadow-inner flex items-center justify-center">
                  <QRCodeSVG
                    value={qrString}
                    size={220}
                    level="M"
                    includeMargin={false}
                    fgColor="#121A1B"
                    bgColor="#FFFFFF"
                  />
                </div>

                {/* Subtitle Badge */}
                <div
                  className="mt-4 px-4 py-1.5 rounded-full border text-xs font-zain-bold flex items-center gap-2"
                  style={{
                    backgroundColor: `${currentTheme.accent}12`,
                    borderColor: `${currentTheme.accent}30`,
                    color: currentTheme.accent,
                  }}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{storiesCount} حكاية جاهزة للبث</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* 3. Transferring State */}
          {status === "transferring" && (
            <motion.div
              key="transferring-state"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.35 }}
              className="flex flex-col items-center gap-6 w-full max-w-xs"
            >
              <div
                className="w-20 h-20 rounded-full border flex items-center justify-center relative shadow-2xl"
                style={{
                  backgroundColor: `${currentTheme.accent}15`,
                  borderColor: `${currentTheme.accent}35`,
                }}
              >
                <Radio
                  className="w-10 h-10 animate-bounce"
                  style={{ color: currentTheme.accent }}
                  strokeWidth={2.4}
                />
              </div>

              <div className="space-y-1.5">
                <h2 className="font-zain-xbold text-xl" style={{ color: currentTheme.text }}>
                  جاري بث الحكايات...
                </h2>
                <p className="font-zain-reg text-xs opacity-70" style={{ color: currentTheme.text }}>
                  يتم نقل النصوص والتنسيقات بأمان فائق
                </p>
              </div>

              {/* Seamless Infinite Shimmering Bar */}
              <div
                className="w-full h-2 rounded-full overflow-hidden border relative"
                style={{
                  backgroundColor: `${currentTheme.accent}15`,
                  borderColor: `${currentTheme.accent}25`,
                }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: currentTheme.accent }}
                  animate={{
                    x: ["-100%", "100%"],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.5,
                    ease: "easeInOut",
                  }}
                />
              </div>
            </motion.div>
          )}

          {/* 4. Completed State */}
          {status === "completed" && (
            <motion.div
              key="completed-state"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.35 }}
              className="flex flex-col items-center gap-5"
            >
              <div
                className="w-20 h-20 rounded-full border flex items-center justify-center shadow-2xl"
                style={{
                  backgroundColor: "rgba(16, 185, 129, 0.15)",
                  borderColor: "rgba(16, 185, 129, 0.35)",
                }}
              >
                <CheckCircle2 className="w-10 h-10 text-emerald-500" strokeWidth={2.5} />
              </div>

              <div className="space-y-1.5">
                <h2 className="font-zain-xbold text-2xl text-emerald-500">
                  تم البث بنجاح ✓
                </h2>
                <p className="font-zain-reg text-sm opacity-70" style={{ color: currentTheme.text }}>
                  تم استلام الحكايات في الجهاز الآخر بالكامل
                </p>
              </div>
            </motion.div>
          )}

          {/* 5. Error State */}
          {status === "error" && (
            <motion.div
              key="error-state"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center gap-5 max-w-xs"
            >
              <div
                className="w-16 h-16 rounded-full border flex items-center justify-center"
                style={{
                  backgroundColor: "rgba(239, 68, 68, 0.12)",
                  borderColor: "rgba(239, 68, 68, 0.3)",
                }}
              >
                <AlertCircle className="w-8 h-8 text-red-500" strokeWidth={2.2} />
              </div>

              <div className="space-y-1.5">
                <h2 className="font-zain-bold text-lg text-red-400">
                  تعذر إتمام البث
                </h2>
                <p className="font-zain-reg text-xs opacity-75" style={{ color: currentTheme.text }}>
                  {errorMessage}
                </p>
              </div>

              <button
                onClick={closeWirelessExport}
                className="h-10 px-6 rounded-full border font-zain-bold text-xs transition-all active:scale-95 cursor-pointer"
                style={{
                  backgroundColor: `${currentTheme.accent}15`,
                  borderColor: `${currentTheme.accent}30`,
                  color: currentTheme.accent,
                }}
              >
                إغلاق
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default WirelessExportPage;
