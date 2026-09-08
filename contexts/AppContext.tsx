import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  useEffect,
} from "react";
import type {
  PrayerState,
} from "../lib/prayer-config";

// --- Shared Type Definitions ---
export interface NoteStyles {
  fontSize: number;
  fontWeight: number;
  textAlign: "right" | "center" | "left" | "justify"; // <-- إضافة الضبط هنا
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
  isLocked?: boolean; // هل الحكاية مغلقة؟
  password?: string; // كلمة المرور (تعمل محلياً)
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
export type ThemeMode = "modern_studio" | "royal_classic" | "night_whisper";

export interface ThemeColors {
  mode: ThemeMode;
  bg: string; // Main Background
  text: string; // Main Text
  accent: string; // Golden/Highlight
  secondary: string; // Faded text
  glass: string; // Glass background color
  border: string; // Border color
  shadow: string; // Shadow color
  isDark: boolean;
}

const themes: Record<ThemeMode, ThemeColors> = {
  modern_studio: {
    mode: "modern_studio",
    bg: "#F4F1EA", // Porcelain
    text: "#2C3E30", // Greyish Olive
    accent: "#A7AA63", // Gold
    secondary: "#5A6A5E",
    glass: "rgba(244, 241, 234, 0.85)",
    border: "rgba(44, 62, 48, 0.1)",
    shadow: "rgba(44, 62, 48, 0.05)",
    isDark: false,
  },
  royal_classic: {
    mode: "royal_classic",
    bg: "#EAE6D2", // Classic Cream
    text: "#121A1B", // Deep Oil/Black
    accent: "#A7AA63",
    secondary: "#4A5556",
    glass: "rgba(234, 230, 210, 0.9)",
    border: "rgba(18, 26, 27, 0.1)",
    shadow: "rgba(0, 0, 0, 0.1)",
    isDark: false,
  },
  night_whisper: {
    mode: "night_whisper",
    bg: "#0F1617", // Very Dark Oil
    text: "#EAE6D2", // Cream text
    accent: "#A7AA63",
    secondary: "#8899A6",
    glass: "rgba(15, 22, 23, 0.85)",
    border: "rgba(255, 255, 255, 0.1)",
    shadow: "rgba(0, 0, 0, 0.5)",
    isDark: true,
  },
};

// --- Context Type ---
interface AppContextType {
  notes: Note[];
  currentView: "home" | "editor" | "settings" | "prayer" | "locationPicker";
  selectedNote: Note | null;
  currentTheme: ThemeColors; // Added Theme
  isSelectionMode: boolean; // Deletion / selection mode active
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
  toggleTheme: (mode: ThemeMode) => void; // Added Theme Toggle
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
    return "modern_studio";
  });

  // Initialize Prayer State from LocalStorage (كما في الإنتاج)
  const [prayerState, setPrayerState] = useState<PrayerState>(() => {
    if (typeof window !== "undefined") {
      try {
        const savedLocation = localStorage.getItem("dar_prayer_location");
        const savedSettings = localStorage.getItem("dar_prayer_settings");
        const location = savedLocation ? JSON.parse(savedLocation) : null;
        const settings = savedSettings ? JSON.parse(savedSettings) : {};
        return {
          location,
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

  // Persist Theme to LocalStorage & update dark class
  useEffect(() => {
    localStorage.setItem("dar_theme", themeMode);
    if (typeof document !== "undefined") {
      if (currentTheme.isDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, [themeMode, currentTheme.isDark]);

  // تحديث حالة المواقيت + التخزين المستمر (كما في الإنتاج)
  const updatePrayerState = (
    partial: Partial<import("../lib/prayer-config").PrayerState>
  ) => {
    setPrayerState((prev) => {
      const next = { ...prev, ...partial };
      if (partial.location) {
        localStorage.setItem(
          "dar_prayer_location",
          JSON.stringify(next.location)
        );
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
    // Strip HTML tags so the home list previews are pristine and text-only
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
                    : n.isLocked, // Keep existing lock state if not provided
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
