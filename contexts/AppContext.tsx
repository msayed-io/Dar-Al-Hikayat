import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  useEffect,
} from "react";
import type {
  PrayerState,
  PrayerLocation,
} from "../lib/prayer-config";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import {
  schedulePrayerAlarms,
  performSilentResumeLocationRefresh,
  clearAllLocationCache,
  getLastSavedLocation,
  saveSavedLocation,
} from "../lib/prayer-alarms";

export interface NoteStyles {
  fontSize: number;
  fontWeight: number;
  textAlign: "right" | "center" | "left" | "justify";
  textColor: string;
  paperStyleIndex: number;
}

export interface Note {
  id: number;
  title: string;
  content: string;
  preview: string;
  date: string;
  category: string;
  styles: NoteStyles;
  isLocked?: boolean;
  password?: string;
}

export interface NoteSaveData {
  id?: number;
  title: string;
  content: string;
  styles: NoteStyles;
  isLocked?: boolean;
  password?: string;
}

// --- Theme Definitions ---
export type ThemeMode = "royal_classic" | "night_whisper" | "apple_dark";

export interface ThemeColors {
  mode: ThemeMode;
  bg: string;
  text: string;
  accent: string;
  secondary: string;
  glass: string;
  border: string;
  shadow: string;
  isDark: boolean;
}

const themes: Record<ThemeMode, ThemeColors> = {
  royal_classic: {
    mode: "royal_classic",
    bg: "#EAE6D2",
    text: "#121A1B",
    accent: "#A7AA63",
    secondary: "#4A5556",
    glass: "rgba(234, 230, 210, 0.94)",
    border: "rgba(18, 26, 27, 0.1)",
    shadow: "0 4px 24px rgba(18, 26, 27, 0.08), 0 1px 3px rgba(18, 26, 27, 0.06)",
    isDark: false,
  },
  night_whisper: {
    mode: "night_whisper",
    bg: "#111718",
    text: "#E2DFD2",
    accent: "#9FA365",
    secondary: "#7F8C8E",
    glass: "rgba(23, 31, 33, 0.94)",
    border: "rgba(226, 223, 210, 0.09)",
    shadow: "0 4px 30px rgba(0, 0, 0, 0.35), 0 1px 3px rgba(0, 0, 0, 0.5)",
    isDark: true,
  },
  apple_dark: {
    mode: "apple_dark",
    bg: "#000000",
    text: "#F5F5F5",
    accent: "#F5F5F5",
    secondary: "#8E8E93",
    glass: "#1C1C1E",
    border: "rgba(255, 255, 255, 0.08)",
    shadow: "0 4px 30px rgba(0, 0, 0, 0.4), 0 1px 3px rgba(0, 0, 0, 0.6)",
    isDark: true,
  },
};

// --- Context Type ---
interface AppContextType {
  notes: Note[];
  currentView: "home" | "editor" | "settings" | "prayer" | "locationPicker";
  selectedNote: Note | null;
  currentTheme: ThemeColors;
  isSelectionMode: boolean;
  setIsSelectionMode: (active: boolean) => void;
  prayerState: import("../lib/prayer-config").PrayerState;
  updatePrayerState: (
    partial: Partial<import("../lib/prayer-config").PrayerState>
  ) => void;
  openEditor: (note: Note | null) => void;
  backToHome: () => void;
  openSettings: () => void;
  openPrayer: () => void;
  openLocationPicker: (fromView?: "settings" | "prayer") => void;
  closeLocationPicker: () => void;
  isLocationSheetOpen: boolean;
  openLocationSheet: () => void;
  closeLocationSheet: () => void;
  saveNote: (noteData: NoteSaveData) => void;
  deleteNotes: (idsToDelete: number[]) => void;
  toggleTheme: (mode: ThemeMode) => void;
  clearLocationCache: () => void;
}

export type { PrayerLocation, PrayerState, CalculationMethodId } from "../lib/prayer-config";

const AppContext = createContext<AppContextType | undefined>(undefined);

