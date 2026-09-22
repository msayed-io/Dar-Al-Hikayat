import React, { useState, useEffect, useRef } from "react";
import {
  Wifi,
  WifiOff,
  Mic,
  MicOff,
  RotateCcw,
  RotateCw,
  Delete,
  CornerDownLeft,
  MoveLeft,
  MoveRight,
  Maximize2,
  Minimize2,
  CheckCircle2,
  Sparkles,
  Type,
  Sliders,
  Volume2,
  Vibrate,
  Globe,
  Smile,
  X
} from "lucide-react";
import { sendRemoteKeystroke, RemoteKeystrokePayload } from "../lib/remote-keyboard-service";

interface RemoteKeyboardMobilePageProps {
  initialPin?: string;
}

// Key layouts
const ARABIC_ROW_1 = ["ض", "ص", "ث", "ق", "ف", "غ", "ع", "ه", "خ", "ح", "ج", "د"];
const ARABIC_ROW_2 = ["ش", "س", "ي", "ب", "ل", "ا", "ت", "ن", "م", "ك", "ط"];
const ARABIC_ROW_3 = ["ئ", "ء", "ؤ", "ر", "لا", "ى", "ة", "و", "ز", "ظ"];

const ENGLISH_ROW_1 = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"];
const ENGLISH_ROW_2 = ["a", "s", "d", "f", "g", "h", "j", "k", "l"];
const ENGLISH_ROW_3 = ["z", "x", "c", "v", "b", "n", "m"];

const NUMBERS_ROW = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

// Tashkeel marks
const TASHKEEL_LIST = [
  { char: "َ", name: "فتحة" },
  { char: "ُ", name: "ضمة" },
  { char: "ِ", name: "كسرة" },
  { char: "ّ", name: "شدة" },
  { char: "ً", name: "تنوين فتح" },
  { char: "ٌ", name: "تنوين ضم" },
  { char: "ٍ", name: "تنوين كسر" },
  { char: "ْ", name: "سكون" },
  { char: "آ", name: "ألف مدة" },
  { char: "أ", name: "ألف همزة" },
  { char: "إ", name: "إبرة كسرة" },
];

// Literary Punctuation
const LITERARY_PUNCTUATION = [
  { char: "«", label: "«" },
  { char: "»", label: "»" },
  { char: "—", label: "— شرطة" },
  { char: "...", label: "... نقاط" },
  { char: "؟", label: "؟" },
  { char: "!", label: "!" },
  { char: "،", label: "،" },
  { char: "؛", label: "؛" },
  { char: ":", label: ":" },
  { char: "\"", label: "\"" },
];

