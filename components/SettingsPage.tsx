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
  KeyRound,
  Plus,
  Trash2,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Wifi,
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
import {
  loadManagedKeysAsync,
  addManagedKey,
  deleteManagedKey,
  updateManagedKey,
  maskApiKey,
  subscribeToKeyChanges,
  testKeyConnection,
  type ManagedApiKey,
} from "../lib/api-key-repository";

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

  // ─── مفاتيح الاتصال بالمساعد الأدبي (Multi-Key Rotation) ───
  const [managedKeys, setManagedKeys] = useState<ManagedApiKey[]>([]);
  const [showAddKeyDialog, setShowAddKeyDialog] = useState(false);
  const [newKeyInput, setNewKeyInput] = useState("");
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [addKeyError, setAddKeyError] = useState<string | null>(null);
  const [keyToDelete, setKeyToDelete] = useState<ManagedApiKey | null>(null);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [testingKeyId, setTestingKeyId] = useState<string | null>(null);
  const [keyFeedback, setKeyFeedback] = useState<{
    id: string;
    success: boolean;
    message: string;
  } | null>(null);
  const [isTestingNewKey, setIsTestingNewKey] = useState(false);
  const [newKeyTestFeedback, setNewKeyTestFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    loadManagedKeysAsync().then((loaded) => {
      setManagedKeys(loaded);
    });

    const unsubscribe = subscribeToKeyChanges(() => {
      loadManagedKeysAsync().then((loaded) => {
        setManagedKeys(loaded);
      });
    });

    return () => unsubscribe();
  }, []);

  const handleTestKey = async (item: ManagedApiKey) => {
    setTestingKeyId(item.id);
    setKeyFeedback(null);
    try {
      const res = await testKeyConnection(item.key);
      if (res.success) {
        if (item.status !== "active") {
          await updateManagedKey(item.id, {
            status: "active",
            rateLimitedAt: undefined,
            disabledReason: undefined,
          });
        }
        setKeyFeedback({
          id: item.id,
          success: true,
          message: "المفتاح متصل ويعمل بنجاح ✓",
        });
      } else {
        setKeyFeedback({
          id: item.id,
          success: false,
          message: res.message,
        });
      }
    } catch (e: any) {
      setKeyFeedback({
        id: item.id,
        success: false,
        message: e?.message || "تعذر فحص الاتصال",
      });
    } finally {
      setTestingKeyId(null);
    }
  };

  const handleTestNewKeyInDialog = async () => {
    const trimmed = newKeyInput.trim();
    if (!trimmed) {
      setAddKeyError("يرجى إدخال قيمة المفتاح أولاً لفحصه");
      return;
    }
    setIsTestingNewKey(true);
    setAddKeyError(null);
    setNewKeyTestFeedback(null);
    try {
      const res = await testKeyConnection(trimmed);
      setNewKeyTestFeedback(res);
      if (!res.success) {
        setAddKeyError(res.message);
      }
    } catch (e: any) {
      setNewKeyTestFeedback({
        success: false,
        message: e?.message || "تعذر فحص الاتصال",
      });
    } finally {
      setIsTestingNewKey(false);
    }
  };

  const handleSaveNewKey = async () => {
    const trimmedKey = newKeyInput.trim();
    if (!trimmedKey) {
      setAddKeyError("يرجى إدخال قيمة مفتاح API");
      return;
    }
    setIsSavingKey(true);
    setAddKeyError(null);
    try {
      await addManagedKey(trimmedKey, newKeyLabel.trim() || undefined);
      setShowAddKeyDialog(false);
      setNewKeyInput("");
      setNewKeyLabel("");
      setNewKeyTestFeedback(null);
      const updated = await loadManagedKeysAsync();
      setManagedKeys(updated);
    } catch (err: any) {
      setAddKeyError(err.message || "حدث خطأ أثناء حفظ المفتاح");
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleConfirmDeleteKey = async () => {
    if (!keyToDelete) return;
    try {
      await deleteManagedKey(keyToDelete.id);
      setKeyToDelete(null);
      const updated = await loadManagedKeysAsync();
      setManagedKeys(updated);
    } catch (err) {
      console.error("Failed to delete key:", err);
    }
  };

  const handleReactivateKey = async (id: string) => {
    await updateManagedKey(id, {
      status: "active",
      rateLimitedAt: undefined,
    });
    const updated = await loadManagedKeysAsync();
    setManagedKeys(updated);
  };

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
        await schedulePrayerAlarms(location, prayerState.method || "egyptian");
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
      await schedulePrayerAlarms(location, prayerState.method || "egyptian");
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
            className="pointer-events-auto h-11 px-5 border flex items-center justify-center backdrop-blur-xl transition-all"
            style={{
              backgroundColor: currentTheme.glass,
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
              className="border flex items-center justify-center backdrop-blur-xl transition-all duration-300 hover:scale-105 active:scale-95 group flex-shrink-0 aspect-square cursor-pointer"
              style={{
                width: "44px",
                height: "44px",
                minWidth: "44px",
                minHeight: "44px",
                backgroundColor: currentTheme.glass,
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

        {/* ─── قسم مفاتيح الاتصال بالمساعد الأدبي (Multi-Key Rotation System) ─── */}
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
          {/* Header */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-8 h-8 flex items-center justify-center border flex-shrink-0"
                style={{
                  backgroundColor: `${currentTheme.accent}15`,
                  borderColor: `${currentTheme.accent}30`,
                  borderRadius: "50%",
                }}
              >
                <KeyRound
                  className="w-3.5 h-3.5"
                  style={{ color: currentTheme.accent }}
                />
              </div>
              <div className="flex flex-col text-right min-w-0">
                <span
                  className="font-zain-bold text-xs leading-tight whitespace-nowrap"
                  style={{ color: currentTheme.text }}
                >
                  مفاتيح الاتصال بالمساعد الأدبي
                </span>
                <span
                  className="font-zain-reg text-[10.5px] opacity-60 mt-0.5 leading-tight whitespace-nowrap"
                  style={{ color: currentTheme.text }}
                >
                  تبديل تلقائي عند انتهاء الحصة
                </span>
              </div>
            </div>

            {/* Key count badge (only when keys exist) */}
            {managedKeys.length > 0 && (
              <div
                className="h-5 px-2 rounded-full border text-[10px] font-zain-bold flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: `${currentTheme.bg}80`,
                  borderColor: currentTheme.border,
                  color: currentTheme.accent,
                  whiteSpace: "nowrap",
                }}
              >
                {`${managedKeys.length} ${
                  managedKeys.length === 1
                    ? "مفتاح"
                    : managedKeys.length === 2
                    ? "مفتاحان"
                    : "مفاتيح"
                }`}
              </div>
            )}
          </div>

          {/* List of Collapsed Key Cards / Empty State */}
          {managedKeys.length === 0 ? (
            <div
              className="py-3 px-3 text-center border rounded-2xl flex items-center justify-center gap-2"
              style={{
                backgroundColor: `${currentTheme.bg}40`,
                borderColor: currentTheme.border,
              }}
            >
              <KeyRound
                className="w-3.5 h-3.5 opacity-40 flex-shrink-0"
                style={{ color: currentTheme.text }}
              />
              <span
                className="font-zain-reg text-xs opacity-60 leading-normal"
                style={{ color: currentTheme.text }}
              >
                لم تُضف أي مفاتيح بعد
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {managedKeys.map((item, index) => {
                const isRateLimited = item.status === "rate_limited";
                const isDisabled = item.status === "disabled";
                const isActive = item.status === "active";

                const isTesting = testingKeyId === item.id;
                const feedback = keyFeedback?.id === item.id ? keyFeedback : null;

                return (
                  <div
                    key={item.id}
                    className="flex flex-col p-2.5 border rounded-2xl transition-all gap-1.5"
                    style={{
                      backgroundColor: `${currentTheme.bg}70`,
                      borderColor: currentTheme.border,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      {/* Key Details & Status */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-7 h-7 flex items-center justify-center border flex-shrink-0"
                          style={{
                            backgroundColor: `${currentTheme.accent}10`,
                            borderColor: `${currentTheme.accent}25`,
                            borderRadius: "50%",
                          }}
                        >
                          <KeyRound
                            className="w-3.5 h-3.5"
                            style={{ color: currentTheme.accent }}
                          />
                        </div>
                        <div className="flex flex-col text-right min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className="font-zain-bold text-xs leading-tight"
                              style={{ color: currentTheme.text }}
                            >
                              {item.label || `مفتاح ${index + 1}`}
                            </span>
                            {/* Status Badge */}
                            {isActive && (
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-zain-bold border"
                                style={{
                                  backgroundColor: `${currentTheme.accent}15`,
                                  borderColor: `${currentTheme.accent}30`,
                                  color: currentTheme.accent,
                                }}
                              >
                                نشط
                              </span>
                            )}
                            {isRateLimited && (
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-zain-bold border"
                                style={{
                                  backgroundColor: "rgba(245, 158, 11, 0.12)",
                                  borderColor: "rgba(245, 158, 11, 0.35)",
                                  color: "#d97706",
                                }}
                              >
                                متوقف مؤقتاً (حد الحصة)
                              </span>
                            )}
                            {isDisabled && (
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-zain-bold border"
                                style={{
                                  backgroundColor: `${currentTheme.border}`,
                                  borderColor: currentTheme.border,
                                  color: currentTheme.secondary,
                                }}
                              >
                                معطَّل
                              </span>
                            )}
                          </div>
                          <span
                            className="font-mono text-[11px] opacity-60 mt-0.5 tracking-wider"
                            dir="ltr"
                            style={{ color: currentTheme.text }}
                          >
                            {maskApiKey(item.key)}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Test Connection Button */}
                        <button
                          onClick={() => handleTestKey(item)}
                          disabled={isTesting}
                          title="فحص اتصال المفتاح الآن"
                          className="h-7 px-2 flex items-center justify-center gap-1 rounded-full border opacity-80 hover:opacity-100 transition-all cursor-pointer active:scale-95 text-[10px] font-zain-bold"
                          style={{
                            backgroundColor: `${currentTheme.accent}10`,
                            borderColor: `${currentTheme.accent}30`,
                            color: currentTheme.accent,
                          }}
                        >
                          {isTesting ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Wifi className="w-3 h-3" />
                          )}
                          <span>{isTesting ? "جارٍ الفحص..." : "فحص"}</span>
                        </button>

                        {isRateLimited && (
                          <button
                            onClick={() => handleReactivateKey(item.id)}
                            title="إعادة التنشيط يدوياً"
                            className="w-7 h-7 flex items-center justify-center rounded-full border opacity-70 hover:opacity-100 transition-all cursor-pointer active:scale-90"
                            style={{
                              backgroundColor: `${currentTheme.bg}90`,
                              borderColor: currentTheme.border,
                              color: currentTheme.accent,
                            }}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setKeyToDelete(item)}
                          title="حذف المفتاح"
                          className="w-7 h-7 flex items-center justify-center rounded-full border opacity-60 hover:opacity-100 hover:text-red-600 transition-all cursor-pointer active:scale-90"
                          style={{
                            backgroundColor: `${currentTheme.bg}90`,
                            borderColor: currentTheme.border,
                            color: currentTheme.secondary,
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Test result feedback banner */}
                    {feedback && (
                      <div
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-zain-bold border animate-in fade-in"
                        style={{
                          backgroundColor: feedback.success
                            ? "rgba(16, 185, 129, 0.1)"
                            : "rgba(239, 68, 68, 0.1)",
                          borderColor: feedback.success
                            ? "rgba(16, 185, 129, 0.3)"
                            : "rgba(239, 68, 68, 0.3)",
                          color: feedback.success ? "#059669" : "#dc2626",
                        }}
                      >
                        {feedback.success ? (
                          <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="w-3 h-3 flex-shrink-0" />
                        )}
                        <span className="leading-tight">{feedback.message}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Single prominent button: إضافة مفتاح جديد */}
          <div className="pt-1">
            <button
              onClick={() => {
                setAddKeyError(null);
                setNewKeyInput("");
                setNewKeyLabel("");
                setShowAddKeyDialog(true);
              }}
              className="w-full h-9 rounded-full font-zain-bold text-xs border transition-all active:scale-95 flex items-center justify-center cursor-pointer shadow-2xs gap-1.5"
              style={{
                backgroundColor: `${currentTheme.accent}15`,
                borderColor: `${currentTheme.accent}30`,
                color: currentTheme.accent,
                whiteSpace: "nowrap",
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة مفتاح جديد</span>
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

      {/* ─── نافذة منبثقة لإضافة مفتاح جديد (Add API Key Dialog) ─── */}
      {showAddKeyDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="border flex flex-col items-center animate-in zoom-in-95 duration-200"
            style={{
              width: "300px",
              maxWidth: "calc(100vw - 32px)",
              borderRadius: "28px",
              padding: "24px 20px",
              backgroundColor: currentTheme.bg,
              borderColor: currentTheme.border,
              boxShadow: `0 20px 45px -10px ${currentTheme.shadow || "rgba(0,0,0,0.3)"}`,
            }}
          >
            {/* Top Icon matching Story Lock Dialog */}
            <div className="flex justify-center mb-3">
              <KeyRound
                className="w-7 h-7"
                style={{ color: currentTheme.accent }}
                strokeWidth={2}
              />
            </div>

            {/* Dialog Title */}
            <h2
              className="text-base font-zain-xbold mb-1 leading-tight text-center"
              style={{ color: currentTheme.text }}
            >
              إضافة مفتاح جديد
            </h2>

            {/* Description */}
            <p
              className="text-xs font-zain-reg mb-4 opacity-70 leading-relaxed text-center px-1"
              style={{ color: currentTheme.text }}
            >
              أدخلي مفتاح Gemini API للمساعد الأدبي لضمان استمرار الاتصال والتبديل التلقائي.
            </p>

            {/* Input 1: API Key */}
            <div className="mb-4 w-full flex flex-col">
              <input
                type="text"
                placeholder="قيمة مفتاح API (مثال: AIzaSy...)"
                value={newKeyInput}
                onChange={(e) => {
                  setNewKeyInput(e.target.value);
                  if (addKeyError) setAddKeyError(null);
                }}
                autoFocus
                dir="ltr"
                className="w-full text-center font-mono text-xs outline-none border transition-all"
                style={{
                  height: "42px",
                  borderRadius: "9999px",
                  backgroundColor: `${currentTheme.accent}0a`,
                  borderColor: `${currentTheme.accent}40`,
                  color: currentTheme.text,
                  padding: "0 16px",
                }}
              />
            </div>

            {/* Input 2: Optional Label */}
            <div className="mb-3.5 w-full flex flex-col">
              <input
                type="text"
                placeholder="تسمية المفتاح (اختياري، مثلاً: مفتاح 1)"
                value={newKeyLabel}
                onChange={(e) => setNewKeyLabel(e.target.value)}
                className="w-full text-center font-zain-bold text-xs outline-none border transition-all"
                style={{
                  height: "42px",
                  borderRadius: "9999px",
                  backgroundColor: `${currentTheme.accent}0a`,
                  borderColor: `${currentTheme.accent}40`,
                  color: currentTheme.text,
                  padding: "0 16px",
                }}
              />
            </div>

            {/* Testing feedback */}
            {newKeyTestFeedback && (
              <div
                className="mb-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-zain-bold border animate-in fade-in"
                style={{
                  backgroundColor: newKeyTestFeedback.success
                    ? "rgba(16, 185, 129, 0.1)"
                    : "rgba(239, 68, 68, 0.1)",
                  borderColor: newKeyTestFeedback.success
                    ? "rgba(16, 185, 129, 0.3)"
                    : "rgba(239, 68, 68, 0.3)",
                  color: newKeyTestFeedback.success ? "#059669" : "#dc2626",
                }}
              >
                {newKeyTestFeedback.success ? (
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                )}
                <span className="leading-tight text-center">{newKeyTestFeedback.message}</span>
              </div>
            )}

            {addKeyError && !newKeyTestFeedback && (
              <div className="mb-3 text-[11px] font-zain-bold text-red-500 text-center leading-tight">
                {addKeyError}
              </div>
            )}

            {/* Action Buttons - Capsule Pill Buttons matching Story Lock Dialog */}
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleTestNewKeyInDialog}
                disabled={isTestingNewKey || isSavingKey || !newKeyInput.trim()}
                className="font-zain-bold text-xs border active:scale-95 transition-all flex items-center justify-center cursor-pointer disabled:opacity-40 gap-1"
                style={{
                  height: "34px",
                  padding: "0 14px",
                  borderRadius: "9999px",
                  backgroundColor: `${currentTheme.accent}12`,
                  borderColor: `${currentTheme.accent}30`,
                  color: currentTheme.accent,
                  whiteSpace: "nowrap",
                }}
              >
                {isTestingNewKey ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Wifi className="w-3 h-3" />
                )}
                <span>{isTestingNewKey ? "جارٍ الفحص..." : "فحص الاتصال"}</span>
              </button>

              <button
                onClick={handleSaveNewKey}
                disabled={isSavingKey}
                className="font-zain-bold text-xs text-white shadow-sm active:scale-95 transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
                style={{
                  height: "34px",
                  padding: "0 20px",
                  borderRadius: "9999px",
                  backgroundColor: currentTheme.accent,
                  whiteSpace: "nowrap",
                }}
              >
                {isSavingKey ? "جارٍ الحفظ..." : "حفظ"}
              </button>

              <button
                onClick={() => {
                  setShowAddKeyDialog(false);
                  setNewKeyInput("");
                  setNewKeyLabel("");
                  setAddKeyError(null);
                  setNewKeyTestFeedback(null);
                }}
                disabled={isSavingKey}
                className="font-zain-bold text-xs active:scale-95 transition-all cursor-pointer opacity-70 hover:opacity-100 flex items-center justify-center"
                style={{
                  height: "34px",
                  padding: "0 14px",
                  borderRadius: "9999px",
                  color: currentTheme.secondary,
                  whiteSpace: "nowrap",
                }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── نافذة تأكيد حذف مفتاح (Delete Confirmation Dialog) ─── */}
      {keyToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="border flex flex-col items-center animate-in zoom-in-95 duration-200"
            style={{
              width: "280px",
              maxWidth: "calc(100vw - 32px)",
              borderRadius: "28px",
              padding: "24px 20px",
              backgroundColor: currentTheme.bg,
              borderColor: currentTheme.border,
              boxShadow: `0 20px 45px -10px ${currentTheme.shadow || "rgba(0,0,0,0.3)"}`,
            }}
          >
            {/* Top Icon */}
            <div className="flex justify-center mb-3">
              <Trash2
                className="w-7 h-7"
                style={{ color: "#dc2626" }}
                strokeWidth={2}
              />
            </div>

            {/* Dialog Title */}
            <h2
              className="text-base font-zain-xbold mb-1 leading-tight text-center"
              style={{ color: currentTheme.text }}
            >
              حذف مفتاح الاتصال
            </h2>

            {/* Description */}
            <p
              className="text-xs font-zain-reg mb-4 opacity-70 leading-relaxed text-center px-1"
              style={{ color: currentTheme.text }}
            >
              هل ترغبين في حذف {keyToDelete.label ? `"${keyToDelete.label}"` : "هذا المفتاح"} نهائياً من قائمة مفاتيح المساعد الأدبي؟
            </p>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleConfirmDeleteKey}
                className="font-zain-bold text-xs text-white shadow-sm active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                style={{
                  height: "34px",
                  padding: "0 22px",
                  borderRadius: "9999px",
                  backgroundColor: "#dc2626",
                  whiteSpace: "nowrap",
                }}
              >
                حذف
              </button>
              <button
                onClick={() => setKeyToDelete(null)}
                className="font-zain-bold text-xs active:scale-95 transition-all cursor-pointer opacity-70 hover:opacity-100 flex items-center justify-center"
                style={{
                  height: "34px",
                  padding: "0 16px",
                  borderRadius: "9999px",
                  color: currentTheme.secondary,
                  whiteSpace: "nowrap",
                }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
