import React, { useState, useEffect, useRef } from "react";
import {
  ArrowRight,
  ChevronRight,
  LogOut,
  Undo2,
  Redo2,
  Check,
  Settings2,
  Type,
  Palette,
  AlignRight,
  AlignCenter,
  AlignLeft,
  AlignJustify, // <-- إضافة أيقونة الضبط
  FileText,
  Scroll,
  X,
  Clock,
  FileDown,
  Sparkles,
  Leaf,
  Cloud,
  Flame,
  Cpu,
  Waves,
  Orbit,
  Feather,
  BookHeart,
  Hourglass,
  Cog,
  Moon,
  Book,
  List,
  Plus,
  Trash2,
  BookOpenText,
  BookOpenCheck,
  Glasses,
  Mic2,
  Files,
  Lock,
  Unlock,
  KeyRound,
  Highlighter,
  Eraser,
  Save,
} from "lucide-react";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
} from "docx";
import { useApp, NoteStyles } from "../contexts/AppContext";
import { exportStoryToPdf, downloadBlob } from "../lib/pdf-export";

// --- 20 Premium Ink Colors ---
const inkColors = [
  { hex: "#2C3E30", name: "زيتي رمادي" },
  { hex: "#121A1B", name: "زيتي عميق" },
  { hex: "#000000", name: "حبر أسود" },
  { hex: "#2C3E50", name: "أزرق ليلي" },
  { hex: "#4A235A", name: "بنفسجي ملكي" },
  { hex: "#641E16", name: "أحمر قاني" },
  { hex: "#784212", name: "بني عتيق" },
  { hex: "#145A32", name: "أخضر غابي" },
  { hex: "#784212", name: "برونزي" },
  { hex: "#A04000", name: "طوبي محروق" },
  { hex: "#566573", name: "رمادي صخري" },
  { hex: "#A7AA63", name: "ذهبي مطفي" },
  { hex: "#117A65", name: "تركواز غامق" },
  { hex: "#C0392B", name: "ياقوتي" },
  { hex: "#D68910", name: "كهرماني" },
  { hex: "#2874A6", name: "أزرق محيطي" },
  { hex: "#EAE6D2", name: "كريمي مضيء" },
  { hex: "#FDFEFE", name: "أبيض ناصع" },
  { hex: "#D7BDE2", name: "خزامي باهت" },
  { hex: "#A9DFBF", name: "فستقي فاتح" },
  { hex: "#AED6F1", name: "سماوي جليدي" },
];

const paperStyles = [
  {
    id: "minimalist",
    name: "استوديو حديث",
    icon: FileText,
    defaultTextColor: "#2C3E30",
    isDark: false,
  },
  {
    id: "classic",
    name: "كشكول كلاسيكي",
    icon: null,
    defaultTextColor: "#121A1B",
    isDark: false,
  },
  {
    id: "linen",
    name: "كتان فاخر",
    icon: Scroll,
    defaultTextColor: "#121A1B",
    isDark: false,
  },
  {
    id: "vintage",
    name: "ورق عتيق",
    icon: Scroll,
    defaultTextColor: "#121A1B",
    isDark: false,
  },
  {
    id: "desert_nights",
    name: "ليالي الصحراء",
    icon: Sparkles,
    defaultTextColor: "#F0E6D8",
    isDark: true,
  },
  {
    id: "forest_manuscript",
    name: "مخطوطة الغابة",
    icon: Leaf,
    defaultTextColor: "#D4CBB6",
    isDark: true,
  },
  {
    id: "cloud_whisper",
    name: "همس السحاب",
    icon: Cloud,
    defaultTextColor: "#483D8B",
    isDark: false,
  },
  {
    id: "magma_ink",
    name: "حبر الصهارة",
    icon: Flame,
    defaultTextColor: "#FFD700",
    isDark: true,
  },
  {
    id: "aether_tablet",
    name: "لوح الأثير",
    icon: Cpu,
    defaultTextColor: "#00FFFF",
    isDark: true,
  },
  {
    id: "abyssal_texts",
    name: "نصوص الأعماق",
    icon: Waves,
    defaultTextColor: "#96E0F0",
    isDark: true,
  },
  {
    id: "celestial_quill",
    name: "ريشة الفلك",
    icon: Orbit,
    defaultTextColor: "#EBEBF5",
    isDark: true,
  },
  {
    id: "serenity_garden",
    name: "حديقة السكون",
    icon: Feather,
    defaultTextColor: "#333D40",
    isDark: false,
  },
  {
    id: "crimson_codex",
    name: "مخطوطة الدم",
    icon: BookHeart,
    defaultTextColor: "#F5EBE0",
    isDark: true,
  },
  {
    id: "memory_mirage",
    name: "سراب الذاكرة",
    icon: Hourglass,
    defaultTextColor: "#5A5A7A",
    isDark: false,
  },
  {
    id: "inventor_workshop",
    name: "ورشة المخترع",
    icon: Cog,
    defaultTextColor: "#2E251F",
    isDark: false,
  },
];

const fontLevels = [200, 300, 400, 700, 900];

const zikrReminders = [
  "سبحان الله وبحمده",
  "سبحان الله العظيم",
  "اللهم صلِّ وسلِّم على نبينا محمد",
  "لا حول ولا قوة إلا بالله",
  "أستغفر الله العظيم وأتوب إليه",
  "سبحان الله والحمد لله",
  "لا إله إلا الله والله أكبر",
  "لا إله إلا أنت سبحانك إني كنت من الظالمين",
  "اللهم إنك عفوٌّ تحب العفو فاعفُ عني",
  "يا مقلِّب القلوب، ثبِّت قلبي على دينك",
  "حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ",
  "اللهم أعني على ذكرك وشكرك وحسن عبادتك",
  "ربِّ اغفر لي ولوالدي",
  "الحمد لله حمدًا كثيرًا",
  "ربِّ زدني علماً",
];

// --- Constants for Chapter System ---
const CHAPTER_SEPARATOR = "|||CHP_SEP|||";
const TITLE_CONTENT_SEPARATOR = "|||TTL_CNT|||";

interface Chapter {
  id: string;
  title: string;
  content: string;
}

// --- The Intelligent Text Flow System ---
// A robust hook to dynamically resize a textarea based on its content and styles.
// This version has been re-engineered to eliminate scroll lag during typing.
const useAutosizeTextArea = (
  textAreaRef: React.RefObject<HTMLTextAreaElement>,
  value: string,
  dependencies: any[] = [], // Pass style dependencies here
) => {
  // We use `useLayoutEffect` to ensure the height adjustment happens synchronously
  // after the DOM has been updated but before the browser has painted the changes.
  // This is crucial for preventing the visual "jank" and scrolling conflicts that
  // can occur with a standard `useEffect` with a timeout.
  React.useLayoutEffect(() => {
    const element = textAreaRef.current;
    if (element) {
      // By resetting and then setting the height in the same synchronous pass,
      // we force a single, immediate reflow to get the correct size. This is far
      // more efficient and smoother than a delayed, asynchronous reflow that can
      // interrupt user interactions like scrolling.
      element.style.height = "auto";
      element.style.height = `${element.scrollHeight}px`;
    }
  }, [textAreaRef, value, ...dependencies]); // Effect runs when value or styles change.
};

