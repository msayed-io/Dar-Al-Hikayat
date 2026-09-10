import React, { useState, useEffect, useCallback, useRef } from "react";
import { useApp, type ThemeMode } from "../contexts/AppContext";
import {
  ChevronRight,
  ChevronLeft,
  Shield,
  MapPin,
  Loader2,
  Bell,
  Compass,
  Download,
  Upload,
  Check,
  Lock,
  Unlock,
} from "lucide-react";
import { CITIES, type CityData } from "../lib/prayer-cities";
import {
  autoDetectLocation,
  schedulePrayerAlarms,
  testPrayerNotification,
  cityToLocation,
} from "../lib/prayer-alarms";
import { NativeBiometric } from "@capgo/capacitor-native-biometric";
import { Capacitor } from "@capacitor/core";

const SettingsPage: React.FC = () => {
  const {
    currentTheme,
    backToHome,
    prayerState,
    updatePrayerState,
    openLocationSheet,
    toggleTheme,
    notes,
    saveNote,
  } = useApp();

  const [isLocked, setIsLocked] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // إحصائيات الدار
  const totalNotesCount = notes.length;
  const totalWordsCount = notes.reduce((sum, n) => {
    const words = n.content?.replace(/<[^>]*>/g, " ").trim().split(/\s+/).filter(Boolean).length || 0;
    return sum + words;
  }, 0);

  useEffect(() => {
    const lockState = localStorage.getItem("dar_app_lock_enabled") === "true";
    setIsLocked(lockState);

    const handleLockChanged = (e: Event) => {
      const customEvt = e as CustomEvent<{ enabled: boolean }>;
      if (customEvt.detail !== undefined) {
        setIsLocked(customEvt.detail.enabled);
      }
    };

    window.addEventListener("dar_app_lock_changed", handleLockChanged);
    return () => {
      window.removeEventListener("dar_app_lock_changed", handleLockChanged);
    };
  }, []);

  const toggleLock = async () => {
    if (!isLocked) {
      localStorage.setItem("dar_app_lock_enabled", "true");
      setIsLocked(true);
      window.dispatchEvent(
        new CustomEvent("dar_app_lock_changed", { detail: { enabled: true } })
      );
    } else {
      try {
        if (Capacitor.isNativePlatform()) {
          const avail = await NativeBiometric.isAvailable().catch(() => ({ isAvailable: false }));
          if (avail.isAvailable) {
            await NativeBiometric.verifyIdentity({
              reason: "يرجى تأكيد هويتك لإلغاء قفل التطبيق",
              title: "دَارُ الحِكَايَاتِ",
              subtitle: "إلغاء قفل التطبيق",
              description: "استخدم بصمة الإصبع أو رمز قفل الهاتف",
              useFallback: true,
            });
          }
        }
      } catch (err) {
        console.log("Biometric verification cancelled or failed on unlock toggle", err);
        return;
      }

      localStorage.setItem("dar_app_lock_enabled", "false");
      setIsLocked(false);
      window.dispatchEvent(
        new CustomEvent("dar_app_lock_changed", { detail: { enabled: false } })
      );
    }
  };

  // تحديد تلقائي للموقع
  const handleAutoDetect = useCallback(async () => {
    setIsDetecting(true);
    try {
      const location = await autoDetectLocation();
      if (location) {
        updatePrayerState({ location });
        await schedulePrayerAlarms(location, prayerState.method || "egypt");
      }
    } catch (e) {
      console.error("Auto detect failed:", e);
    } finally {
      setIsDetecting(false);
    }
  }, [prayerState.method, updatePrayerState]);

  // اختيار مدينة يدويًا
  const handleSelectCity = useCallback(
    async (city: CityData) => {
      const location = cityToLocation(city);
      updatePrayerState({ location });
      setShowCityPicker(false);
      setCitySearch("");
      await schedulePrayerAlarms(location, prayerState.method || "egypt");
    },
    [prayerState.method, updatePrayerState]
  );

  // إشعار تجريبي
  const handleTestNotification = useCallback(async () => {
    setIsSendingTest(true);
    setTestFeedback(null);
    try {
      const result = await testPrayerNotification();
      setTestFeedback(result);
    } catch (e: any) {
      console.error("Test notification failed:", e);
      setTestFeedback({
        success: false,
        message: `تعذر إرسال الإشعار: ${e?.message || "خطأ غير متوقع"}`,
      });
    } finally {
      setIsSendingTest(false);
      setTimeout(() => {
        setTestFeedback(null);
      }, 5000);
    }
  }, []);

  // تصدير نسخة احتياطية من الحكايات
  const handleExportBackup = () => {
    const dataStr = JSON.stringify(notes, null, 2);
    const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);
    const exportFileDefaultName = `دار_الحكايات_نسخة_احتياطية_${new Date().toISOString().slice(0, 10)}.json`;

    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();
  };

  // استيراد نسخة احتياطية
  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          let count = 0;
          parsed.forEach((item: any) => {
            if (item.title && item.content) {
              saveNote({
                title: item.title,
                content: item.content,
                styles: item.styles || {
                  fontSize: 18,
                  fontWeight: 400,
                  textAlign: "right",
                  textColor: currentTheme.text,
                  paperStyleIndex: 0,
                },
                isLocked: !!item.isLocked,
                password: item.password || "",
              });
              count++;
            }
          });
          setImportStatus(`تم استرجاع ${count} حكاية بنجاح`);
        } else {
          setImportStatus("صيغة الملف غير صالحة");
        }
      } catch (err) {
        setImportStatus("تعذر قراءة ملف النسخة الاحتياطية");
      }
      setTimeout(() => setImportStatus(null), 4000);
    };
    reader.readAsText(file);
  };

  // المدن المفلترة
  const filteredCities = CITIES.filter(
    (c) => c.nameAr.includes(citySearch) || c.countryAr.includes(citySearch)
  );
  const groupedCities: Record<string, CityData[]> = {};
  for (const city of filteredCities) {
    if (!groupedCities[city.countryAr]) groupedCities[city.countryAr] = [];
    groupedCities[city.countryAr].push(city);
  }

  // ثيمات دار الحكايات الثلاثة للكبسولة الاحترافية
  const themesCapsuleList: {
    id: ThemeMode;
    label: string;
    dotColor: string;
    borderColor: string;
  }[] = [
    {
      id: "modern_studio",
      label: "استوديو حديث",
      dotColor: "#2C3E30",
      borderColor: "#A7AA63",
    },
    {
      id: "royal_classic",
      label: "كلاسيكي ملكي",
      dotColor: "#EAE6D2",
      borderColor: "#A7AA63",
    },
    {
      id: "night_whisper",
      label: "همس الليالي",
      dotColor: "#111718",
      borderColor: "#9FA365",
    },
  ];

  return (
    <div
      className="min-h-screen relative font-sans transition-colors duration-500 flex flex-col"
      dir="rtl"
      style={{ backgroundColor: currentTheme.bg, color: currentTheme.text }}
    >
      {/* ─── Floating Capsule Header System ─── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 pointer-events-none"
        style={{ top: 0, paddingTop: "16px", paddingBottom: "8px", paddingLeft: "16px", paddingRight: "16px" }}
      >
        <div className="max-w-md mx-auto flex items-center justify-between pointer-events-none w-full">
          {/* Right Capsule: Settings Title */}
          <div
            className="pointer-events-auto h-11 px-5 border shadow-lg flex items-center justify-center backdrop-blur-xl transition-all"
            style={{
              backgroundColor: currentTheme.bg,
              borderColor: currentTheme.border,
              boxShadow: `0 8px 24px -4px ${currentTheme.shadow}`,
              borderRadius: "9999px",
            }}
          >
            <h1
              className="font-zain-xbold text-base md:text-lg leading-none pt-0.5"
              style={{ color: currentTheme.text }}
            >
              إعدادات دار الحكايات
            </h1>
          </div>

          {/* Left Capsule: Exit Button */}
          <div className="pointer-events-auto flex-shrink-0">
            <button
              onClick={backToHome}
              className="border shadow-lg flex items-center justify-center backdrop-blur-xl transition-all duration-300 hover:scale-105 active:scale-95 group flex-shrink-0 aspect-square cursor-pointer"
              style={{
                width: "44px",
                height: "44px",
                minWidth: "44px",
                minHeight: "44px",
                backgroundColor: currentTheme.bg,
                borderColor: currentTheme.border,
                boxShadow: `0 8px 24px -4px ${currentTheme.shadow}`,
                borderRadius: "50%",
              }}
              title="العودة للرئيسية"
              aria-label="العودة"
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

      {/* Content */}
      <div
        className="px-4 flex-1 z-10 relative max-w-md mx-auto w-full flex flex-col gap-3.5"
        style={{ paddingTop: "74px", paddingBottom: "48px" }}
      >
        {/* ─── قسم أجواء وثيمات الدار (الكبسولة المدمجة الأنيقة) ─── */}
        <div
          className="border shadow-sm transition-all"
          style={{
            backgroundColor: currentTheme.glass,
            borderColor: currentTheme.border,
            borderRadius: "20px",
            padding: "12px 14px",
            boxShadow: `0 4px 16px -2px ${currentTheme.shadow}`,
          }}
        >
          <div className="flex items-center justify-between mb-2 px-1">
            <span
              className="font-zain-bold text-xs"
              style={{ color: currentTheme.accent }}
            >
              أجواء وثيمات الدار
            </span>
            <span
              className="text-[11px] font-zain-reg opacity-60"
              style={{ color: currentTheme.text }}
            >
              {currentTheme.mode === "modern_studio"
                ? "استوديو حديث"
                : currentTheme.mode === "royal_classic"
                ? "كلاسيكي ملكي"
                : "همس الليالي"}
            </span>
          </div>

          {/* Segmented Capsule Controller */}
          <div
            className="flex p-1 border shadow-inner items-center gap-1"
            style={{
              backgroundColor: `${currentTheme.bg}90`,
              borderColor: currentTheme.border,
              borderRadius: "9999px",
            }}
          >
            {themesCapsuleList.map((t) => {
              const isActive = currentTheme.mode === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => toggleTheme(t.id)}
                  className="flex-1 py-1.5 px-2 rounded-full font-zain-bold text-xs transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95"
                  style={{
                    backgroundColor: isActive ? currentTheme.accent : "transparent",
                    color: isActive ? "#FFFFFF" : currentTheme.text,
                    opacity: isActive ? 1 : 0.75,
                    boxShadow: isActive ? `0 2px 8px -1px ${currentTheme.shadow}` : "none",
                  }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full border flex-shrink-0 transition-transform"
                    style={{
                      backgroundColor: t.dotColor,
                      borderColor: isActive ? "rgba(255,255,255,0.7)" : currentTheme.border,
                      transform: isActive ? "scale(1.15)" : "scale(1)",
                    }}
                  />
                  <span className="leading-none pt-0.5 text-[11px] sm:text-xs">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── قسم محراب المواقيت (الموقع والتنبيهات الذكية) ─── */}
        <div
          className="border shadow-sm transition-all flex flex-col gap-3"
          style={{
            backgroundColor: currentTheme.glass,
            borderColor: currentTheme.border,
            borderRadius: "20px",
            padding: "14px 16px",
            boxShadow: `0 4px 16px -2px ${currentTheme.shadow}`,
          }}
        >
          {/* Header Row: Location */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-9 h-9 flex items-center justify-center border flex-shrink-0"
                style={{
                  backgroundColor: `${currentTheme.accent}15`,
                  borderColor: `${currentTheme.accent}30`,
                  borderRadius: "50%",
                }}
              >
                <MapPin className="w-4 h-4" style={{ color: currentTheme.accent }} />
              </div>
              <div className="flex flex-col text-right min-w-0">
                <span
                  className="font-zain-bold text-[11px] opacity-60 leading-tight"
                  style={{ color: currentTheme.text }}
                >
                  موقع المحراب
                </span>
                <span
                  className="font-zain-xbold text-sm leading-snug truncate"
                  style={{ color: currentTheme.text }}
                >
                  {prayerState.location
                    ? `${prayerState.location.cityNameAr || prayerState.location.cityName}${
                        prayerState.location.countryNameAr
                          ? `، ${prayerState.location.countryNameAr}`
                          : ""
                      }`
                    : "تحديد الموقع..."}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={openLocationSheet}
                className="h-8 px-3 rounded-full border text-xs font-zain-bold transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                style={{
                  backgroundColor: `${currentTheme.accent}15`,
                  borderColor: `${currentTheme.accent}30`,
                  color: currentTheme.accent,
                  whiteSpace: "nowrap",
                }}
              >
                <span>تغيير</span>
                <ChevronLeft className="w-3 h-3" />
              </button>
              <button
                onClick={handleAutoDetect}
                disabled={isDetecting}
                className="w-8 h-8 rounded-full border transition-all active:scale-95 flex items-center justify-center cursor-pointer"
                style={{
                  backgroundColor: `${currentTheme.bg}80`,
                  borderColor: currentTheme.border,
                  color: currentTheme.accent,
                }}
                title="تحديد تلقائي عبر GPS"
              >
                {isDetecting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Compass className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Test Notification Mini Pill Button */}
          <div className="pt-2 border-t" style={{ borderColor: currentTheme.border }}>
            <button
              onClick={handleTestNotification}
              disabled={isSendingTest}
              className="w-full h-9 rounded-full font-zain-bold text-xs border transition-all active:scale-95 flex items-center justify-center cursor-pointer shadow-2xs gap-1.5"
              style={{
                backgroundColor: `${currentTheme.accent}14`,
                borderColor: `${currentTheme.accent}30`,
                color: currentTheme.accent,
                opacity: isSendingTest ? 0.6 : 1,
              }}
            >
              {isSendingTest ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Bell className="w-3.5 h-3.5" />
              )}
              <span>{isSendingTest ? "جاري الإرسال..." : "إرسال إشعار تجريبي لاختبار التباين"}</span>
            </button>

            {testFeedback && (
              <div
                className="mt-2 py-1.5 px-3 rounded-xl text-[11px] font-zain-bold text-center border animate-in fade-in"
                style={{
                  backgroundColor: testFeedback.success
                    ? "rgba(34, 197, 94, 0.1)"
                    : "rgba(239, 68, 68, 0.1)",
                  borderColor: testFeedback.success
                    ? "rgba(34, 197, 94, 0.3)"
                    : "rgba(239, 68, 68, 0.3)",
                  color: testFeedback.success ? "#16a34a" : "#dc2626",
                }}
              >
                {testFeedback.message}
              </div>
            )}
          </div>
        </div>

        {/* ─── قسم قفل الدار (تصميم كبسولي مدمج ومفتاح سلس راقٍ) ─── */}
        <div
          className="border shadow-sm transition-all"
          style={{
            backgroundColor: currentTheme.glass,
            borderColor: currentTheme.border,
            borderRadius: "20px",
            padding: "14px 16px",
            boxShadow: `0 4px 16px -2px ${currentTheme.shadow}`,
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-9 h-9 flex items-center justify-center border flex-shrink-0 transition-colors"
                style={{
                  backgroundColor: isLocked ? `${currentTheme.accent}20` : `${currentTheme.accent}10`,
                  borderColor: isLocked ? `${currentTheme.accent}40` : currentTheme.border,
                  borderRadius: "50%",
                }}
              >
                {isLocked ? (
                  <Lock className="w-4 h-4" style={{ color: currentTheme.accent }} />
                ) : (
                  <Unlock className="w-4 h-4 opacity-50" style={{ color: currentTheme.text }} />
                )}
              </div>
              <div className="flex flex-col text-right min-w-0">
                <span
                  className="font-zain-bold text-sm leading-tight"
                  style={{ color: currentTheme.text }}
                >
                  قفل الدار بالبصمة
                </span>
                <span
                  className="font-zain-reg text-xs opacity-65 mt-0.5 leading-tight"
                  style={{ color: currentTheme.text }}
                >
                  طلب بصمة الإصبع أو الرمز عند فتح التطبيق
                </span>
              </div>
            </div>

            {/* Slim iOS-style Capsule Toggle Switch */}
            <button
              onClick={toggleLock}
              className="w-12 h-6.5 relative transition-colors duration-300 cursor-pointer flex-shrink-0 border p-0.5"
              style={{
                backgroundColor: isLocked ? currentTheme.accent : `${currentTheme.border}`,
                borderColor: isLocked ? currentTheme.accent : currentTheme.border,
                borderRadius: "9999px",
              }}
              aria-label="تبديل قفل التطبيق"
            >
              <div
                className={`w-5 h-5 bg-white transition-all duration-300 shadow-md flex items-center justify-center ${
                  isLocked ? "mr-auto ml-0" : "ml-auto mr-0"
                }`}
                style={{ borderRadius: "50%" }}
              >
                {isLocked ? (
                  <Check className="w-2.5 h-2.5 text-[#2C3E30] stroke-[3]" />
                ) : null}
              </div>
            </button>
          </div>
        </div>

        {/* ─── قسم أرشيف الحكايات والنسخ الاحتياطي (تصميم متناسق ومدمج) ─── */}
        <div
          className="border shadow-sm transition-all flex flex-col gap-3"
          style={{
            backgroundColor: currentTheme.glass,
            borderColor: currentTheme.border,
            borderRadius: "20px",
            padding: "14px 16px",
            boxShadow: `0 4px 16px -2px ${currentTheme.shadow}`,
          }}
        >
          {/* Stats Bar */}
          <div className="flex items-center justify-between px-1">
            <span
              className="font-zain-bold text-xs"
              style={{ color: currentTheme.accent }}
            >
              أرشيف المخطوطات والنسخ
            </span>
            <div className="flex items-center gap-2 text-xs font-zain-reg opacity-70">
              <span>{totalNotesCount} حكاية</span>
              <span>•</span>
              <span>{totalWordsCount.toLocaleString("ar-EG")} كلمة</span>
            </div>
          </div>

          {/* Capsule Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportBackup}
              className="flex-1 h-9 rounded-full font-zain-bold text-xs border transition-all active:scale-95 flex items-center justify-center cursor-pointer shadow-2xs gap-1.5"
              style={{
                backgroundColor: `${currentTheme.accent}15`,
                borderColor: `${currentTheme.accent}30`,
                color: currentTheme.accent,
                whiteSpace: "nowrap",
              }}
            >
              <Download className="w-3.5 h-3.5" />
              <span>تصدير نسخة</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 h-9 rounded-full font-zain-bold text-xs border transition-all active:scale-95 flex items-center justify-center cursor-pointer shadow-2xs gap-1.5"
              style={{
                backgroundColor: `${currentTheme.bg}80`,
                borderColor: currentTheme.border,
                color: currentTheme.text,
                whiteSpace: "nowrap",
              }}
            >
              <Upload className="w-3.5 h-3.5" style={{ color: currentTheme.accent }} />
              <span>استيراد حكايات</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
            />
          </div>

          {importStatus && (
            <div
              className="py-1.5 px-3 rounded-xl text-[11px] font-zain-bold text-center border animate-in fade-in"
              style={{
                backgroundColor: `${currentTheme.accent}15`,
                borderColor: `${currentTheme.accent}30`,
                color: currentTheme.accent,
              }}
            >
              {importStatus}
            </div>
          )}
        </div>

        {/* ─── الفوتر الرقيق ─── */}
        <div className="text-center pt-2 opacity-50">
          <p className="font-zain-reg text-[11px]" style={{ color: currentTheme.text }}>
            دَارُ الحِكَايَاتِ والمِحْرَابُ • حيث يجتمع الأدب والسكينة
          </p>
        </div>
      </div>

      {/* ─── نافذة اختيار المدينة السلسة (Bottom Sheet) ─── */}
      {showCityPicker && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-md border-t shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300"
            style={{
              backgroundColor: currentTheme.bg,
              borderColor: currentTheme.border,
              borderTopLeftRadius: "28px",
              borderTopRightRadius: "28px",
              maxHeight: "80vh",
            }}
          >
            {/* رأس النافذة */}
            <div
              className="p-4 border-b flex items-center justify-between"
              style={{ borderColor: currentTheme.border }}
            >
              <h3
                className="font-zain-xbold text-base"
                style={{ color: currentTheme.text }}
              >
                اختيار المدينة
              </h3>
              <button
                onClick={() => {
                  setShowCityPicker(false);
                  setCitySearch("");
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity cursor-pointer"
                style={{ color: currentTheme.text }}
              >
                ✕
              </button>
            </div>

            {/* حقل البحث */}
            <div className="px-4 pt-3">
              <input
                type="text"
                value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
                placeholder="ابحث عن مدينة أو محافظة..."
                className="w-full border text-xs font-zain-reg outline-none focus:ring-2 transition-all"
                style={{
                  backgroundColor: `${currentTheme.bg}80`,
                  borderColor: currentTheme.border,
                  color: currentTheme.text,
                  borderRadius: "9999px",
                  padding: "8px 14px",
                }}
                autoFocus
              />
            </div>

            {/* قائمة المدن */}
            <div
              className="overflow-y-auto p-4 flex flex-col gap-3"
              style={{ maxHeight: "calc(80vh - 130px)" }}
            >
              {Object.entries(groupedCities).map(([country, cities]) => (
                <div key={country}>
                  <h4
                    className="font-zain-bold text-[10px] opacity-50 mb-1.5 tracking-wider"
                    style={{ color: currentTheme.accent }}
                  >
                    {country}
                  </h4>
                  <div className="flex flex-col gap-1">
                    {cities.map((city) => (
                      <button
                        key={`${city.nameAr}-${city.countryAr}`}
                        onClick={() => handleSelectCity(city)}
                        className="w-full text-right transition-all active:scale-[0.98] hover:bg-black/5 p-2 rounded-xl cursor-pointer"
                        style={{ color: currentTheme.text }}
                      >
                        <span className="font-zain-reg text-xs">
                          {city.nameAr}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {filteredCities.length === 0 && (
                <p className="text-center font-zain-reg text-xs opacity-50 py-6">
                  لم يتم العثور على مدينة
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