export const RemoteKeyboardMobilePage: React.FC<RemoteKeyboardMobilePageProps> = ({ initialPin }) => {
  // Extract session pin from URL query param if available
  const getPinFromUrl = () => {
    if (initialPin) return initialPin;
    const hash = window.location.hash || "";
    const match = hash.match(/pin=([a-zA-Z0-9]+)/) || window.location.search.match(/pin=([a-zA-Z0-9]+)/);
    return match ? match[1] : "123456";
  };

  const [sessionPin, setSessionPin] = useState<string>(getPinFromUrl());
  const [pinInput, setPinInput] = useState<string>(sessionPin);
  const [isPinVerified, setIsPinVerified] = useState<boolean>(true);
  
  const [langMode, setLangMode] = useState<"AR" | "EN" | "NUM">("AR");
  const [isShiftActive, setIsShiftActive] = useState<boolean>(false);
  const [hapticEnabled, setHapticEnabled] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [latencyMs, setLatencyMs] = useState<number>(2);
  const [activeTab, setActiveTab] = useState<"tashkeel" | "punctuation">("tashkeel");
  
  const [isListeningVoice, setIsListeningVoice] = useState<boolean>(false);
  const [voiceTextBuffer, setVoiceTextBuffer] = useState<string>("");
  const recognitionRef = useRef<any>(null);

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const spaceTouchXRef = useRef<number | null>(null);

  // Send connection ping when mobile page mounts
  useEffect(() => {
    sendRemoteKeystroke({
      sessionPin,
      type: "COMMAND",
      senderId: "mobile-keyboard",
      timestamp: Date.now(),
    });
  }, [sessionPin]);

  // Audio click sound synth
  const playClickSound = () => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {
      // ignore
    }
  };

  // Trigger haptic vibration
  const triggerHaptic = (ms = 12) => {
    if (hapticEnabled && typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(ms);
      } catch {
        // ignore
      }
    }
    playClickSound();
  };

  // Helper to dispatch keystroke
  const dispatchKey = async (type: RemoteKeystrokePayload["type"], char?: string, action?: RemoteKeystrokePayload["action"], text?: string) => {
    triggerHaptic(12);
    const res = await sendRemoteKeystroke({
      sessionPin,
      type,
      char,
      action,
      text,
      senderId: "mobile-keyboard",
      timestamp: Date.now(),
    });
    if (res.latencyMs !== undefined) {
      setLatencyMs(res.latencyMs);
    }
    setIsConnected(true);
  };

  // Voice recognition setup
  const toggleVoiceDictation = () => {
    triggerHaptic(20);
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("خاصية الإملاء الصوتي غير مدعومة في متصفح هذا الهاتف.");
      return;
    }

    if (isListeningVoice) {
      recognitionRef.current?.stop();
      setIsListeningVoice(false);
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.lang = "ar-SA";
      rec.continuous = true;
      rec.interimResults = true;

      rec.onstart = () => {
        setIsListeningVoice(true);
      };

      rec.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setVoiceTextBuffer(transcript);

        // Auto send final transcript
        const isFinal = event.results[event.results.length - 1].isFinal;
        if (isFinal && transcript.trim()) {
          dispatchKey("PASTE_TEXT", undefined, undefined, transcript.trim() + " ");
          setVoiceTextBuffer("");
        }
      };

      rec.onerror = (err: any) => {
        console.warn("Speech recognition error:", err);
        setIsListeningVoice(false);
      };

      rec.onend = () => {
        setIsListeningVoice(false);
      };

      rec.start();
      recognitionRef.current = rec;
    } catch (e) {
      console.warn("Failed to start speech recognition:", e);
      setIsListeningVoice(false);
    }
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    triggerHaptic(15);
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Trackpad Spacebar touch handlers
  const handleSpaceTouchStart = (e: React.TouchEvent) => {
    spaceTouchXRef.current = e.touches[0].clientX;
  };

  const handleSpaceTouchMove = (e: React.TouchEvent) => {
    if (spaceTouchXRef.current === null) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - spaceTouchXRef.current;
    const threshold = 18; // px

    if (diff > threshold) {
      // Swiped right -> Cursor right
      dispatchKey("COMMAND", undefined, "NAVIGATE_RIGHT");
      spaceTouchXRef.current = currentX;
    } else if (diff < -threshold) {
      // Swiped left -> Cursor left
      dispatchKey("COMMAND", undefined, "NAVIGATE_LEFT");
      spaceTouchXRef.current = currentX;
    }
  };

  const handleSpaceTouchEnd = () => {
    spaceTouchXRef.current = null;
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 bg-slate-950 text-slate-100 flex flex-col justify-between select-none touch-none overflow-hidden font-sans"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      {/* ── Top Header Bar ── */}
      <header className="h-10 px-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0 text-xs">
        {/* Device Sync & Latency Status */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>متصل بالتابلت ({latencyMs}ms)</span>
          </div>

          <span className="text-slate-400 font-mono text-[11px] bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
            PIN: {sessionPin}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setHapticEnabled(!hapticEnabled)}
            className={`p-1.5 rounded transition ${hapticEnabled ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-slate-800 text-slate-400"}`}
            title="الاهتزاز اللمسي"
          >
            <Vibrate className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-1.5 rounded transition ${soundEnabled ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-slate-800 text-slate-400"}`}
            title="الصوت اللمسي"
          >
            <Volume2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={toggleVoiceDictation}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold transition ${
              isListeningVoice
                ? "bg-rose-500 text-white animate-pulse"
                : "bg-amber-600/30 text-amber-300 border border-amber-500/40 hover:bg-amber-600/50"
            }`}
          >
            {isListeningVoice ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
            <span>{isListeningVoice ? "جاري الاستماع..." : "إملاء صوتي"}</span>
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
            title="ملء الشاشة"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* Voice Dictation Live Banner */}
      {isListeningVoice && (
        <div className="bg-rose-950/80 border-b border-rose-800/50 px-3 py-1.5 flex items-center justify-between text-rose-200 text-xs shrink-0 animate-pulse">
          <span className="truncate max-w-[80%]">
            🎙️ {voiceTextBuffer || "تحدث الآن ليتم توجيه النص فوراً إلى التابلت..."}
          </span>
          <button
            onClick={() => {
              if (voiceTextBuffer.trim()) {
                dispatchKey("PASTE_TEXT", undefined, undefined, voiceTextBuffer.trim() + " ");
                setVoiceTextBuffer("");
              }
            }}
            className="px-2 py-0.5 bg-rose-700 rounded text-[11px] font-bold text-white hover:bg-rose-600"
          >
            إرسال النص
          </button>
        </div>
      )}

      {/* ── Tashkeel & Literary Punctuation Ribbon ── */}
      <div className="bg-slate-900 border-b border-slate-800 px-1.5 py-1 shrink-0 flex flex-col gap-1">
        {/* Ribbon Tab Selectors */}
        <div className="flex items-center justify-between px-1 text-[11px]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("tashkeel")}
              className={`px-2.5 py-0.5 rounded-full font-bold transition ${
                activeTab === "tashkeel" ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              شريط التشكيل اللحظي َ ُ ِ
            </button>
            <button
              onClick={() => setActiveTab("punctuation")}
              className={`px-2.5 py-0.5 rounded-full font-bold transition ${
                activeTab === "punctuation" ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              علامات الترقيم الروائية « » — ...
            </button>
          </div>

          <span className="text-[10px] text-slate-500 hidden sm:inline">
            كيبورد روائي احترافي موصول بالتابلت
          </span>
        </div>

        {/* Active Ribbon Content */}
        {activeTab === "tashkeel" ? (
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 px-0.5">
            {TASHKEEL_LIST.map((item) => (
              <button
                key={item.char}
                onClick={() => dispatchKey("TASHKEEL", item.char)}
                className="flex-1 min-w-[36px] h-9 rounded-lg bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/30 text-amber-300 font-bold text-lg flex items-center justify-center active:scale-95 transition shadow-sm"
                title={item.name}
              >
                {item.char}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 px-0.5">
            {LITERARY_PUNCTUATION.map((item) => (
              <button
                key={item.char}
                onClick={() => dispatchKey("KEY", item.char)}
                className="flex-1 min-w-[42px] h-9 rounded-lg bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-500/30 text-indigo-200 font-bold text-sm flex items-center justify-center active:scale-95 transition shadow-sm whitespace-nowrap px-1"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Main Keyboard Keypad (Landscape Fit) ── */}
      <div className="flex-1 p-1.5 flex flex-col justify-center gap-1.5 max-w-5xl mx-auto w-full">

        {/* NUMBERS ROW (Shown when NUM mode is active) */}
        {langMode === "NUM" && (
          <div className="flex items-center gap-1 w-full justify-center">
            {NUMBERS_ROW.map((num) => (
              <button
                key={num}
                onClick={() => dispatchKey("KEY", num)}
                className="flex-1 h-11 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 font-bold text-lg flex items-center justify-center active:bg-slate-700 transition shadow"
              >
                {num}
              </button>
            ))}
          </div>
        )}

        {/* ROW 1 */}
        <div className="flex items-center gap-1 w-full justify-center">
          {(langMode === "AR" ? ARABIC_ROW_1 : ENGLISH_ROW_1).map((key) => {
            const charToShow = isShiftActive && langMode === "EN" ? key.toUpperCase() : key;
            return (
              <button
                key={key}
                onClick={() => dispatchKey("KEY", charToShow)}
                className="flex-1 h-11 sm:h-12 rounded-lg bg-slate-800 border border-slate-700/80 text-slate-100 font-semibold text-xl flex items-center justify-center active:bg-amber-600 active:text-slate-950 transition shadow active:scale-95"
              >
                {charToShow}
              </button>
            );
          })}
        </div>

        {/* ROW 2 */}
        <div className="flex items-center gap-1 w-full justify-center px-2">
          {(langMode === "AR" ? ARABIC_ROW_2 : ENGLISH_ROW_2).map((key) => {
            const charToShow = isShiftActive && langMode === "EN" ? key.toUpperCase() : key;
            return (
              <button
                key={key}
                onClick={() => dispatchKey("KEY", charToShow)}
                className="flex-1 h-11 sm:h-12 rounded-lg bg-slate-800 border border-slate-700/80 text-slate-100 font-semibold text-xl flex items-center justify-center active:bg-amber-600 active:text-slate-950 transition shadow active:scale-95"
              >
                {charToShow}
              </button>
            );
          })}
        </div>

        {/* ROW 3 */}
        <div className="flex items-center gap-1 w-full justify-center">
          {/* Shift key for EN */}
          {langMode === "EN" && (
            <button
              onClick={() => {
                triggerHaptic();
                setIsShiftActive(!isShiftActive);
              }}
              className={`px-3 h-11 sm:h-12 rounded-lg border font-bold text-xs flex items-center justify-center transition ${
                isShiftActive ? "bg-amber-500 text-slate-950 border-amber-400" : "bg-slate-800 text-slate-400 border-slate-700"
              }`}
            >
              ⇧ SHIFT
            </button>
          )}

          {(langMode === "AR" ? ARABIC_ROW_3 : ENGLISH_ROW_3).map((key) => {
            const charToShow = isShiftActive && langMode === "EN" ? key.toUpperCase() : key;
            return (
              <button
                key={key}
                onClick={() => dispatchKey("KEY", charToShow)}
                className="flex-1 h-11 sm:h-12 rounded-lg bg-slate-800 border border-slate-700/80 text-slate-100 font-semibold text-xl flex items-center justify-center active:bg-amber-600 active:text-slate-950 transition shadow active:scale-95"
              >
                {charToShow}
              </button>
            );
          })}

          {/* Delete Single Char Button */}
          <button
            onClick={() => dispatchKey("COMMAND", undefined, "BACKSPACE")}
            className="px-3 h-11 sm:h-12 rounded-lg bg-slate-800/90 border border-slate-700 text-rose-400 font-bold text-sm flex items-center justify-center active:bg-rose-600 active:text-white transition shadow active:scale-95 shrink-0"
            title="حذف حرف"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* ROW 4: Trackpad Spacebar & Function Bar */}
        <div className="flex items-center gap-1.5 w-full justify-between pt-0.5">
          {/* Language Switch */}
          <button
            onClick={() => {
              triggerHaptic();
              setLangMode(langMode === "AR" ? "EN" : langMode === "EN" ? "NUM" : "AR");
            }}
            className="px-3 h-11 sm:h-12 rounded-lg bg-slate-800 border border-slate-700 text-amber-400 font-bold text-xs flex items-center justify-center gap-1 active:bg-slate-700 transition shrink-0"
          >
            <Globe className="w-4 h-4" />
            <span>{langMode === "AR" ? "عربي" : langMode === "EN" ? "EN" : "123"}</span>
          </button>

          {/* Undo Button */}
          <button
            onClick={() => dispatchKey("COMMAND", undefined, "UNDO")}
            className="px-2.5 h-11 sm:h-12 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center active:bg-slate-700 transition shrink-0"
            title="تراجع"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Redo Button */}
          <button
            onClick={() => dispatchKey("COMMAND", undefined, "REDO")}
            className="px-2.5 h-11 sm:h-12 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center active:bg-slate-700 transition shrink-0"
            title="إعادة"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* TRACKPAD SPACEBAR (Swiping left/right moves cursor) */}
          <button
            onClick={() => dispatchKey("KEY", " ")}
            onTouchStart={handleSpaceTouchStart}
            onTouchMove={handleSpaceTouchMove}
            onTouchEnd={handleSpaceTouchEnd}
            className="flex-1 h-11 sm:h-12 rounded-lg bg-slate-800/90 border border-amber-500/40 text-amber-200/80 font-medium text-xs flex items-center justify-center gap-2 active:bg-amber-600 active:text-slate-950 transition shadow cursor-grab active:cursor-grabbing"
          >
            <MoveRight className="w-3.5 h-3.5 text-amber-400/60" />
            <span className="font-semibold text-sm">مسافة (اسحب يميناً/يساراً للتحريك)</span>
            <MoveLeft className="w-3.5 h-3.5 text-amber-400/60" />
          </button>

          {/* Delete Word Button */}
          <button
            onClick={() => dispatchKey("COMMAND", undefined, "DELETE_WORD")}
            className="px-2.5 h-11 sm:h-12 rounded-lg bg-slate-800 border border-slate-700 text-rose-300 font-bold text-[11px] flex items-center justify-center active:bg-rose-700 active:text-white transition shrink-0"
            title="حذف كلمة كاملة"
          >
            حذف كلمة
          </button>

          {/* Enter / New Paragraph Button */}
          <button
            onClick={() => dispatchKey("COMMAND", undefined, "NEWLINE")}
            className="px-4 h-11 sm:h-12 rounded-lg bg-amber-500 border border-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-1 active:bg-amber-400 transition shadow shrink-0"
            title="فقرة جديدة"
          >
            <span>فقرة</span>
            <CornerDownLeft className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
};

export default RemoteKeyboardMobilePage;
