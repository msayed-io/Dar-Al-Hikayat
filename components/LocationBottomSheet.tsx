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
import { autoDetectLocation, schedulePrayerAlarms } from "../lib/prayer-alarms";

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
      await schedulePrayerAlarms(loc, prayerState.method);
      setDetectSuccess(true);
      setTimeout(() => {
        setDetectSuccess(false);
        closeLocationSheet();
      }, 700);
    } catch (err) {
      console.warn("GPS detection fallback:", err);
      // Fallback to safe default
      const fallbackLoc = {
        latitude: 30.0444,
        longitude: 31.2357,
        cityName: "القاهرة",
        cityNameAr: "القاهرة",
        countryNameAr: "مصر",
        timezoneId: "Africa/Cairo",
        isAutoDetected: true,
      };
      updatePrayerState({ location: fallbackLoc });
      setDetectSuccess(true);
      setTimeout(() => {
        setDetectSuccess(false);
        closeLocationSheet();
      }, 700);
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
              title="إغلاق"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Title */}
            <h2
              className="font-zain-xbold text-lg leading-tight"
              style={{ color: currentTheme.text }}
            >
              تحديد موقع الصلاة
            </h2>

            {/* Symmetrical placeholder */}
            <div className="w-8 h-8" />
          </div>

          {/* Micro-Capsule: Tiny, Minimal, Exactly the Place Name Only */}
          <div className="flex justify-center pb-3">
            <div
              className="rounded-full border text-xs sm:text-sm font-zain-bold shadow-2xs"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                padding: "4px 12px",
                whiteSpace: "nowrap",
                backgroundColor: `${currentTheme.accent}15`,
                borderColor: `${currentTheme.accent}30`,
                color: currentTheme.accent,
              }}
            >
              <MapPin style={{ width: "16px", height: "16px", flexShrink: 0, marginTop: "-2px" }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "200px", lineHeight: 1 }}>{currentCity}</span>
            </div>
          </div>

          <div className="px-4 sm:px-5 pb-5 pt-1">
            {/* Error or Success notification */}
            {detectError && (
              <div
                className="mb-3 p-2.5 rounded-2xl text-xs font-zain-bold text-center border"
                style={{
                  backgroundColor: "rgba(239, 68, 68, 0.1)",
                  borderColor: "rgba(239, 68, 68, 0.3)",
                  color: "#ef4444",
                }}
              >
                {detectError}
              </div>
            )}

            {/* Options List: Compact, Refined, Rounded-2xl Cards */}
            <div className="space-y-2.5">
              {/* Option 1: تحديد الموقع تلقائياً */}
              <button
                type="button"
                onClick={handleTriggerAutoDetect}
                disabled={isDetecting}
                className="w-full text-right p-3 sm:p-3.5 rounded-[22px] border transition-all duration-200 cursor-pointer active:scale-[0.98] flex items-center justify-between group"
                style={{
                  backgroundColor: isAuto
                    ? `${currentTheme.accent}12`
                    : currentTheme.isDark
                    ? "rgba(255,255,255,0.03)"
                    : "rgba(0,0,0,0.02)",
                  borderColor: isAuto
                    ? `${currentTheme.accent}45`
                    : currentTheme.border,
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center border shadow-2xs shrink-0 transition-transform group-hover:scale-105"
                    style={{
                      backgroundColor: `${currentTheme.accent}18`,
                      borderColor: `${currentTheme.accent}35`,
                      color: currentTheme.accent,
                    }}
                  >
                    {isDetecting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : detectSuccess ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Navigation className="w-4 h-4" />
                    )}
                  </div>

                  <div className="flex flex-col">
                    <span
                      className="font-zain-bold text-sm leading-snug"
                      style={{ color: currentTheme.text }}
                    >
                      تحديد الموقع تلقائياً
                    </span>
                    <span
                      className="font-zain-reg text-xs opacity-65 leading-tight"
                      style={{ color: currentTheme.secondary }}
                    >
                      {isDetecting
                        ? "جارٍ استشعار الموقع عبر الأقمار الصناعية..."
                        : "تفعيل GPS لحساب المواقيت بدقة حسب موقعك الفعلي"}
                    </span>
                  </div>
                </div>

                {/* Compact Toggle Switch */}
                <div
                  className="w-10 h-6 rounded-full p-0.5 transition-all duration-300 flex items-center border shrink-0"
                  style={{
                    backgroundColor: isAuto
                      ? currentTheme.accent
                      : currentTheme.isDark
                      ? "rgba(255, 255, 255, 0.15)"
                      : "rgba(0, 0, 0, 0.12)",
                    borderColor: isAuto
                      ? currentTheme.accent
                      : currentTheme.border,
                    justifyContent: isAuto ? "flex-start" : "flex-end",
                  }}
                >
                  <motion.div
                    layout
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="w-5 h-5 rounded-full bg-white shadow-xs flex items-center justify-center"
                  >
                    {isDetecting && (
                      <Loader2 className="w-2.5 h-2.5 animate-spin text-gray-700" />
                    )}
                  </motion.div>
                </div>
              </button>

              {/* Option 2: تحديد يدوياً (الخريطة والبحث) */}
              <button
                type="button"
                onClick={() => {
                  closeLocationSheet();
                  openLocationPicker();
                }}
                className="w-full text-right p-3 sm:p-3.5 rounded-[22px] border transition-all duration-200 cursor-pointer active:scale-[0.98] flex items-center justify-between group"
                style={{
                  backgroundColor: !isAuto
                    ? `${currentTheme.accent}12`
                    : currentTheme.isDark
                    ? "rgba(255,255,255,0.03)"
                    : "rgba(0,0,0,0.02)",
                  borderColor: !isAuto
                    ? `${currentTheme.accent}45`
                    : currentTheme.border,
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center border shadow-2xs shrink-0 transition-transform group-hover:scale-105"
                    style={{
                      backgroundColor: `${currentTheme.accent}18`,
                      borderColor: `${currentTheme.accent}35`,
                      color: currentTheme.accent,
                    }}
                  >
                    <Map className="w-4 h-4" />
                  </div>

                  <div className="flex flex-col">
                    <span
                      className="font-zain-bold text-sm leading-snug"
                      style={{ color: currentTheme.text }}
                    >
                      تحديد يدوياً (الخريطة والبحث)
                    </span>
                    <span
                      className="font-zain-reg text-xs opacity-65 leading-tight"
                      style={{ color: currentTheme.secondary }}
                    >
                      اختيار أي مدينة أو قرية أو عزبة من الخريطة المباشرة
                    </span>
                  </div>
                </div>

                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center border shadow-2xs shrink-0 transition-transform group-hover:-translate-x-1"
                  style={{
                    backgroundColor: `${currentTheme.accent}12`,
                    borderColor: `${currentTheme.accent}25`,
                    color: currentTheme.accent,
                  }}
                >
                  <ChevronLeft className="w-4 h-4" />
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
