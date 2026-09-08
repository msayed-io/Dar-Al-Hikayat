import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bell, AlarmClock, MapPin, Check, Shield, ArrowLeft, AlertCircle } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { useApp } from "../contexts/AppContext";
import {
  requestNotificationPermission,
  requestExactAlarmPermission,
  checkExactAlarmPermission,
  autoDetectLocation,
  schedulePrayerAlarms,
} from "../lib/prayer-alarms";

interface PermissionsGuardProps {
  children: React.ReactNode;
}

export const PermissionsGuard: React.FC<PermissionsGuardProps> = ({ children }) => {
  const { currentTheme, prayerState, updatePrayerState } = useApp();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [stepStates, setStepStates] = useState({
    notifications: false,
    exactAlarms: false,
    location: false,
  });

  const [loadingStep, setLoadingStep] = useState<string | null>(null);

  // Check current permissions status on mount (Android only)
  useEffect(() => {
    if (Capacitor.getPlatform() !== "android") {
      setShowOnboarding(false);
      return;
    }

    const checkAllPermissions = async () => {
      // 1. Check if onboarding was already completed
      const completed = localStorage.getItem("dar_onboarding_completed") === "true";
      if (completed) {
        setShowOnboarding(false);
        return;
      }

      // 2. Check each permission natively
      try {
        // Notification permission check (Android 13+)
        let notifGranted = false;
        if (typeof Notification !== "undefined" && "permission" in Notification) {
          notifGranted = Notification.permission === "granted";
        } else {
          // Native Capacitor Notification check
          notifGranted = await requestNotificationPermission();
        }

        // Exact alarm check
        const alarmGranted = await checkExactAlarmPermission();

        // Location permission check
        const geoPerm = await Geolocation.checkPermissions();
        const locGranted = geoPerm.location === "granted";

        setStepStates({
          notifications: notifGranted,
          exactAlarms: alarmGranted,
          location: locGranted,
        });

        // If any of the critical permissions are missing, show the beautiful onboarding
        if (!notifGranted || !alarmGranted || !locGranted) {
          setShowOnboarding(true);
        }
      } catch (e) {
        console.error("Error checking permissions on launch:", e);
        setShowOnboarding(true);
      }
    };

    checkAllPermissions();
  }, []);

  // Handler for notification permission
  const handleRequestNotifications = async () => {
    setLoadingStep("notifications");
    try {
      const granted = await requestNotificationPermission();
      setStepStates((prev) => ({ ...prev, notifications: granted }));
    } catch (error) {
      console.error("Notifications request error:", error);
    } finally {
      setLoadingStep(null);
    }
  };

  // Handler for exact alarms
  const handleRequestExactAlarms = async () => {
    setLoadingStep("exactAlarms");
    try {
      const granted = await requestExactAlarmPermission();
      setStepStates((prev) => ({ ...prev, exactAlarms: granted }));
      
      // Since system intents might take the user away, verify again
      setTimeout(async () => {
        const checkAgain = await checkExactAlarmPermission();
        setStepStates((prev) => ({ ...prev, exactAlarms: checkAgain }));
      }, 1000);
    } catch (error) {
      console.error("Exact alarms request error:", error);
    } finally {
      setLoadingStep(null);
    }
  };

  // Handler for Location
  const handleRequestLocation = async () => {
    setLoadingStep("location");
    try {
      const geoPerm = await Geolocation.requestPermissions();
      if (geoPerm.location === "granted") {
        setStepStates((prev) => ({ ...prev, location: true }));
        // Instantly detect location automatically to set correct times
        try {
          const loc = await autoDetectLocation();
          updatePrayerState({ location: loc });
          await schedulePrayerAlarms(loc, prayerState.method);
        } catch (e) {
          console.error("Auto detect location failed inside onboarding:", e);
        }
      }
    } catch (error) {
      console.error("Location request error:", error);
    } finally {
      setLoadingStep(null);
    }
  };

  // Skip / Complete Onboarding
  const handleCompleteOnboarding = () => {
    localStorage.setItem("dar_onboarding_completed", "true");
    setShowOnboarding(false);
  };

  if (!showOnboarding) {
    return <>{children}</>;
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col justify-between overflow-y-auto px-6 py-8 select-none"
      style={{ backgroundColor: currentTheme.bg, color: currentTheme.text }}
      dir="rtl"
    >
      {/* ── Header Decor ── */}
      <div className="flex flex-col items-center text-center mt-6 space-y-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center border shadow-md bg-white/5 animate-pulse"
          style={{ borderColor: currentTheme.border }}
        >
          <Shield className="w-8 h-8" style={{ color: currentTheme.accent }} />
        </div>
        <div>
          <h1 className="text-3xl font-zain-xbold" style={{ color: currentTheme.accent }}>
            تهيئة الحماية والتنبيهات
          </h1>
          <p className="text-base font-zain-reg opacity-75 mt-1 max-w-sm">
            لضمان تشغيل تذكيرات الصلاة والتنزيلات بدقة احترافية تامة، يرجى تفعيل الأذونات التالية:
          </p>
        </div>
      </div>

      {/* ── Permission Cards Grid ── */}
      <div className="my-8 space-y-4 max-w-md mx-auto w-full">
        {/* Step 1: Notifications */}
        <motion.div
          whileTap={{ scale: 0.98 }}
          className="p-4 rounded-3xl border flex items-center justify-between transition-all"
          style={{
            backgroundColor: stepStates.notifications ? `${currentTheme.accent}08` : currentTheme.glass,
            borderColor: stepStates.notifications ? `${currentTheme.accent}50` : currentTheme.border,
          }}
        >
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                stepStates.notifications ? "bg-[#A7AA63]/20" : "bg-black/5 dark:bg-white/5"
              }`}
            >
              <Bell className="w-5 h-5" style={{ color: stepStates.notifications ? currentTheme.accent : currentTheme.text }} />
            </div>
            <div className="text-right">
              <h3 className="font-zain-bold text-lg leading-tight">إشعارات الصلوات والأذكار</h3>
              <p className="font-zain-reg text-xs opacity-60">تنبيهات الآذان المكتوب وصوت التذكير الهادئ</p>
            </div>
          </div>

          <button
            onClick={handleRequestNotifications}
            disabled={stepStates.notifications || loadingStep === "notifications"}
            className="px-4 py-2 rounded-xl text-xs font-zain-bold cursor-pointer transition-all active:scale-95 flex items-center gap-1"
            style={{
              backgroundColor: stepStates.notifications ? `${currentTheme.accent}20` : currentTheme.text,
              color: stepStates.notifications ? currentTheme.accent : currentTheme.bg,
            }}
          >
            {stepStates.notifications ? (
              <>
                <Check className="w-3.5 h-3.5" strokeWidth={3} />
                <span>مفعّل</span>
              </>
            ) : loadingStep === "notifications" ? (
              <span>جاري...</span>
            ) : (
              <span>تفعيل</span>
            )}
          </button>
        </motion.div>

        {/* Step 2: Exact Alarms */}
        <motion.div
          whileTap={{ scale: 0.98 }}
          className="p-4 rounded-3xl border flex items-center justify-between transition-all"
          style={{
            backgroundColor: stepStates.exactAlarms ? `${currentTheme.accent}08` : currentTheme.glass,
            borderColor: stepStates.exactAlarms ? `${currentTheme.accent}50` : currentTheme.border,
          }}
        >
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                stepStates.exactAlarms ? "bg-[#A7AA63]/20" : "bg-black/5 dark:bg-white/5"
              }`}
            >
              <AlarmClock className="w-5 h-5" style={{ color: stepStates.exactAlarms ? currentTheme.accent : currentTheme.text }} />
            </div>
            <div className="text-right">
              <h3 className="font-zain-bold text-lg leading-tight">المنبهات الدقيقة (تخطي الخمول)</h3>
              <p className="font-zain-reg text-xs opacity-60">حماية التنبيهات من الإغلاق عند نوم الهاتف</p>
            </div>
          </div>

          <button
            onClick={handleRequestExactAlarms}
            disabled={stepStates.exactAlarms || loadingStep === "exactAlarms"}
            className="px-4 py-2 rounded-xl text-xs font-zain-bold cursor-pointer transition-all active:scale-95 flex items-center gap-1"
            style={{
              backgroundColor: stepStates.exactAlarms ? `${currentTheme.accent}20` : currentTheme.text,
              color: stepStates.exactAlarms ? currentTheme.accent : currentTheme.bg,
            }}
          >
            {stepStates.exactAlarms ? (
              <>
                <Check className="w-3.5 h-3.5" strokeWidth={3} />
                <span>مفعّل</span>
              </>
            ) : loadingStep === "exactAlarms" ? (
              <span>جاري...</span>
            ) : (
              <span>تفعيل</span>
            )}
          </button>
        </motion.div>

        {/* Step 3: Location */}
        <motion.div
          whileTap={{ scale: 0.98 }}
          className="p-4 rounded-3xl border flex items-center justify-between transition-all"
          style={{
            backgroundColor: stepStates.location ? `${currentTheme.accent}08` : currentTheme.glass,
            borderColor: stepStates.location ? `${currentTheme.accent}50` : currentTheme.border,
          }}
        >
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                stepStates.location ? "bg-[#A7AA63]/20" : "bg-black/5 dark:bg-white/5"
              }`}
            >
              <MapPin className="w-5 h-5" style={{ color: stepStates.location ? currentTheme.accent : currentTheme.text }} />
            </div>
            <div className="text-right">
              <h3 className="font-zain-bold text-lg leading-tight">تحديد الموقع الجغرافي</h3>
              <p className="font-zain-reg text-xs opacity-60">حساب أوقات الصلاة الدقيقة لمدينتك</p>
            </div>
          </div>

          <button
            onClick={handleRequestLocation}
            disabled={stepStates.location || loadingStep === "location"}
            className="px-4 py-2 rounded-xl text-xs font-zain-bold cursor-pointer transition-all active:scale-95 flex items-center gap-1"
            style={{
              backgroundColor: stepStates.location ? `${currentTheme.accent}20` : currentTheme.text,
              color: stepStates.location ? currentTheme.accent : currentTheme.bg,
            }}
          >
            {stepStates.location ? (
              <>
                <Check className="w-3.5 h-3.5" strokeWidth={3} />
                <span>مفعّل</span>
              </>
            ) : loadingStep === "location" ? (
              <span>جاري...</span>
            ) : (
              <span>تفعيل</span>
            )}
          </button>
        </motion.div>
      </div>

      {/* ── Bottom Action Button ── */}
      <div className="flex flex-col items-center space-y-4 w-full max-w-md mx-auto">
        <button
          onClick={handleCompleteOnboarding}
          className="w-full h-12 rounded-2xl font-zain-xbold text-lg border shadow-md flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer active:scale-95 hover:brightness-110"
          style={{
            backgroundColor: currentTheme.text,
            color: currentTheme.bg,
            borderColor: currentTheme.border,
            boxShadow: `0 8px 24px -4px ${currentTheme.shadow}`,
          }}
        >
          <span>استكشاف التطبيق والبدء</span>
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Bypass link with subtext */}
        <button
          onClick={handleCompleteOnboarding}
          className="text-sm font-zain-reg opacity-50 hover:opacity-100 transition-all cursor-pointer underline decoration-dotted"
        >
          تخطي التهيئة مؤقتاً (سأقوم بضبطها لاحقاً)
        </button>

        <div className="flex items-center gap-2 text-xs font-zain-reg text-amber-600 dark:text-amber-400 opacity-80 text-center">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>عدم تفعيل جميع الأذونات قد يسبب توقف تنبيهات الصلاة في الخلفية</span>
        </div>
      </div>
    </div>
  );
};
