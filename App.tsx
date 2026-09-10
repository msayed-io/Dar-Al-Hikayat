import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { BookOpen, Compass, Plus, Feather } from "lucide-react";
import DarAlHikayatMaster from "./components/DarAlHikayatEditor";
import HomePage from "./components/HomePage";
import SplashScreen from "./components/SplashScreen";
import SettingsPage from "./components/SettingsPage";
import PrayerPage from "./components/PrayerPage";
import LocationPickerPage from "./components/LocationPickerPage";
import LocationBottomSheet from "./components/LocationBottomSheet";
import { AppProvider, useApp } from "./contexts/AppContext";
import { NativeBiometric } from "@capgo/capacitor-native-biometric";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { PermissionsGuard } from "./components/PermissionsGuard";

// The main component that manages views and persistent navigation
const AppContent = () => {
  const { currentView, currentTheme, backToHome, openPrayer, openEditor, isSelectionMode } = useApp();

  return (
    <div className="App relative min-h-screen">
      {/* ── Main Tab Screens (Persistent to preserve scroll & state) ── */}
      <div className={currentView === "home" ? "block" : "hidden"}>
        <HomePage />
      </div>

      <div className={currentView === "prayer" ? "block" : "hidden"}>
        <PrayerPage />
      </div>

      {/* ── Fullscreen Overlay Screens ── */}
      {currentView === "settings" && <SettingsPage />}
      {currentView === "editor" && <DarAlHikayatMaster />}
      {currentView === "locationPicker" && <LocationPickerPage />}

      {/* ── Global Location Bottom Action Sheet ── */}
      <LocationBottomSheet />

      {/* ── Unified Persistent Floating Bottom Navigation (Centered with Adjacent Circular FAB) ── */}
      <AnimatePresence>
        {(currentView === "home" || currentView === "prayer") && !isSelectionMode && (
          <motion.footer
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{
              type: "spring",
              stiffness: 240,
              damping: 25,
              mass: 0.8,
            }}
            className="fixed bottom-4 left-0 right-0 z-40 px-4 pointer-events-none flex justify-center items-center gap-3"
          >
            {/* Floating Navigation Capsule */}
            <div
              className="pointer-events-auto h-12 p-1.5 rounded-full border shadow-2xl flex items-center gap-1.5 backdrop-blur-2xl transition-all duration-300"
              style={{
                borderRadius: "9999px",
                backgroundColor: currentTheme.glass,
                borderColor: currentTheme.border,
                boxShadow: `0 12px 32px -4px ${currentTheme.shadow}`,
              }}
            >
              {/* Tab 1: الحكايات */}
              <button
                onClick={backToHome}
                className={`relative h-full flex items-center justify-center gap-2 rounded-full transition-all duration-300 cursor-pointer ${
                  currentView === "home"
                    ? "px-4"
                    : "px-3.5 opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5 active:scale-95"
                }`}
                style={{
                  borderRadius: "9999px",
                  color: currentView === "home" ? currentTheme.accent : currentTheme.text,
                }}
                title="الحكايات"
              >
                {currentView === "home" && (
                  <motion.div
                    layoutId="activeBottomTabPill"
                    className="absolute inset-0 rounded-full border"
                    style={{
                      borderRadius: "9999px",
                      backgroundColor: `${currentTheme.accent}18`,
                      borderColor: `${currentTheme.accent}35`,
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 220,
                      damping: 26,
                      mass: 0.8,
                    }}
                  />
                )}
                <BookOpen className="w-4 h-4 shrink-0 relative z-10" strokeWidth={2.2} />
                <AnimatePresence mode="popLayout">
                  {currentView === "home" && (
                    <motion.div
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 220,
                        damping: 26,
                        mass: 0.8,
                      }}
                      className="relative z-10 overflow-hidden flex items-center"
                    >
                      <span
                        className="font-zain-bold text-xs pt-0.5 whitespace-nowrap pr-0.5"
                        style={{ color: currentTheme.accent }}
                      >
                        الحكايات
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>

              {/* Tab 2: المحراب */}
              <button
                onClick={openPrayer}
                className={`relative h-full flex items-center justify-center gap-2 rounded-full transition-all duration-300 cursor-pointer ${
                  currentView === "prayer"
                    ? "px-4"
                    : "px-3.5 opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5 active:scale-95"
                }`}
                style={{
                  borderRadius: "9999px",
                  color: currentView === "prayer" ? currentTheme.accent : currentTheme.text,
                }}
                title="المحراب"
              >
                {currentView === "prayer" && (
                  <motion.div
                    layoutId="activeBottomTabPill"
                    className="absolute inset-0 rounded-full border"
                    style={{
                      borderRadius: "9999px",
                      backgroundColor: `${currentTheme.accent}18`,
                      borderColor: `${currentTheme.accent}35`,
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 220,
                      damping: 26,
                      mass: 0.8,
                    }}
                  />
                )}
                <Compass className="w-4 h-4 shrink-0 relative z-10" strokeWidth={2.2} />
                <AnimatePresence mode="popLayout">
                  {currentView === "prayer" && (
                    <motion.div
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 220,
                        damping: 26,
                        mass: 0.8,
                      }}
                      className="relative z-10 overflow-hidden flex items-center"
                    >
                      <span
                        className="font-zain-bold text-xs pt-0.5 whitespace-nowrap pr-0.5"
                        style={{ color: currentTheme.accent }}
                      >
                        المحراب
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            </div>

            {/* Standalone Circular Floating Action Button (+) right next to capsule */}
            <AnimatePresence>
              {currentView === "home" && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{ type: "spring", stiffness: 220, damping: 24, mass: 0.8 }}
                  onClick={() => openEditor(null)}
                  className="pointer-events-auto w-12 h-12 rounded-full border flex items-center justify-center backdrop-blur-md transition-all duration-300 hover:scale-105 active:scale-95 flex-shrink-0 cursor-pointer"
                  style={{
                    borderRadius: "9999px",
                    backgroundColor: currentTheme.isDark ? "#1C2526" : currentTheme.accent,
                    color: currentTheme.isDark ? currentTheme.accent : currentTheme.bg,
                    borderColor: currentTheme.isDark ? "rgba(226, 223, 210, 0.15)" : currentTheme.border,
                    boxShadow: currentTheme.isDark
                      ? "0 6px 18px -3px rgba(0, 0, 0, 0.45)"
                      : `0 6px 18px -3px ${currentTheme.shadow}`,
                  }}
                  title="حكاية جديدة"
                >
                  <Feather className="w-5 h-5" strokeWidth={2.2} />
                </motion.button>
              )}
            </AnimatePresence>
          </motion.footer>
        )}
      </AnimatePresence>
    </div>
  );
};

