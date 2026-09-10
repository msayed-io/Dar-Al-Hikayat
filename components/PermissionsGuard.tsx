import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Bell,
  AlarmClock,
  MapPin,
  Check,
  ChevronLeft,
  X,
  Loader2,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Geolocation } from "@capacitor/geolocation";
import { useApp } from "../contexts/AppContext";
import {
  checkNotificationPermission,
  requestNotificationPermission,
  requestExactAlarmPermission,
  checkExactAlarmPermission,
  openNativeNotificationSettings,
  autoDetectLocation,
  schedulePrayerAlarms,
} from "../lib/prayer-alarms";

interface PermissionsGuardProps {
  children: React.ReactNode;
}

type StepKey = "notifications" | "exactAlarms" | "location" | "completed";

export const PermissionsGuard: React.FC<PermissionsGuardProps> = ({ children }) => {
  const { currentTheme, prayerState, updatePrayerState } = useApp();
  const [showSheet, setShowSheet] = useState(false);
  const [currentStep, setCurrentStep] = useState<StepKey>("notifications");
  const [isProcessing, setIsProcessing] = useState(false);
  const [stepSuccessPulse, setStepSuccessPulse] = useState(false);
  const [needsManualSettings, setNeedsManualSettings] = useState(false);
  const isCheckingRef = useRef(false);

  // تحقق شامل وتحديث الخطوة الحالية بدقة
  const evaluatePermissions = useCallback(async (): Promise<{
    notifications: boolean;
    exactAlarms: boolean;
    location: boolean;
  }> => {
    if (Capacitor.getPlatform() !== "android") {
      return { notifications: true, exactAlarms: true, location: true };
    }

    try {
      const notif = await checkNotificationPermission();
      const alarm = await checkExactAlarmPermission();
      const geoPerm = await Geolocation.checkPermissions();
      const loc = geoPerm.location === "granted";

      return {
        notifications: notif,
        exactAlarms: alarm,
        location: loc,
      };
    } catch (e) {
      console.error("Error evaluating permissions:", e);
      return { notifications: false, exactAlarms: false, location: false };
    }
  }, []);

  // تحديد الخطوة التالية غير المفعلة
  const resolveActiveStep = useCallback(
    (perms: { notifications: boolean; exactAlarms: boolean; location: boolean }): StepKey => {
      if (!perms.notifications) return "notifications";
      if (!perms.exactAlarms) return "exactAlarms";
      if (!perms.location) return "location";
      return "completed";
    },
    []
  );

  // الفحص الأولي عند تشغيل التطبيق
  useEffect(() => {
    if (Capacitor.getPlatform() !== "android") {
      setShowSheet(false);
      return;
    }

    const initCheck = async () => {
      const alreadyDone = localStorage.getItem("dar_onboarding_completed") === "true";
      if (alreadyDone) {
        setShowSheet(false);
        return;
      }

      const perms = await evaluatePermissions();
      const nextStep = resolveActiveStep(perms);

      if (nextStep === "completed") {
        localStorage.setItem("dar_onboarding_completed", "true");
        setShowSheet(false);
      } else {
        setCurrentStep(nextStep);
        setShowSheet(true);
      }
    };

    initCheck();
  }, [evaluatePermissions, resolveActiveStep]);

  // إعادة الفحص التلقائي بمجرد رجوع المستخدم للتطبيق من إعدادات النظام (App Resume / Focus)
  const handleAppResume = useCallback(async () => {
    if (isCheckingRef.current || !showSheet) return;
    isCheckingRef.current = true;

    try {
      const perms = await evaluatePermissions();
      const nextStep = resolveActiveStep(perms);

      // إذا كانت الخطوة السابقة قد تفعلت بنجاح أثناء غياب المستخدم
      if (nextStep !== currentStep && currentStep !== "completed") {
        setStepSuccessPulse(true);
        setNeedsManualSettings(false);
        setTimeout(() => {
          setStepSuccessPulse(false);
          setCurrentStep(nextStep);
          if (nextStep === "completed") {
            handleFinishOnboarding();
          }
        }, 600);
      }
    } finally {
      isCheckingRef.current = false;
    }
  }, [showSheet, currentStep, evaluatePermissions, resolveActiveStep]);

  useEffect(() => {
    if (Capacitor.getPlatform() !== "android") return;

    let appListenerHandle: any = null;
    CapApp.addListener("appStateChange", (state) => {
      if (state.isActive) {
        handleAppResume();
      }
    }).then((handle) => {
      appListenerHandle = handle;
    });

    window.addEventListener("focus", handleAppResume);

    return () => {
      if (appListenerHandle) {
        appListenerHandle.remove();
      }
      window.removeEventListener("focus", handleAppResume);
    };
  }, [handleAppResume]);

  // معالجة الخطوة 1: طلب إذن الإشعارات
  const handleActivateNotifications = async () => {
    setIsProcessing(true);
    setNeedsManualSettings(false);
    try {
      const granted = await requestNotificationPermission();
      if (granted) {
        setStepSuccessPulse(true);
        setTimeout(async () => {
          setStepSuccessPulse(false);
          const perms = await evaluatePermissions();
          const next = resolveActiveStep(perms);
          setCurrentStep(next);
          if (next === "completed") handleFinishOnboarding();
        }, 600);
      } else {
        // إذا رفض المستخدم، نوفر زر الانتقال المباشر للإعدادات
        setNeedsManualSettings(true);
      }
    } catch (e) {
      console.error("Activate notifications error:", e);
      setNeedsManualSettings(true);
    } finally {
      setIsProcessing(false);
    }
  };

  // معالجة الخطوة 2: طلب إذن المنبهات الدقيقة
  const handleActivateExactAlarms = async () => {
    setIsProcessing(true);
    try {
      const granted = await requestExactAlarmPermission();
      if (granted) {
        setStepSuccessPulse(true);
        setTimeout(async () => {
          setStepSuccessPulse(false);
          const perms = await evaluatePermissions();
          const next = resolveActiveStep(perms);
          setCurrentStep(next);
          if (next === "completed") handleFinishOnboarding();
        }, 600);
      }
    } catch (e) {
      console.error("Activate exact alarms error:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  // معالجة الخطوة 3: تحديد الموقع عبر GPS
  const handleActivateLocation = async () => {
    setIsProcessing(true);
    try {
      const geoPerm = await Geolocation.requestPermissions();
      if (geoPerm.location === "granted") {
        try {
          const loc = await autoDetectLocation();
          updatePrayerState({ location: loc });
          await schedulePrayerAlarms(loc, prayerState.method);
        } catch (gpsErr) {
          console.warn("GPS lookup fallback:", gpsErr);
        }
        setStepSuccessPulse(true);
        setTimeout(() => {
          setStepSuccessPulse(false);
          setCurrentStep("completed");
          handleFinishOnboarding();
        }, 600);
      } else {
        // إذا رفض المستخدم إذن الموقع، نكمل مع الموقع الافتراضي الحالي
        handleFinishOnboarding();
      }
    } catch (e) {
      console.error("Activate location error:", e);
      handleFinishOnboarding();
    } finally {
      setIsProcessing(false);
    }
  };

  // إنهاء التهيئة وجدولة المنبهات وإغلاق البطاقة
  const handleFinishOnboarding = () => {
    localStorage.setItem("dar_onboarding_completed", "true");
    if (prayerState.location) {
      schedulePrayerAlarms(prayerState.location, prayerState.method).catch((e) => {
        console.warn("Auto schedule on onboarding close failed:", e);
      });
    }
    setTimeout(() => {
      setShowSheet(false);
    }, 700);
  };

  // تخطي مؤقت
  const handleDismiss = () => {
    localStorage.setItem("dar_onboarding_completed", "true");
    setShowSheet(false);
    if (prayerState.location) {
      schedulePrayerAlarms(prayerState.location, prayerState.method).catch(() => {});
    }
  };

  const getStepNumber = () => {
    switch (currentStep) {
      case "notifications":
        return { current: 1, total: 3 };
      case "exactAlarms":
        return { current: 2, total: 3 };
      case "location":
        return { current: 3, total: 3 };
      case "completed":
        return { current: 3, total: 3 };
    }
  };

  const stepMeta = getStepNumber();

  return (
    <>
      {/* التطبيق يعمل دائماً في الخلفية بدون حجب */}
      {children}

      {/* البطاقة السفلية التفاعلية للتهيئة خطوة بخطوة */}
      <AnimatePresence>
        {showSheet && (
          <div className="fixed inset-0 z-[120] flex items-end justify-center pointer-events-auto p-0 select-none">
            {/* الخلفية المظلمة الشفافة ذات التغبيش */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={handleDismiss}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
            />

            {/* الحاوية السفلية بتصميم Apple المتناسق */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="relative w-full max-w-lg overflow-hidden border-t shadow-2xl z-10"
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
              dir="rtl"
            >
              {/* مقبض السحب العلوي (Drag Handle) */}
              <div className="flex justify-center pt-3 pb-1">
                <div
                  className="w-12 h-1.5 rounded-full opacity-35"
                  style={{ backgroundColor: currentTheme.text }}
                />
              </div>

              {/* صف الترويسة: زر الإغلاق + العنوان + كبسولة التقدم */}
              <div className="px-5 pt-2 pb-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="w-8 h-8 rounded-full border flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  style={{
                    backgroundColor: currentTheme.isDark
                      ? "rgba(255,255,255,0.08)"
                      : "rgba(0,0,0,0.05)",
                    borderColor: currentTheme.border,
                    color: currentTheme.text,
                  }}
                  title="تخطي"
                  aria-label="تخطي"
                >
                  <X className="w-4 h-4" />
                </button>

                <h2
                  className="font-zain-xbold text-lg leading-tight text-center"
                  style={{ color: currentTheme.text }}
                >
                  تهيئة التنبيهات والأذونات
                </h2>

                {/* كبسولة الخطوة الحالية */}
                <div
                  className="rounded-full border text-xs font-zain-bold px-2.5 py-1"
                  style={{
                    backgroundColor: `${currentTheme.accent}15`,
                    borderColor: `${currentTheme.accent}30`,
                    color: currentTheme.accent,
                  }}
                >
                  {currentStep === "completed"
                    ? "مكتمل"
                    : `الخطوة ${stepMeta.current} من ${stepMeta.total}`}
                </div>
              </div>

              {/* مؤشر الخطوات الدائري المصغر */}
              <div className="flex items-center justify-center gap-1.5 pt-1 pb-3">
                {[1, 2, 3].map((stepIdx) => {
                  const isActive = stepMeta.current === stepIdx;
                  const isDone = stepMeta.current > stepIdx || currentStep === "completed";
                  return (
                    <div
                      key={stepIdx}
                      className="h-1.5 rounded-full transition-all duration-300"
                      style={{
                        width: isActive ? "24px" : "8px",
                        backgroundColor: isDone || isActive
                          ? currentTheme.accent
                          : currentTheme.isDark
                          ? "rgba(255,255,255,0.2)"
                          : "rgba(0,0,0,0.15)",
                      }}
                    />
                  );
                })}
              </div>

              {/* محتوى الخطوة الواحدة (تفعيل واحد فقط في كل مرة) */}
              <div className="px-5 pb-4">
                <AnimatePresence mode="wait">
                  {/* ── الخطوة 1: إشعارات الصلوات ── */}
                  {currentStep === "notifications" && (
                    <motion.div
                      key="step-notifications"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      transition={{ duration: 0.22 }}
                      className="flex flex-col items-center text-center py-4 px-2 w-full"
                    >
                      <div
                        className="w-14 h-14 rounded-full flex items-center justify-center border shadow-xs mb-4 transition-transform"
                        style={{
                          backgroundColor: stepSuccessPulse
                            ? "rgba(34, 197, 94, 0.18)"
                            : `${currentTheme.accent}15`,
                          borderColor: stepSuccessPulse
                            ? "rgba(34, 197, 94, 0.4)"
                            : `${currentTheme.accent}30`,
                          color: stepSuccessPulse ? "#16a34a" : currentTheme.accent,
                        }}
                      >
                        {stepSuccessPulse ? (
                          <Check className="w-7 h-7 text-green-600 animate-scale" />
                        ) : (
                          <Bell className="w-6 h-6" />
                        )}
                      </div>

                      <h3
                        className="font-zain-xbold text-lg mb-1.5"
                        style={{ color: currentTheme.text }}
                      >
                        إشعارات الصلوات والأذكار
                      </h3>

                      <p
                        className="font-zain-reg text-sm opacity-80 mb-6 max-w-xs leading-relaxed"
                        style={{ color: currentTheme.secondary }}
                      >
                        تفعيل إشعارات الأذان المكتوب والتذكيرات لتنبيهك بمواقيت الصلاة بدقة.
                      </p>

                      <button
                        type="button"
                        onClick={handleActivateNotifications}
                        disabled={isProcessing || stepSuccessPulse}
                        className="w-full h-11 rounded-full font-zain-bold text-sm shadow-sm transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                        style={{
                          backgroundColor: currentTheme.accent,
                          color: currentTheme.isDark ? "#111" : "#fff",
                          opacity: isProcessing ? 0.75 : 1,
                        }}
                      >
                        {isProcessing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : stepSuccessPulse ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Bell className="w-4 h-4" />
                        )}
                        <span>
                          {stepSuccessPulse
                            ? "تم تفعيل الإشعارات بنجاح"
                            : "تفعيل إشعارات الصلوات"}
                        </span>
                      </button>

                      {needsManualSettings && (
                        <button
                          type="button"
                          onClick={() => openNativeNotificationSettings()}
                          className="mt-3 text-xs font-zain-bold flex items-center gap-1.5 opacity-85 hover:opacity-100 transition-opacity cursor-pointer"
                          style={{ color: currentTheme.accent }}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>فتح إعدادات إشعارات التطبيق في الهاتف</span>
                        </button>
                      )}
                    </motion.div>
                  )}

                  {/* ── الخطوة 2: المنبهات الدقيقة وتخطي الخمول ── */}
                  {currentStep === "exactAlarms" && (
                    <motion.div
                      key="step-exactAlarms"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      transition={{ duration: 0.22 }}
                      className="flex flex-col items-center text-center py-4 px-2 w-full"
                    >
                      <div
                        className="w-14 h-14 rounded-full flex items-center justify-center border shadow-xs mb-4 transition-transform"
                        style={{
                          backgroundColor: stepSuccessPulse
                            ? "rgba(34, 197, 94, 0.18)"
                            : `${currentTheme.accent}15`,
                          borderColor: stepSuccessPulse
                            ? "rgba(34, 197, 94, 0.4)"
                            : `${currentTheme.accent}30`,
                          color: stepSuccessPulse ? "#16a34a" : currentTheme.accent,
                        }}
                      >
                        {stepSuccessPulse ? (
                          <Check className="w-7 h-7 text-green-600 animate-scale" />
                        ) : (
                          <AlarmClock className="w-6 h-6" />
                        )}
                      </div>

                      <h3
                        className="font-zain-xbold text-lg mb-1.5"
                        style={{ color: currentTheme.text }}
                      >
                        المنبهات الدقيقة
                      </h3>

                      <p
                        className="font-zain-reg text-sm opacity-80 mb-6 max-w-xs leading-relaxed"
                        style={{ color: currentTheme.secondary }}
                      >
                        تفعيل إذن المنبه الدقيق لتنبيهك في وقت الأذان بدقة فائقة وتخطي وضع سكون الهاتف.
                      </p>

                      <button
                        type="button"
                        onClick={handleActivateExactAlarms}
                        disabled={isProcessing || stepSuccessPulse}
                        className="w-full h-11 rounded-full font-zain-bold text-sm shadow-sm transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                        style={{
                          backgroundColor: currentTheme.accent,
                          color: currentTheme.isDark ? "#111" : "#fff",
                          opacity: isProcessing ? 0.75 : 1,
                        }}
                      >
                        {isProcessing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : stepSuccessPulse ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <AlarmClock className="w-4 h-4" />
                        )}
                        <span>
                          {stepSuccessPulse
                            ? "تم تفعيل المنبهات الدقيقة"
                            : "تفعيل المنبه الدقيق"}
                        </span>
                      </button>

                      <p
                        className="mt-3 text-[11px] font-zain-reg opacity-65 max-w-xs"
                        style={{ color: currentTheme.secondary }}
                      >
                        سيتم توجيهك لشاشة الإعدادات لتفعيل الخيار، ثم العودة تلقائياً.
                      </p>
                    </motion.div>
                  )}

                  {/* ── الخطوة 3: تحديد الموقع الجغرافي ── */}
                  {currentStep === "location" && (
                    <motion.div
                      key="step-location"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      transition={{ duration: 0.22 }}
                      className="flex flex-col items-center text-center py-4 px-2 w-full"
                    >
                      <div
                        className="w-14 h-14 rounded-full flex items-center justify-center border shadow-xs mb-4 transition-transform"
                        style={{
                          backgroundColor: stepSuccessPulse
                            ? "rgba(34, 197, 94, 0.18)"
                            : `${currentTheme.accent}15`,
                          borderColor: stepSuccessPulse
                            ? "rgba(34, 197, 94, 0.4)"
                            : `${currentTheme.accent}30`,
                          color: stepSuccessPulse ? "#16a34a" : currentTheme.accent,
                        }}
                      >
                        {stepSuccessPulse ? (
                          <Check className="w-7 h-7 text-green-600 animate-scale" />
                        ) : (
                          <MapPin className="w-6 h-6" />
                        )}
                      </div>

                      <h3
                        className="font-zain-xbold text-lg mb-1.5"
                        style={{ color: currentTheme.text }}
                      >
                        تحديد الموقع الجغرافي
                      </h3>

                      <p
                        className="font-zain-reg text-sm opacity-80 mb-6 max-w-xs leading-relaxed"
                        style={{ color: currentTheme.secondary }}
                      >
                        تحديد موقعك الجغرافي تلقائياً لضبط وحساب مواقيت الصلاة بدقة متناهية.
                      </p>

                      <button
                        type="button"
                        onClick={handleActivateLocation}
                        disabled={isProcessing || stepSuccessPulse}
                        className="w-full h-11 rounded-full font-zain-bold text-sm shadow-sm transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                        style={{
                          backgroundColor: currentTheme.accent,
                          color: currentTheme.isDark ? "#111" : "#fff",
                          opacity: isProcessing ? 0.75 : 1,
                        }}
                      >
                        {isProcessing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : stepSuccessPulse ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <MapPin className="w-4 h-4" />
                        )}
                        <span>
                          {stepSuccessPulse
                            ? "تم استشعار الموقع بنجاح"
                            : "تحديد الموقع تلقائياً (GPS)"}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleFinishOnboarding}
                        className="mt-3 text-xs font-zain-bold opacity-75 hover:opacity-100 transition-opacity cursor-pointer"
                        style={{ color: currentTheme.text }}
                      >
                        الاستمرار بالموقع الافتراضي ({prayerState.location?.cityNameAr || "القاهرة"})
                      </button>
                    </motion.div>
                  )}

                  {/* ── حالة الاكتمال والاحتفال ── */}
                  {currentStep === "completed" && (
                    <motion.div
                      key="step-completed"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      transition={{ duration: 0.22 }}
                      className="flex flex-col items-center text-center py-4 px-2 w-full"
                    >
                      <div
                        className="w-14 h-14 rounded-full flex items-center justify-center border shadow-xs mb-4"
                        style={{
                          backgroundColor: "rgba(34, 197, 94, 0.18)",
                          borderColor: "rgba(34, 197, 94, 0.4)",
                          color: "#16a34a",
                        }}
                      >
                        <Sparkles className="w-6 h-6 text-green-600 animate-bounce" />
                      </div>

                      <h3
                        className="font-zain-xbold text-lg mb-1.5"
                        style={{ color: currentTheme.text }}
                      >
                        اكتملت التهيئة بنجاح
                      </h3>

                      <p
                        className="font-zain-reg text-sm opacity-80 mb-6 max-w-xs leading-relaxed"
                        style={{ color: currentTheme.secondary }}
                      >
                        تم ضبط منبهات الأذان وجدولة مواقيت الصلاة بدقة متناهية.
                      </p>

                      <button
                        type="button"
                        onClick={handleFinishOnboarding}
                        className="w-full h-11 rounded-full font-zain-bold text-sm shadow-sm transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                        style={{
                          backgroundColor: currentTheme.accent,
                          color: currentTheme.isDark ? "#111" : "#fff",
                        }}
                      >
                        <Check className="w-4 h-4" />
                        <span>ابدأ استخدام دَارُ الحِكَايَاتِ</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* زر تخطي مؤقتاً في أسفل البطاقة */}
              {currentStep !== "completed" && (
                <div className="flex justify-center pt-1 pb-1">
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="text-xs font-zain-bold opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
                    style={{ color: currentTheme.text }}
                  >
                    تخطي التهيئة مؤقتاً (يمكنك ضبطها لاحقاً من الإعدادات)
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default PermissionsGuard;
