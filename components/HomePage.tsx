import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  Plus,
  PenTool,
  BookOpen,
  Feather,
  MoreVertical,
  Menu,
  Grid,
  List,
  CheckSquare,
  Trash2,
  CheckCircle2,
  X,
  BarChart,
  Palette,
  Moon,
  Sun,
  Info,
  ArrowRight,
  ChevronRight,
  Phone,
  Mail,
  Sparkles,
  Download,
  Upload,
  Save,
  Lock,
  Unlock,
  KeyRound,
  Settings,
  Home,
  Compass,
  Clock,
  Flame,
  Award,
  BookHeart,
  Type,
} from "lucide-react";
import { useApp, Note } from "../contexts/AppContext";

const HomePage: React.FC = () => {
  const {
    notes,
    openEditor,
    deleteNotes,
    currentTheme,
    toggleTheme,
    saveNote,
    openSettings,
    openPrayer,
    isSelectionMode,
    setIsSelectionMode,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // --- UI Controls State ---
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [selectedNoteIds, setSelectedNoteIds] = useState<number[]>([]);
  const [showMenu, setShowMenu] = useState(false);

  // --- New Feature State ---
  const [showDashboard, setShowDashboard] = useState(false);
  const [dashboardStats, setDashboardStats] = useState({
    words: 0,
    stories: 0,
    avg: 0,
    chars: 0,
    readingTime: 0,
    thisMonthWords: 0,
    thisMonthStories: 0,
    longestStoryWords: 0,
    writerLevelTitle: "بَذْرَةُ إِلهَام",
    nextMilestone: 500,
    progressPercentage: 0,
  });
  const [showAbout, setShowAbout] = useState(false); // State for About Page
  const [showBackupUI, setShowBackupUI] = useState(false); // State for Backup/Restore UI

  // --- Lock System State ---
  const [unlockModal, setUnlockModal] = useState<{
    show: boolean;
    noteId: number | null;
  }>({ show: false, noteId: null });
  const [unlockPassword, setUnlockPassword] = useState("");
  const [shakeInput, setShakeInput] = useState(false);

  // --- Scroll & UI Visibility State (Matching Editor) ---
  const [showUI, setShowUI] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Refs for long press logic
  const longPressTimerRef = useRef<any>(null);
  const isLongPressRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Powerful Filtering Logic ---
  const filteredNotes = React.useMemo(() => {
    const trimmedSearch = searchTerm.trim().toLowerCase();
    if (!trimmedSearch) {
      return notes;
    }

    // Split search query into individual words
    const searchTerms = trimmedSearch.split(/\s+/).filter(Boolean);

    return notes.filter((note) => {
      const noteText = `${note.title.toLowerCase()} ${note.preview.toLowerCase()}`;
      // The note is a match only if ALL search terms are found within its combined text
      return searchTerms.every((term) => noteText.includes(term));
    });
  }, [notes, searchTerm]);

  // --- Dashboard Statistics Calculation ---
  const calculateDashboardStats = () => {
    const arabicMonths: { [key: string]: number } = {
      يناير: 0,
      فبراير: 1,
      مارس: 2,
      أبريل: 3,
      مايو: 4,
      يونيو: 5,
      يوليو: 6,
      أغسطس: 7,
      سبتمبر: 8,
      أكتوبر: 9,
      نوفمبر: 10,
      ديسمبر: 11,
    };
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let totalWords = 0;
    let totalChars = 0;
    let longestStoryWords = 0;

    notes.forEach((note) => {
      const text = (note.content || note.preview || "")
        .replace(/<[^>]*>/g, "")
        .trim();
      const wordCount = text === "" ? 0 : text.split(/\s+/).length;
      const charCount = text.length;

      totalWords += wordCount;
      totalChars += charCount;
      if (wordCount > longestStoryWords) {
        longestStoryWords = wordCount;
      }
    });

    const totalStories = notes.length;
    const avgWords =
      totalStories > 0 ? Math.round(totalWords / totalStories) : 0;
    const readingTimeMinutes = Math.ceil(totalWords / 200);

    const notesThisMonth = notes.filter((note) => {
      try {
        const parts = note.date.split(" ");
        if (parts.length !== 3) return false;
        const month = arabicMonths[parts[1]];
        const year = parseInt(
          parts[2].replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))),
        );
        return month === currentMonth && year === currentYear;
      } catch {
        return false;
      }
    });

    const wordsThisMonth = notesThisMonth.reduce((sum, note) => {
      const text = (note.content || note.preview || "")
        .replace(/<[^>]*>/g, "")
        .trim();
      return sum + (text === "" ? 0 : text.split(/\s+/).length);
    }, 0);

    const storiesThisMonth = notesThisMonth.length;

    let levelTitle = "بَذْرَةُ إِلهَام";
    let nextMilestone = 500;

    if (totalWords >= 50000) {
      levelTitle = "رَاوِي الدَّار الأَعْظَم";
      nextMilestone = 100000;
    } else if (totalWords >= 20000) {
      levelTitle = "سَارِدُ المَلاحِم";
      nextMilestone = 50000;
    } else if (totalWords >= 5000) {
      levelTitle = "سَاهِرُ القَلَم";
      nextMilestone = 20000;
    } else if (totalWords >= 1000) {
      levelTitle = "حَكَوَاتِيٌّ شَغُوف";
      nextMilestone = 5000;
    } else if (totalWords >= 300) {
      levelTitle = "مُصَمِّمُ الحِكَايَات";
      nextMilestone = 1000;
    }

    const progressPercentage = Math.min(
      100,
      Math.round((totalWords / nextMilestone) * 100),
    );

    setDashboardStats({
      words: totalWords,
      stories: totalStories,
      avg: avgWords,
      chars: totalChars,
      readingTime: readingTimeMinutes,
      thisMonthWords: wordsThisMonth,
      thisMonthStories: storiesThisMonth,
      longestStoryWords,
      writerLevelTitle: levelTitle,
      nextMilestone,
      progressPercentage,
    });
  };

  // --- Backup & Restore Logic ---
  const handleExportBackup = () => {
    const dataStr = JSON.stringify(notes, null, 2);
    const dataUri =
      "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);

    const exportFileDefaultName = `دَارُ_الحِكَايَاتِ_نسخة_احتياطية_${new Date().toISOString().slice(0, 10)}.json`;

    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();
    setShowBackupUI(false);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileObj = event.target.files && event.target.files[0];
    if (!fileObj) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsedNotes = JSON.parse(content) as Note[];

        if (Array.isArray(parsedNotes)) {
          // Validate basic structure
          const validNotes = parsedNotes.filter(
            (n) => n.title && typeof n.content === "string",
          );
          if (validNotes.length > 0) {
            // Import logic: Add new notes, don't overwrite existing IDs if possible,
            // actually re-generating IDs is safer to avoid conflicts, but keeping history is good.
            // Simple approach: Add all as new notes to avoid conflicts
            validNotes.forEach((note) => {
              saveNote({
                title: note.title,
                content: note.content,
                styles: note.styles,
                isLocked: note.isLocked,
                password: note.password,
              });
            });
            alert(`تم استعادة ${validNotes.length} حكاية بنجاح إلى المكتبة.`);
          } else {
            alert("الملف لا يحتوي على حكايات صالحة.");
          }
        }
      } catch (error) {
        console.error(error);
        alert("حدث خطأ أثناء قراءة ملف النسخة الاحتياطية.");
      }
    };
    reader.readAsText(fileObj);
    setShowBackupUI(false);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // --- Lock System Logic ---
  const handleUnlockAttempt = () => {
    const targetNote = notes.find((n) => n.id === unlockModal.noteId);
    if (targetNote && targetNote.password === unlockPassword) {
      setUnlockModal({ show: false, noteId: null });
      setUnlockPassword("");
      openEditor(targetNote);
    } else {
      setShakeInput(true);
      setTimeout(() => setShakeInput(false), 400);
    }
  };

  // --- Handlers ---
  const toggleSelectionMode = () => {
    if (isSelectionMode) {
      setIsSelectionMode(false);
      setSelectedNoteIds([]);
    } else {
      setIsSelectionMode(true);
      setShowMenu(false);
    }
  };

  const toggleViewMode = () => {
    setViewMode((prev) => (prev === "list" ? "grid" : "list"));
    setShowMenu(false);
  };

  const toggleDashboard = () => {
    if (!showDashboard) {
      calculateDashboardStats();
    }
    setShowDashboard(!showDashboard);
    setShowMenu(false);
  };

  const handleSelectNote = (id: number) => {
    setSelectedNoteIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((noteId) => noteId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedNoteIds.length === filteredNotes.length) {
      setSelectedNoteIds([]);
    } else {
      setSelectedNoteIds(filteredNotes.map((n) => n.id));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedNoteIds.length > 0) {
      deleteNotes(selectedNoteIds);
      setIsSelectionMode(false);
      setSelectedNoteIds([]);
    }
  };

  // --- Long Press Logic ---
  const handleTouchStart = (id: number) => {
    isLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      if (!isSelectionMode) {
        setIsSelectionMode(true);
        setSelectedNoteIds([id]);
        if (navigator.vibrate) navigator.vibrate(50);
      }
    }, 600);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  };

  const handleCardClick = (note: Note) => {
    if (isLongPressRef.current) return;
    if (isSelectionMode) {
      handleSelectNote(note.id);
    } else {
      if (note.isLocked) {
        setUnlockModal({ show: true, noteId: note.id });
      } else {
        openEditor(note);
      }
    }
  };

  // --- Scroll Effect (Auto Hide UI) ---
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      // Show UI if scrolling up significantly or at the very top
      if (currentScrollY < lastScrollY - 10 || currentScrollY < 50) {
        setShowUI(true);
      }
      // Hide UI if scrolling down
      else if (currentScrollY > lastScrollY + 10 && !isSelectionMode) {
        setShowUI(false);
      }
      setLastScrollY(currentScrollY);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY, isSelectionMode]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      if (!event.target.closest(".header-menu-container")) {
        setShowMenu(false);
      }
      if (!event.target.closest(".dashboard-container")) {
        setShowDashboard(false);
      }
      if (!event.target.closest(".backup-modal")) {
        setShowBackupUI(false);
      }
      if (!event.target.closest(".unlock-modal")) {
        // Optional: close unlock modal on outside click
        // setUnlockModal({ show: false, noteId: null });
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      className="min-h-screen relative font-sans transition-colors duration-500"
      dir="rtl"
      style={{ backgroundColor: currentTheme.bg, color: currentTheme.text }}
      onClick={() => !showUI && setShowUI(true)}
    >
      <style>{`
        .font-zain-light { font-family: 'Zain', sans-serif; font-weight: 200; }
        .font-zain-reg   { font-family: 'Zain', sans-serif; font-weight: 400; }
        .font-zain-bold  { font-family: 'Zain', sans-serif; font-weight: 700; }
        .font-zain-xbold { font-family: 'Zain', sans-serif; font-weight: 900; }
        ::selection { background-color: ${currentTheme.accent}33; color: ${currentTheme.text}; }
        body { overflow-x: hidden; }
        
        .animate-shake {
            animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
        }

        @keyframes shake {
            10%, 90% { transform: translate3d(-1px, 0, 0); }
            20%, 80% { transform: translate3d(2px, 0, 0); }
            30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
            40%, 60% { transform: translate3d(4px, 0, 0); }
        }
        
        /* Smooth Scroll for About Page */
        .about-scroll::-webkit-scrollbar { width: 4px; }
        .about-scroll::-webkit-scrollbar-thumb { background-color: ${currentTheme.accent}40; border-radius: 4px; }
      `}</style>

      {/* Dynamic Background Blobs (Soft subtle atmosphere in light mode only; disabled in dark mode to prevent eye strain and background glare) */}
      {!currentTheme.isDark && (
        <>
          <div
            className="fixed top-[-10%] right-[-10%] w-96 h-96 rounded-full filter blur-[100px] pointer-events-none z-0 transition-all duration-700"
            style={{
              backgroundColor: currentTheme.accent,
              opacity: 0.12,
            }}
          />
          <div
            className="fixed bottom-[-10%] left-[-10%] w-80 h-80 rounded-full filter blur-[120px] pointer-events-none z-0 transition-all duration-700"
            style={{
              backgroundColor: currentTheme.accent,
              opacity: 0.08,
            }}
          />
        </>
      )}

      {/* --- UNLOCK MODAL (Matched to New Compact Security Design) --- */}
      {unlockModal.show && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setUnlockModal({ show: false, noteId: null });
              setUnlockPassword("");
            }
          }}
        >
          <div
            className="unlock-modal border shadow-2xl text-center animate-in zoom-in-95 duration-200"
            style={{
              width: "260px",
              maxWidth: "calc(100vw - 32px)",
              borderRadius: "28px",
              padding: "24px 20px",
              backgroundColor: currentTheme.bg,
              borderColor: currentTheme.border,
              boxShadow: `0 20px 45px -10px ${currentTheme.shadow || "rgba(0,0,0,0.3)"}`,
            }}
          >
            {/* Top Lock Icon - Pure & Standing on its own without circles */}
            <div className="flex justify-center mb-3">
              <Lock
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
              الحكاية مغلقة
            </h2>

            {/* Description */}
            <p
              className="text-xs font-zain-reg mb-4 opacity-70 leading-relaxed text-center px-1"
              style={{ color: currentTheme.text }}
            >
              أدخل كلمة المرور لفتح الحكاية وقراءتها.
            </p>

            {/* Password Input Field - Circular/Capsule border radius matching navigation pills */}
            <div className={`mb-4 w-full flex justify-center ${shakeInput ? "animate-shake" : ""}`}>
              <input
                type="password"
                placeholder="كلمة المرور"
                value={unlockPassword}
                onChange={(e) => {
                  setUnlockPassword(e.target.value);
                  setShakeInput(false);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleUnlockAttempt()}
                autoFocus
                className="w-full text-center font-zain-bold text-sm outline-none border transition-all"
                style={{
                  height: "42px",
                  borderRadius: "9999px",
                  backgroundColor: `${currentTheme.accent}0a`,
                  borderColor: shakeInput
                    ? "#ef4444"
                    : `${currentTheme.accent}40`,
                  color: currentTheme.text,
                }}
              />
            </div>

            {/* Action Buttons - Capsule Pill Confirm Button with explicit inline padding & nowrap */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleUnlockAttempt}
                className="font-zain-bold text-xs text-white shadow-sm active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                style={{
                  height: "34px",
                  padding: "0 22px",
                  borderRadius: "9999px",
                  backgroundColor: currentTheme.accent,
                  whiteSpace: "nowrap",
                }}
              >
                تأكيد
              </button>
              <button
                onClick={() => {
                  setUnlockModal({ show: false, noteId: null });
                  setUnlockPassword("");
                }}
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

      {/* --- BACKUP / RESTORE MODAL (Apple Concentric System) --- */}
      {showBackupUI && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div
            className="backup-modal w-full max-w-sm border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            style={{
              backgroundColor: currentTheme.bg,
              borderColor: currentTheme.border,
              borderRadius: "28px",
            }}
          >
            <div className="p-5 text-center">
              <div
                className="w-14 h-14 flex items-center justify-center mx-auto mb-3.5 border shadow-sm"
                style={{
                  backgroundColor: `${currentTheme.accent}15`,
                  borderColor: `${currentTheme.accent}30`,
                  borderRadius: "18px",
                }}
              >
                <Save
                  className="w-7 h-7"
                  style={{ color: currentTheme.accent }}
                  strokeWidth={1.75}
                />
              </div>
              <h2
                className="text-xl font-zain-xbold mb-1.5"
                style={{ color: currentTheme.text }}
              >
                خزنة الحكايات
              </h2>
              <p
                className="text-xs font-zain-reg mb-5 leading-relaxed"
                style={{ color: currentTheme.secondary }}
              >
                احتفظ بنسخة احتياطية من جميع حكاياتك على جهازك، أو استعد نسخة سابقة بأمان تام.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleExportBackup}
                  className="flex flex-col items-center justify-center gap-2 p-3.5 border hover:bg-black/5 active:scale-95 transition-all shadow-sm"
                  style={{
                    backgroundColor: `${currentTheme.accent}08`,
                    borderColor: `${currentTheme.accent}25`,
                    borderRadius: "16px",
                  }}
                >
                  <Download
                    className="w-5 h-5"
                    style={{ color: currentTheme.accent }}
                  />
                  <span
                    className="font-zain-bold text-sm"
                    style={{ color: currentTheme.text }}
                  >
                    حفظ نسخة
                  </span>
                </button>

                <button
                  onClick={handleImportClick}
                  className="flex flex-col items-center justify-center gap-2 p-3.5 border hover:bg-black/5 active:scale-95 transition-all shadow-sm"
                  style={{
                    backgroundColor: `${currentTheme.accent}08`,
                    borderColor: `${currentTheme.accent}25`,
                    borderRadius: "16px",
                  }}
                >
                  <Upload
                    className="w-5 h-5"
                    style={{ color: currentTheme.accent }}
                  />
                  <span
                    className="font-zain-bold text-sm"
                    style={{ color: currentTheme.text }}
                  >
                    استعادة نسخة
                  </span>
                </button>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".json"
              />
            </div>
            <div
              className="p-3 border-t bg-black/5 flex justify-center"
              style={{ borderColor: currentTheme.border }}
            >
              <button
                onClick={() => setShowBackupUI(false)}
                className="px-6 py-1.5 text-sm font-zain-bold opacity-70 hover:opacity-100 hover:bg-black/5 transition-all"
                style={{
                  color: currentTheme.secondary,
                  borderRadius: "9999px",
                }}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CREATIVITY STATS MODAL (MATCHED EXACTLY TO LOCK STORY DIALOG) --- */}
      {showDashboard && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDashboard(false);
            }
          }}
        >
          <div
            className="border shadow-2xl text-center animate-in zoom-in-95 duration-200 relative flex flex-col items-center"
            style={{
              width: "260px",
              maxWidth: "calc(100vw - 32px)",
              borderRadius: "28px",
              padding: "24px 20px",
              backgroundColor: currentTheme.bg,
              borderColor: currentTheme.border,
              boxShadow: `0 20px 45px -10px ${currentTheme.shadow || "rgba(0,0,0,0.3)"}`,
            }}
          >
            {/* Header Row: Title and Close Button on the exact same level */}
            <div className="w-full relative flex items-center justify-center mb-1 min-h-[28px]">
              <h2
                className="text-base font-zain-xbold leading-none text-center"
                style={{ color: currentTheme.text }}
              >
                إحصائيات الإبداع
              </h2>
              <button
                onClick={() => setShowDashboard(false)}
                className="absolute left-0 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full border flex items-center justify-center opacity-60 hover:opacity-100 transition-all cursor-pointer"
                style={{
                  borderColor: `${currentTheme.accent}30`,
                  backgroundColor: `${currentTheme.accent}08`,
                  color: currentTheme.text,
                }}
                title="إغلاق"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Description */}
            <p
              className="text-xs font-zain-reg mb-4 opacity-70 leading-relaxed text-center px-1"
              style={{ color: currentTheme.text }}
            >
              ملخص أرقام ونبض قلمك في الدار
            </p>

            {/* Capsule Pills Stack - Matched to password field pills */}
            <div className="w-full flex flex-col gap-2.5 mb-1">
              {/* Row 1: إجمالي الكلمات */}
              <div
                className="w-full flex items-center justify-between px-3.5 border transition-all"
                style={{
                  height: "42px",
                  borderRadius: "9999px",
                  backgroundColor: `${currentTheme.accent}0a`,
                  borderColor: `${currentTheme.accent}30`,
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <PenTool
                    className="w-4 h-4 flex-shrink-0 opacity-80"
                    style={{ color: currentTheme.accent }}
                    strokeWidth={2}
                  />
                  <span
                    className="font-zain-bold text-xs truncate"
                    style={{ color: currentTheme.text }}
                  >
                    إجمالي الكلمات
                  </span>
                </div>
                <span
                  className="font-zain-xbold text-sm flex-shrink-0"
                  style={{ color: currentTheme.accent }}
                >
                  {dashboardStats.words.toLocaleString("ar-EG")}
                </span>
              </div>

              {/* Row 2: عدد الحكايات */}
              <div
                className="w-full flex items-center justify-between px-3.5 border transition-all"
                style={{
                  height: "42px",
                  borderRadius: "9999px",
                  backgroundColor: `${currentTheme.accent}0a`,
                  borderColor: `${currentTheme.accent}30`,
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <BookOpen
                    className="w-4 h-4 flex-shrink-0 opacity-80"
                    style={{ color: currentTheme.accent }}
                    strokeWidth={2}
                  />
                  <span
                    className="font-zain-bold text-xs truncate"
                    style={{ color: currentTheme.text }}
                  >
                    عدد الحكايات
                  </span>
                </div>
                <span
                  className="font-zain-xbold text-sm flex-shrink-0"
                  style={{ color: currentTheme.text }}
                >
                  {dashboardStats.stories.toLocaleString("ar-EG")}
                </span>
              </div>

              {/* Row 3: متوسط الكلمات */}
              <div
                className="w-full flex items-center justify-between px-3.5 border transition-all"
                style={{
                  height: "42px",
                  borderRadius: "9999px",
                  backgroundColor: `${currentTheme.accent}0a`,
                  borderColor: `${currentTheme.accent}30`,
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <BarChart
                    className="w-4 h-4 flex-shrink-0 opacity-80"
                    style={{ color: currentTheme.accent }}
                    strokeWidth={2}
                  />
                  <span
                    className="font-zain-bold text-xs truncate"
                    style={{ color: currentTheme.text }}
                  >
                    متوسط الكلمات
                  </span>
                </div>
                <span
                  className="font-zain-xbold text-sm flex-shrink-0"
                  style={{ color: currentTheme.text }}
                >
                  {dashboardStats.avg.toLocaleString("ar-EG")}{" "}
                  <span className="font-zain-reg text-[11px] opacity-70">كلمة</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
      {showAbout && (
        <div
          className="fixed inset-0 z-[100] animate-in slide-in-from-bottom duration-700 fade-in overflow-hidden flex flex-col"
          style={{ backgroundColor: currentTheme.bg }}
        >
          {/* Background Texture */}
          <div
            className="absolute inset-0 opacity-30 pointer-events-none z-0"
            style={{
              backgroundImage:
                'url("https://www.transparenttextures.com/patterns/subtle-linen.png")',
              filter: currentTheme.isDark ? "invert(1)" : "none",
            }}
          ></div>

          {/* --- FLOATING CAPSULE HEADER SYSTEM --- */}
          <header
            className="fixed top-0 left-0 right-0 z-[120] pointer-events-none"
            style={{ top: 0, paddingTop: "16px", paddingBottom: "8px", paddingLeft: "16px", paddingRight: "16px" }}
          >
            <div className="max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto flex items-center justify-between pointer-events-none w-full">
              {/* Right Capsule: Title */}
              <div
                className="pointer-events-auto h-11 px-5 rounded-full border flex items-center justify-center backdrop-blur-xl transition-all"
                style={{
                  backgroundColor: currentTheme.glass,
                  borderColor: currentTheme.border,
                  boxShadow: `0 8px 24px -4px ${currentTheme.shadow}`,
                }}
              >
                <h1
                  className="font-zain-xbold text-base md:text-lg leading-none pt-0.5"
                  style={{ color: currentTheme.accent }}
                >
                  عن دَارِ الحِكَايَاتِ
                </h1>
              </div>

              {/* Left Capsule: Exit Button */}
              <div className="pointer-events-auto flex-shrink-0">
                <button
                  onClick={() => setShowAbout(false)}
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
                  title="العودة"
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

          {/* --- SCROLLABLE CONTENT --- */}
          <div
            className="w-full h-full overflow-y-auto about-scroll relative z-10 px-4 flex flex-col items-center"
            style={{ paddingTop: "88px", paddingBottom: "48px" }}
          >
            <div className="w-full max-w-2xl mx-auto flex flex-col items-center text-center space-y-12 pb-20 pt-6">
              {/* Intro Card */}
              <div
                className="w-full p-6 sm:p-8 rounded-3xl border backdrop-blur-xl transition-all duration-300 animate-in slide-in-from-bottom-8 duration-700 delay-200 fill-mode-backwards"
                style={{
                  backgroundColor: currentTheme.glass,
                  borderColor: currentTheme.border,
                  boxShadow: `0 12px 32px -4px ${currentTheme.shadow}`,
                }}
              >
                <p
                  className="font-zain-reg text-2xl leading-[2.3] max-w-lg mx-auto opacity-95"
                  style={{ color: currentTheme.text }}
                >
                  هذا الدار ليس إهداءً عابراً، بل هو وعدٌ محفور بالحب. بنيته
                  لأجلكِ، ليكون حصناً يليق بجمال ما تكتبين.
                </p>
              </div>

              {/* Separator */}
              <div className="flex items-center justify-center opacity-80 w-full max-w-xs">
                <div
                  className="h-px flex-1"
                  style={{ backgroundColor: currentTheme.accent }}
                ></div>
                <div
                  className="mx-4 text-xl"
                  style={{ color: currentTheme.accent }}
                >
                  ❦
                </div>
                <div
                  className="h-px flex-1"
                  style={{ backgroundColor: currentTheme.accent }}
                ></div>
              </div>

              {/* 2. VISION SECTION */}
              <div
                className="w-full p-6 sm:p-8 rounded-3xl border backdrop-blur-xl transition-all duration-300 animate-in slide-in-from-bottom-8 duration-700 delay-300 fill-mode-backwards"
                style={{
                  backgroundColor: currentTheme.glass,
                  borderColor: currentTheme.border,
                  boxShadow: `0 12px 32px -4px ${currentTheme.shadow}`,
                }}
              >
                <h2
                  className="font-zain-bold text-xl mb-4 tracking-widest uppercase opacity-80"
                  style={{ color: currentTheme.accent }}
                >
                  فلسفة المكان
                </h2>
                <p
                  className="font-zain-reg text-2xl leading-[2.2] text-center"
                  style={{ color: currentTheme.text }}
                >
                  في عالمٍ يضج بالصخب، "دَارُ الحِكَايَاتِ" هو صمتٌ مقدّس. هنا،
                  لا شيء يقطع خلوتك سوى الإلهام، ولا حدود لك سوى خيالك.
                </p>
              </div>

              {/* Separator */}
              <div className="flex items-center justify-center opacity-80 w-full max-w-xs">
                <div
                  className="h-px flex-1"
                  style={{ backgroundColor: currentTheme.accent }}
                ></div>
                <div
                  className="mx-4 text-xl"
                  style={{ color: currentTheme.accent }}
                >
                  ❦
                </div>
                <div
                  className="h-px flex-1"
                  style={{ backgroundColor: currentTheme.accent }}
                ></div>
              </div>

              {/* 3. THE ZIKR FEATURE */}
              <div
                className="w-full p-6 sm:p-8 rounded-3xl border backdrop-blur-xl transition-all duration-300 animate-in slide-in-from-bottom-8 duration-700 delay-500 fill-mode-backwards"
                style={{
                  backgroundColor: currentTheme.glass,
                  borderColor: currentTheme.border,
                  boxShadow: `0 12px 32px -4px ${currentTheme.shadow}`,
                }}
              >
                <h2
                  className="font-zain-bold text-xl mb-4 tracking-widest uppercase opacity-80"
                  style={{ color: currentTheme.accent }}
                >
                  السر المقدس
                </h2>
                <p
                  className="font-zain-reg text-2xl leading-[2.2] text-center"
                  style={{ color: currentTheme.text }}
                >
                  ميزة "الأذكار" هي النبض الذي يبارك كل حرف. لتكن رفيقك الخفي،
                  تهمس في أذنك بذكر الله، ليجري مع حبر قلمك أجرٌ لا ينقطع.
                </p>
              </div>

              {/* Separator */}
              <div className="flex items-center justify-center opacity-80 w-full max-w-xs">
                <div
                  className="h-px flex-1"
                  style={{ backgroundColor: currentTheme.accent }}
                ></div>
                <div
                  className="mx-4 text-xl"
                  style={{ color: currentTheme.accent }}
                >
                  ❦
                </div>
                <div
                  className="h-px flex-1"
                  style={{ backgroundColor: currentTheme.accent }}
                ></div>
              </div>

              {/* 4. DEVELOPER SECTION */}
              <div
                className="w-full p-6 sm:p-8 rounded-3xl border backdrop-blur-xl transition-all duration-300 animate-in slide-in-from-bottom-8 duration-700 delay-700 fill-mode-backwards"
                style={{
                  backgroundColor: currentTheme.glass,
                  borderColor: currentTheme.border,
                  boxShadow: `0 12px 32px -4px ${currentTheme.shadow}`,
                }}
              >
                <h2
                  className="font-zain-bold text-xl mb-4 tracking-widest uppercase opacity-80"
                  style={{ color: currentTheme.accent }}
                >
                  حارس الحلم
                </h2>

                <div className="flex flex-col items-center justify-center">
                  <p
                    className="font-zain-reg text-2xl leading-[2.2] text-center mb-8 opacity-95"
                    style={{ color: currentTheme.text }}
                  >
                    هذا الصرح لم يُبنَ بالأكواد، بل شُيِّد بنبض القلب. هو رسالتي
                    الصامتة للعالم بأن كلماتكِ تستحق قصراً من نور. صُنع بحبٍ
                    خالص، ليليق بملكة الحكايات.
                  </p>

                  <h3
                    className="font-zain-xbold text-3xl mb-6"
                    style={{ color: currentTheme.accent }}
                  >
                    محمد السيد (حمص)
                  </h3>

                  <div className="flex justify-center gap-4">
                    <a
                      href="tel:01140251843"
                      className="group flex items-center justify-center w-12 h-12 rounded-full border backdrop-blur-xl hover:scale-110 active:scale-95 transition-all duration-300 shadow-md cursor-pointer"
                      style={{
                        backgroundColor: currentTheme.glass,
                        borderColor: currentTheme.border,
                        boxShadow: `0 4px 14px -2px ${currentTheme.shadow}`,
                      }}
                      title="اتصال تلفوني"
                    >
                      <Phone
                        className="w-5 h-5 transition-colors"
                        style={{ color: currentTheme.accent }}
                      />
                    </a>
                    <a
                      href="mailto:mohamed01140251843sayed@gmail.com"
                      className="group flex items-center justify-center w-12 h-12 rounded-full border backdrop-blur-xl hover:scale-110 active:scale-95 transition-all duration-300 shadow-md cursor-pointer"
                      style={{
                        backgroundColor: currentTheme.glass,
                        borderColor: currentTheme.border,
                        boxShadow: `0 4px 14px -2px ${currentTheme.shadow}`,
                      }}
                      title="إرسال بريد إلكتروني"
                    >
                      <Mail
                        className="w-5 h-5 transition-colors"
                        style={{ color: currentTheme.accent }}
                      />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        className="relative z-10 w-full max-w-7xl mx-auto min-h-screen flex flex-col"
        style={{
          backgroundColor: "transparent",
        }}
      >
        {/* --- FLOATING HEADER CAPSULES SYSTEM (Apple Concentric Geometry) --- */}
        <header
          className={`fixed top-0 left-0 right-0 z-50 p-2 transition-all duration-500 ease-out pointer-events-none ${showUI ? "translate-y-0" : "-translate-y-full opacity-0"}`}
          style={{ top: 0 }}
        >
          <div className="w-full max-w-7xl mx-auto relative flex items-center justify-between pointer-events-none px-4 sm:px-6 lg:px-8">
            {isSearchOpen ? (
              /* Full-Width Search Floating Capsule */
              <div
                className="pointer-events-auto w-full h-11 px-3.5 rounded-full border flex items-center gap-2.5 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200"
                style={{
                  backgroundColor: currentTheme.glass,
                  borderColor: currentTheme.border,
                  boxShadow: `0 8px 24px -4px ${currentTheme.shadow}`,
                }}
              >
                <Search
                  className="w-4 h-4 flex-shrink-0"
                  style={{ color: currentTheme.accent }}
                  strokeWidth={2.2}
                />
                <input
                  type="text"
                  placeholder="ابحث في حكاياتك..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                  className="flex-1 bg-transparent border-none outline-none font-zain-reg text-sm pt-0.5"
                  style={{ color: currentTheme.text }}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="w-5 h-5 rounded-full flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity"
                    style={{ color: currentTheme.text }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsSearchOpen(false);
                    setSearchTerm("");
                  }}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:bg-black/5 active:scale-95"
                  style={{ color: currentTheme.secondary }}
                  title="إغلاق البحث"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                {/* Right Capsule: Brand Title (Clean typography only) */}
                <div
                  className="pointer-events-auto h-11 px-5 rounded-full border flex items-center justify-center backdrop-blur-xl transition-transform hover:scale-[1.02]"
                  style={{
                    backgroundColor: currentTheme.glass,
                    borderColor: currentTheme.border,
                    boxShadow: `0 8px 24px -4px ${currentTheme.shadow}`,
                  }}
                >
                  <span
                    className="font-zain-xbold text-lg leading-none pt-0.5 tracking-wide select-none"
                    style={{ color: currentTheme.accent }}
                  >
                    دَارُ الحِكَايَاتِ
                  </span>
                </div>

                {/* Left Capsule: Search Trigger + Three-lines Menu ("الثلاث شرط") */}
                <div className="relative header-menu-container pointer-events-auto">
                  <div
                    className="h-11 px-2 rounded-full border flex items-center gap-1 backdrop-blur-xl transition-transform hover:scale-[1.02]"
                    style={{
                      backgroundColor: currentTheme.glass,
                      borderColor: currentTheme.border,
                      boxShadow: `0 8px 24px -4px ${currentTheme.shadow}`,
                    }}
                  >
                    {/* Search Icon Button */}
                    <button
                      onClick={() => setIsSearchOpen(true)}
                      className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-black/5 active:scale-95"
                      style={{ color: currentTheme.text }}
                      title="بحث"
                    >
                      <Search
                        className="w-4 h-4"
                        style={{ color: currentTheme.accent }}
                        strokeWidth={2.2}
                      />
                    </button>

                    {/* Divider */}
                    <div
                      className="w-px h-4 mx-0.5 opacity-60"
                      style={{ backgroundColor: currentTheme.border }}
                    />

                    {/* More Menu Button (Three Vertical Dots) */}
                    <button
                      onClick={() => setShowMenu(!showMenu)}
                      className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-black/5 active:scale-95 cursor-pointer"
                      style={{ color: currentTheme.text }}
                      title="خيارات إضافية"
                    >
                      <MoreVertical
                        className="w-4 h-4"
                        style={{ color: currentTheme.text }}
                        strokeWidth={2.2}
                      />
                    </button>
                  </div>

                  {/* Redesigned Menu Dropdown Card (Editor Smooth 500ms Animation Pattern) */}
                  <div
                    className={`absolute top-full left-0 mt-2 min-w-[178px] w-max border shadow-xl z-[60] overflow-hidden origin-top-left transition-all duration-500 ease-out ${
                      showMenu
                        ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
                        : "opacity-0 -translate-y-3 scale-95 pointer-events-none"
                    }`}
                    style={{
                      backgroundColor: currentTheme.bg,
                      borderColor: currentTheme.border,
                      borderRadius: "20px",
                      boxShadow: `0 10px 24px -4px ${currentTheme.shadow}, 0 0 1px ${currentTheme.border}`,
                    }}
                  >
                      <div className="flex flex-col p-1 gap-0.5">
                        {/* 1. تفعيل وضع التحديد */}
                        <button
                          onClick={toggleSelectionMode}
                          className="flex items-center gap-2.5 px-3 py-1.5 text-right group transition-all hover:bg-black/5 active:scale-[0.98] cursor-pointer whitespace-nowrap w-full"
                          style={{
                            color: currentTheme.text,
                            borderRadius: "16px",
                          }}
                        >
                          <CheckSquare
                            className="w-3.5 h-3.5 group-hover:scale-110 transition-transform flex-shrink-0"
                            style={{ color: currentTheme.accent }}
                            strokeWidth={2}
                          />
                          <span className="font-zain-reg text-[12px] leading-none pt-0.5 whitespace-nowrap">
                            تحديد الحكايات
                          </span>
                        </button>

                        {/* 2. نمط العرض (شبكي / قائمة) */}
                        <button
                          onClick={toggleViewMode}
                          className="flex items-center gap-2.5 px-3 py-1.5 text-right group transition-all hover:bg-black/5 active:scale-[0.98] cursor-pointer whitespace-nowrap w-full"
                          style={{
                            color: currentTheme.text,
                            borderRadius: "16px",
                          }}
                        >
                          {viewMode === "list" ? (
                            <>
                              <Grid
                                className="w-3.5 h-3.5 group-hover:scale-110 transition-transform flex-shrink-0"
                                style={{ color: currentTheme.accent }}
                                strokeWidth={2}
                              />
                              <span className="font-zain-reg text-[12px] leading-none pt-0.5 whitespace-nowrap">
                                عرض شبكي
                              </span>
                            </>
                          ) : (
                            <>
                              <List
                                className="w-3.5 h-3.5 group-hover:scale-110 transition-transform flex-shrink-0"
                                style={{ color: currentTheme.accent }}
                                strokeWidth={2}
                              />
                              <span className="font-zain-reg text-[12px] leading-none pt-0.5 whitespace-nowrap">
                                عرض قائمة
                              </span>
                            </>
                          )}
                        </button>

                        {/* 3. إحصائيات الإبداع */}
                        <button
                          onClick={() => {
                            setShowDashboard(true);
                            setShowMenu(false);
                          }}
                          className="flex items-center gap-2.5 px-3 py-1.5 text-right group transition-all hover:bg-black/5 active:scale-[0.98] cursor-pointer whitespace-nowrap w-full"
                          style={{
                            color: currentTheme.text,
                            borderRadius: "16px",
                          }}
                        >
                          <BarChart
                            className="w-3.5 h-3.5 group-hover:scale-110 transition-transform flex-shrink-0"
                            style={{ color: currentTheme.accent }}
                            strokeWidth={2}
                          />
                          <span className="font-zain-reg text-[12px] leading-none pt-0.5 whitespace-nowrap">
                            إحصائيات الإبداع
                          </span>
                        </button>

                        <div
                          className="h-px mx-1.5 my-0.5 opacity-30"
                          style={{ backgroundColor: currentTheme.border }}
                        />

                        {/* 4. الإعدادات */}
                        <button
                          onClick={() => {
                            openSettings();
                            setShowMenu(false);
                          }}
                          className="flex items-center gap-2.5 px-3 py-1.5 text-right group transition-all hover:bg-black/5 active:scale-[0.98] cursor-pointer whitespace-nowrap w-full"
                          style={{
                            color: currentTheme.text,
                            borderRadius: "16px",
                          }}
                        >
                          <Settings
                            className="w-3.5 h-3.5 group-hover:scale-110 transition-transform flex-shrink-0"
                            style={{ color: currentTheme.accent }}
                            strokeWidth={2}
                          />
                          <span className="font-zain-reg text-[12px] leading-none pt-0.5 whitespace-nowrap">
                            الإعدادات
                          </span>
                        </button>

                        {/* 5. عن دار الحكايات */}
                        <button
                          onClick={() => {
                            setShowAbout(true);
                            setShowMenu(false);
                          }}
                          className="flex items-center gap-2.5 px-3 py-1.5 text-right group transition-all hover:bg-black/5 active:scale-[0.98] cursor-pointer whitespace-nowrap w-full"
                          style={{
                            color: currentTheme.text,
                            borderRadius: "16px",
                          }}
                        >
                          <Info
                            className="w-3.5 h-3.5 group-hover:scale-110 transition-transform flex-shrink-0"
                            style={{ color: currentTheme.accent }}
                            strokeWidth={2}
                          />
                          <span className="font-zain-reg text-[12px] leading-none pt-0.5 whitespace-nowrap">
                            عن دَارِ الحِكَايَاتِ
                          </span>
                        </button>
                      </div>
                    </div>
                </div>
              </>
            )}
          </div>
        </header>

        {/* --- Main Content (Passes seamlessly under floating capsules) --- */}
        <div
          className="flex-1 px-4 sm:px-5 pb-28"
          style={{ paddingTop: "80px", paddingBottom: "96px" }}
        >

          <div
            className={`${viewMode === "grid" ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4" : "max-w-2xl sm:max-w-3xl mx-auto space-y-4 w-full"}`}
          >
            {filteredNotes.length > 0 ? (
              filteredNotes.map((note) => {
                const isSelected = selectedNoteIds.includes(note.id);
                return (
                  <div
                    key={note.id}
                    onMouseDown={() => handleTouchStart(note.id)}
                    onMouseUp={handleTouchEnd}
                    onTouchStart={() => handleTouchStart(note.id)}
                    onTouchEnd={handleTouchEnd}
                    onClick={() => handleCardClick(note)}
                    className={`
                        group relative rounded-2xl backdrop-blur-2xl transition-all duration-300 cursor-pointer overflow-hidden w-full
                        ${viewMode === "grid" ? "p-4 min-h-[200px] sm:min-h-[220px] h-auto flex flex-col justify-between hover:-translate-y-1" : "p-4 hover:-translate-y-1"}
                      `}
                    style={{
                      backgroundColor: isSelected
                        ? `${currentTheme.accent}20`
                        : currentTheme.glass,
                      borderColor: isSelected
                        ? currentTheme.accent
                        : currentTheme.border,
                      borderWidth: "1px",
                      borderRadius: viewMode === "grid" ? "22px" : "24px",
                      boxShadow: isSelected
                        ? `0 0 0 2px ${currentTheme.accent}, 0 8px 24px -4px ${currentTheme.shadow}`
                        : `0 8px 24px -4px ${currentTheme.shadow}`,
                    }}
                  >
                    {isSelectionMode && (
                      <div
                        className={`absolute top-2.5 left-2.5 z-20 transition-all duration-300 ${isSelected ? "scale-100 opacity-100" : "scale-75 opacity-50"}`}
                      >
                        {isSelected ? (
                          <CheckCircle2
                            className="w-5 h-5 fill-current"
                            style={{ color: currentTheme.accent }}
                          />
                        ) : (
                          <div
                            className="w-4 h-4 rounded-full border"
                            style={{ borderColor: currentTheme.accent }}
                          ></div>
                        )}
                      </div>
                    )}

                    <div className="relative z-10 flex flex-col h-full justify-between flex-1">
                      <div>
                        <div
                          className={`flex justify-between items-start ${viewMode === "grid" ? "mb-2 flex-col gap-1" : "mb-1.5"}`}
                        >
                          <h2
                            className={`${viewMode === "grid" ? "text-base line-clamp-2" : "text-lg"} font-zain-bold leading-relaxed`}
                            style={{ color: currentTheme.accent }}
                          >
                            {note.title}
                          </h2>
                          <span
                            className={`text-[10px] px-2.5 py-0.5 rounded-full border font-zain-bold pt-0.5 backdrop-blur-md transition-all ${viewMode === "grid" ? "self-start" : ""}`}
                            style={{
                              borderColor: `${currentTheme.accent}35`,
                              color: currentTheme.accent,
                              backgroundColor: `${currentTheme.accent}12`,
                            }}
                          >
                            {note.category}
                          </span>
                        </div>

                        {/* Lock Content Mask */}
                        {note.isLocked ? (
                          <div className="flex flex-col items-center justify-center opacity-40 py-4">
                            <Lock
                              className="w-5 h-5 mb-1.5"
                              style={{ color: currentTheme.text }}
                            />
                            <p
                              className="text-xs font-zain-reg text-center"
                              style={{ color: currentTheme.text }}
                            >
                              حكاية مغلقة بأمر الكاتب
                            </p>
                          </div>
                        ) : (
                          <p
                            className={`text-sm leading-relaxed font-zain-reg mb-3 ${viewMode === "grid" ? "line-clamp-3" : "line-clamp-2"}`}
                            style={{ color: currentTheme.text, opacity: 0.8 }}
                          >
                            {note.preview}
                          </p>
                        )}
                      </div>

                      <div
                        className={`flex justify-between items-center border-t pt-2 ${viewMode === "grid" ? "mt-4" : "mt-1"}`}
                        style={{ borderColor: currentTheme.border }}
                      >
                        <span
                          className="text-xs font-zain-reg"
                          style={{ color: currentTheme.secondary }}
                        >
                          {note.date}
                        </span>
                        {viewMode === "list" &&
                          !isSelectionMode &&
                          !note.isLocked && (
                            <button style={{ color: currentTheme.accent }}>
                              <PenTool className="w-3 h-3 opacity-60" />
                            </button>
                          )}
                        {note.isLocked && (
                          <Lock
                            className="w-3 h-3 opacity-60"
                            style={{ color: currentTheme.secondary }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div
                className={`text-center py-20 opacity-40 flex flex-col items-center ${viewMode === "grid" ? "col-span-2" : ""}`}
              >
                <BookOpen
                  className="w-10 h-10 mb-4"
                  style={{ color: currentTheme.accent }}
                  strokeWidth={1}
                />
                <p
                  className="text-lg font-zain-reg"
                  style={{ color: currentTheme.text }}
                >
                  لا توجد حكايات مطابقة...
                </p>
              </div>
            )}
          </div>
        </div>

        {/* --- Selection Mode Footer (Apple Rounded Full Geometry) --- */}
        <AnimatePresence>
          {isSelectionMode && (
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.95 }}
              transition={{
                type: "spring",
                stiffness: 240,
                damping: 25,
                mass: 0.8,
              }}
              className="fixed bottom-4 left-0 right-0 z-50 px-4 pointer-events-none flex justify-center items-center"
            >
              <div
                className="pointer-events-auto w-full max-w-sm h-12 p-1.5 rounded-full backdrop-blur-2xl border flex justify-between items-center gap-2 transition-all"
                style={{
                  backgroundColor: currentTheme.glass,
                  borderColor: currentTheme.border,
                  boxShadow: `0 12px 32px -4px ${currentTheme.shadow}`,
                }}
              >
                <button
                  onClick={toggleSelectionMode}
                  className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
                  style={{ color: currentTheme.text }}
                  title="إلغاء التحديد"
                >
                  <X className="w-4 h-4" />
                </button>

                <div
                  className="px-3.5 py-1 rounded-full border flex items-center gap-2"
                  style={{
                    backgroundColor: `${currentTheme.accent}15`,
                    borderColor: `${currentTheme.accent}30`,
                  }}
                >
                  <span
                    className="text-xs font-zain-bold pt-0.5"
                    style={{ color: currentTheme.accent }}
                  >
                    {selectedNoteIds.length} محدد
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={handleSelectAll}
                    className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
                    style={{ color: currentTheme.text }}
                    title="تحديد الكل"
                  >
                    <CheckSquare className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleDeleteSelected}
                    disabled={selectedNoteIds.length === 0}
                    className={`w-9 h-9 flex items-center justify-center rounded-full transition-all active:scale-95 cursor-pointer ${selectedNoteIds.length > 0 ? "hover:bg-red-500/10 text-red-500" : "opacity-30 cursor-not-allowed"}`}
                    style={{
                      color:
                        selectedNoteIds.length > 0
                          ? undefined
                          : currentTheme.text,
                    }}
                    title="حذف المحدد"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default HomePage;
