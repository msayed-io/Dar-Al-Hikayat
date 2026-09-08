import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "../contexts/AppContext";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Shield,
  ShieldAlert,
  Fingerprint,
  MapPin,
  Loader2,
  Bell,
  Info,
  ChevronDown,
} from "lucide-react";
import { type CalculationMethodId, CALCULATION_METHODS } from "../lib/prayer-config";
import { CITIES, type CityData } from "../lib/prayer-cities";
import {
  autoDetectLocation,
  schedulePrayerAlarms,
  testPrayerNotification,
  cityToLocation,
} from "../lib/prayer-alarms";

const SettingsPage: React.FC = () => {
  const { currentTheme, backToHome, prayerState, updatePrayerState, openLocationSheet } = useApp();
  const [isLocked, setIsLocked] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [showMethodList, setShowMethodList] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);

  useEffect(() => {
    const lockState = localStorage.getItem("dar_app_lock_enabled") === "true";
    setIsLocked(lockState);
  }, []);

  const toggleLock = () => {
    const newState = !isLocked;
    setIsLocked(newState);
    localStorage.setItem("dar_app_lock_enabled", String(newState));
  };

  // تحديد تلقائي للموقع
  const handleAutoDetect = useCallback(async () => {
    setIsDetecting(true);
    try {
      const location = await autoDetectLocation();
      if (location) {
        updatePrayerState({ location });
        await schedulePrayerAlarms(location, prayerState.method);
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
      await schedulePrayerAlarms(location, prayerState.method);
    },
    [prayerState.method, updatePrayerState]
  );

  // تغيير طريقة الحساب
  const handleSelectMethod = useCallback(
    async (methodId: CalculationMethodId) => {
      updatePrayerState({ method: methodId });
      if (prayerState.location) {
        await schedulePrayerAlarms(prayerState.location, methodId);
      }
    },
    [prayerState.location, updatePrayerState]
  );

  // إشعار تجريبي
  const handleTestNotification = useCallback(async () => {
    setIsSendingTest(true);
    try {
      await testPrayerNotification();
    } catch (e) {
      console.error("Test notification failed:", e);
    } finally {
      setTimeout(() => setIsSendingTest(false), 2000);
    }
  }, []);

  // المدن المفلترة + التجميع حسب الدولة (كما في الإنتاج)
  const filteredCities = CITIES.filter(
    (c) => c.nameAr.includes(citySearch) || c.countryAr.includes(citySearch)
  );
  const groupedCities: Record<string, CityData[]> = {};
  for (const city of filteredCities) {
    if (!groupedCities[city.countryAr]) groupedCities[city.countryAr] = [];
    groupedCities[city.countryAr].push(city);
  }

  const currentMethod =
    CALCULATION_METHODS.find((m) => m.id === prayerState.method) ||
    CALCULATION_METHODS[0];

  return (
    <div
      className="min-h-screen relative font-sans transition-colors duration-500 flex flex-col"
      dir="rtl"
      style={{ backgroundColor: currentTheme.bg, color: currentTheme.text }}
    >
      {/* --- Floating Capsule Header System (Strictly Component-Scoped) --- */}
      <header
        className="fixed top-0 left-0 right-0 z-50 pointer-events-none"
        style={{ top: 0, paddingTop: "16px", paddingBottom: "8px", paddingLeft: "16px", paddingRight: "16px" }}
      >
        <div className="max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto flex items-center justify-between pointer-events-none w-full">
          {/* Right Capsule: Settings Title (Clean typography only, no emojis or icons) */}
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
              إعدادات المحراب
            </h1>
          </div>

          {/* Left Capsule: Exit Button (Pure circular icon button, no text, clean X icon) */}
          <div className="pointer-events-auto">
            <button
              onClick={backToHome}
              className="w-11 h-11 border shadow-lg flex items-center justify-center backdrop-blur-xl transition-all duration-300 hover:scale-105 active:scale-95 group"
              style={{
                backgroundColor: currentTheme.bg,
                borderColor: currentTheme.border,
                boxShadow: `0 8px 24px -4px ${currentTheme.shadow}`,
                borderRadius: "9999px",
              }}
              title="العودة"
              aria-label="العودة"
            >
              <div
                className="w-7 h-7 flex items-center justify-center border shadow-xs transition-transform duration-200 group-hover:translate-x-0.5"
                style={{
                  backgroundColor: `${currentTheme.accent}15`,
                  borderColor: `${currentTheme.accent}30`,
                  borderRadius: "50%",
                }}
              >
                <ChevronRight
                  className="w-4 h-4"
                  style={{ color: currentTheme.accent }}
                  strokeWidth={2.5}
                />
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Content (Strictly offset with inline padding-top so it never collides with header) */}
      <div
        className="px-4 sm:px-5 md:px-8 lg:px-12 flex-1 z-10 relative max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto w-full"
        style={{ paddingTop: "88px", paddingBottom: "48px" }}
      >
        {/* ─── قسم مواقيت الصلاة ─── */}
        <section>
          <h2
            className="text-sm font-zain-bold opacity-60 px-2 uppercase tracking-wider"
            style={{ color: currentTheme.accent, marginBottom: "12px" }}
          >
            مواقيت الصلاة
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* بطاقة موقع حساب المواقيت — إعادة تصميم كاملة متكاملة من الصفر */}
            <div
              onClick={openLocationSheet}
              className="border shadow-sm transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99] group"
              style={{
                backgroundColor: currentTheme.glass,
                borderColor: currentTheme.border,
                borderRadius: "24px",
                padding: "18px 20px",
                boxShadow: `0 4px 20px -2px ${currentTheme.shadow}`,
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center" style={{ gap: "14px" }}>
                  <div
                    className="flex items-center justify-center border flex-shrink-0 transition-transform duration-300 group-hover:scale-105"
                    style={{
                      width: "44px",
                      height: "44px",
                      backgroundColor: `${currentTheme.accent}18`,
                      borderColor: `${currentTheme.accent}35`,
                      borderRadius: "16px",
                    }}
                  >
                    <MapPin
                      className="w-5 h-5"
                      style={{ color: currentTheme.accent }}
                      strokeWidth={2.2}
                    />
                  </div>
                  <div className="flex flex-col text-right">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-zain-bold text-sm leading-tight"
                        style={{ color: currentTheme.text }}
                      >
                        موقع حساب المواقيت
                      </span>
                      {prayerState.location && (
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-zain-bold border"
                          style={{
                            backgroundColor: `${currentTheme.accent}12`,
                            borderColor: `${currentTheme.accent}25`,
                            color: currentTheme.accent,
                          }}
                        >
                          {prayerState.location.isAutoDetected
                            ? "تلقائي GPS"
                            : "يدوي"}
                        </span>
                      )}
                    </div>
                    <span
                      className="font-zain-xbold text-base mt-0.5 leading-snug"
                      style={{ color: currentTheme.text }}
                    >
                      {prayerState.location
                        ? `${prayerState.location.cityNameAr || prayerState.location.cityName}${
                            prayerState.location.countryNameAr
                              ? `، ${prayerState.location.countryNameAr}`
                              : ""
                          }`
                        : "انقر لتحديد موقعك"}
                    </span>
                  </div>
                </div>

                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center border shadow-xs transition-transform duration-200 group-hover:-translate-x-1 shrink-0"
                  style={{
                    backgroundColor: `${currentTheme.accent}10`,
                    borderColor: `${currentTheme.accent}25`,
                    color: currentTheme.accent,
                  }}
                >
                  <ChevronLeft className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* بطاقة طريقة الحساب (Apple Concentric Rounded Corners) */}
            <div
              className="border shadow-sm transition-all"
              style={{
                backgroundColor: currentTheme.glass,
                borderColor: currentTheme.border,
                borderRadius: "24px",
                padding: "18px",
                boxShadow: `0 4px 20px -2px ${currentTheme.shadow}`,
              }}
            >
              <button
                onClick={() => setShowMethodList(!showMethodList)}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center" style={{ gap: "12px" }}>
                  <div
                    className="flex items-center justify-center border flex-shrink-0"
                    style={{
                      width: "42px",
                      height: "42px",
                      backgroundColor: `${currentTheme.accent}15`,
                      borderColor: `${currentTheme.accent}30`,
                      borderRadius: "14px",
                    }}
                  >
                    <span className="text-base">🕌</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="font-zain-bold text-sm" style={{ color: currentTheme.text, lineHeight: "1.4" }}>
                      طريقة الحساب
                    </span>
                    <span className="font-zain-reg text-xs opacity-70" style={{ color: currentTheme.text, lineHeight: "1.4" }}>
                      {currentMethod.nameAr}
                    </span>
                  </div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${showMethodList ? "rotate-180" : ""}`}
                  style={{ color: currentTheme.accent }}
                />
              </button>

              {showMethodList && (
                <div
                  className="border-t"
                  style={{
                    borderColor: currentTheme.border,
                    marginTop: "14px",
                    paddingTop: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  {CALCULATION_METHODS.map((method) => (
                    <button
                      key={method.id}
                      onClick={() => handleSelectMethod(method.id)}
                      className="w-full text-right transition-all active:scale-[0.98] flex items-center justify-between"
                      style={{
                        backgroundColor:
                          prayerState.method === method.id
                            ? `${currentTheme.accent}15`
                            : "transparent",
                        borderColor:
                          prayerState.method === method.id
                            ? `${currentTheme.accent}30`
                            : "transparent",
                        borderWidth: "1px",
                        borderRadius: "14px",
                        padding: "10px 14px",
                      }}
                    >
                      <div className="flex flex-col">
                        <span
                          className="font-zain-bold text-sm"
                          style={{ color: currentTheme.text }}
                        >
                          {method.nameAr}
                        </span>
                        <span
                          className="font-zain-reg text-[11px] opacity-50"
                          style={{ color: currentTheme.text }}
                        >
                          {method.description}
                        </span>
                      </div>
                      {prayerState.method === method.id && (
                        <div
                          className="w-5 h-5 flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: currentTheme.accent,
                            borderRadius: "50%",
                          }}
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            fill="none"
                          >
                            <path
                              d="M2 6L5 9L10 3"
                              stroke="white"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* بطاقة اختبار الإشعار (Apple Concentric Rounded Corners) */}
            <div
              className="border shadow-sm transition-all"
              style={{
                backgroundColor: currentTheme.glass,
                borderColor: currentTheme.border,
                borderRadius: "24px",
                padding: "18px",
                boxShadow: `0 4px 20px -2px ${currentTheme.shadow}`,
              }}
            >
              <div className="flex items-center" style={{ gap: "12px", marginBottom: "14px" }}>
                <div
                  className="flex items-center justify-center border flex-shrink-0"
                  style={{
                    width: "42px",
                    height: "42px",
                    backgroundColor: `${currentTheme.accent}15`,
                    borderColor: `${currentTheme.accent}30`,
                    borderRadius: "14px",
                  }}
                >
                  <Bell
                    className="w-5 h-5"
                    style={{ color: currentTheme.accent }}
                  />
                </div>
                <div className="flex flex-col text-right">
                  <span className="font-zain-bold text-sm" style={{ color: currentTheme.text, lineHeight: "1.4" }}>
                    اختبار الإشعار
                  </span>
                  <span className="font-zain-reg text-xs opacity-70" style={{ color: currentTheme.text, lineHeight: "1.4" }}>
                    اضغط لرؤية إشعار تجريبي خلال 5 ثوانٍ
                  </span>
                </div>
              </div>
              <button
                onClick={handleTestNotification}
                disabled={isSendingTest}
                className="w-full font-zain-bold text-sm border transition-all active:scale-95 flex items-center justify-center"
                style={{
                  backgroundColor: `${currentTheme.accent}15`,
                  borderColor: `${currentTheme.accent}30`,
                  color: currentTheme.accent,
                  borderRadius: "14px",
                  paddingTop: "11px",
                  paddingBottom: "11px",
                  gap: "8px",
                  opacity: isSendingTest ? 0.6 : 1,
                }}
              >
                {isSendingTest ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Bell className="w-4 h-4" />
                )}
                {isSendingTest ? "تم الإرسال..." : "اختبار إشعار الصلاة"}
              </button>
            </div>
          </div>
        </section>

        {/* ─── قسم الأمان والخصوصية (Apple Concentric Rounded Corners) ─── */}
        <section style={{ marginTop: "24px" }}>
          <h2
            className="text-sm font-zain-bold opacity-60 px-2 uppercase tracking-wider"
            style={{ color: currentTheme.accent, marginBottom: "12px" }}
          >
            الأمان والخصوصية
          </h2>

          <div
            className="border shadow-sm transition-all"
            style={{
              backgroundColor: currentTheme.glass,
              borderColor: currentTheme.border,
              borderRadius: "24px",
              padding: "18px",
              boxShadow: `0 4px 20px -2px ${currentTheme.shadow}`,
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center" style={{ gap: "14px" }}>
                <div
                  className="flex items-center justify-center border flex-shrink-0"
                  style={{
                    width: "48px",
                    height: "48px",
                    backgroundColor: isLocked
                      ? `${currentTheme.accent}20`
                      : "rgba(0,0,0,0.03)",
                    borderColor: isLocked
                      ? `${currentTheme.accent}40`
                      : currentTheme.border,
                    borderRadius: "14px",
                  }}
                >
                  {isLocked ? (
                    <Shield
                      className="w-6 h-6"
                      style={{ color: currentTheme.accent }}
                    />
                  ) : (
                    <ShieldAlert
                      className="w-6 h-6 opacity-50"
                      style={{ color: currentTheme.text }}
                    />
                  )}
                </div>
                <div className="flex flex-col text-right">
                  <span className="font-zain-bold text-base md:text-lg" style={{ color: currentTheme.text, lineHeight: "1.3" }}>
                    قفل التطبيق
                  </span>
                  <span className="font-zain-reg text-xs opacity-70" style={{ color: currentTheme.text, lineHeight: "1.4" }}>
                    طلب بصمة الإصبع أو الرمز السري عند الفتح
                  </span>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                onClick={toggleLock}
                className={`w-12 h-6 relative transition-colors duration-300 ${isLocked ? "bg-green-500/80" : "bg-gray-400/30"}`}
                style={{
                  backgroundColor: isLocked ? currentTheme.accent : undefined,
                  borderRadius: "9999px",
                }}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white transition-transform duration-300 shadow-sm ${isLocked ? "left-1" : "right-1"}`}
                  style={{ borderRadius: "50%" }}
                />
              </button>
            </div>

            {isLocked && (
              <div
                className="border-t flex items-start"
                style={{
                  borderColor: currentTheme.border,
                  backgroundColor: `${currentTheme.accent}08`,
                  borderRadius: "14px",
                  marginTop: "16px",
                  padding: "12px 14px",
                  gap: "10px",
                }}
              >
                <Info
                  className="w-4 h-4 mt-0.5 flex-shrink-0"
                  style={{ color: currentTheme.accent }}
                />
                <p className="text-xs font-zain-reg opacity-80 leading-relaxed">
                  التطبيق الآن محمي. سيتم طلب التحقق من الهوية الآمنة للجهاز
                  (البصمة أو نمط الشاشة) عند كل مرة تفتحين فيها التطبيق أو
                  تعودين إليه.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ─── نافذة اختيار المدينة (Bottom Sheet with Apple Curves) ─── */}
      {showCityPicker && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg border-t shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300"
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
                className="font-zain-xbold text-lg"
                style={{ color: currentTheme.text }}
              >
                اختيار المدينة
              </h3>
              <button
                onClick={() => {
                  setShowCityPicker(false);
                  setCitySearch("");
                }}
                className="min-w-[2rem] min-h-[2rem] flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity"
                style={{
                  color: currentTheme.text,
                  borderRadius: "50%",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M2 2L14 14M14 2L2 14"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            {/* حقل البحث */}
            <div className="px-4 pt-3">
              <input
                type="text"
                value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
                placeholder="ابحث عن مدينة أو محافظة..."
                className="w-full border text-sm font-zain-reg outline-none focus:ring-2 transition-all"
                style={{
                  backgroundColor: `${currentTheme.bg}80`,
                  borderColor: currentTheme.border,
                  color: currentTheme.text,
                  borderRadius: "14px",
                  padding: "10px 14px",
                }}
                autoFocus
              />
            </div>

            {/* قائمة المدن */}
            <div
              className="overflow-y-auto p-4"
              style={{ maxHeight: "calc(80vh - 140px)", display: "flex", flexDirection: "column", gap: "16px" }}
            >
              {Object.entries(groupedCities).map(([country, cities]) => (
                <div key={country}>
                  <h4
                    className="font-zain-bold text-xs opacity-50 mb-2 tracking-wider"
                    style={{ color: currentTheme.accent }}
                  >
                    {country}
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {cities.map((city) => (
                      <button
                        key={`${city.nameAr}-${city.countryAr}`}
                        onClick={() => handleSelectCity(city)}
                        className="w-full text-right transition-all active:scale-[0.98] hover:bg-black/5"
                        style={{
                          color: currentTheme.text,
                          borderRadius: "12px",
                          padding: "10px 14px",
                        }}
                      >
                        <span className="font-zain-reg text-sm">
                          {city.nameAr}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {filteredCities.length === 0 && (
                <p className="text-center font-zain-reg text-sm opacity-50 py-8">
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
