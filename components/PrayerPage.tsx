import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import { useApp } from "../contexts/AppContext";
import {
  Coordinates,
  PrayerTimes as AdhanPrayerTimes,
  CalculationMethod,
} from "adhan";
import {
  Compass,
  BookOpen,
  MapPin,
  ChevronDown,
} from "lucide-react";
import {
  RING_RADIUS,
  RING_LENGTH,
} from "../lib/prayer-content";
import {
  calculateSecondaryTimes,
  formatPrayerTime,
  SecondaryPrayerTimes,
} from "../lib/prayer-times";

const PrayerPage: React.FC = () => {
  const { currentTheme, backToHome, prayerState, updatePrayerState, openLocationSheet } = useApp();

  /* ── Time & Clock ── */
  const [now, setNow] = useState<Date>(() => new Date());
  const [isSecondaryTimesExpanded, setIsSecondaryTimesExpanded] =
    useState<boolean>(false);

  /* ── Notification / Audio Preferences for each prayer ── */
  const [prayerAlarms, setPrayerAlarms] = useState<Record<string, boolean>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dar_prayer_alarms");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // default
        }
      }
    }
    return {
      fajr: true,
      dhuhr: true,
      asr: true,
      maghrib: true,
      isha: true,
    };
  });

  const toggleAlarm = (key: string) => {
    setPrayerAlarms((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem("dar_prayer_alarms", JSON.stringify(next));
      return next;
    });
  };

  /* ── Clock Interval (1s) ── */
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  /* ── Location Configuration ── */
  const latitude = prayerState.location?.latitude ?? 30.0444;
  const longitude = prayerState.location?.longitude ?? 31.2357;
  const cityName =
    prayerState.location?.cityNameAr ||
    prayerState.location?.cityName ||
    "القاهرة";
  const countryName = prayerState.location?.countryNameAr || "مصر";
  const timezoneId = prayerState.location?.timezoneId ?? "Africa/Cairo";

  /* ── Prayer Schedule Calculations ── */
  const calculationData = useMemo(() => {
    const coordinates = new Coordinates(latitude, longitude);
    const params = CalculationMethod.Egyptian();
    const pt = new AdhanPrayerTimes(coordinates, now, params);

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const ptTomorrow = new AdhanPrayerTimes(coordinates, tomorrow, params);

    // List of 6 prayers including Sunrise
    const schedule = [
      { key: "fajr", name: "الفجر", date: pt.fajr, isMandatory: true },
      { key: "sunrise", name: "الشروق", date: pt.sunrise, isMandatory: false },
      { key: "dhuhr", name: "الظهر", date: pt.dhuhr, isMandatory: true },
      { key: "asr", name: "العصر", date: pt.asr, isMandatory: true },
      { key: "maghrib", name: "المغرب", date: pt.maghrib, isMandatory: true },
      { key: "isha", name: "العشاء", date: pt.isha, isMandatory: true },
    ];

    // Mandatory prayers for current/next calculation
    const mandatorySchedule = schedule.filter((p) => p.isMandatory);

    const nowTimeMs = now.getTime();

    // Determine current prayer & next prayer
    let currentIndex = mandatorySchedule.length - 1; // Default to Isha yesterday
    for (let i = mandatorySchedule.length - 1; i >= 0; i--) {
      if (nowTimeMs >= mandatorySchedule[i].date.getTime()) {
        currentIndex = i;
        break;
      }
    }

    const current = mandatorySchedule[currentIndex];
    const isNextTomorrow = currentIndex === mandatorySchedule.length - 1;
    const next = isNextTomorrow
      ? { key: "fajr", name: "الفجر", date: ptTomorrow.fajr, isMandatory: true }
      : mandatorySchedule[currentIndex + 1];

    // Progress & Countdown
    const currentStartMs = current.date.getTime();
    const nextStartMs = next.date.getTime();
    const totalPeriodMs = Math.max(1, nextStartMs - currentStartMs);
    const elapsedMs = Math.max(0, nowTimeMs - currentStartMs);
    const progress = Math.min(1, Math.max(0, elapsedMs / totalPeriodMs));

    // Seconds Remaining
    const remainingSeconds = Math.max(0, Math.floor((nextStartMs - nowTimeMs) / 1000));
    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = remainingSeconds % 60;
    const countdownLabel = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    // Augmented schedule for display
    const augmented = schedule.map((p) => {
      const isCurrent = p.key === current.key;
      const isNext = p.key === next.key;
      let status = "";
      if (isCurrent) status = "الآن";
      else if (isNext) status = "التالية";
      else if (nowTimeMs > p.date.getTime()) status = "تمت";
      else status = "قادمة";

      return {
        ...p,
        timeFormatted: formatPrayerTime(p.date, timezoneId),
        isCurrent,
        isNext,
        status,
      };
    });

    return {
      current,
      next,
      progress,
      countdownLabel,
      augmented,
    };
  }, [now, latitude, longitude, timezoneId]);

  /* ── Date Strings (Hijri & Gregorian) ── */
  const dateStrings = useMemo(() => {
    try {
      const hijriDate = new Intl.DateTimeFormat("ar-SA-u-ca-islamic", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(now);
      const gregorianDate = new Intl.DateTimeFormat("ar-EG", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(now);
      return { hijriDate, gregorianDate };
    } catch {
      return { hijriDate: "اليوم المبارك", gregorianDate: now.toLocaleDateString("ar-EG") };
    }
  }, [now]);

  /* ── Secondary Times ── */
  const secondaryTimes: SecondaryPrayerTimes = useMemo(() => {
    return calculateSecondaryTimes(latitude, longitude, now, "egyptian", timezoneId);
  }, [latitude, longitude, now, timezoneId]);

  /* ── Ring Offset Calculation ── */
  const ringOffset = RING_LENGTH * (1 - calculationData.progress);

  return (
    <div
      dir="rtl"
      className="min-h-screen w-full relative overflow-x-hidden font-zain-reg transition-colors duration-500 select-none pb-48"
      style={{
        backgroundColor: currentTheme.bg,
        color: currentTheme.text,
        paddingBottom: "150px",
      }}
    >
      {/* ═══════════════════════════════════════════════════════════════
          CURRENT PRAYER & TIMER CARD (Top Section)
          ═══════════════════════════════════════════════════════════════ */}
      <section
        className="mx-auto w-full px-4 pt-12 pb-3"
        style={{ maxWidth: "420px", paddingTop: "36px" }}
      >
        <div
          className="relative overflow-hidden border p-5 sm:p-6 transition-all"
          style={{
            borderRadius: "32px",
            backgroundColor: currentTheme.glass,
            borderColor: currentTheme.border,
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            boxShadow: `0 18px 40px -8px ${currentTheme.shadow}`,
          }}
        >
          <div className="flex items-center justify-between">
            {/* Right Column: Prayer Info */}
            <div className="flex flex-col items-start">
              <p
                className="text-xs font-zain-bold mb-1 opacity-75"
                style={{ color: currentTheme.secondary }}
              >
                الصلاة الحالية
              </p>
              <p
                className="text-3xl sm:text-4xl font-zain-xbold leading-none tracking-tight mb-2"
                style={{ color: currentTheme.text }}
              >
                {calculationData.current.name}
              </p>
              <p
                className="text-xs font-zain-bold"
                style={{ color: currentTheme.accent }}
              >
                التالية: {calculationData.next.name}
              </p>
            </div>

            {/* Left Column: Circular Progress Gauge Countdown */}
            <div className="relative h-20 w-20 sm:h-22 sm:w-22 shrink-0 drop-shadow-sm flex items-center justify-center">
              <svg
                className="h-full w-full -rotate-90"
                viewBox="0 0 100 100"
                role="img"
                aria-label="مؤشر مرور الوقت"
              >
                {/* Background Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r={RING_RADIUS}
                  stroke={currentTheme.isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"}
                  strokeWidth="6"
                  fill="none"
                />
                {/* Dynamic Progress Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r={RING_RADIUS}
                  stroke={currentTheme.accent}
                  strokeWidth="6"
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={RING_LENGTH}
                  strokeDashoffset={ringOffset}
                  className="transition-all duration-1000 ease-in-out"
                />
              </svg>
              <div
                className="absolute inset-0 flex flex-col items-center justify-center text-center mt-0.5"
                style={{ color: currentTheme.text }}
              >
                <p
                  className="text-[9px] font-zain-bold opacity-75 mb-0.5"
                  style={{ color: currentTheme.secondary }}
                >
                  متبقي
                </p>
                <p className="text-[10px] sm:text-[11px] font-zain-xbold tabular-nums tracking-tight">
                  {calculationData.countdownLabel}
                </p>
              </div>
            </div>
          </div>

          {/* Date Footer */}
          <div
            className="mt-4 border-t pt-3 flex items-center justify-between text-xs font-zain-bold"
            style={{ borderColor: currentTheme.border }}
          >
            <span style={{ color: currentTheme.secondary }}>
              {dateStrings.gregorianDate}
            </span>
            <span style={{ color: currentTheme.accent }}>
              {dateStrings.hijriDate}
            </span>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          PRAYER TIMES SECTION: Today's Schedule & Alarm Toggles
          ═══════════════════════════════════════════════════════════════ */}
      <section
        className="mx-auto w-full px-4 pt-2 pb-8"
        style={{ maxWidth: "420px" }}
      >
        {/* Section Header */}
        <div className="mb-3 flex items-center justify-between">
          <h3
            className="text-xl sm:text-2xl font-zain-xbold"
            style={{ color: currentTheme.text }}
          >
            مواقيت اليوم
          </h3>
          <button
            type="button"
            onClick={openLocationSheet}
            className="rounded-full border shadow-xs cursor-pointer transition-all active:scale-95 text-xs sm:text-sm font-zain-bold"
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
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
            title="تحديد موقع الصلاة"
          >
            <MapPin style={{ width: "16px", height: "16px", flexShrink: 0, marginTop: "-2px" }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "200px", lineHeight: 1 }}>{cityName}</span>
          </button>
        </div>

        {/* Unified Prayer Times Panel */}
        <div
          className="border p-2.5 sm:p-3 space-y-1.5 transition-all"
          style={{
            borderRadius: "24px",
            backgroundColor: currentTheme.glass,
            borderColor: currentTheme.border,
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: `0 14px 32px -6px ${currentTheme.shadow}`,
          }}
        >
          {calculationData.augmented.map((prayer) => {
            const isHighlighted = prayer.isNext; // Highlight next upcoming prayer
            const hasAlarm = prayerAlarms[prayer.key] ?? false;

            return (
              <div
                key={prayer.key}
                className={`relative flex items-center justify-between px-3.5 py-2.5 transition-all duration-200 ${
                  isHighlighted ? "shadow-sm" : "hover:bg-black/5 dark:hover:bg-white/5"
                }`}
                style={{
                  borderRadius: "16px",
                  backgroundColor: isHighlighted ? `${currentTheme.accent}18` : "transparent",
                  borderColor: isHighlighted ? `${currentTheme.accent}35` : "transparent",
                  borderWidth: "1px",
                }}
              >
                {/* Right: Prayer Name & Status */}
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm sm:text-base font-zain-bold ${
                      isHighlighted ? "font-zain-xbold" : ""
                    }`}
                    style={{
                      color: isHighlighted ? currentTheme.accent : currentTheme.text,
                    }}
                  >
                    {prayer.name}
                  </span>
                  {prayer.isCurrent && (
                    <span
                      className="text-[10px] font-zain-bold px-2 py-0.5 border leading-none"
                      style={{
                        borderRadius: "9999px",
                        backgroundColor: `${currentTheme.accent}25`,
                        borderColor: `${currentTheme.accent}40`,
                        color: currentTheme.accent,
                      }}
                    >
                      الآن
                    </span>
                  )}
                  {prayer.isNext && (
                    <span
                      className="text-[10px] font-zain-bold px-2 py-0.5 border leading-none"
                      style={{
                        borderRadius: "9999px",
                        backgroundColor: currentTheme.accent,
                        borderColor: currentTheme.accent,
                        color: currentTheme.bg,
                      }}
                    >
                      التالية
                    </span>
                  )}
                </div>

                {/* Left: Time Display */}
                <div className="flex items-center justify-end">
                  <span
                    className={`text-sm sm:text-base font-zain-xbold tabular-nums tracking-tight ${
                      isHighlighted ? "scale-105" : ""
                    }`}
                    style={{
                      color: isHighlighted ? currentTheme.accent : currentTheme.text,
                    }}
                  >
                    {prayer.timeFormatted}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            COLLAPSIBLE SECONDARY TIMES ("أوقات أخرى")
            ═══════════════════════════════════════════════════════════════ */}
        <div className="relative flex items-center justify-center my-5">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div
              className="w-full border-t"
              style={{ borderColor: currentTheme.border }}
            />
          </div>
          <button
            type="button"
            onClick={() => setIsSecondaryTimesExpanded(!isSecondaryTimesExpanded)}
            className="relative flex items-center gap-1.5 px-3.5 py-1.5 border shadow-xs text-xs font-zain-bold cursor-pointer transition-all active:scale-95"
            style={{
              borderRadius: "9999px",
              backgroundColor: currentTheme.bg,
              borderColor: currentTheme.border,
              color: currentTheme.secondary,
            }}
          >
            <span>أوقات أخرى</span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-300 ${
                isSecondaryTimesExpanded ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>

        {/* List of Secondary Times */}
        <AnimatePresence>
          {isSecondaryTimesExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="overflow-hidden"
            >
              <div
                className="border p-4 space-y-3 shadow-md"
                style={{
                  borderRadius: "20px",
                  backgroundColor: currentTheme.glass,
                  borderColor: currentTheme.border,
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                }}
              >
                {/* 1. Duha */}
                <div className="flex items-center justify-between">
                  <span
                    className="font-zain-bold text-sm"
                    style={{ color: currentTheme.text }}
                  >
                    صلاة الضحى
                  </span>
                  <span
                    className="font-zain-xbold text-sm tabular-nums"
                    style={{ color: currentTheme.accent }}
                  >
                    {secondaryTimes.duha}
                  </span>
                </div>

                {/* 2. Midnight */}
                <div className="flex items-center justify-between">
                  <span
                    className="font-zain-bold text-sm"
                    style={{ color: currentTheme.text }}
                  >
                    منتصف الليل الشرعي
                  </span>
                  <span
                    className="font-zain-xbold text-sm tabular-nums"
                    style={{ color: currentTheme.accent }}
                  >
                    {secondaryTimes.midnight}
                  </span>
                </div>

                {/* 3. First Third */}
                <div className="flex items-center justify-between">
                  <span
                    className="font-zain-bold text-sm"
                    style={{ color: currentTheme.text }}
                  >
                    الثلث الأول من الليل
                  </span>
                  <span
                    className="font-zain-xbold text-sm tabular-nums"
                    style={{ color: currentTheme.accent }}
                  >
                    {secondaryTimes.firstThird}
                  </span>
                </div>

                {/* 4. Last Third */}
                <div className="flex items-center justify-between">
                  <span
                    className="font-zain-bold text-sm"
                    style={{ color: currentTheme.text }}
                  >
                    الثلث الأخير (وقت السحر)
                  </span>
                  <span
                    className="font-zain-xbold text-sm tabular-nums"
                    style={{ color: currentTheme.accent }}
                  >
                    {secondaryTimes.lastThird}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
};

export default PrayerPage;
