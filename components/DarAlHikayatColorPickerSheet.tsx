import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Check } from "lucide-react";
import { ThemeColors } from "../contexts/AppContext";

export interface DarAlHikayatColorPickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentColor: string;
  onApplyColor: (hex: string) => void;
  theme: ThemeColors;
}

// ── Math & Color Conversion Helpers (HSV / RGB / HEX) ──

interface HSV {
  h: number; // 0 - 360
  s: number; // 0 - 1
  v: number; // 0 - 1
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    clean = clean
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const num = parseInt(clean, 16);
  if (isNaN(num) || clean.length !== 6) {
    return { r: 255, g: 255, b: 255 };
  }
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function rgbToHsv(r: number, g: number, b: number): HSV {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const d = max - min;

  let h = 0;
  const v = max;
  const s = max === 0 ? 0 : d / max;

  if (d !== 0) {
    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0);
        break;
      case gNorm:
        h = (bNorm - rNorm) / d + 2;
        break;
      case bNorm:
        h = (rNorm - gNorm) / d + 4;
        break;
    }
    h *= 60;
  }

  return {
    h: Math.round(h),
    s: Math.max(0, Math.min(1, s)),
    v: Math.max(0, Math.min(1, v)),
  };
}

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let rPrime = 0;
  let gPrime = 0;
  let bPrime = 0;

  const segment = Math.floor(h / 60) % 6;
  switch (segment) {
    case 0:
      rPrime = c;
      gPrime = x;
      bPrime = 0;
      break;
    case 1:
      rPrime = x;
      gPrime = c;
      bPrime = 0;
      break;
    case 2:
      rPrime = 0;
      gPrime = c;
      bPrime = x;
      break;
    case 3:
      rPrime = 0;
      gPrime = x;
      bPrime = c;
      break;
    case 4:
      rPrime = x;
      gPrime = 0;
      bPrime = c;
      break;
    case 5:
      rPrime = c;
      gPrime = 0;
      bPrime = x;
      break;
  }

  const r = Math.round((rPrime + m) * 255);
  const g = Math.round((gPrime + m) * 255);
  const b = Math.round((bPrime + m) * 255);

  const toHex = (n: number) => n.toString(16).padStart(2, "0").toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * دالة ذكية لتوليد الاسم اللوني العربي الدقيق وفقاً لدرجة اللون والإشباع والسطوع
 * (مثل: "أحمر داكن"، "سماوي"، "أزرق كحلي"، "ذهبي"، "رمادي هادئ"، إلخ).
 */
export function getArabicColorName(h: number, s: number, v: number): string {
  if (v <= 0.12) return "أسود";
  if (v <= 0.22 && s <= 0.25) return "أسود داكن";
  if (s <= 0.08) {
    if (v >= 0.92) return "أبيض";
    if (v >= 0.70) return "رمادي فاتح";
    if (v >= 0.38) return "رمادي";
    return "رمادي داكن";
  }

  let baseName = "";
  let isPresetComposite = false;

  // تحديد الطيف الأساسي
  if (h >= 345 || h < 14) {
    baseName = "أحمر";
  } else if (h < 42) {
    if (v < 0.58 && s > 0.32) {
      baseName = "بني";
      isPresetComposite = true;
    } else {
      baseName = "برتقالي";
    }
  } else if (h < 68) {
    if (v < 0.45) {
      baseName = "زيتي";
      isPresetComposite = true;
    } else if (s > 0.75) {
      baseName = "أصفر ذهبي";
      isPresetComposite = true;
    } else {
      baseName = "أصفر";
    }
  } else if (h < 165) {
    if (v < 0.38) {
      baseName = "أخضر داكن";
      isPresetComposite = true;
    } else if (h < 95) {
      baseName = "أخضر ليموني";
      isPresetComposite = true;
    } else {
      baseName = "أخضر";
    }
  } else if (h < 195) {
    baseName = "سماوي";
  } else if (h < 255) {
    if (v < 0.40) {
      baseName = "كحلي";
      isPresetComposite = true;
    } else {
      baseName = "أزرق";
    }
  } else if (h < 290) {
    baseName = "بنفسجي";
  } else {
    baseName = "وردي";
  }

  // إضافة النعوت والصفات الدقيقة
  if (!isPresetComposite) {
    if (v <= 0.42) {
      return `${baseName} داكن`;
    } else if (v >= 0.86 && s <= 0.42) {
      return `${baseName} فاتح`;
    } else if (s >= 0.85 && v >= 0.80) {
      return `${baseName} ناصع`;
    } else if (s <= 0.35) {
      return `${baseName} هادئ`;
    }
  }

  return baseName;
}

