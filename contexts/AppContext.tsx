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
import { StorageService, NoteMetadata } from "../lib/storage-service";

export interface NoteStyles {
  fontSize: number;
  fontWeight: number;
  textAlign: "right" | "center" | "left" | "justify";
  textColor: string;
  paperStyleIndex: number;
  handwriting?: {
    strokes?: any[];
    isPageRuled?: boolean;
    dataUrl?: string;
  };
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
  word_count?: number;
  char_count?: number;
  updated_at?: number;
  created_at?: number;
}

export interface NoteSaveData {
  id?: number;
  title: string;
  content: string;
  styles: NoteStyles;
  category?: string;
  date?: string;
  isLocked?: boolean;
  password?: string;
}

// --- Theme Definitions ---
export type ThemeMode = "royal_classic" | "night_whisper" | "apple_dark";
export type AppleVariant = "default" | "liquid_glass";

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
  isLiquidGlass?: boolean;
  appleVariant?: AppleVariant;
}

const themes: Record<ThemeMode, ThemeColors> = {
  royal_classic: {
    mode: "royal_classic",
    bg: "#EAE6D2",
    text: "#121A1B",
    accent: "#A7AA63",
    secondary: "#4A5556",
    glass: "rgba(244, 241, 228, 0.96)",
    border: "rgba(18, 26, 27, 0.12)",
    shadow: "0 10px 30px -4px rgba(18, 26, 27, 0.12), 0 2px 8px rgba(18, 26, 27, 0.06)",
    isDark: false,
    isLiquidGlass: false,
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
    isLiquidGlass: false,
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
    isLiquidGlass: false,
    appleVariant: "default",
  },
};

// --- Context Type ---
interface AppContextType {
  notes: Note[];
  currentView: "home" | "editor" | "settings" | "prayer" | "locationPicker";
  selectedNote: Note | null;
  currentTheme: ThemeColors;
  appleVariant: AppleVariant;
  setAppleVariant: (variant: AppleVariant) => void;
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
  saveNote: (noteData: NoteSaveData) => Promise<boolean>;
  importNotesBulk: (newNotes: Note[]) => void;
  deleteNotes: (idsToDelete: number[]) => void;
  toggleTheme: (mode: ThemeMode) => void;
  clearLocationCache: () => void;
  reloadNotes: () => Promise<void>;
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

  const [notes, setNotes] = useState<Note[]>([]);
  const [isNotesLoaded, setIsNotesLoaded] = useState(false);

  const reloadNotes = async () => {
    const loadedMeta = await StorageService.loadNotesMetadata();
    setNotes(loadedMeta as Note[]);
  };

  // Initialize Notes Metadata from StorageService
  useEffect(() => {
    const initNotes = async () => {
      const loadedMeta = await StorageService.loadNotesMetadata();
      setNotes(loadedMeta as Note[]);
      setIsNotesLoaded(true);
    };
    initNotes();
  }, []);

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

  const [appleVariant, setAppleVariantState] = useState<AppleVariant>(() => {
    if (typeof window !== "undefined") {
      const savedVariant = localStorage.getItem("dar_apple_variant") as AppleVariant;
      if (savedVariant === "liquid_glass" || savedVariant === "default") {
        return savedVariant;
      }
    }
    return "default";
  });

  const setAppleVariant = (variant: AppleVariant) => {
    setAppleVariantState(variant);
    if (typeof window !== "undefined") {
      localStorage.setItem("dar_apple_variant", variant);
    }
  };

  // Compute theme dynamically with support for Apple Dark Liquid Glass mode
  const currentTheme: ThemeColors = React.useMemo(() => {
    const baseTheme = themes[themeMode];
    if (themeMode === "apple_dark") {
      if (appleVariant === "liquid_glass") {
        return {
          mode: "apple_dark",
          bg: "transparent",
          text: "#FFFFFF",
          accent: "#FFFFFF",
          secondary: "rgba(255, 255, 255, 0.85)",
          glass: "rgba(0, 0, 0, 0.25)",
          border: "rgba(255, 255, 255, 0.35)",
          shadow: "inset 0 4px 20px rgba(255, 255, 255, 0.15), 0 8px 32px rgba(0, 0, 0, 0.2)",
          isDark: true,
          isLiquidGlass: true,
          appleVariant: "liquid_glass",
        };
      }
      return {
        ...baseTheme,
        isLiquidGlass: false,
        appleVariant: "default",
      };
    }
    return {
      ...baseTheme,
      isLiquidGlass: false,
    };
  }, [themeMode, appleVariant]);
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