// --- Provider Component ---
export const AppProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [currentView, setCurrentView] = useState<
    "home" | "editor" | "settings" | "prayer" | "locationPicker"
  >("home");
  const [previousLocationView, setPreviousLocationView] = useState<"settings" | "prayer">("settings");
  const [isLocationSheetOpen, setIsLocationSheetOpen] = useState<boolean>(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);

  // Initialize Notes from LocalStorage
  const [notes, setNotes] = useState<Note[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dar_notes");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error("Failed to parse notes:", e);
          return [];
        }
      }
    }
    return [];
  });

  // Initialize Theme from LocalStorage
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("dar_theme") as ThemeMode;
      if (savedTheme && themes[savedTheme]) {
        return savedTheme;
      }
    }
    return "royal_classic";
  });

  // تهيئة حالة الصلاة: الاعتماد الدقيق على الطبقة 2 (آخر موقع تم استشعاره بنجاح وحفظه من الـ GPS)
  const [prayerState, setPrayerState] = useState<PrayerState>(() => {
    if (typeof window !== "undefined") {
      try {
        const savedSettings = localStorage.getItem("dar_prayer_settings");
        const settings = savedSettings ? JSON.parse(savedSettings) : {};
        const savedLoc = getLastSavedLocation();

        return {
          location: savedLoc || null,
          method: settings.method || "egyptian",
          isInitialized: settings.isInitialized || false,
        };
      } catch {
        return { location: null, method: "egyptian", isInitialized: false };
      }
    }
    return { location: null, method: "egyptian", isInitialized: false };
  });

  const currentTheme = themes[themeMode];

  // Persist Notes to LocalStorage
  useEffect(() => {
    localStorage.setItem("dar_notes", JSON.stringify(notes));
  }, [notes]);

  // Persist Theme to LocalStorage & synchronize html/body/root background colors dynamically
  useEffect(() => {
    localStorage.setItem("dar_theme", themeMode);
    if (typeof document !== "undefined") {
      document.documentElement.style.backgroundColor = currentTheme.bg;
      document.body.style.backgroundColor = currentTheme.bg;
      const rootEl = document.getElementById("root");
      if (rootEl) {
        rootEl.style.backgroundColor = currentTheme.bg;
      }

      if (currentTheme.isDark) {
        document.documentElement.classList.add("dark");
        document.body.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
        document.body.classList.remove("dark");
      }

      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute("content", currentTheme.bg);
      }
    }
  }, [themeMode, currentTheme.isDark, currentTheme.bg]);

  // تحديث حالة المواقيت + التخزين المستمر وتغذية الطبقة 2
  const updatePrayerState = (
    partial: Partial<import("../lib/prayer-config").PrayerState>
  ) => {
    setPrayerState((prev) => {
      const locationToSave = partial.location !== undefined ? partial.location : prev.location;

      const next = {
        ...prev,
        ...partial,
        location: locationToSave,
      };

      if (locationToSave) {
        saveSavedLocation(locationToSave);
      }
      if (partial.method || partial.isInitialized !== undefined) {
        localStorage.setItem(
          "dar_prayer_settings",
          JSON.stringify({
            method: next.method,
            isInitialized: next.isInitialized,
          })
        );
      }
      return next;
    });
  };

  // تفريغ كاش وبيانات الموقع بالكامل
  const clearLocationCache = () => {
    clearAllLocationCache();
    updatePrayerState({
      location: null,
    });
  };

  // جدولة منبهات الصلاة تلقائياً عند بدء تشغيل التطبيق أو تحديث الموقع أو طريقة الحساب
  useEffect(() => {
    if (prayerState.location) {
      schedulePrayerAlarms(prayerState.location, prayerState.method).catch((err) => {
        console.warn("Auto-scheduling prayer alarms on startup failed:", err);
      });
    }
  }, [prayerState.location?.latitude, prayerState.location?.longitude, prayerState.method]);

  // طبقة إضافية: تحديث هادئ عند عودة التطبيق للواجهة (Resume)
  useEffect(() => {
    let appListenerHandle: { remove: () => Promise<void> } | null = null;

    const runSilentResumeUpdate = async () => {
      // فقط إذا كان الموقع تم تحديده تلقائياً مسبقاً
      if (!prayerState.location?.isAutoDetected) return;
      try {
        const freshLocation = await performSilentResumeLocationRefresh();
        if (freshLocation) {
          updatePrayerState({ location: freshLocation });
        }
      } catch {
        // بدون إظهار أي خطأ للمستخدم إن فشل — لأن لديه أصلاً موقعاً سابقاً معروضاً
      }
    };

    if (Capacitor.isNativePlatform()) {
      CapApp.addListener("appStateChange", (state) => {
        if (state.isActive) {
          void runSilentResumeUpdate();
        }
      }).then((h) => {
        appListenerHandle = h;
      }).catch(() => {});
    }

    const onVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void runSilentResumeUpdate();
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    return () => {
      appListenerHandle?.remove();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    };
  }, [prayerState.location?.isAutoDetected]);

  const openEditor = (note: Note | null) => {
    setIsSelectionMode(false);
    setSelectedNote(note);
    setCurrentView("editor");
  };

  const backToHome = () => {
    setIsSelectionMode(false);
    setCurrentView("home");
    setSelectedNote(null);
  };

  const openSettings = () => {
    setIsSelectionMode(false);
    setCurrentView("settings");
  };

  const openPrayer = () => {
    setIsSelectionMode(false);
    setCurrentView("prayer");
  };

  const openLocationPicker = (fromView?: "settings" | "prayer") => {
    setIsLocationSheetOpen(false);
    if (fromView) {
      setPreviousLocationView(fromView);
    } else if (currentView === "settings" || currentView === "prayer") {
      setPreviousLocationView(currentView);
    }
    setCurrentView("locationPicker");
  };

  const closeLocationPicker = () => {
    setCurrentView(previousLocationView);
  };

  const openLocationSheet = () => {
    setIsLocationSheetOpen(true);
  };

  const closeLocationSheet = () => {
    setIsLocationSheetOpen(false);
  };

  const toggleTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
  };

  const saveNote = (noteData: NoteSaveData) => {
    const now = new Date();
    const formattedDate = now.toLocaleDateString("ar-EG", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const cleanContent = noteData.content.replace(/<[^>]*>/g, " ").trim();
    const previewText =
      cleanContent.substring(0, 100) +
      (cleanContent.length > 100 ? "..." : "");

    if (noteData.id) {
      setNotes((prevNotes) => {
        const updated = prevNotes.map((n) =>
          n.id === noteData.id
            ? {
                ...n,
                title: noteData.title || "بدون عنوان",
                content: noteData.content,
                preview: previewText,
                date: formattedDate,
                styles: noteData.styles,
                isLocked:
                  noteData.isLocked !== undefined
                    ? noteData.isLocked
                    : n.isLocked,
                password:
                  noteData.password !== undefined
                    ? noteData.password
                    : n.password,
              }
            : n,
        );
        if (currentView === "editor" && selectedNote?.id === noteData.id) {
           const updatedNote = updated.find((n) => n.id === noteData.id);
           if (updatedNote) setSelectedNote(updatedNote);
        }
        return updated;
      });
    } else {
      const newNote: Note = {
        id: Date.now(),
        title: noteData.title || "بدون عنوان",
        content: noteData.content,
        preview: previewText,
        date: formattedDate,
        category: "حكاية جديدة",
        styles: noteData.styles,
        isLocked: noteData.isLocked || false,
        password: noteData.password || "",
      };
      setNotes((prevNotes) => [newNote, ...prevNotes]);
      if (currentView === "editor") {
        setSelectedNote(newNote);
      }
    }
  };

  const deleteNotes = (idsToDelete: number[]) => {
    setNotes((prevNotes) =>
      prevNotes.filter((note) => !idsToDelete.includes(note.id)),
    );
  };

  const value = {
    notes,
    currentView,
    selectedNote,
    currentTheme,
    isSelectionMode,
    setIsSelectionMode,
    prayerState,
    updatePrayerState,
    openEditor,
    backToHome,
    openSettings,
    openPrayer,
    openLocationPicker,
    closeLocationPicker,
    isLocationSheetOpen,
    openLocationSheet,
    closeLocationSheet,
    saveNote,
    deleteNotes,
    toggleTheme,
    clearLocationCache,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// --- Custom Hook for consuming context ---
export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};