export const DarAlHikayatColorPickerSheet: React.FC<DarAlHikayatColorPickerSheetProps> = ({
  isOpen,
  onClose,
  currentColor,
  onApplyColor,
  theme,
}) => {
  // HSV state
  const [hsv, setHsv] = useState<HSV>({ h: 0, s: 0.66, v: 0.26 });
  const [hexInput, setHexInput] = useState<string>("#431616");

  // Portal container
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);

  // References for dragging
  const satValFieldRef = useRef<HTMLDivElement>(null);
  const hueSliderRef = useRef<HTMLDivElement>(null);
  const isDraggingSatVal = useRef(false);
  const isDraggingHue = useRef(false);

  // Initialize portal node on mount
  useEffect(() => {
    if (typeof document === "undefined") return;
    let element = document.getElementById("dar-color-picker-root");
    if (!element) {
      element = document.createElement("div");
      element.id = "dar-color-picker-root";
      element.style.position = "relative";
      element.style.zIndex = "2147483647";
      document.body.appendChild(element);
    }
    setPortalNode(element);
  }, []);

  // Sync state when opened or currentColor changes
  useEffect(() => {
    if (isOpen && currentColor) {
      const rgb = hexToRgb(currentColor);
      const parsedHsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
      setHsv(parsedHsv);
      setHexInput(currentColor.startsWith("#") ? currentColor.toUpperCase() : `#${currentColor.toUpperCase()}`);
    }
  }, [isOpen, currentColor]);

  // Derived current HEX color and Arabic Name
  const currentHex = useMemo(() => {
    return hsvToHex(hsv.h, hsv.s, hsv.v);
  }, [hsv]);

  const arabicColorName = useMemo(() => {
    return getArabicColorName(hsv.h, hsv.s, hsv.v);
  }, [hsv]);

  // Keep hex input in sync with currentHex while user is dragging
  useEffect(() => {
    setHexInput(currentHex);
  }, [currentHex]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // ── 2D Saturation-Value Field Drag Handler ──
  const updateSatValFromPointer = useCallback((clientX: number, clientY: number) => {
    if (!satValFieldRef.current) return;
    const rect = satValFieldRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));

    const s = Math.max(0, Math.min(1, x / rect.width));
    const v = Math.max(0, Math.min(1, 1 - y / rect.height));

    setHsv((prev) => ({ ...prev, s, v }));
  }, []);

  const handleSatValPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingSatVal.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateSatValFromPointer(e.clientX, e.clientY);
  };

  const handleSatValPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingSatVal.current) return;
    e.preventDefault();
    e.stopPropagation();
    updateSatValFromPointer(e.clientX, e.clientY);
  };

  const handleSatValPointerUp = (e: React.PointerEvent) => {
    if (!isDraggingSatVal.current) return;
    isDraggingSatVal.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  // ── Hue Slider Drag Handler ──
  const updateHueFromPointer = useCallback((clientX: number) => {
    if (!hueSliderRef.current) return;
    const rect = hueSliderRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    const h = Math.round(ratio * 360) % 360;

    setHsv((prev) => ({ ...prev, h }));
  }, []);

  const handleHuePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingHue.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateHueFromPointer(e.clientX);
  };

  const handleHuePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingHue.current) return;
    e.preventDefault();
    e.stopPropagation();
    updateHueFromPointer(e.clientX);
  };

  const handleHuePointerUp = (e: React.PointerEvent) => {
    if (!isDraggingHue.current) return;
    isDraggingHue.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  // ── Manual Hex Input Change ──
  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    setHexInput(val);
    const clean = val.replace("#", "");
    if (/^[0-9A-Fa-f]{6}$/.test(clean)) {
      const rgb = hexToRgb(`#${clean}`);
      const parsedHsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
      setHsv(parsedHsv);
    }
  };

  // ── Apply Selection ──
  const handleApply = () => {
    onApplyColor(currentHex);
    onClose();
  };

  if (!isOpen) return null;

  // ── Sheet styling based on application theme (matches UpdateDialog standards) ──
  const isAppleDark = theme.mode === "apple_dark";
  const isNightWhisper = theme.mode === "night_whisper";
  const sheetBg = isAppleDark
    ? "#1C1C1E"
    : isNightWhisper
    ? "#171F21"
    : theme.isDark
    ? "#121A1B"
    : "#FFFFFF";

  const sheetBorder = isAppleDark
    ? "rgba(255, 255, 255, 0.12)"
    : isNightWhisper
    ? "rgba(226, 223, 210, 0.12)"
    : theme.border;

  const content = (
    <AnimatePresence>
      <div
        id="dar-color-picker-overlay"
        dir="rtl"
        className="fixed inset-0 flex items-end justify-center pointer-events-auto select-none"
        style={{
          zIndex: 2147483647,
          isolation: "isolate",
        }}
      >
        {/* Backdrop overlay — click anywhere to close smoothly */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="fixed inset-0 bg-black/65 backdrop-blur-md cursor-pointer"
          onClick={onClose}
        />

        {/* Bottom Sheet Card — matches exact UpdateDialog sizing, radius and philosophy */}
        <motion.div
          initial={{ y: "100%", opacity: 0.9 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0.9 }}
          transition={{
            type: "spring",
            damping: 32,
            stiffness: 340,
            mass: 0.9,
          }}
          className="relative w-full max-w-[420px] border shadow-2xl z-10 flex flex-col items-center overflow-hidden"
          style={{
            borderTopLeftRadius: "36px",
            borderTopRightRadius: "36px",
            borderBottomLeftRadius: "0px",
            borderBottomRightRadius: "0px",
            backgroundColor: sheetBg,
            borderColor: sheetBorder,
            boxShadow: `0 -16px 50px -10px ${theme.shadow || "rgba(0,0,0,0.5)"}`,
            padding: "14px 18px 24px 18px",
            paddingBottom: "max(env(safe-area-inset-bottom), 24px)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Drag Indicator Pill */}
          <div
            className="w-10 h-1.5 rounded-full mb-3 opacity-25"
            style={{ backgroundColor: theme.text }}
          />

          {/* ── Header: Checkmark Button on Left & Dynamic Arabic Color Name in Center ── */}
          <div className="w-full flex items-center justify-between mb-4 px-1">
            {/* Top-Left / Top-Corner Apply Checkmark Button (Matches Screenshot Exactly) */}
            <button
              type="button"
              onClick={handleApply}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-90 cursor-pointer"
              style={{
                color: theme.text,
              }}
              title="تطبيق واختيار اللون"
              aria-label="تطبيق اللون"
            >
              <Check className="w-6 h-6 stroke-[2.4]" />
            </button>

            {/* Dynamic Arabic Color Name (Matches Screenshot: "أحمر داكن") */}
            <h3
              className="text-base sm:text-lg font-bold font-zain-bold tracking-tight text-center pl-9"
              style={{
                color: theme.text,
                fontFamily: "'Thmanyah Serif Display', 'Thmanyah Sans', sans-serif",
              }}
            >
              {arabicColorName}
            </h3>

            {/* Spacer for symmetrical centering */}
            <div className="w-0" />
          </div>

          {/* ── 2D Saturation-Value Color Field (Matches Screenshot Exactly) ── */}
          <div
            ref={satValFieldRef}
            onPointerDown={handleSatValPointerDown}
            onPointerMove={handleSatValPointerMove}
            onPointerUp={handleSatValPointerUp}
            onPointerCancel={handleSatValPointerUp}
            className="w-full relative rounded-2xl sm:rounded-[22px] overflow-hidden mb-4 border shadow-inner cursor-crosshair touch-none select-none"
            style={{
              height: "175px",
              backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
              borderColor: isAppleDark || isNightWhisper ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
            }}
          >
            {/* Horizontal Saturation Layer: White to Transparent */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "linear-gradient(to right, #FFFFFF, rgba(255, 255, 255, 0))",
              }}
            />

            {/* Vertical Brightness/Value Layer: Transparent to Black */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "linear-gradient(to top, #000000, rgba(0, 0, 0, 0))",
              }}
            />

            {/* Draggable Circle Cursor (White Ring 'O' from Reference Image) */}
            <div
              className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${hsv.s * 100}%`,
                top: `${(1 - hsv.v) * 100}%`,
              }}
            >
              <div
                className="w-6 h-6 rounded-full border-2 border-white shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
                style={{
                  backgroundColor: "transparent",
                }}
              />
            </div>
          </div>

          {/* ── Hue Slider Bar (Matches Screenshot Exactly) ── */}
          <div className="w-full mb-5 select-none" style={{ marginBottom: "22px" }}>
            <div
              ref={hueSliderRef}
              onPointerDown={handleHuePointerDown}
              onPointerMove={handleHuePointerMove}
              onPointerUp={handleHuePointerUp}
              onPointerCancel={handleHuePointerUp}
              className="w-full relative rounded-full border shadow-sm cursor-pointer touch-none select-none flex items-center"
              style={{
                height: "18px",
                background:
                  "linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)",
                borderColor: isAppleDark || isNightWhisper ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.12)",
              }}
            >
              {/* Draggable Hue Circle Cursor (White Ring 'O' from Reference Image) */}
              <div
                className="absolute pointer-events-none top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
                style={{
                  left: `${(hsv.h / 360) * 100}%`,
                }}
              >
                <div
                  className="w-6 h-6 rounded-full border-2 border-white shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
                  style={{
                    backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* ── Hex Code Display & Color Preview Circle Capsule ── */}
          <div
            className="w-full rounded-full border flex items-center justify-between px-3.5 transition-colors"
            style={{
              height: "52px",
              minHeight: "52px",
              borderRadius: "9999px",
              backgroundColor: isAppleDark || isNightWhisper ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)",
              borderColor: isAppleDark || isNightWhisper ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.1)",
            }}
          >
            {/* Dot and Hex Code Grouped Directly Next to Each Other in Natural Order */}
            <div className="flex items-center gap-3" dir="rtl">
              {/* Circular Color Preview Swatch */}
              <button
                type="button"
                onClick={handleApply}
                className="w-8 h-8 rounded-full border shadow-inner transition-transform active:scale-95 cursor-pointer shrink-0"
                style={{
                  backgroundColor: currentHex,
                  borderColor: isAppleDark || isNightWhisper ? "rgba(255, 255, 255, 0.25)" : "rgba(0, 0, 0, 0.2)",
                }}
                title="تطبيق هذا اللون"
                aria-label="تطبيق اللون المختار"
              />

              {/* Hex Code Input directly next to the color dot */}
              <input
                type="text"
                value={hexInput}
                onChange={handleHexInputChange}
                maxLength={7}
                dir="ltr"
                className="bg-transparent text-base font-mono font-bold tracking-wider outline-none text-right w-28"
                style={{
                  color: theme.text,
                }}
                placeholder="#000000"
              />
            </div>

            {/* Subtle Pill Indicator / Label */}
            <span
              onClick={handleApply}
              className="text-xs font-mono font-bold opacity-45 hover:opacity-100 transition-opacity cursor-pointer px-2"
              style={{ color: theme.text }}
            >
              HEX
            </span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  const targetNode =
    portalNode ||
    (typeof document !== "undefined"
      ? document.getElementById("dar-color-picker-root") || document.body
      : null);

  if (targetNode) {
    return createPortal(content, targetNode);
  }

  return content;
};

export default DarAlHikayatColorPickerSheet;
