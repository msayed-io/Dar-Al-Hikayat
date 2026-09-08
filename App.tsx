import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { BookOpen, Compass, Plus } from "lucide-react";
import DarAlHikayatMaster from "./components/DarAlHikayatEditor";
import HomePage from "./components/HomePage";
import SplashScreen from "./components/SplashScreen";
import SettingsPage from "./components/SettingsPage";
import PrayerPage from "./components/PrayerPage";
import LocationPickerPage from "./components/LocationPickerPage";
import LocationBottomSheet from "./components/LocationBottomSheet";
import { AppProvider, useApp } from "./contexts/AppContext";
import { NativeBiometric } from "@capgo/capacitor-native-biometric";

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
                  className="pointer-events-auto w-12 h-12 rounded-full border shadow-xl flex items-center justify-center backdrop-blur-md transition-all duration-300 hover:scale-110 active:scale-95 flex-shrink-0 cursor-pointer"
                  style={{
                    borderRadius: "9999px",
                    backgroundColor: currentTheme.accent,
                    color: currentTheme.bg,
                    borderColor: currentTheme.border,
                    boxShadow: `0 10px 26px -2px ${currentTheme.accent}55`,
                  }}
                  title="حكاية جديدة"
                >
                  <Plus className="w-5 h-5" strokeWidth={2.6} />
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

  useEffect(() => {
    const lockState = localStorage.getItem("dar_app_lock_enabled") === "true";
    setIsLockEnabled(lockState);

    if (lockState) {
      // authenticate(); // [TEMPORARILY DISABLED] Auto-trigger disabled
      setIsUnlocked(false);
    } else {
      setIsUnlocked(true);
    }

    // Listen for visibility change to re-lock when app comes from background
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        localStorage.getItem("dar_app_lock_enabled") === "true"
      ) {
        setIsUnlocked(false);
        // authenticate(); // [TEMPORARILY DISABLED] Auto-trigger disabled
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const authenticate = async () => {
    // [TEMPORARY BYPASS] - Allow entering just by clicking
    console.log("Temporary bypass: Unlocking app without native biometric");
    setIsUnlocked(true);
    return;
    
    try {
      // First check if biometric is available
      const result = await NativeBiometric.isAvailable();
      if (!result.isAvailable) {
        // If not available, we shouldn't block the user (maybe it's web or simulator)
        console.warn("Biometrics not available on this platform");
        setIsUnlocked(true);
        return;
      }

      // Perform authentication
      const authResult = await NativeBiometric.verifyIdentity({
        reason: "يرجى التحقق من هويتك لفتح التطبيق",
        title: "تسجيل الدخول",
        subtitle: "دَارُ الحِكَايَاتِ",
        description: "استخدم البصمة أو الرمز السري",
      });

      // verifyIdentity resolves on success and rejects on failure/cancel
      setIsUnlocked(true);
    } catch (error) {
      console.error("Biometric error or user canceled", error);
      // Don't unlock if it fails or user cancels.
      // On the web, NativeBiometric throws an error because it's not implemented,
      // we will simulate open for development if we catch an unimplemented error.
      if (
        String(error).includes("Unimplemented") ||
        String(error).includes("not implemented")
      ) {
        console.log("Mocking biometric unlock for web development");
        setIsUnlocked(true);
      }
    }
  };

  if (isLockEnabled && !isUnlocked) {
    // The Blank Mask Screen
    return (
      <div
        className="fixed inset-0 z-[200] flex flex-col items-center justify-center transition-all duration-500"
        style={{ backgroundColor: currentTheme.bg }}
        dir="rtl"
      >
        <div className="flex flex-col items-center justify-center max-w-sm w-full p-8 text-center space-y-6">
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

          <h2
            className="text-xl font-zain-bold tracking-wide"
            style={{ color: currentTheme.text }}
          >
            التطبيق مقفل
          </h2>

          <button
            onClick={authenticate}
            className="px-6 py-3 rounded-xl border flex items-center justify-center gap-3 w-full transition-all hover:bg-black/5 active:scale-95 shadow-sm"
            style={{
              borderColor: currentTheme.border,
              color: currentTheme.text,
              backgroundColor: currentTheme.glass,
            }}
          >
            <span className="font-zain-reg text-lg">اضغط لفتح التطبيق</span>
          </button>
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
          <div className="animate-in fade-in duration-700 min-h-screen">
            <AppContent />
          </div>
        </BiometricGuard>
      )}
    </AppProvider>
  );
}

export default App;
