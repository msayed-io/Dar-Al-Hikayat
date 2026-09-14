import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Navigation,
  Map,
  MapPin,
  Loader2,
  ChevronLeft,
  Check,
  X,
} from "lucide-react";
import { useApp } from "../contexts/AppContext";
import {
  autoDetectLocation,
  schedulePrayerAlarms,
  LOCATION_ACTIONABLE_ERROR_MESSAGE,
} from "../lib/prayer-alarms";

export const LocationBottomSheet: React.FC = () => {
  const {
    currentTheme,
    isLocationSheetOpen,
    closeLocationSheet,
    prayerState,
    updatePrayerState,
    openLocationPicker,
  } = useApp();

  const [isDetecting, setIsDetecting] = useState(false);
  const [detectSuccess, setDetectSuccess] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);

  if (!isLocationSheetOpen) return null;

  const isAuto = prayerState.location?.isAutoDetected ?? false;
  const currentCity =
    prayerState.location?.cityNameAr ||
    prayerState.location?.cityName ||
    "غير محدد";

  const handleTriggerAutoDetect = async () => {
    setIsDetecting(true);
    setDetectError(null);
    setDetectSuccess(false);

    try {
      const loc = await autoDetectLocation();
      updatePrayerState({ location: loc });
      const scheduled = await schedulePrayerAlarms(loc, prayerState.method);
      if (!scheduled) {
        throw new Error("تم تحديد الموقع، لكن صلاحيات إشعارات الصلاة غير مكتملة.");
      }
      setDetectSuccess(true);
      setTimeout(() => {
        setDetectSuccess(false);
        closeLocationSheet();
      }, 700);
    } catch (err) {
      console.warn("GPS detection failed:", err);
      setDetectError(err instanceof Error ? err.message : LOCATION_ACTIONABLE_ERROR_MESSAGE);
    } finally {
      setIsDetecting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-end justify-center pointer-events-auto p-0">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={closeLocationSheet}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
        />

        {/* True Bottom Sheet Docked to the Bottom */}
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          className="relative w-full max-w-lg overflow-hidden border-t shadow-2xl z-10 select-none"
          style={{
            borderTopLeftRadius: "36px",
            borderTopRightRadius: "36px",
            borderBottomLeftRadius: "0px",
            borderBottomRightRadius: "0px",
            backgroundColor: currentTheme.glass,
            borderColor: currentTheme.border,
            backdropFilter: "blur(28px)",
            WebkitBackdropFilter: "blur(28px)",
            boxShadow: `0 -12px 48px -8px ${currentTheme.shadow}`,
            paddingBottom: "max(env(safe-area-inset-bottom), 24px)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Drag Indicator Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div
              className="w-12 h-1.5 rounded-full opacity-35"
              style={{ backgroundColor: currentTheme.text }}
            />
          </div>

          {/* Header Row: Close Button at TOP + Title + Symmetrical Balance */}
          <div className="px-5 pt-2 pb-2 flex items-center justify-between">
            {/* Top Close / Cancel Button */}
            <button
              type="button"
              onClick={closeLocationSheet}
              className="w-8 h-8 rounded-full border flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
              style={{
                backgroundColor: currentTheme.isDark
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(0,0,0,0.05)",
                borderColor: currentTheme.border,
                color: currentTheme.text,
              }}
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center">
              <h3
                className="font-zain-bold text-lg leading-tight"
                style={{ color: currentTheme.accent }}
              >
                تحديد الموقع
              </h3>
              <p
                className="font-zain-reg text-xs opacity-65 leading-none mt-0.5"
                style={{ color: currentTheme.secondary }}
              >
                لدقة مواقيت الصلاة واتجاه القبلة
              </p>
            </div>

            {/* Symmetrical placeholder for visual optical balance */}
            <div className="w-8 h-8 opacity-0 pointer-events-none" />
          </div>

          {/* Current Active Location Capsule */}
          <div className="px-5 pt-1 pb-2.5">
            <div
              className="h-12 px-3.5 rounded-full border flex items-center justify-between gap-2 shadow-xs"
              style={{
                borderRadius: "9999px",
                backgroundColor: currentTheme.isDark
                  ? "rgba(255,255,255,0.05)"
                  : "rgba(0,0,0,0.03)",
                borderColor: currentTheme.border,
              }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center border shrink-0"
                  style={{
                    backgroundColor: `${currentTheme.accent}18`,
                    borderColor: `${currentTheme.accent}35`,
                    color: currentTheme.accent,
                  }}
                >
                  <MapPin className="w-3.5 h-3.5" />
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="font-zain-reg text-[11px] opacity-65 shrink-0 whitespace-nowrap"
                    style={{ color: currentTheme.secondary }}
                  >
                    الموقع المعتمد:
                  </span>
                  <span
                    className="font-zain-bold text-xs sm:text-sm truncate whitespace-nowrap"
                    style={{ color: currentTheme.text }}
                  >
                    {currentCity}
                  </span>
                </div>
              </div>

              <span
                className="px-2.5 py-0.5 rounded-full text-[10px] font-zain-bold border shrink-0 whitespace-nowrap"
                style={{
                  borderRadius: "9999px",
                  backgroundColor: isAuto
                    ? "rgba(34, 197, 94, 0.14)"
                    : "rgba(59, 130, 246, 0.14)",
                  borderColor: isAuto
                    ? "rgba(34, 197, 94, 0.35)"
                    : "rgba(59, 130, 246, 0.35)",
                  color: isAuto ? "#16a34a" : "#2563eb",
                }}
              >
                {isAuto ? "تلقائي (GPS)" : "مخصص (خريطة)"}
              </span>
            </div>
          </div>

          {/* Error / Feedback Notice */}
          {detectError && (
            <div className="px-5 pb-2.5">
              <div
                className="px-4 py-2 rounded-full border text-center text-xs font-zain-bold truncate shadow-xs"
                style={{
                  borderRadius: "9999px",
                  backgroundColor: "rgba(245, 158, 11, 0.15)",
                  borderColor: "rgba(245, 158, 11, 0.35)",
                  color: "#d97706",
                }}
              >
                تعذر تحديد الموقع تلقائياً، يمكنك الاختيار بدقة من الخريطة
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="px-5 pb-4">
            <div className="space-y-2">
              {/* Option 1: التحديد التلقائي عبر GPS */}
              <button
                type="button"
                onClick={handleTriggerAutoDetect}
                disabled={isDetecting}
                className="w-full h-12 px-3.5 rounded-full border transition-all duration-200 cursor-pointer active:scale-[0.98] flex items-center justify-between gap-3 group shadow-xs"
                style={{
                  borderRadius: "9999px",
                  backgroundColor: currentTheme.isDark
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(0,0,0,0.03)",
                  borderColor: currentTheme.border,
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center border shrink-0 transition-transform group-hover:scale-105"
                    style={{
                      backgroundColor: `${currentTheme.accent}18`,
                      borderColor: `${currentTheme.accent}35`,
                      color: currentTheme.accent,
                    }}
                  >
                    {isDetecting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : detectSuccess ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Navigation className="w-3.5 h-3.5" />
                    )}
                  </div>

                  <span
                    className="font-zain-bold text-xs sm:text-sm truncate whitespace-nowrap"
                    style={{ color: currentTheme.text }}
                  >
                    {isDetecting
                      ? "جارٍ استشعار الموقع عبر GPS..."
                      : detectSuccess
                      ? "تم تحديد موقعك بدقة!"
                      : "تحديد موقعي تلقائياً (GPS)"}
                  </span>
                </div>

                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center border shrink-0 transition-transform group-hover:-translate-x-0.5"
                  style={{
                    backgroundColor: `${currentTheme.accent}10`,
                    borderColor: `${currentTheme.accent}20`,
                    color: currentTheme.accent,
                  }}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </div>
              </button>

              {/* Option 2: الخريطة التفاعلية */}
              <button
                type="button"
                onClick={() => {
                  closeLocationSheet();
                  openLocationPicker();
                }}
                disabled={isDetecting}
                className="w-full h-12 px-3.5 rounded-full border transition-all duration-200 cursor-pointer active:scale-[0.98] flex items-center justify-between gap-3 group shadow-xs"
                style={{
                  borderRadius: "9999px",
                  backgroundColor: currentTheme.isDark
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(0,0,0,0.03)",
                  borderColor: currentTheme.border,
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center border shrink-0 transition-transform group-hover:scale-105"
                    style={{
                      backgroundColor: `${currentTheme.accent}18`,
                      borderColor: `${currentTheme.accent}35`,
                      color: currentTheme.accent,
                    }}
                  >
                    <Map className="w-3.5 h-3.5" />
                  </div>

                  <span
                    className="font-zain-bold text-xs sm:text-sm truncate whitespace-nowrap"
                    style={{ color: currentTheme.text }}
                  >
                    تحديد من الخريطة التفاعلية
                  </span>
                </div>

                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center border shrink-0 transition-transform group-hover:-translate-x-0.5"
                  style={{
                    backgroundColor: `${currentTheme.accent}10`,
                    borderColor: `${currentTheme.accent}20`,
                    color: currentTheme.accent,
                  }}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </div>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default LocationBottomSheet;