  const saveNote = async (noteData: NoteSaveData): Promise<boolean> => {
    try {
      const rawContent = (noteData.content || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
      const hasHandwriting = Array.isArray(noteData.styles?.handwriting?.strokes) && noteData.styles.handwriting.strokes.length > 0;
      const hasHandwritingUrl = Boolean(noteData.styles?.handwriting?.dataUrl && noteData.styles.handwriting.dataUrl.length > 50);
      const trimmedTitle = (noteData.title || "").trim();
      const hasTitle = trimmedTitle.length > 0 && trimmedTitle !== "بدون عنوان";

      if (!rawContent && !hasHandwriting && !hasHandwritingUrl && !hasTitle) {
        console.warn("Attempted to save an empty story, operation cancelled.");
        return false;
      }

      const savedMeta = await StorageService.saveStory({
        id: noteData.id,
        title: noteData.title,
        content: noteData.content,
        category: noteData.category || selectedNote?.category,
        date: noteData.date || selectedNote?.date,
        styles: noteData.styles,
        isLocked: noteData.isLocked,
        password: noteData.password,
      });

      const fullNote: Note = {
        ...savedMeta,
        content: noteData.content,
      };

      setNotes((prevNotes) => {
        const existingIndex = prevNotes.findIndex((n) => n.id === fullNote.id);
        if (existingIndex >= 0) {
          const updated = [...prevNotes];
          updated[existingIndex] = fullNote;
          return updated;
        } else {
          return [fullNote, ...prevNotes];
        }
      });

      if (currentView === "editor") {
        setSelectedNote(fullNote);
      }
      return true;
    } catch (err) {
      console.error("Failed to save story:", err);
      alert("حدث خطأ أثناء حفظ الحكاية. يرجى المحاولة مرة أخرى.");
      return false;
    }
  };

  const importNotesBulk = (newNotes: Note[]) => {
    setNotes((prevNotes) => {
      const map = new Map(prevNotes.map((n) => [n.id, n]));
      for (const note of newNotes) {
        map.set(note.id, { ...(map.get(note.id) || {}), ...note });
      }
      return Array.from(map.values()).sort((a, b) => (b.id || 0) - (a.id || 0));
    });
  };

  const deleteNotes = (idsToDelete: number[]) => {
    if (idsToDelete.length === 0) return;
    let prevList: Note[] = [];
    setNotes((prevNotes) => {
      prevList = prevNotes;
      return prevNotes.filter((note) => !idsToDelete.includes(note.id));
    });

    StorageService.deleteStories(idsToDelete).catch((err) => {
      console.error("Failed to delete stories:", err);
      setNotes(prevList);
      alert("حدث خطأ أثناء حذف الحكايات من قاعدة البيانات.");
    });
  };

  // Persist Theme to LocalStorage & synchronize html/body/root background colors dynamically
  useEffect(() => {
    localStorage.setItem("dar_theme", themeMode);
    localStorage.setItem("dar_apple_variant", appleVariant);
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

      if (currentTheme.isLiquidGlass) {
        document.documentElement.classList.add("theme-liquid-glass");
        document.body.classList.add("theme-liquid-glass");
      } else {
        document.documentElement.classList.remove("theme-liquid-glass");
        document.body.classList.remove("theme-liquid-glass");
      }

      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute("content", currentTheme.bg);
      }
    }
  }, [themeMode, appleVariant, currentTheme.isDark, currentTheme.isLiquidGlass, currentTheme.bg]);

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
      if (!prayerState.location?.isAutoDetected) return;
      try {
        const freshLocation = await performSilentResumeLocationRefresh();
        if (freshLocation) {
          updatePrayerState({ location: freshLocation });
        }
      } catch {
        // بدون إظهار أي خطأ للمستخدم إن فشل
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

  const value = {
    notes,
    currentView,
    selectedNote,
    currentTheme,
    appleVariant,
    setAppleVariant,
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
    importNotesBulk,
    deleteNotes,
    toggleTheme,
    clearLocationCache,
    reloadNotes,
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