// Component that handles biometric lock
const BiometricGuard: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { currentTheme } = useApp();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLockEnabled, setIsLockEnabled] = useState(false);
  const isAuthenticatingRef = React.useRef(false);
  const lastAuthenticatedAtRef = React.useRef(0);
  const wasInBackgroundRef = React.useRef(false);

  const authenticate = async () => {
    if (isAuthenticatingRef.current) return;
    isAuthenticatingRef.current = true;

    try {
      if (Capacitor.isNativePlatform()) {
        const availResult = await NativeBiometric.isAvailable().catch(() => ({ isAvailable: false }));
        if (!availResult.isAvailable) {
          console.warn("Biometrics hardware not available on this platform");
          lastAuthenticatedAtRef.current = Date.now();
          setIsUnlocked(true);
          return;
        }

        // Perform native Android biometric authentication
        await NativeBiometric.verifyIdentity({
          reason: "يرجى تأكيد هويتك لفتح التطبيق",
          title: "دَارُ الحِكَايَاتِ",
          subtitle: "قفل التطبيق",
          description: "استخدم بصمة الإصبع أو رمز قفل الشاشة",
          useFallback: true,
          maxAttempts: 5,
        });

        lastAuthenticatedAtRef.current = Date.now();
        setIsUnlocked(true);
      } else {
        // Web preview / Browser simulation
        setTimeout(() => {
          lastAuthenticatedAtRef.current = Date.now();
          setIsUnlocked(true);
        }, 300);
      }
    } catch (error) {
      console.log("Biometric verification error or user cancelled:", error);
      setIsUnlocked(false);
    } finally {
      // Keep isAuthenticating flag true for a 800ms cooldown to ignore trailing system resume events
      setTimeout(() => {
        isAuthenticatingRef.current = false;
      }, 800);
    }
  };

  useEffect(() => {
    const checkAndTriggerAuth = () => {
      const lockState = localStorage.getItem("dar_app_lock_enabled") === "true";
      setIsLockEnabled(lockState);

      if (lockState) {
        setIsUnlocked(false);
        // Automatically prompt for fingerprint/biometric immediately
        setTimeout(() => {
          authenticate();
        }, 150);
      } else {
        setIsUnlocked(true);
      }
    };

    checkAndTriggerAuth();

    // Listen for custom event when user toggles lock in Settings
    const handleLockChanged = (e: Event) => {
      const customEvt = e as CustomEvent<{ enabled: boolean }>;
      const isEnabled = customEvt.detail?.enabled ?? (localStorage.getItem("dar_app_lock_enabled") === "true");
      setIsLockEnabled(isEnabled);
      if (isEnabled) {
        setIsUnlocked(false);
        setTimeout(() => {
          authenticate();
        }, 100);
      } else {
        setIsUnlocked(true);
      }
    };

    // Listen for visibility change to re-lock only when returning from actual background
    const handleVisibilityChange = () => {
      const lockEnabled = localStorage.getItem("dar_app_lock_enabled") === "true";
      if (!lockEnabled) return;

      if (document.visibilityState === "hidden") {
        wasInBackgroundRef.current = true;
      } else if (document.visibilityState === "visible") {
        // If we are currently in the middle of authenticating (e.g. system dialog just closed), do NOT re-lock!
        if (isAuthenticatingRef.current) return;
        // If unlocked within the last 2.5 seconds, do NOT re-lock!
        if (Date.now() - lastAuthenticatedAtRef.current < 2500) return;

        if (wasInBackgroundRef.current) {
          wasInBackgroundRef.current = false;
          setIsUnlocked(false);
          setTimeout(() => {
            authenticate();
          }, 150);
        }
      }
    };

    window.addEventListener("dar_app_lock_changed", handleLockChanged);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Native app resume listener
    let resumeHandle: any = null;
    if (Capacitor.isNativePlatform()) {
      CapApp.addListener("appStateChange", ({ isActive }) => {
        const lockEnabled = localStorage.getItem("dar_app_lock_enabled") === "true";
        if (!lockEnabled) return;

        if (!isActive) {
          wasInBackgroundRef.current = true;
        } else {
          // Returning to foreground
          if (isAuthenticatingRef.current) return;
          if (Date.now() - lastAuthenticatedAtRef.current < 2500) return;

          if (wasInBackgroundRef.current) {
            wasInBackgroundRef.current = false;
            setIsUnlocked(false);
            setTimeout(() => {
              authenticate();
            }, 150);
          }
        }
      }).then((handle) => {
        resumeHandle = handle;
      }).catch(() => {});
    }

    return () => {
      window.removeEventListener("dar_app_lock_changed", handleLockChanged);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (resumeHandle) {
        resumeHandle.remove();
      }
    };
  }, []);

  if (isLockEnabled && !isUnlocked) {
    // Pure Clean Lock Screen - NO manual unlock button, auto native prompt & tap-to-retry
    return (
      <div
        onClick={() => authenticate()}
        className="fixed inset-0 z-[200] flex flex-col items-center justify-center transition-all duration-500 cursor-pointer select-none"
        style={{ backgroundColor: currentTheme.bg }}
        dir="rtl"
      >
        <div className="flex flex-col items-center justify-center max-w-sm w-full p-8 text-center space-y-6 pointer-events-none">
          <div
            className="w-24 h-24 rounded-3xl flex items-center justify-center bg-white/5 border shadow-xl animate-pulse"
            style={{ borderColor: currentTheme.border }}
          >
            <img
              src={
                currentTheme.isDark ? "/logo-dark-bg.png" : "/logo-light-bg.png"
              }
              alt="Logo"
              className="w-16 h-16 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </div>

          <div className="space-y-2">
            <h2
              className="text-2xl font-zain-bold tracking-wide"
              style={{ color: currentTheme.text }}
            >
              التطبيق مقفل
            </h2>
            <p
              className="text-sm font-zain-reg opacity-60"
              style={{ color: currentTheme.text }}
            >
              المصادقة ببصمة الإصبع أو نظام حماية الهاتف
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// The root component that wraps everything with the provider
function App() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <AppProvider>
      {showSplash ? (
        <SplashScreen onFinish={() => setShowSplash(false)} />
      ) : (
        <BiometricGuard>
          <PermissionsGuard>
            <div className="animate-in fade-in duration-700 min-h-screen">
              <AppContent />
            </div>
          </PermissionsGuard>
        </BiometricGuard>
      )}
    </AppProvider>
  );
}

export default App;