// A memoized component for rendering each chapter to optimize performance and encapsulate logic.
const ChapterItem = React.memo(
  ({
    chapter,
    index,
    onUpdate,
    onRemove,
    isSavedMode,
    styles,
    showFlowIndicator,
    canBeDeleted,
    containerRef,
  }: {
    chapter: Chapter;
    index: number;
    onUpdate: (id: string, field: "title" | "content", value: string) => void;
    onRemove: (id: string) => void;
    isSavedMode: boolean;
    styles: {
      fontSize: number;
      fontWeight: number;
      textAlign: "right" | "center" | "left" | "justify";
      textColor: string;
      accentColor: string;
    };
    showFlowIndicator: boolean;
    canBeDeleted: boolean;
    containerRef: (el: HTMLDivElement | null) => void;
  }) => {
    const divRef = useRef<HTMLDivElement>(null);
    const { fontSize, fontWeight, textAlign, textColor, accentColor } = styles;

    // Sync content updates (e.g. undo, redo, or initial load)
    useEffect(() => {
      if (divRef.current && divRef.current.innerHTML !== chapter.content) {
        divRef.current.innerHTML = chapter.content;
      }
    }, [chapter.content]);

    const handleInput = () => {
      if (divRef.current) {
        onUpdate(chapter.id, "content", divRef.current.innerHTML);
      }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      if (!text) return;

      let success = false;
      try {
        success = document.execCommand("insertText", false, text);
      } catch (err) {
        success = false;
      }

      if (!success) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          const textNode = document.createTextNode(text);
          range.insertNode(textNode);

          range.setStartAfter(textNode);
          range.setEndAfter(textNode);
          selection.removeAllRanges();
          selection.addRange(range);
        } else {
          if (divRef.current) {
            divRef.current.innerText += text;
          }
        }
      }

      if (divRef.current) {
        onUpdate(chapter.id, "content", divRef.current.innerHTML);
      }
    };

    return (
      <>
        {index > 0 && (
          <div className="chapter-separator" aria-hidden="true">
            <div className="chapter-line"></div>
            <span className="chapter-icon">❦</span>
            <div className="chapter-line"></div>
          </div>
        )}
        <div ref={containerRef} className="relative group/chapter">
          {!isSavedMode && canBeDeleted && (
            <button
              onClick={() => onRemove(chapter.id)}
              className="absolute top-2 left-0 opacity-0 group-hover/chapter:opacity-100 p-2 text-red-400 hover:text-red-600 transition-all z-10"
              title="حذف الفصل"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}

          {/* Text Flow Indicator - The "genius" visible feature */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 left-0 z-10 transition-all duration-500 pointer-events-none ${showFlowIndicator ? "opacity-100 scale-100" : "opacity-0 scale-75"}`}
          >
            <Waves
              className="w-5 h-5 animate-pulse"
              style={{ color: accentColor }}
            />
          </div>

          <div className="mb-4 text-center">
            <input
              value={chapter.title}
              onChange={(e) => onUpdate(chapter.id, "title", e.target.value)}
              placeholder={`الفصل ${index + 1}`}
              readOnly={isSavedMode}
              className="bg-transparent text-center font-zain-xbold text-2xl w-full outline-none placeholder:opacity-30"
              style={{ color: accentColor }}
            />
          </div>

          <div
            ref={divRef}
            contentEditable={!isSavedMode}
            onInput={handleInput}
            onPaste={handlePaste}
            data-chapter-id={chapter.id}
            data-placeholder="اكتب محتوى الفصل هنا..."
            className={`w-full bg-transparent border-none outline-none resize-none leading-loose overflow-hidden min-h-[200px] editor-container ${
              !chapter.content || chapter.content === "<br>" ? "is-empty" : ""
            }`}
            style={{
              fontSize: `${fontSize}px`,
              fontFamily: "'Zain', sans-serif",
              fontWeight: fontWeight,
              textAlign: textAlign,
              color: textColor,
              lineHeight: 2.2,
              minHeight: "200px",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
            spellCheck={false}
          />
        </div>
      </>
    );
  },
);

const DarAlHikayatMaster: React.FC = () => {
  const { selectedNote, backToHome, saveNote, currentTheme, toggleTheme } =
    useApp();

  const noteId = selectedNote?.id;
  const initialTitle = selectedNote?.title;
  const initialContent = selectedNote?.content || selectedNote?.preview;
  const initialMode = selectedNote ? "read" : "edit";
  const initialStyles = selectedNote?.styles;
  const onBack = backToHome;
  const onSave = saveNote;

  const defaultContent = "";

  // --- State Management ---
  const [content, setContent] = useState(initialContent || defaultContent);
  const [title, setTitle] = useState(initialTitle || "");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isNovelMode, setIsNovelMode] = useState(false);
  const [chapters, setChapters] = useState<Chapter[]>([
    { id: "1", title: "", content: "" },
  ]);
  const [showTOC, setShowTOC] = useState(false);
  const [showNovelMenu, setShowNovelMenu] = useState(false);
  const [history, setHistory] = useState<any[]>([
    {
      content: initialContent || "",
      chapters: [{ id: "1", title: "", content: initialContent || "" }],
      isNovel: false,
    },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [fontSize, setFontSize] = useState(initialStyles?.fontSize || 16);
  const [activeFontWeight, setActiveFontWeight] = useState(
    initialStyles?.fontWeight || 400,
  );
  const [textAlign, setTextAlign] = useState<NoteStyles["textAlign"]>(
    initialStyles?.textAlign || "right",
  );
  const [textColor, setTextColor] = useState(
    initialStyles?.textColor || "#2C3E30",
  );
  const [activePaperStyleIndex, setActivePaperStyleIndex] = useState(
    initialStyles?.paperStyleIndex || 0,
  );
  const [isDirty, setIsDirty] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isDialogClosing, setIsDialogClosing] = useState(false);
  const [currentZikr, setCurrentZikr] = useState("");
  const [isZikrVisible, setIsZikrVisible] = useState(false);
  const [showUI, setShowUI] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [showColorGrid, setShowColorGrid] = useState(false);
  const [isSavedMode, setIsSavedMode] = useState(initialMode === "read");
  const [sessionStartTime] = useState(new Date());
  const [sessionEndTime, setSessionEndTime] = useState<Date | null>(null);
  const [sessionDuration, setSessionDuration] = useState("");
  const [showSessionReport, setShowSessionReport] = useState(false);
  const [showStatsPanel, setShowStatsPanel] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportFileName, setExportFileName] = useState("");
  const [exportFormat, setExportFormat] = useState<"pdf" | "docx">("pdf");
  const [isExporting, setIsExporting] = useState(false);

  // --- Lock System State ---
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [noteIsLocked, setNoteIsLocked] = useState(
    selectedNote?.isLocked || false,
  );
  const [notePassword, setNotePassword] = useState(
    selectedNote?.password || "",
  );
  const [newPassword, setNewPassword] = useState("");

  const editorRef = useRef<HTMLDivElement>(null);
  const [toolbarVisible, setToolbarVisible] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 });
  const [selectedHighlightColor, setSelectedHighlightColor] = useState<{ name: string; bg: string; text: string }>({
    name: "أصفر ساطع",
    bg: "#FFE600",
    text: "#000000",
  });

  // Sync content state to standard editor div (for Undo/Redo/external updates)
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== content) {
      editorRef.current.innerHTML = content;
    }
  }, [content]);
  const typingTimeoutRef = useRef<any>(null);
  const chapterRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const zikrTimeoutRef = useRef<any>(null);
  const zikrIndexRef = useRef(0);
  const headerRef = useRef<HTMLElement>(null); // Ref for the header element
  const tocListRef = useRef<HTMLDivElement>(null); // Ref for TOC scroll container

  // --- Intelligent Text Flow System State ---
  const [activeResizeId, setActiveResizeId] = useState<string | null>(null);
  const resizeIndicatorTimeoutRef = useRef<any>(null);

  useEffect(() => {
    const rawContent =
      selectedNote?.content || selectedNote?.preview || defaultContent;
    if (rawContent.includes(CHAPTER_SEPARATOR)) {
      const parts = rawContent.split(CHAPTER_SEPARATOR).filter(Boolean);
      const parsedChapters: Chapter[] = parts.map((part, index) => {
        const [chTitle, chContent] = part.split(TITLE_CONTENT_SEPARATOR);
        return {
          id: Date.now().toString() + index,
          title: chTitle || "",
          content: chContent || "",
        };
      });
      setChapters(
        parsedChapters.length > 0
          ? parsedChapters
          : [{ id: Date.now().toString(), title: "الفصل الأول", content: "" }],
      );
      setIsNovelMode(true);
      setContent("");
    } else {
      setContent(rawContent);
      setChapters([
        {
          id: Date.now().toString(),
          title: "الفصل الأول",
          content: rawContent,
        },
      ]);
      setIsNovelMode(false);
    }
    setTitle(selectedNote?.title || "");
    if (selectedNote?.styles) {
      setFontSize(selectedNote.styles.fontSize || 16);
      setActiveFontWeight(selectedNote.styles.fontWeight || 400);
      setTextAlign(selectedNote.styles.textAlign || "right");
      setTextColor(
        selectedNote.styles.textColor ||
          paperStyles[selectedNote.styles.paperStyleIndex || 0]
            .defaultTextColor,
      );
      setActivePaperStyleIndex(selectedNote.styles.paperStyleIndex || 0);
    }
    // Set Lock State
    setNoteIsLocked(selectedNote?.isLocked || false);
    setNotePassword(selectedNote?.password || "");

    setIsDirty(false);
    setIsSavedMode(initialMode === "read");
    setHistory([
      {
        content: rawContent,
        chapters: isNovelMode
          ? chapters
          : [{ id: "1", title: "", content: rawContent }],
        isNovel: isNovelMode,
      },
    ]);
  }, [selectedNote, initialMode]);

  const pushHistory = (
    newContent: string,
    newChapters: Chapter[],
    isNovel: boolean,
  ) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({
      content: newContent,
      chapters: JSON.parse(JSON.stringify(newChapters)),
      isNovel,
    });
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      if (prev.isNovel) {
        setIsNovelMode(true);
        setChapters(prev.chapters);
      } else {
        setIsNovelMode(false);
        setContent(prev.content);
      }
      setIsDirty(true);
    }
  };
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      if (next.isNovel) {
        setIsNovelMode(true);
        setChapters(next.chapters);
      } else {
        setIsNovelMode(false);
        setContent(next.content);
      }
      setIsDirty(true);
    }
  };

  const calculateDuration = (start: Date, end: Date) => {
    const diff = end.getTime() - start.getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    let r = "";
    if (h > 0) r += `${h} س و `;
    r += `${m} د`;
    if (m === 0 && h === 0) r = "أقل من دقيقة";
    return r;
  };
  const formatTime = (date: Date) =>
    date.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });

  const toggleNovelMode = () => {
    if (isNovelMode) {
      // Disable Novel Mode: CLEAR EVERYTHING as requested
      setContent("");
      setIsNovelMode(false);
      pushHistory(
        "",
        [{ id: Date.now().toString(), title: "", content: "" }],
        false,
      );
    } else {
      // Enable Novel Mode
      setChapters([
        { id: Date.now().toString(), title: "الفصل الأول", content: content },
      ]);
      setIsNovelMode(true);
      pushHistory(
        content,
        [{ id: Date.now().toString(), title: "الفصل الأول", content: content }],
        true,
      );
    }
    setIsDirty(true);
    setShowNovelMenu(false);
  };

  const addChapter = () => {
    const newChapter = { id: Date.now().toString(), title: "", content: "" };
    const newChapters = [...chapters, newChapter];
    setChapters(newChapters);
    pushHistory(content, newChapters, true);
    setIsDirty(true);
    setTimeout(() => {
      chapterRefs.current[newChapter.id]?.scrollIntoView({
        behavior: "smooth",
      });
      if (tocListRef.current) {
        tocListRef.current.scrollTo({
          top: tocListRef.current.scrollHeight,
          behavior: "smooth",
        });
      }
    }, 100);
  };

  const updateChapter = (
    id: string,
    field: "title" | "content",
    value: string,
  ) => {
    if (isSavedMode) return;
    if (field === "content") {
      setActiveResizeId(id);
      if (resizeIndicatorTimeoutRef.current)
        clearTimeout(resizeIndicatorTimeoutRef.current);
      resizeIndicatorTimeoutRef.current = setTimeout(
        () => setActiveResizeId(null),
        1200,
      );
    }
    const newChapters = chapters.map((c) =>
      c.id === id ? { ...c, [field]: value } : c,
    );
    setChapters(newChapters);
    setIsDirty(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      pushHistory(content, newChapters, true);
    }, 1000);
    setShowUI(false);
  };

  const removeChapter = (id: string) => {
    if (chapters.length <= 1) return;
    const newChapters = chapters.filter((c) => c.id !== id);
    setChapters(newChapters);
    pushHistory(content, newChapters, true);
    setIsDirty(true);
  };

  const scrollToChapter = (id: string) => {
    const chapterElement = chapterRefs.current[id];
    const headerElement = headerRef.current;

    if (chapterElement && headerElement) {
      const headerHeight = headerElement.offsetHeight;
      const chapterPosition =
        chapterElement.getBoundingClientRect().top + window.scrollY;
      const PADDING_TOP = 20; // A little space above the title

      window.scrollTo({
        top: chapterPosition - headerHeight - PADDING_TOP,
        behavior: "smooth",
      });
    }
    setShowTOC(false);
  };

  const handleSave = () => {
    const endTime = new Date();
    setSessionEndTime(endTime);
    setSessionDuration(calculateDuration(sessionStartTime, endTime));
    let finalContent = isNovelMode
      ? chapters
          .map((c) => `${c.title}${TITLE_CONTENT_SEPARATOR}${c.content}`)
          .join(CHAPTER_SEPARATOR)
      : content;
    if (onSave) {
      onSave({
        id: noteId,
        title: title,
        content: finalContent,
        styles: {
          fontSize,
          fontWeight: activeFontWeight,
          textAlign,
          textColor,
          paperStyleIndex: activePaperStyleIndex,
        },
        isLocked: noteIsLocked,
        password: notePassword,
      });
    }
    setIsSavedMode(true);
    setShowUI(true);
    setShowControls(false);
    setIsDirty(false);
  };

  // تصدير PDF (نفس آلية النسخة الإنتاجية)
  const handleExportPDF = async (fileName?: string) => {
    const displayTitle = fileName || title || "بدون عنوان";
    const safeTitle = displayTitle.replace(/[\\/:*?"<>|]/g, "_");
    setIsExporting(true);
    try {
      const pdfContent = isNovelMode
        ? chapters
            .map((c) => {
              const chTitle = c.title ? `<h2 style="font-family: 'Zain', sans-serif; font-weight: 900; font-size: 20px; color: ${currentTheme.accent}; text-align: center; margin-top: 30px; margin-bottom: 15px;">${c.title}</h2>` : "";
              return `${chTitle}${c.content}`;
            })
            .join("<div style='text-align: center; margin: 30px 0; color: #A7AA63; font-size: 20px;'>❦</div>")
        : content;

      const blob = await exportStoryToPdf(
        displayTitle,
        pdfContent,
        {
          fontSize,
          fontWeight: activeFontWeight,
          textAlign,
          textColor,
          paperStyleIndex: activePaperStyleIndex,
        },
        {
          bg: currentTheme.isDark ? "#0F1617" : "#F4F1EA",
          text: currentTheme.isDark ? "#EAE6D2" : "#121A1B",
          secondary: currentTheme.secondary,
        }
      );
      if (blob.size < 1000) {
        throw new Error("PDF blob is too small - likely blank");
      }
      downloadBlob(blob, `${safeTitle}.pdf`);
    } catch (e) {
      console.error("Error exporting PDF:", e);
      alert("حدث خطأ أثناء تصدير ملف PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportDOCX = async (fileName?: string) => {
    const displayTitle = fileName || title || "بدون عنوان";
    const safeTitle = displayTitle.replace(/[\\/:*?"<>|]/g, "_");
    
    const stripHtml = (html: string): string => {
      const parsedDoc = new DOMParser().parseFromString(html, "text/html");
      parsedDoc.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
      parsedDoc.querySelectorAll("div").forEach((div) => {
        const textNode = parsedDoc.createTextNode("\n" + div.textContent);
        div.replaceWith(textNode);
      });
      parsedDoc.querySelectorAll("p").forEach((p) => {
        const textNode = parsedDoc.createTextNode("\n" + p.textContent);
        p.replaceWith(textNode);
      });
      return (parsedDoc.body.textContent || "").trim();
    };

    const getDocxAlignment = (align: NoteStyles["textAlign"]) => {
      switch (align) {
        case "center":
          return AlignmentType.CENTER;
        case "left":
          return AlignmentType.LEFT;
        case "justify":
          return AlignmentType.JUSTIFIED; // <-- إضافة حالة الضبط
        default:
          return AlignmentType.RIGHT;
      }
    };
    const children = [
      new Paragraph({
        children: [new TextRun({ text: displayTitle, bold: true, size: 48 })],
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        bidirectional: true,
        spacing: { after: 400 },
      }),
    ];
    if (isNovelMode) {
      chapters.forEach((chapter, index) => {
        if (chapter.title) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: chapter.title,
                  bold: true,
                  size: 36,
                  color: "2C3E30",
                }),
              ],
              heading: HeadingLevel.HEADING_2,
              alignment: AlignmentType.CENTER,
              bidirectional: true,
              spacing: { before: 400, after: 200 },
            }),
          );
        }
        stripHtml(chapter.content).split("\n").forEach((line) => {
          const trimmed = line.trim();
          if (!trimmed) return;
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: trimmed,
                  size: Number(fontSize) * 1.5,
                }),
              ],
              alignment: getDocxAlignment(textAlign),
              bidirectional: true,
              spacing: { after: 200, line: 360 },
            }),
          );
        });
        if (index < chapters.length - 1) {
          children.push(new Paragraph({ children: [new PageBreak()] }));
        }
      });
    } else {
      stripHtml(content)
        .split("\n")
        .forEach((line) => {
          const trimmed = line.trim();
          if (!trimmed) return;
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: trimmed,
                  size: Number(fontSize) * 1.5,
                }),
              ],
              alignment: getDocxAlignment(textAlign),
              bidirectional: true,
              spacing: { after: 200, line: 360 },
            }),
          );
        });
    }
    const doc = new Document({
      creator: "دَارُ الحِكَايَاتِ",
      title: displayTitle,
      sections: [{ properties: {}, children }],
    });
    try {
      const blob = await Packer.toBlob(doc);
      await downloadBlob(blob, `${safeTitle}.docx`);
    } catch (error) {
      console.error("Error exporting:", error);
      alert("حدث خطأ أثناء تصدير الملف.");
    }
  };

  const handleContentChange = (newContent: string) => {
    if (isSavedMode || isNovelMode) return;
    setContent(newContent);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      pushHistory(newContent, [], false);
    }, 1000);
    setIsDirty(true);
    setShowUI(false);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;

    let success = false;
    try {
      success = document.execCommand("insertText", false, text);
    } catch (err) {
      success = false;
    }

    if (!success) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);

        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        if (editorRef.current) {
          editorRef.current.innerText += text;
        }
      }
    }

    if (editorRef.current) {
      handleContentChange(editorRef.current.innerHTML);
    }
  };

  const toggleFontWeight = () => {
    const nextIndex =
      (fontLevels.indexOf(activeFontWeight) + 1) % fontLevels.length;
    setActiveFontWeight(fontLevels[nextIndex]);
    setIsDirty(true);
  };
  const switchTexture = () => {
    const newIndex = (activePaperStyleIndex + 1) % paperStyles.length;
    setActivePaperStyleIndex(newIndex);
    setTextColor(paperStyles[newIndex].defaultTextColor);
    setIsDirty(true);
  };
  const updateTextColor = (c: string) => {
    setTextColor(c);
    setIsDirty(true);
  };

  // --- تحديث منطق المحاذاة ليشمل الضبط ---
  const updateTextAlign = () => {
    const alignments: NoteStyles["textAlign"][] = [
      "right",
      "center",
      "left",
      "justify",
    ];
    const currentIndex = alignments.indexOf(textAlign);
    const nextIndex = (currentIndex + 1) % alignments.length;
    setTextAlign(alignments[nextIndex]);
    setIsDirty(true);
  };

  const updateFontSize = (v: string) => {
    setFontSize(Number(v));
    setIsDirty(true);
  };
  const updateTitle = (v: string) => {
    setTitle(v);
    setIsDirty(true);
  };

  const handleBackNavigation = () => {
    if (!isSavedMode && isDirty) setShowConfirmDialog(true);
    else if (onBack) onBack();
  };
  const handleConfirmSave = () => {
    setIsDialogClosing(true);
    setTimeout(() => {
      handleSave();
      setShowConfirmDialog(false);
      setIsDialogClosing(false);
      if (onBack) onBack();
    }, 200);
  };
  const handleConfirmDiscard = () => {
    setIsDialogClosing(true);
    setTimeout(() => {
      setShowConfirmDialog(false);
      setIsDialogClosing(false);
      if (onBack) onBack();
    }, 200);
  };
  const handleReturnToEdit = () => {
    if (isSavedMode) {
      setIsSavedMode(false);
      setShowSessionReport(false);
    }
  };

  // --- Lock Logic ---
  const saveLockSettings = () => {
    if (!noteIsLocked) {
      // Locking with single password
      if (newPassword && newPassword.trim()) {
        setNoteIsLocked(true);
        setNotePassword(newPassword.trim());
        setIsDirty(true);
        setShowLockDialog(false);
        setNewPassword("");
      } else {
        alert("يرجى إدخال كلمة المرور لتأمين الحكاية");
      }
    } else {
      // Unlocking (Removing Lock)
      setNoteIsLocked(false);
      setNotePassword("");
      setIsDirty(true);
      setShowLockDialog(false);
    }
  };

  const checkIfSelectionIsInsideEditor = (range: Range) => {
    let node: Node | null = range.startContainer;
    while (node) {
      if (node instanceof HTMLElement) {
        if (node.classList.contains("editor-container")) {
          return true;
        }
      }
      node = node.parentNode;
    }
    return false;
  };

  const getChapterIdFromSelection = (range: Range): string | null => {
    let node: Node | null = range.startContainer;
    while (node) {
      if (node instanceof HTMLElement && node.hasAttribute("data-chapter-id")) {
        return node.getAttribute("data-chapter-id");
      }
      node = node.parentNode;
    }
    return null;
  };

  const triggerEditorUpdates = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    
    if (isNovelMode) {
      const chapterId = getChapterIdFromSelection(range);
      if (chapterId) {
        const chapterEl = document.querySelector(`[data-chapter-id="${chapterId}"]`);
        if (chapterEl instanceof HTMLElement) {
          const newHtml = chapterEl.innerHTML;
          
          setChapters((prev) => {
            const updated = prev.map((c) =>
              c.id === chapterId ? { ...c, content: newHtml } : c
            );
            
            if (isSavedMode) {
              const finalContent = updated
                .map((c) => `${c.title}${TITLE_CONTENT_SEPARATOR}${c.content}`)
                .join(CHAPTER_SEPARATOR);
              if (onSave) {
                onSave({
                  id: noteId,
                  title: title,
                  content: finalContent,
                  styles: {
                    fontSize,
                    fontWeight: activeFontWeight,
                    textAlign,
                    textColor,
                    paperStyleIndex: activePaperStyleIndex,
                  },
                  isLocked: noteIsLocked,
                  password: notePassword,
                });
              }
            } else {
              setIsDirty(true);
            }
            return updated;
          });
        }
      }
    } else {
      if (editorRef.current) {
        const newHtml = editorRef.current.innerHTML;
        setContent(newHtml);
        
        if (isSavedMode) {
          if (onSave) {
            onSave({
              id: noteId,
              title: title,
              content: newHtml,
              styles: {
                fontSize,
                fontWeight: activeFontWeight,
                textAlign,
                textColor,
                paperStyleIndex: activePaperStyleIndex,
              },
              isLocked: noteIsLocked,
              password: notePassword,
            });
          }
        } else {
          setIsDirty(true);
        }
      }
    }
  };

  const clearHighlightFromSelection = (selection: Selection, range: Range) => {
    const container = range.commonAncestorContainer;
    const elementsToUnwrap = new Set<HTMLElement>();
    
    let parent: Node | null = container;
    while (parent) {
      if (parent instanceof HTMLElement && (parent.classList.contains("highlight") || parent.classList.contains("hl"))) {
        elementsToUnwrap.add(parent);
      }
      parent = parent.parentNode;
    }
    
    const searchTarget = container instanceof HTMLElement ? container : container.parentNode;
    if (searchTarget instanceof HTMLElement) {
      const highlights = searchTarget.querySelectorAll(".highlight, .hl");
      highlights.forEach((hl) => {
        if (hl instanceof HTMLElement && (selection.containsNode(hl, true) || range.intersectsNode(hl))) {
          elementsToUnwrap.add(hl);
        }
      });
    }
    
    elementsToUnwrap.forEach((el) => {
      if (el.parentNode) {
        const fragment = document.createDocumentFragment();
        while (el.firstChild) {
          fragment.appendChild(el.firstChild);
        }
        el.parentNode.replaceChild(fragment, el);
      }
    });

    if (searchTarget instanceof HTMLElement) {
      searchTarget.normalize();
    }
  };

  const applyHighlight = (colorObj?: { name: string; bg: string; text: string }) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;

    const activeColor = colorObj || selectedHighlightColor;
    const range = selection.getRangeAt(0);

    // Clear existing highlight layers first so colors never stack on top of each other
    clearHighlightFromSelection(selection, range);

    const updatedSelection = window.getSelection();
    if (!updatedSelection || updatedSelection.isCollapsed || updatedSelection.rangeCount === 0) return;
    const newRange = updatedSelection.getRangeAt(0);

    const span = document.createElement("span");
    span.className = "highlight";
    span.style.backgroundColor = activeColor.bg;
    span.style.color = activeColor.text;
    span.style.borderRadius = "3px";
    span.style.padding = "0 4px";
    span.style.fontWeight = "600";
    span.style.boxDecorationBreak = "clone";
    (span.style as any).webkitBoxDecorationBreak = "clone";
    
    try {
      newRange.surroundContents(span);
    } catch (e) {
      const extract = newRange.extractContents();
      span.appendChild(extract);
      newRange.insertNode(span);
    }
    
    updatedSelection.removeAllRanges();
    
    triggerEditorUpdates();
  };

  const removeHighlight = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    clearHighlightFromSelection(selection, range);
    selection.removeAllRanges();
    triggerEditorUpdates();
  };

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        setToolbarVisible(false);
        return;
      }
      
      const range = selection.getRangeAt(0);
      const text = selection.toString().trim();
      
      if (selection.isCollapsed || text.length === 0) {
        setToolbarVisible(false);
        return;
      }
      
      const isInside = checkIfSelectionIsInsideEditor(range);
      if (!isInside) {
        setToolbarVisible(false);
        return;
      }
      
      const rect = range.getBoundingClientRect();
      
      // Intelligent positioning: if selection is too close to top of screen, show toolbar BELOW selection
      // Otherwise, show it ABOVE selection with safe space to avoid overlapping system Copy/Paste popups
      const showBelow = rect.top < 120;
      const top = showBelow
        ? rect.bottom + window.scrollY + 60
        : rect.top + window.scrollY - 95;
      
      const left = Math.max(60, Math.min(window.innerWidth - 60, rect.left + rect.width / 2));
      
      setToolbarPosition({ top, left });
      setToolbarVisible(true);
    };
    
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [isSavedMode, isNovelMode, chapters, content, selectedHighlightColor]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentZikr(zikrReminders[zikrIndexRef.current]);
      zikrIndexRef.current = (zikrIndexRef.current + 1) % zikrReminders.length;
      setIsZikrVisible(true);
      if (zikrTimeoutRef.current) clearTimeout(zikrTimeoutRef.current);
      zikrTimeoutRef.current = setTimeout(() => setIsZikrVisible(false), 5000);
    }, 30000);
    return () => clearInterval(intervalId);
  }, []);

  // --- New Robust Scroll Logic for Header/Footer ---
  useEffect(() => {
    let scrollTimeout: any;

    const handleScroll = () => {
      // 1. Hide UI immediately on ANY scroll activity
      setShowUI(false);

      // 2. Clear the previous timeout that would have shown the UI
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      // 3. Set a new timeout to show UI only after scrolling completely stops
      scrollTimeout = setTimeout(() => {
        setShowUI(true);
      }, 350); // Snappy, responsive delay to restore UI after scrolling
    };

    // Use passive listener for best performance
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  }, []); // Empty dependency array to run only once

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      if (
        !event.target.closest(".toc-card") &&
        !event.target.closest(".toc-toggle")
      )
        setShowTOC(false);
      if (
        !event.target.closest(".novel-menu") &&
        !event.target.closest(".novel-menu-trigger")
      )
        setShowNovelMenu(false);
      if (
        !event.target.closest(".session-toggle") &&
        !event.target.closest(".session-card")
      )
        setShowSessionReport(false);
      if (
        !event.target.closest(".stats-panel") &&
        !event.target.closest(".stats-trigger")
      )
        setShowStatsPanel(false);
      if (!event.target.closest(".lock-dialog")) setShowLockDialog(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getBackgroundStyle = () => {
    const baseSize = Number(fontSize) * 2.2;
    const style = paperStyles[activePaperStyleIndex];
    const styleId = style.id;
    if (styleId === "minimalist") return { backgroundColor: "#F4F1EA" };
    if (styleId === "classic")
      return {
        backgroundColor: "#fdfbf7",
        backgroundImage: `linear-gradient(rgba(0,0,0,0.08) 1px, transparent 1px)`,
        backgroundSize: `100% ${baseSize}px`,
        backgroundAttachment: "local",
      };
    if (styleId === "linen")
      return {
        backgroundColor: "#EAE6D2",
        backgroundImage:
          'url("https://www.transparenttextures.com/patterns/subtle-linen.png")',
      };
    if (styleId === "vintage")
      return {
        backgroundColor: "#e3d0b1",
        backgroundImage:
          'url("https://www.transparenttextures.com/patterns/parchment.png")',
        boxShadow: "inset 0 0 100px rgba(0,0,0,0.1)",
      };
    if (styleId === "desert_nights")
      return {
        backgroundColor: "#191928",
        backgroundImage:
          'url("https://www.transparenttextures.com/patterns/stardust.png")',
      };
    if (styleId === "forest_manuscript")
      return {
        backgroundColor: "#2A3F3A",
        backgroundImage:
          'url("https://www.transparenttextures.com/patterns/natural-paper.png")',
        boxShadow: "inset 0 0 150px rgba(0,0,0,0.3)",
      };
    if (styleId === "cloud_whisper")
      return {
        background: "linear-gradient(180deg, #a8d5e5 0%, #f7cac9 100%)",
      };
    if (styleId === "magma_ink")
      return {
        backgroundColor: "#1C1C1C",
        backgroundImage:
          'url("https://www.transparenttextures.com/patterns/rocky-wall.png")',
        boxShadow: "inset 0 -100px 80px -80px rgba(255, 80, 0, 0.3)",
      };
    if (styleId === "aether_tablet")
      return {
        backgroundColor: "#222831",
        backgroundImage:
          'url("https://www.transparenttextures.com/patterns/clean-gray-paper.png")',
        boxShadow: "inset 0 0 40px rgba(0, 200, 200, 0.15)",
      };
    if (styleId === "abyssal_texts")
      return {
        background: "radial-gradient(ellipse at bottom, #0d1b2a 0%, #000 100%)",
        boxShadow: "inset 0 100px 100px -50px rgba(150, 224, 240, 0.1)",
      };
    if (styleId === "celestial_quill")
      return {
        background:
          "linear-gradient(160deg, #000010 0%, #1a0033 50%, #330044 100%)",
        backgroundImage:
          'url("https://www.transparenttextures.com/patterns/stardust.png"), linear-gradient(160deg, #000010 0%, #1a0033 50%, #330044 100%)',
      };
    if (styleId === "serenity_garden")
      return {
        backgroundColor: "#F4F4F4",
        backgroundImage:
          'url("https://www.transparenttextures.com/patterns/sand.png")',
      };
    if (styleId === "crimson_codex")
      return {
        backgroundColor: "#1A0000",
        backgroundImage:
          'url("https://www.transparenttextures.com/patterns/black-felt.png")',
        boxShadow: "inset 0 0 150px rgba(100, 0, 0, 0.5)",
      };
    if (styleId === "memory_mirage")
      return {
        background: "radial-gradient(circle at 100% 0%, #f3e7e9, #e3eeff)",
        backgroundImage:
          'url("https://www.transparenttextures.com/patterns/noisy.png"), radial-gradient(circle at 100% 0%, #f3e7e9, #e3eeff)',
      };
    if (styleId === "inventor_workshop")
      return {
        backgroundColor: "#C8B9A5",
        backgroundImage:
          'url("https://www.transparenttextures.com/patterns/blueprint.png"), url("https://www.transparenttextures.com/patterns/worn-dots.png")',
        backgroundBlendMode: "multiply",
      };
    return { backgroundColor: "#F4F1EA" };
  };

  const wordCount = isNovelMode
    ? chapters.reduce(
        (acc, curr) =>
          acc +
          (curr.content.trim() === ""
            ? 0
            : curr.content.trim().split(/\s+/).length),
        0,
      )
    : content.trim() === ""
      ? 0
      : content.trim().split(/\s+/).length;
  const charCount = isNovelMode
    ? chapters.reduce((acc, curr) => acc + curr.content.length, 0)
    : content.length;

  // --- Professional Stats Calculation ---
  const readingTime = Math.ceil(wordCount / 200); // Average silent reading speed
  const speakingTime = Math.ceil(wordCount / 130); // Average speaking speed
  const estimatedPages = Math.max(1, Math.ceil(wordCount / 500)); // Approx 500 words per single-spaced A4 page

  return (
    <div
      className="min-h-screen w-full relative font-sans transition-all duration-500 ease-in-out"
      dir="rtl"
      style={getBackgroundStyle()}
      onClick={(e) => {
        if (!(e.target instanceof Element)) return;
        if (!showUI) {
          setShowUI(true);
          return;
        }
        if (isSavedMode) {
          if (!e.target.closest("header, .session-card, .toc-card, .export-dialog, .confirm-dialog, .lock-dialog")) {
            handleReturnToEdit();
          }
        } else {
          if (
            !e.target.closest(
              "button, footer, .novel-menu, .color-grid, .toc-card, .stats-panel, .export-dialog, .confirm-dialog, .lock-dialog",
            )
          ) {
            setShowUI(true);
          }
        }
      }}
    >
      <style>{`
        .font-zain-light { font-family: 'Zain', sans-serif; font-weight: 200; } .font-zain-reg { font-family: 'Zain', sans-serif; font-weight: 400; } .font-zain-bold { font-family: 'Zain', sans-serif; font-weight: 700; } .font-zain-xbold { font-family: 'Zain', sans-serif; font-weight: 900; }
        textarea::-webkit-scrollbar { display: none; } body { overflow-x: hidden; } textarea { transition: color 0.3s ease, font-weight 0.3s ease; }
        input::placeholder, textarea::placeholder { color: currentColor; opacity: 0.5; }
        .chapter-separator { display: flex; align-items: center; justify-content: center; margin: 40px 0; opacity: 0.5; }
        .chapter-line { height: 1px; background: linear-gradient(90deg, transparent, #A7AA63, transparent); flex: 1; }
        .chapter-icon { color: #A7AA63; margin: 0 15px; font-size: 24px; }
        .custom-scroll::-webkit-scrollbar { width: 4px; } .custom-scroll::-webkit-scrollbar-thumb { background-color: ${currentTheme.accent}40; border-radius: 4px; }
        .highlight, .hl {
          background-color: ${currentTheme.accent}40;
          border-radius: 2px;
          padding: 0 2px;
          box-decoration-break: clone;
          -webkit-box-decoration-break: clone;
        }
        .editor-container[contenteditable="true"]:empty::before,
        .editor-container[contenteditable="true"].is-empty::before {
          content: attr(data-placeholder);
          color: currentColor;
          opacity: 0.5;
          pointer-events: none;
          display: block;
        }
        .editor-container[contenteditable="false"]:empty::before,
        .editor-container[contenteditable="false"].is-empty::before {
          content: "";
        }
      `}</style>

      {/* Zikr Toast */}
      <div
        className={`fixed top-20 left-1/2 -translate-x-1/2 z-40 transition-all duration-700 ${isZikrVisible ? "opacity-100" : "opacity-0 -translate-y-10 scale-90 pointer-events-none"}`}
      >
        <div
          className="backdrop-blur-md rounded-full px-5 py-1.5 border shadow-xl"
          style={{
            backgroundColor: currentTheme.glass,
            borderColor: currentTheme.border,
          }}
        >
          <p
            className="font-zain-bold text-base tracking-wide whitespace-nowrap drop-shadow-md"
            style={{ color: currentTheme.accent }}
          >
            {currentZikr}
          </p>
        </div>
      </div>

      {/* Confirm Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            className={`confirm-dialog border shadow-2xl text-center ${isDialogClosing ? "animate-out zoom-out-95 duration-200" : "animate-in zoom-in-95 duration-200"}`}
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
            <div className="flex justify-center mb-3">
              <Save
                className="w-8 h-8"
                style={{ color: currentTheme.accent }}
              />
            </div>
            <h2
              className="text-lg font-zain-bold mb-5 tracking-tight leading-tight"
              style={{ color: currentTheme.text }}
            >
              هل تريد حفظ التغييرات؟
            </h2>
            <div className="flex gap-2">
              <button
                onClick={handleConfirmDiscard}
                className="flex-1 py-2 rounded-full font-zain-bold text-sm border transition-all active:scale-95"
                style={{ 
                  backgroundColor: "transparent",
                  borderColor: currentTheme.border,
                  color: currentTheme.text 
                }}
              >
                تجاهل
              </button>
              <button
                onClick={handleConfirmSave}
                className="flex-1 py-2 rounded-full font-zain-bold text-sm transition-all active:scale-95 shadow-sm text-[#121A1B]"
                style={{ backgroundColor: currentTheme.accent }}
              >
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Dialog - Compact & Rounded Redesign */}
      {showExportDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            className="export-dialog border shadow-2xl text-center animate-in zoom-in-95 duration-200"
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
            <div className="flex justify-center mb-3">
              <FileDown
                className="w-8 h-8"
                style={{ color: currentTheme.accent }}
              />
            </div>
            <h2
              className="text-lg font-zain-bold mb-1 tracking-tight leading-tight"
              style={{ color: currentTheme.text }}
            >
              تصدير الحكاية كـ {exportFormat === "pdf" ? "PDF" : "Word"}
            </h2>
            <p
              className="text-[11px] font-zain-reg mb-5 opacity-70 leading-relaxed max-w-[220px] mx-auto"
              style={{ color: currentTheme.text }}
            >
              اختر اسماً لملف{" "}
              {exportFormat === "pdf" ? "الـ PDF" : "الوثيقة"}. يمكنك استخدام
              العنوان الحالي أو تخصيص اسم جديد.
            </p>

            {/* اختيار تنسيق التصدير (كما في الإنتاج) */}
            <div className="flex gap-2 mb-4 p-1 rounded-full border" style={{ borderColor: currentTheme.border, backgroundColor: `${currentTheme.accent}05` }}>
              <button
                onClick={() => setExportFormat("pdf")}
                className={`flex-1 py-2 rounded-full font-zain-bold text-sm border transition-all active:scale-95 ${
                  exportFormat === "pdf" ? "" : "opacity-60"
                }`}
                style={{
                  backgroundColor:
                    exportFormat === "pdf"
                      ? currentTheme.accent
                      : "transparent",
                  borderColor:
                    exportFormat === "pdf"
                      ? "transparent"
                      : "transparent",
                  color:
                    exportFormat === "pdf"
                      ? currentTheme.bg
                      : currentTheme.text,
                }}
              >
                تصدير PDF
              </button>
              <button
                onClick={() => setExportFormat("docx")}
                className={`flex-1 py-2 rounded-full font-zain-bold text-sm border transition-all active:scale-95 ${
                  exportFormat === "docx" ? "" : "opacity-60"
                }`}
                style={{
                  backgroundColor:
                    exportFormat === "docx"
                      ? currentTheme.accent
                      : "transparent",
                  borderColor:
                    exportFormat === "docx"
                      ? "transparent"
                      : "transparent",
                  color:
                    exportFormat === "docx"
                      ? currentTheme.bg
                      : currentTheme.text,
                }}
              >
                تصدير Word
              </button>
            </div>

            <input
              type="text"
              value={exportFileName}
              onChange={(e) => setExportFileName(e.target.value)}
              className="w-full h-11 rounded-full text-center outline-none border focus:border-opacity-100 transition-all font-zain-bold mb-4 text-sm px-4"
              style={{
                backgroundColor: "rgba(0,0,0,0.03)",
                borderColor: currentTheme.border,
                color: currentTheme.text,
              }}
              placeholder="اسم الملف..."
            />
            
            <div className="flex gap-2">
              <button
                onClick={() => setShowExportDialog(false)}
                className="flex-1 py-2 rounded-full font-zain-bold text-sm border transition-all active:scale-95"
                style={{ 
                  backgroundColor: "transparent",
                  borderColor: currentTheme.border,
                  color: currentTheme.text 
                }}
              >
                إلغاء
              </button>
              <button
                disabled={isExporting}
                onClick={() => {
                  if (exportFormat === "pdf") {
                    handleExportPDF(exportFileName);
                  } else {
                    handleExportDOCX(exportFileName);
                  }
                  setShowExportDialog(false);
                }}
                className="flex-1 py-2 rounded-full font-zain-bold text-sm transition-all active:scale-95 shadow-sm text-[#121A1B]"
                style={{
                  backgroundColor: currentTheme.accent,
                  opacity: isExporting ? 0.6 : 1,
                }}
              >
                {isExporting
                  ? "جاري التصدير..."
                  : "تصدير"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lock Setup Dialog - Compact & Rounded Redesign */}
      {showLockDialog && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowLockDialog(false);
              setNewPassword("");
            }
          }}
        >
          <div
            className="lock-dialog border shadow-2xl text-center animate-in zoom-in-95 duration-200"
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
              {noteIsLocked ? "إلغاء قفل الحكاية" : "تأمين الحكاية"}
            </h2>

            {/* Description */}
            <p
              className="text-xs font-zain-reg mb-4 opacity-70 leading-relaxed text-center px-1"
              style={{ color: currentTheme.text }}
            >
              {noteIsLocked
                ? "هل ترغب في إزالة كلمة المرور وإتاحة الحكاية للقراءة؟"
                : "أدخل كلمة المرور لحماية الحكاية وقفلها."}
            </p>

            {/* Password Input Field - Circular/Capsule border radius matching navigation pills */}
            {!noteIsLocked && (
              <div className="mb-4 w-full flex justify-center">
                <input
                  type="password"
                  placeholder="كلمة المرور"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveLockSettings()}
                  autoFocus
                  className="w-full text-center font-zain-bold text-sm outline-none border transition-all"
                  style={{
                    height: "42px",
                    borderRadius: "9999px",
                    backgroundColor: `${currentTheme.accent}0a`,
                    borderColor: `${currentTheme.accent}40`,
                    color: currentTheme.text,
                  }}
                />
              </div>
            )}

            {/* Action Buttons - Capsule Pill Confirm Button with explicit inline padding & nowrap */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={saveLockSettings}
                className="font-zain-bold text-xs text-white shadow-sm active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                style={{
                  height: "34px",
                  padding: "0 22px",
                  borderRadius: "9999px",
                  backgroundColor: currentTheme.accent,
                  whiteSpace: "nowrap",
                }}
              >
                {noteIsLocked ? "إزالة القفل" : "تأكيد"}
              </button>
              <button
                onClick={() => {
                  setShowLockDialog(false);
                  setNewPassword("");
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

      {/* Header (Editor and Reader Mode Top Bar) */}
      <header
        ref={headerRef}
        className={`fixed top-4 left-0 right-0 z-50 px-4 pointer-events-none flex justify-center items-center transition-all duration-300 ease-out ${showUI ? "translate-y-0 opacity-100" : "-translate-y-16 opacity-0"}`}
      >
        <div
          className="pointer-events-auto w-full max-w-sm h-12 p-1.5 rounded-full backdrop-blur-2xl border shadow-2xl flex justify-between items-center gap-1.5 transition-all"
          style={{
            backgroundColor: currentTheme.glass,
            borderColor: currentTheme.border,
            boxShadow: `0 12px 32px -4px ${currentTheme.shadow || "rgba(0,0,0,0.15)"}`,
          }}
        >
          <div className="flex items-center gap-1 flex-1 min-w-0 pr-1">
            <button
              onClick={handleBackNavigation}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer flex-shrink-0"
              style={{ color: currentTheme.text }}
              title={isSavedMode ? "خروج" : "رجوع"}
            >
              <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
            </button>
            <div className="flex flex-col items-start min-w-0 h-9 justify-center flex-1">
              {isEditingTitle && !isSavedMode ? (
                <input
                  value={title}
                  placeholder="بدون عنوان"
                  onChange={(e) => updateTitle(e.target.value)}
                  onBlur={() => setIsEditingTitle(false)}
                  className="bg-transparent text-sm font-zain-xbold text-right outline-none w-full border-b leading-tight"
                  style={{
                    color: currentTheme.text,
                    borderColor: currentTheme.border,
                  }}
                  autoFocus
                />
              ) : (
                <div className="flex items-center gap-1.5 min-w-0 max-w-full">
                  <h1
                    onClick={() => !isSavedMode && setIsEditingTitle(true)}
                    className={`text-sm font-zain-xbold truncate text-right leading-tight ${!isSavedMode ? "cursor-pointer" : ""}`}
                    style={{ color: currentTheme.text }}
                    title={title || "بدون عنوان"}
                  >
                    {title || "بدون عنوان"}
                  </h1>
                  {noteIsLocked && (
                    <Lock
                      className="w-3 h-3 flex-shrink-0"
                      style={{ color: currentTheme.accent }}
                    />
                  )}
                </div>
              )}
              <div
                className={`overflow-hidden transition-all duration-300 ${isDirty && !isSavedMode ? "max-h-4" : "max-h-0 opacity-0"}`}
              >
                <span
                  className="text-[8px] font-zain-bold block leading-none pt-0.5"
                  style={{ color: currentTheme.secondary }}
                >
                  توجد تغييرات غير محفوظة
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {!isSavedMode ? (
              <>
                <div className="relative">
                  <button
                    onClick={() => setShowNovelMenu(!showNovelMenu)}
                    className="novel-menu-trigger w-9 h-9 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer relative"
                    style={{
                      color: isNovelMode
                        ? currentTheme.accent
                        : currentTheme.secondary,
                    }}
                    title="إعدادات الرواية"
                  >
                    <BookOpenText className="w-4 h-4" />
                    {isNovelMode && (
                      <span
                        className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: currentTheme.accent }}
                      ></span>
                    )}
                  </button>
                  {showNovelMenu && (
                    <div
                      className="novel-menu absolute top-full left-0 mt-2 min-w-[195px] border rounded-2xl shadow-2xl z-[70] animate-in fade-in zoom-in-95 p-1.5 transition-all"
                      style={{
                        backgroundColor: currentTheme.bg,
                        borderColor: currentTheme.border,
                        boxShadow: `0 16px 36px -6px ${currentTheme.shadow || "rgba(0,0,0,0.25)"}`,
                      }}
                    >
                      <button
                        onClick={toggleNovelMode}
                        className="w-full text-right px-3 py-2 rounded-xl active:scale-95 flex items-center justify-between gap-3 mb-1 cursor-pointer transition-all"
                        style={{
                          backgroundColor: "transparent",
                          color: currentTheme.text,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = `${currentTheme.accent}14`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        <span
                          className="font-zain-bold text-xs whitespace-nowrap leading-none pt-0.5"
                          style={{ color: currentTheme.text }}
                        >
                          {isNovelMode ? "تعطيل الرواية" : "تفعيل الرواية"}
                        </span>
                        <Book
                          className="w-4 h-4 flex-shrink-0"
                          style={{ color: currentTheme.accent }}
                        />
                      </button>
                      {isNovelMode && (
                        <button
                          onClick={() => {
                            setShowTOC(true);
                            setShowNovelMenu(false);
                          }}
                          className="toc-toggle w-full text-right px-3 py-2 rounded-xl active:scale-95 flex items-center justify-between gap-3 cursor-pointer transition-all"
                          style={{
                            backgroundColor: "transparent",
                            color: currentTheme.text,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = `${currentTheme.accent}14`;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "transparent";
                          }}
                        >
                          <span
                            className="font-zain-bold text-xs whitespace-nowrap leading-none pt-0.5"
                            style={{ color: currentTheme.text }}
                          >
                            فهرس الفصول
                          </span>
                          <List
                            className="w-4 h-4 flex-shrink-0"
                            style={{ color: currentTheme.accent }}
                          />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* LOCK BUTTON */}
                <button
                  onClick={() => setShowLockDialog(true)}
                  className={`w-9 h-9 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer ${noteIsLocked ? "text-green-600" : ""}`}
                  style={{
                    color: noteIsLocked
                      ? currentTheme.accent
                      : currentTheme.secondary,
                  }}
                  title={noteIsLocked ? "الحكاية مؤمنة" : "تأمين الحكاية"}
                >
                  {noteIsLocked ? (
                    <Lock className="w-4 h-4" />
                  ) : (
                    <Unlock className="w-4 h-4" />
                  )}
                </button>

                <div
                  className="w-px h-5 mx-0.5"
                  style={{ backgroundColor: currentTheme.border }}
                ></div>

                <button
                  onClick={handleUndo}
                  disabled={historyIndex <= 0}
                  className={`w-9 h-9 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all ${historyIndex > 0 ? "cursor-pointer" : "cursor-not-allowed opacity-40"}`}
                  style={{
                    color:
                      historyIndex > 0
                        ? currentTheme.text
                        : currentTheme.secondary,
                  }}
                  title="تراجع"
                >
                  <Undo2 className="w-4 h-4" />
                </button>

                <button
                  onClick={handleRedo}
                  disabled={historyIndex >= history.length - 1}
                  className={`w-9 h-9 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all ${historyIndex < history.length - 1 ? "cursor-pointer" : "cursor-not-allowed opacity-40"}`}
                  style={{
                    color:
                      historyIndex < history.length - 1
                        ? currentTheme.text
                        : currentTheme.secondary,
                  }}
                  title="إعادة"
                >
                  <Redo2 className="w-4 h-4" />
                </button>

                <button
                  onClick={handleSave}
                  className="w-9 h-9 flex items-center justify-center rounded-full active:scale-95 transition-all cursor-pointer shadow-sm"
                  style={{
                    backgroundColor: currentTheme.accent,
                    color: currentTheme.bg,
                  }}
                  title="حفظ الحكاية"
                >
                  <Check className="w-4 h-4" strokeWidth={2.8} />
                </button>
              </>
            ) : (
              <div className="relative flex items-center gap-1.5">
                <button
                  onClick={() => setShowSessionReport(!showSessionReport)}
                  className="session-toggle w-9 h-9 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
                  title="تقرير الجلسة"
                  style={{ color: currentTheme.text }}
                >
                  <Clock className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setExportFileName(title || "بدون عنوان");
                    setShowExportDialog(true);
                  }}
                  title="تصدير Word"
                  className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
                  style={{ color: currentTheme.text }}
                >
                  <FileDown className="w-4 h-4" />
                </button>
                <div
                  className="h-7 px-2.5 rounded-full border flex items-center justify-center text-xs font-zain-bold whitespace-nowrap pt-0.5"
                  style={{
                    backgroundColor: `${currentTheme.accent}18`,
                    borderColor: `${currentTheme.accent}30`,
                    color: currentTheme.accent,
                  }}
                >
                  وضع القراءة
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Table of Contents - Left Side Floating Card */}
      {isNovelMode && (
        <div
          className={`toc-card fixed top-20 left-4 z-[60] w-72 max-w-[calc(100vw-2rem)] flex flex-col border rounded-2xl shadow-2xl transition-all duration-300 overflow-hidden ${showTOC ? "opacity-100 translate-y-0 scale-100 pointer-events-auto" : "opacity-0 -translate-y-2 scale-95 pointer-events-none"}`}
          style={{
            maxHeight: "300px",
            backgroundColor: currentTheme.bg,
            borderColor: currentTheme.border,
            boxShadow: `0 20px 40px -8px ${currentTheme.shadow || "rgba(0,0,0,0.25)"}`,
          }}
        >
          {/* Header without icon - Pure typography & count badge */}
          <div
            className="px-3.5 py-2.5 border-b flex justify-between items-center flex-shrink-0"
            style={{ borderColor: currentTheme.border, flexShrink: 0 }}
          >
            <div className="flex items-center gap-2">
              <span
                className="font-zain-xbold text-sm leading-none pt-0.5"
                style={{ color: currentTheme.text }}
              >
                فهرس الفصول
              </span>
              <span
                className="text-[10px] font-zain-bold px-2 py-0.5 rounded-full leading-none"
                style={{
                  backgroundColor: `${currentTheme.accent}18`,
                  color: currentTheme.accent,
                  border: `1px solid ${currentTheme.accent}30`,
                }}
              >
                {chapters.length} {chapters.length === 1 ? "فصل" : "فصول"}
              </span>
            </div>
            <button
              onClick={() => setShowTOC(false)}
              className="w-6 h-6 rounded-full flex items-center justify-center active:scale-90 transition-all cursor-pointer"
              style={{ color: currentTheme.secondary }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = `${currentTheme.accent}15`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
              title="إغلاق الفهرس"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Internal Scrollable Chapter List - Strictly constrained */}
          <div
            ref={tocListRef}
            className="overflow-y-auto p-2 custom-scroll space-y-1"
            style={{
              flex: "1 1 0%",
              minHeight: 0,
              overflowY: "auto",
            }}
          >
            {chapters.map((chap, idx) => (
              <button
                key={chap.id}
                onClick={() => scrollToChapter(chap.id)}
                className="w-full text-right px-2.5 py-2 rounded-xl active:scale-[0.98] group flex items-center gap-2 transition-all cursor-pointer"
                style={{
                  backgroundColor: "transparent",
                  color: currentTheme.text,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = `${currentTheme.accent}14`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-zain-bold flex-shrink-0"
                  style={{
                    backgroundColor: `${currentTheme.accent}20`,
                    color: currentTheme.accent,
                  }}
                >
                  {idx + 1}
                </span>
                <span
                  className="font-zain-bold text-xs truncate flex-1 leading-tight pt-0.5"
                  style={{ color: currentTheme.text }}
                >
                  {chap.title || "فصل بدون عنوان"}
                </span>
              </button>
            ))}
          </div>

          {/* Fixed Pinned Bottom Action Button */}
          {!isSavedMode && (
            <div
              className="p-2 border-t mt-auto flex-shrink-0"
              style={{ borderColor: currentTheme.border, flexShrink: 0 }}
            >
              <button
                onClick={addChapter}
                className="w-full h-8.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer hover:opacity-90"
                style={{
                  backgroundColor: `${currentTheme.accent}15`,
                  border: `1px dashed ${currentTheme.accent}60`,
                  color: currentTheme.accent,
                }}
                title="إضافة فصل جديد"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                <span className="font-zain-bold text-xs pt-0.5">فصل جديد</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Session Report */}
      {isSavedMode && showSessionReport && (
        <div className="session-card fixed top-20 right-4 z-50 w-80 animate-in slide-in-from-top-4 fade-in">
          <div
            className="backdrop-blur-xl border p-5 rounded-2xl shadow-2xl"
            style={{
              backgroundColor: currentTheme.glass,
              borderColor: currentTheme.border,
            }}
          >
            <div
              className="flex items-center justify-between gap-2 mb-4 border-b pb-3"
              style={{ borderColor: currentTheme.border }}
            >
              <div className="flex items-center gap-2">
                <Clock
                  className="w-5 h-5"
                  style={{ color: currentTheme.accent }}
                />
                <h3
                  className="font-zain-xbold text-lg"
                  style={{ color: currentTheme.accent }}
                >
                  تقرير الجلسة
                </h3>
              </div>
              <button
                onClick={() => setShowSessionReport(false)}
                className="hover:opacity-70"
                style={{ color: currentTheme.secondary }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 font-zain-reg text-sm">
              <div className="flex justify-between items-center">
                <span style={{ color: currentTheme.secondary }}>
                  بداية الإلهام:
                </span>
                <span
                  className="font-zain-bold"
                  dir="ltr"
                  style={{ color: currentTheme.text }}
                >
                  {formatTime(sessionStartTime)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: currentTheme.secondary }}>
                  لحظة الختام:
                </span>
                <span
                  className="font-zain-bold"
                  dir="ltr"
                  style={{ color: currentTheme.text }}
                >
                  {sessionEndTime ? formatTime(sessionEndTime) : "..."}
                </span>
              </div>
              <div
                className="mt-2 pt-2 border-t flex justify-between items-center p-2 rounded-lg"
                style={{
                  borderColor: currentTheme.border,
                  backgroundColor: `${currentTheme.accent}10`,
                }}
              >
                <span style={{ color: currentTheme.accent }}>
                  المدة المستغرقة:
                </span>
                <span
                  className="font-zain-xbold"
                  style={{ color: currentTheme.accent }}
                >
                  {sessionDuration}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main id="story-content" className="w-full relative z-0 pb-36">
        {!isNovelMode ? (
          <div
            ref={editorRef}
            contentEditable={!isSavedMode}
            onInput={(e) => handleContentChange(e.currentTarget.innerHTML)}
            onPaste={handlePaste}
            data-placeholder="اكتب حكايتك هنا..."
            className={`w-full bg-transparent border-none outline-none px-6 leading-loose pt-28 min-h-[60vh] editor-container ${
              !content || content === "<br>" ? "is-empty" : ""
            }`}
            style={{
              fontSize: `${fontSize}px`,
              fontFamily: "'Zain', sans-serif",
              fontWeight: activeFontWeight,
              textAlign: textAlign,
              color: textColor,
              lineHeight: 2.2,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
            spellCheck={false}
          />
        ) : (
          // CRITICAL FIX: Removed dynamic padding. Uses fixed padding now to prevent layout thrashing.
          <div className="w-full px-4 md:px-6 pt-28">
            {chapters.map((chapter, index) => (
              <ChapterItem
                key={chapter.id}
                chapter={chapter}
                index={index}
                onUpdate={updateChapter}
                onRemove={removeChapter}
                isSavedMode={isSavedMode}
                styles={{
                  fontSize,
                  fontWeight: activeFontWeight,
                  textAlign,
                  textColor,
                  accentColor: currentTheme.accent,
                }}
                showFlowIndicator={activeResizeId === chapter.id}
                canBeDeleted={chapters.length > 1}
                containerRef={(el) => (chapterRefs.current[chapter.id] = el)}
              />
            ))}
          </div>
        )}
      </main>

      {isSavedMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <span
            className="text-xs animate-pulse font-zain-reg"
            style={{ color: currentTheme.secondary }}
          >
            اضغط على النص للعودة للكتابة
          </span>
        </div>
      )}

      {/* Editor Bottom Bar */}
      {!isSavedMode && (
        <footer
          className={`fixed bottom-4 left-0 right-0 z-40 px-4 pointer-events-none flex justify-center items-center transition-all duration-300 ease-out ${showUI ? "translate-y-0 opacity-100" : "translate-y-16 opacity-0"}`}
        >
          <div
            className="pointer-events-auto w-full max-w-sm h-12 p-1.5 rounded-full backdrop-blur-2xl border shadow-2xl flex justify-between items-center gap-2 transition-all"
            style={{
              backgroundColor: currentTheme.glass,
              borderColor: currentTheme.border,
              boxShadow: `0 12px 32px -4px ${currentTheme.shadow || "rgba(0,0,0,0.15)"}`,
            }}
          >
            {/* Right Group */}
            <div className="flex-1 flex justify-start items-center">
              {isNovelMode ? (
                <button
                  onClick={addChapter}
                  className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
                  style={{ color: currentTheme.accent }}
                  title="فصل جديد"
                >
                  <Plus className="w-4 h-4" />
                </button>
              ) : (
                <div className="w-9 h-9"></div> /* Sized placeholder to balance the layout */
              )}
            </div>

            {/* Center Button */}
            <div className="flex-shrink-0">
              <button
                onClick={() => {
                  setShowControls(!showControls);
                  setShowColorGrid(false);
                  setShowStatsPanel(false);
                }}
                className={`w-9 h-9 rounded-full flex items-center justify-center shadow-md border backdrop-blur-md transition-all duration-300 overflow-hidden cursor-pointer active:scale-95 ${showControls ? "scale-90 opacity-80" : "hover:scale-105"}`}
                style={{
                  backgroundColor: showControls
                    ? currentTheme.glass
                    : currentTheme.bg,
                  borderColor: currentTheme.border,
                }}
                title="أدوات التنسيق"
              >
                <img
                  src={
                    currentTheme.isDark
                      ? "/logo-dark-bg.png"
                      : "/logo-light-bg.png"
                  }
                  alt="أدوات"
                  className="w-5 h-5 object-contain transition-transform duration-300"
                  style={{
                    transform: showControls ? "rotate(-10deg)" : "rotate(0)",
                  }}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    e.currentTarget.nextElementSibling?.removeAttribute(
                      "style",
                    );
                  }}
                />
                <Feather
                  className="w-4 h-4 hidden"
                  style={{ color: currentTheme.accent, display: "none" }}
                />
              </button>
            </div>

            {/* Left Group */}
            <div className="flex-1 flex justify-end items-center relative">
              <button
                onClick={() => setShowStatsPanel(!showStatsPanel)}
                className="stats-trigger h-9 px-3 rounded-full flex items-center gap-2 hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
                title="إحصائيات الكلمات والأحرف"
              >
                <div className="flex flex-col items-center justify-center">
                  <span
                    className="font-zain-xbold text-xs leading-none"
                    style={{ color: currentTheme.text }}
                  >
                    {wordCount}
                  </span>
                  <span
                    className="font-zain-bold text-[8px] -mt-0.5 leading-none"
                    style={{ color: currentTheme.secondary }}
                  >
                    كلمة
                  </span>
                </div>
                <div
                  className="w-px h-4"
                  style={{ backgroundColor: currentTheme.border }}
                ></div>
                <div className="flex flex-col items-center justify-center">
                  <span
                    className="font-zain-xbold text-xs leading-none"
                    style={{ color: currentTheme.text }}
                  >
                    {charCount}
                  </span>
                  <span
                    className="font-zain-bold text-[8px] -mt-0.5 leading-none"
                    style={{ color: currentTheme.secondary }}
                  >
                    حرف
                  </span>
                </div>
              </button>

              {/* Professional Stats Panel (The Insight) */}
              {showStatsPanel && (
                <div
                  className="stats-panel absolute bottom-full left-0 mb-3 w-48 border rounded-2xl shadow-2xl z-[60] overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-bottom-left backdrop-blur-2xl"
                  style={{
                    backgroundColor: currentTheme.glass,
                    borderColor: currentTheme.border,
                  }}
                >
                  <div className="p-3">
                    <h4
                      className="text-xs font-zain-bold mb-2 opacity-50 text-center"
                      style={{ color: currentTheme.text }}
                    >
                      بصيرة الكاتب
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Glasses
                          className="w-4 h-4"
                          style={{ color: currentTheme.accent }}
                        />
                        <div className="flex flex-col">
                          <span
                            className="text-[10px] font-zain-reg"
                            style={{ color: currentTheme.secondary }}
                          >
                            وقت القراءة
                          </span>
                          <span
                            className="text-sm font-zain-bold leading-none"
                            style={{ color: currentTheme.text }}
                          >
                            {readingTime} دقيقة
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mic2
                          className="w-4 h-4"
                          style={{ color: currentTheme.accent }}
                        />
                        <div className="flex flex-col">
                          <span
                            className="text-[10px] font-zain-reg"
                            style={{ color: currentTheme.secondary }}
                          >
                            وقت الإلقاء
                          </span>
                          <span
                            className="text-sm font-zain-bold leading-none"
                            style={{ color: currentTheme.text }}
                          >
                            {speakingTime} دقيقة
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Files
                          className="w-4 h-4"
                          style={{ color: currentTheme.accent }}
                        />
                        <div className="flex flex-col">
                          <span
                            className="text-[10px] font-zain-reg"
                            style={{ color: currentTheme.secondary }}
                          >
                            صفحات (A4)
                          </span>
                          <span
                            className="text-sm font-zain-bold leading-none"
                            style={{ color: currentTheme.text }}
                          >
                            {estimatedPages} صفحة
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </footer>
      )}

      {/* Settings Panel */}
      {!isSavedMode && (
        <div
          className={`fixed bottom-28 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-96 z-50 backdrop-blur-2xl rounded-3xl shadow-2xl p-6 transition-all duration-500 ${showControls && showUI ? "opacity-100" : "opacity-0 translate-y-10 scale-95 pointer-events-none"}`}
          style={{
            backgroundColor: currentTheme.glass,
            borderColor: currentTheme.border,
            borderWidth: "1px",
          }}
        >
          {showColorGrid ? (
            <div className="color-grid animate-in fade-in">
              <div
                className="flex justify-between items-center mb-4 border-b pb-2"
                style={{ borderColor: currentTheme.border }}
              >
                <span
                  className="text-xs font-zain-bold"
                  style={{ color: currentTheme.text }}
                >
                  اختر لون الحبر
                </span>
                <button
                  onClick={() => setShowColorGrid(false)}
                  className="hover:text-[#A7AA63]"
                  style={{ color: currentTheme.secondary }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-5 gap-3">
                {inkColors.map((ink) => (
                  <button
                    key={ink.hex}
                    onClick={() => updateTextColor(ink.hex)}
                    className={`w-10 h-10 rounded-full border-2 shadow-sm hover:scale-110 ${textColor === ink.hex ? "scale-110" : "border-transparent"}`}
                    style={{
                      backgroundColor: ink.hex,
                      borderColor:
                        textColor === ink.hex ? textColor : "transparent",
                    }}
                    title={ink.name}
                  >
                    {textColor === ink.hex && (
                      <Check className="w-4 h-4 text-white" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div
                  className="flex justify-between mb-2 font-zain-bold text-xs px-1"
                  style={{ color: currentTheme.secondary }}
                >
                  <span>صغير</span>
                  <span>{fontSize}px</span>
                  <span>كبير</span>
                </div>
                <input
                  type="range"
                  min="16"
                  max="36"
                  value={fontSize}
                  onChange={(e) => updateFontSize(e.target.value)}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
                  style={{
                    accentColor: currentTheme.accent,
                    backgroundColor: currentTheme.isDark
                      ? "rgba(255,255,255,0.1)"
                      : "rgba(0,0,0,0.1)",
                  }}
                />
              </div>
              <div className="grid grid-cols-4 gap-4 items-center">
                <div className="flex flex-col items-center gap-2">
                  <span
                    className="text-[10px] font-zain-bold"
                    style={{ color: textColor }}
                  >
                    السمك
                  </span>
                  <button
                    onClick={toggleFontWeight}
                    className="w-12 h-12 rounded-2xl flex items-center justify-center hover:bg-black/5 border"
                    style={{
                      backgroundColor: currentTheme.isDark
                        ? "rgba(255,255,255,0.05)"
                        : "rgba(0,0,0,0.05)",
                      borderColor: currentTheme.border,
                    }}
                  >
                    <Type
                      className="w-5 h-5"
                      style={{ color: currentTheme.text }}
                    />
                  </button>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <span
                    className="text-[10px] font-zain-bold"
                    style={{ color: textColor }}
                  >
                    المحاذاة
                  </span>
                  <button
                    onClick={updateTextAlign}
                    className="w-12 h-12 rounded-2xl flex items-center justify-center hover:bg-black/5 border"
                    style={{
                      backgroundColor: currentTheme.isDark
                        ? "rgba(255,255,255,0.05)"
                        : "rgba(0,0,0,0.05)",
                      borderColor: currentTheme.border,
                    }}
                  >
                    {textAlign === "right" && (
                      <AlignRight
                        className="w-5 h-5"
                        style={{ color: currentTheme.text }}
                      />
                    )}
                    {textAlign === "center" && (
                      <AlignCenter
                        className="w-5 h-5"
                        style={{ color: currentTheme.text }}
                      />
                    )}
                    {textAlign === "left" && (
                      <AlignLeft
                        className="w-5 h-5"
                        style={{ color: currentTheme.text }}
                      />
                    )}
                    {textAlign === "justify" && (
                      <AlignJustify
                        className="w-5 h-5"
                        style={{ color: currentTheme.text }}
                      />
                    )}
                  </button>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <span
                    className="text-[10px] font-zain-bold"
                    style={{ color: textColor }}
                  >
                    اللون
                  </span>
                  <button
                    onClick={() => setShowColorGrid(true)}
                    className="w-12 h-12 rounded-2xl flex items-center justify-center hover:bg-black/5 relative border"
                    style={{
                      backgroundColor: currentTheme.isDark
                        ? "rgba(255,255,255,0.05)"
                        : "rgba(0,0,0,0.05)",
                      borderColor: currentTheme.border,
                    }}
                  >
                    <Palette
                      className="w-5 h-5"
                      style={{ color: currentTheme.text }}
                    />
                    <div
                      className="absolute bottom-2 right-2 w-2 h-2 rounded-full border border-white/50"
                      style={{ backgroundColor: textColor }}
                    ></div>
                  </button>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <span
                    className="text-[10px] font-zain-bold"
                    style={{ color: textColor }}
                  >
                    الورق
                  </span>
                  <button
                    onClick={switchTexture}
                    className="w-12 h-12 rounded-2xl flex items-center justify-center hover:bg-black/5 relative overflow-hidden border"
                    style={{
                      backgroundColor: currentTheme.isDark
                        ? "rgba(255,255,255,0.05)"
                        : "rgba(0,0,0,0.05)",
                      borderColor: currentTheme.border,
                    }}
                  >
                    {(() => {
                      const style = paperStyles[activePaperStyleIndex];
                      const iconColor = currentTheme.text;
                      if (style.id === "classic") {
                        return (
                          <div className="w-full h-full flex flex-col justify-center items-center gap-1 opacity-60">
                            <div
                              className="w-6 h-px"
                              style={{ backgroundColor: iconColor }}
                            ></div>
                            <div
                              className="w-6 h-px"
                              style={{ backgroundColor: iconColor }}
                            ></div>
                            <div
                              className="w-6 h-px"
                              style={{ backgroundColor: iconColor }}
                            ></div>
                          </div>
                        );
                      }
                      const IconComponent = style.icon;
                      return (
                        <IconComponent
                          className="w-5 h-5"
                          style={{ color: iconColor }}
                        />
                      );
                    })()}
                  </button>
                </div>
              </div>
              <div
                className="flex justify-between items-center mt-4 pt-4 border-t"
                style={{ borderColor: currentTheme.border }}
              >
                <span
                  className="text-[10px] font-zain-reg"
                  style={{ color: currentTheme.secondary }}
                >
                  {paperStyles[activePaperStyleIndex].name}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => toggleTheme("modern_studio")}
                    className={`w-6 h-6 rounded-full border ${currentTheme.mode === "modern_studio" ? "ring-1 ring-offset-1" : ""}`}
                    style={{
                      backgroundColor: "#F4F1EA",
                      borderColor: "#2C3E30",
                      ringColor: currentTheme.accent,
                    }}
                  />
                  <button
                    onClick={() => toggleTheme("royal_classic")}
                    className={`w-6 h-6 rounded-full border ${currentTheme.mode === "royal_classic" ? "ring-1 ring-offset-1" : ""}`}
                    style={{
                      backgroundColor: "#EAE6D2",
                      borderColor: "#121A1B",
                      ringColor: currentTheme.accent,
                    }}
                  />
                  <button
                    onClick={() => toggleTheme("night_whisper")}
                    className={`w-6 h-6 rounded-full border flex items-center justify-center ${currentTheme.mode === "night_whisper" ? "ring-1 ring-offset-1" : ""}`}
                    style={{
                      backgroundColor: "#0F1617",
                      borderColor: "#A7AA63",
                      ringColor: currentTheme.accent,
                    }}
                  >
                    <Moon className="w-3 h-3 text-[#A7AA63]" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {toolbarVisible && (
        <div
          className="fixed z-50 flex items-center gap-1 p-0.5 px-1.5 rounded-full shadow-2xl backdrop-blur-md transition-all duration-200 ease-out border"
          style={{
            top: `${toolbarPosition.top - window.scrollY}px`,
            left: `${toolbarPosition.left}px`,
            transform: "translate(-50%, -100%)",
            backgroundColor: currentTheme.isDark ? "rgba(20, 20, 22, 0.92)" : "rgba(255, 255, 255, 0.92)",
            borderColor: currentTheme.border,
            boxShadow: `0 8px 20px -6px rgba(0,0,0,0.12), 0 0 0 1px ${currentTheme.border}`,
          }}
          dir="rtl"
        >
          {/* Main Highlight Action */}
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              applyHighlight();
            }}
            className="group relative flex items-center justify-center p-1.5 rounded-full hover:bg-stone-200/50 dark:hover:bg-zinc-800/50 transition-colors"
            style={{ color: selectedHighlightColor.bg }}
          >
            <Highlighter className="w-3.5 h-3.5" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex items-center justify-center bg-zinc-900 text-white text-[10px] py-0.5 px-2 rounded-md shadow-lg whitespace-nowrap pointer-events-none">
              تظليل النص
            </span>
          </button>

          {/* Color Circles Selector */}
          <div className="flex items-center gap-1.5 px-1">
            {[
              { name: "أصفر ساطع", bg: "#FFE600", text: "#000000" },
              { name: "أخضر نضاح", bg: "#4ADE80", text: "#052C14" },
              { name: "وردي زاهي", bg: "#FF729F", text: "#4C0019" },
              { name: "أزرق سماوي", bg: "#38BDF8", text: "#03203C" },
              { name: "برتقالي مشرق", bg: "#FB923C", text: "#3A1000" },
            ].map((color) => (
              <button
                key={color.bg}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setSelectedHighlightColor(color);
                  applyHighlight(color);
                }}
                className={`w-3.5 h-3.5 rounded-full transition-all focus:outline-none relative group ${
                  selectedHighlightColor.bg === color.bg
                    ? "ring-2 ring-stone-800 dark:ring-stone-100 scale-125 z-10"
                    : "opacity-85 hover:opacity-100 hover:scale-110"
                }`}
                style={{ backgroundColor: color.bg }}
              >
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex items-center justify-center bg-zinc-900 text-white text-[10px] py-0.5 px-2 rounded-md shadow-lg whitespace-nowrap pointer-events-none">
                  {color.name}
                </span>
              </button>
            ))}
          </div>

          {/* Divider */}
          <div
            className="w-px h-3.5 self-center mx-0.5"
            style={{ backgroundColor: currentTheme.border }}
          />

          {/* Remove Highlight Button */}
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              removeHighlight();
            }}
            className="group relative flex items-center justify-center p-1.5 rounded-full hover:bg-stone-200/50 dark:hover:bg-zinc-800/50 transition-colors"
            style={{ color: currentTheme.text }}
          >
            <Eraser className="w-3.5 h-3.5" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex items-center justify-center bg-zinc-900 text-white text-[10px] py-0.5 px-2 rounded-md shadow-lg whitespace-nowrap pointer-events-none">
              إزالة التظليل
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

export default DarAlHikayatMaster;
