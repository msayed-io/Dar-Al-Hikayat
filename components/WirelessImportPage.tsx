import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { ChevronRight, Scan, CheckCircle2, AlertCircle, Camera, RefreshCw } from "lucide-react";
import jsQR from "jsqr";
import { useApp } from "../contexts/AppContext";
import { StorageService } from "../lib/storage-service";
import {
  decodeTransferQrData,
  fetchRemoteStories,
  notifyTransferCompleted,
  triggerHaptic,
  TransferPayloadMeta,
} from "../lib/wireless-transfer-service";

interface CameraPermissionPlugin {
  requestCameraPermission(): Promise<{ granted: boolean }>;
}

const CameraPermission = registerPlugin<CameraPermissionPlugin>("CameraPermission");
const QR_SURFACE_SIZE = 252;

export const WirelessImportPage: React.FC = () => {
  const { currentTheme, closeWirelessImport, importNotesBulk, reloadNotes } = useApp();
  const [status, setStatus] = useState<"scanning" | "fetching" | "importing" | "completed" | "error">("scanning");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [importProgress, setImportProgress] = useState<{ processed: number; total: number }>({ processed: 0, total: 0 });
  const [importedFinalCount, setImportedFinalCount] = useState<number>(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isScanningActiveRef = useRef<boolean>(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const requestNativeCameraPermission = async (): Promise<void> => {
    if (Capacitor.getPlatform() !== "android") return;

    const result = await CameraPermission.requestCameraPermission();
    if (!result.granted) {
      throw new Error("تم رفض إذن الكاميرا. اسمح بالوصول إلى الكاميرا من إعدادات التطبيق ثم أعد المحاولة.");
    }
  };

  const optimizeCameraFocus = async (stream: MediaStream): Promise<void> => {
    const track = stream.getVideoTracks()[0];
    if (!track || typeof track.getCapabilities !== "function" || typeof track.applyConstraints !== "function") return;

    try {
      const capabilities = track.getCapabilities() as MediaTrackCapabilities & {
        focusMode?: string[];
      };
      if (capabilities.focusMode?.includes("continuous")) {
        await track.applyConstraints({
          advanced: [{ focusMode: "continuous" }],
        } as unknown as MediaTrackConstraints);
      }
    } catch (error) {
      // Focus controls are optional across browsers; the stream remains usable without them.
      console.debug("Continuous camera focus is not available:", error);
    }
  };

  // Stop camera tracks cleanly
  const stopCameraStream = () => {
    isScanningActiveRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  // Start video stream & scanner loop
  const startCamera = async () => {
    stopCameraStream();
    isScanningActiveRef.current = true;
    setStatus("scanning");
    setErrorMessage("");

    try {
      await requestNativeCameraPermission();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("الكاميرا غير مدعومة في هذا المتصفح أو الجهاز.");
      }

      const videoConstraints = {
        facingMode: { exact: "environment" },
        width: { ideal: 1920, max: 1920 },
        height: { ideal: 1080, max: 1080 },
        frameRate: { ideal: 30, max: 60 },
        focusMode: { ideal: "continuous" },
      } as MediaTrackConstraints;
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
      } catch (error) {
        // Some Android WebViews expose the rear lens without supporting exact facingMode.
        stream = await navigator.mediaDevices.getUserMedia({
          video: { ...videoConstraints, facingMode: { ideal: "environment" } },
        });
      }

      streamRef.current = stream;
      await optimizeCameraFocus(stream);
      setHasCameraPermission(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
        scanFrame();
      }
    } catch (err: any) {
      console.warn("Camera access error:", err);
      setHasCameraPermission(false);
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        setErrorMessage("يرجى منح إذن الوصول إلى الكاميرا لمسح رمز الـ QR.");
      } else {
        setErrorMessage(err?.message || "تعذر فتح الكاميرا للمسح.");
      }
    }
  };

  // Frame scanner loop using jsQR
  const scanFrame = () => {
    if (!isScanningActiveRef.current) return;

    const video = videoRef.current;
    if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
      const canvas = scanCanvasRef.current || document.createElement("canvas");
      scanCanvasRef.current = canvas;
      // The viewfinder is square; analyze only its center crop at a stable size.
      // This avoids processing a full 1080p frame on every animation frame and keeps
      // QR modules sharp instead of repeatedly scaling an oversized canvas.
      const sourceSize = Math.min(video.videoWidth, video.videoHeight);
      const scanSize = Math.min(720, sourceSize);
      canvas.width = scanSize;
      canvas.height = scanSize;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      if (ctx) {
        const sourceX = (video.videoWidth - sourceSize) / 2;
        const sourceY = (video.videoHeight - sourceSize) / 2;
        ctx.drawImage(video, sourceX, sourceY, sourceSize, sourceSize, 0, 0, scanSize, scanSize);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "attemptBoth",
        });

        if (code && code.data) {
          const decodedMeta = decodeTransferQrData(code.data);
          if (decodedMeta) {
            // Valid QR code detected!
            handleValidQrDetected(decodedMeta);
            return;
          }
        }
      }
    }

    if (isScanningActiveRef.current) {
      animationFrameRef.current = requestAnimationFrame(scanFrame);
    }
  };

  // Process the scanned QR code
  const handleValidQrDetected = async (meta: TransferPayloadMeta) => {
    stopCameraStream();
    triggerHaptic("scan");
    setStatus("fetching");

    try {
      // 1. Fetch the raw stories array from the sender
      const rawStories = await fetchRemoteStories(meta);

      if (!Array.isArray(rawStories) || rawStories.length === 0) {
        throw new Error("لم يتم العثور على أي حكايات في حزمة البث.");
      }

      setStatus("importing");
      setImportProgress({ processed: 0, total: rawStories.length });

      abortControllerRef.current = new AbortController();

      // 2. High-speed batch import using existing robust StorageService pipeline
      const result = await StorageService.importBatch(
        rawStories,
        (processed, total) => {
          setImportProgress({ processed, total });
        },
        abortControllerRef.current.signal
      );

      if (result.imported.length > 0) {
        importNotesBulk(result.imported as any);
        await reloadNotes();
      }

      // 3. Confirm completion back to sending device
      await notifyTransferCompleted(meta);

      setImportedFinalCount(result.imported.length);
      setStatus("completed");
      triggerHaptic("success");

      // Auto close after 2 seconds
      setTimeout(() => {
        closeWirelessImport();
      }, 2000);
    } catch (err: any) {
      console.error("Import processing error:", err);
      setStatus("error");
      setErrorMessage(err?.message || "حدث خطأ أثناء استيراد الحكايات.");
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopCameraStream();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <div
      className="min-h-screen relative font-sans transition-colors duration-500 flex flex-col no-scrollbar select-none"
      dir="rtl"
      style={{
        backgroundColor: currentTheme.bg,
        color: currentTheme.text,
      }}
    >
      {/* ── Fixed Floating Top Bar ── */}
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
            <Scan
              className="w-4 h-4 animate-pulse"
              style={{ color: currentTheme.accent }}
              strokeWidth={2.4}
            />
            <h1
              className="font-zain-xbold text-base md:text-lg leading-none pt-0.5"
              style={{ color: currentTheme.text }}
            >
              استقبال الحكايات
            </h1>
          </div>

          {/* Left Capsule: Exit Button */}
          <div className="pointer-events-auto flex-shrink-0">
            <button
              onClick={() => {
                stopCameraStream();
                closeWirelessImport();
              }}
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
          {/* 1. Camera Viewfinder Scanning State */}
          {status === "scanning" && (
            <motion.div
              key="scanning-state"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center gap-8 w-full"
            >
              {/* Header Texts */}
              <div className="space-y-1.5 px-2">
                <h2
                  className="font-zain-xbold text-xl md:text-2xl leading-tight"
                  style={{ color: currentTheme.text }}
                >
                  مسح رمز الاقتران
                </h2>
                <p
                  className="font-zain-reg text-sm opacity-70 leading-relaxed max-w-xs mx-auto"
                  style={{ color: currentTheme.text }}
                >
                  ضع رمز الـ QR المعروض على الجهاز الآخر داخل المربع
                </p>
              </div>

              {/* Viewfinder Square Box with Scanner Laser */}
              <div
                className="relative flex-none rounded-[32px] overflow-hidden border shadow-2xl flex items-center justify-center bg-black/90"
                style={{
                  width: `${QR_SURFACE_SIZE}px`,
                  height: `${QR_SURFACE_SIZE}px`,
                  minWidth: `${QR_SURFACE_SIZE}px`,
                  minHeight: `${QR_SURFACE_SIZE}px`,
                  maxWidth: `${QR_SURFACE_SIZE}px`,
                  maxHeight: `${QR_SURFACE_SIZE}px`,
                  borderColor: currentTheme.mode === "apple_dark" ? "rgba(255, 255, 255, 0.15)" : currentTheme.border,
                }}
              >
                {/* Active Camera Video Feed */}
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  playsInline
                  muted
                />

                {/* Corner Guides Over Video */}
                <div className="absolute inset-4 pointer-events-none border border-white/20 rounded-2xl flex flex-col justify-between p-1">
                  <div className="flex justify-between">
                    <span
                      className="w-5 h-5 border-t-2 border-r-2 rounded-tr-lg"
                      style={{ borderColor: currentTheme.accent }}
                    />
                    <span
                      className="w-5 h-5 border-t-2 border-l-2 rounded-tl-lg"
                      style={{ borderColor: currentTheme.accent }}
                    />
                  </div>
                  <div className="flex justify-between">
                    <span
                      className="w-5 h-5 border-b-2 border-r-2 rounded-br-lg"
                      style={{ borderColor: currentTheme.accent }}
                    />
                    <span
                      className="w-5 h-5 border-b-2 border-l-2 rounded-bl-lg"
                      style={{ borderColor: currentTheme.accent }}
                    />
                  </div>
                </div>

                {/* Animated Laser Scanning Beam */}
                <motion.div
                  className="absolute left-6 right-6 h-0.5 rounded-full pointer-events-none"
                  style={{
                    backgroundColor: currentTheme.accent,
                    boxShadow: `0 0 14px 2px ${currentTheme.accent}`,
                  }}
                  animate={{
                    top: ["15%", "85%", "15%"],
                    opacity: [0.75, 1, 0.75],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 2.2,
                    ease: "easeInOut",
                  }}
                />

                {/* Camera Permission Warning / Fallback Overlay */}
                {hasCameraPermission === false && (
                  <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-6 gap-3 z-20">
                    <Camera className="w-10 h-10 text-white/50" />
                    <p className="font-zain-reg text-xs text-white/80 leading-relaxed text-center">
                      {errorMessage || "تعذر فتح الكاميرا. يرجى تفعيل إذن الكاميرا في المتصفح."}
                    </p>
                    <button
                      onClick={startCamera}
                      className="mt-2 px-4 py-2 rounded-full border text-xs font-zain-bold text-white flex items-center gap-1.5 active:scale-95"
                      style={{
                        backgroundColor: `${currentTheme.accent}30`,
                        borderColor: currentTheme.accent,
                      }}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>إعادة المحاولة</span>
                    </button>
                  </div>
                )}
              </div>

            </motion.div>
          )}

          {/* 2. Fetching State (Connecting & Downloading) */}
          {status === "fetching" && (
            <motion.div
              key="fetching-state"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.35 }}
              className="flex flex-col items-center gap-6 w-full max-w-xs px-2"
            >
              <div
                className="w-20 h-20 rounded-full border flex items-center justify-center relative shadow-2xl"
                style={{
                  backgroundColor: `${currentTheme.accent}15`,
                  borderColor: `${currentTheme.accent}35`,
                }}
              >
                <Scan
                  className="w-10 h-10 animate-pulse"
                  style={{ color: currentTheme.accent }}
                  strokeWidth={2.4}
                />
              </div>

              <div className="flex flex-col items-center gap-2 w-full">
                <h2 className="font-zain-xbold text-xl leading-relaxed" style={{ color: currentTheme.text }}>
                  تم الاقتران بنجاح
                </h2>
                <p className="font-zain-reg text-sm leading-relaxed opacity-70" style={{ color: currentTheme.text }}>
                  جاري استقبال حزمة الحكايات عبر الشبكة المحلية...
                </p>
              </div>

              {/* Shimmering Progress Line */}
              <div
                className="w-full h-2.5 rounded-full overflow-hidden border relative"
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
                    duration: 1.2,
                    ease: "easeInOut",
                  }}
                />
              </div>
            </motion.div>
          )}

          {/* 3. Importing State (Batch processing into SQLite / Storage) */}
          {status === "importing" && (
            <motion.div
              key="importing-state"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.35 }}
              className="flex flex-col items-center gap-6 w-full max-w-xs px-2"
            >
              <div
                className="w-20 h-20 rounded-full border flex items-center justify-center shadow-2xl"
                style={{
                  backgroundColor: `${currentTheme.accent}15`,
                  borderColor: `${currentTheme.accent}35`,
                }}
              >
                <RefreshCw
                  className="w-10 h-10 animate-spin"
                  style={{ color: currentTheme.accent }}
                  strokeWidth={2.4}
                />
              </div>

              <div className="flex flex-col items-center gap-2 w-full">
                <h2 className="font-zain-xbold text-xl leading-relaxed" style={{ color: currentTheme.text }}>
                  جاري استيراد الحكايات...
                </h2>
                <p className="font-zain-reg text-sm leading-relaxed opacity-70" style={{ color: currentTheme.text }}>
                  تم استيراد {importProgress.processed} من {importProgress.total} حكاية
                </p>
              </div>

              {/* Measured Progress Bar */}
              <div
                className="w-full h-2.5 rounded-full overflow-hidden border relative"
                style={{
                  backgroundColor: `${currentTheme.accent}15`,
                  borderColor: `${currentTheme.accent}25`,
                }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300 ease-out"
                  style={{
                    backgroundColor: currentTheme.accent,
                    width: `${importProgress.total > 0 ? (importProgress.processed / importProgress.total) * 100 : 0}%`,
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
                  تم الاستيراد بنجاح ✓
                </h2>
                <p className="font-zain-reg text-sm opacity-70" style={{ color: currentTheme.text }}>
                  تم حفظ {importedFinalCount} حكاية في أرشيف الدار
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
                  تعذر استيراد الحكايات
                </h2>
                <p className="font-zain-reg text-xs opacity-75" style={{ color: currentTheme.text }}>
                  {errorMessage}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={startCamera}
                  className="h-10 px-5 rounded-full border font-zain-bold text-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                  style={{
                    backgroundColor: `${currentTheme.accent}20`,
                    borderColor: `${currentTheme.accent}40`,
                    color: currentTheme.accent,
                  }}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>إعادة المحاولة</span>
                </button>
                <button
                  onClick={() => {
                    stopCameraStream();
                    closeWirelessImport();
                  }}
                  className="h-10 px-5 rounded-full border font-zain-bold text-xs transition-all active:scale-95 cursor-pointer"
                  style={{
                    backgroundColor: `${currentTheme.bg}80`,
                    borderColor: currentTheme.border,
                    color: currentTheme.text,
                  }}
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default WirelessImportPage;
