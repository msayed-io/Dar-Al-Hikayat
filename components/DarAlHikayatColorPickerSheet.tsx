import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, Check, Pipette, RefreshCw } from "lucide-react";
import { ThemeColors } from "../contexts/AppContext";

export interface DarAlHikayatColorPickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentColor: string;
  onApplyColor: (hex: string) => void;
  theme: ThemeColors;
}

// Convert Hex to HSL
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let c = hex.replace("#", "");
  if (c.length === 3) {
    c = c.split("").map((x) => x + x).join("");
  }
  const num = parseInt(c, 16);
  if (isNaN(num)) return { h: 0, s: 100, l: 50 };
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

// Convert HSL to Hex
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

const QUICK_PRESETS = [
  "#FFFFFF",
  "#121A1B",
  "#A7AA63",
  "#3B82F6",
  "#0EA5E9",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#9333EA",
  "#EC4899",
  "#6366F1",
  "#14B8A6",
  "#84CC16",
  "#EAB308",
  "#F97316",
  "#64748B",
];

export const DarAlHikayatColorPickerSheet: React.FC<DarAlHikayatColorPickerSheetProps> = ({
  isOpen,
  onClose,
  currentColor,
  onApplyColor,
  theme,
}) => {
  const [hue, setHue] = useState<number>(0);
  const [saturation, setSaturation] = useState<number>(100);
  const [lightness, setLightness] = useState<number>(50);
  const [hexInput, setHexInput] = useState<string>("#FFFFFF");
  const [selectedHex, setSelectedHex] = useState<string>("#FFFFFF");

  useEffect(() => {
    if (currentColor) {
      const validHex = currentColor.startsWith("#") ? currentColor : `#${currentColor}`;
      setSelectedHex(validHex.toUpperCase());
      setHexInput(validHex.toUpperCase());
      const { h, s, l } = hexToHsl(validHex);
      setHue(h);
      setSaturation(s);
      setLightness(l);
    }
  }, [currentColor, isOpen]);

  const updateFromHsl = useCallback((h: number, s: number, l: number) => {
    const hex = hslToHex(h, s, l);
    setSelectedHex(hex);
    setHexInput(hex);
  }, []);

  const handleHueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newHue = Number(e.target.value);
    setHue(newHue);
    updateFromHsl(newHue, saturation, lightness);
  };

  const handleSaturationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSat = Number(e.target.value);
    setSaturation(newSat);
    updateFromHsl(hue, newSat, lightness);
  };

  const handleLightnessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newLight = Number(e.target.value);
    setLightness(newLight);
    updateFromHsl(hue, saturation, newLight);
  };

  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setHexInput(val);
    if (/^#?([0-9A-F]{3}){1,2}$/i.test(val)) {
      const formatted = val.startsWith("#") ? val : `#${val}`;
      setSelectedHex(formatted.toUpperCase());
      const { h, s, l } = hexToHsl(formatted);
      setHue(h);
      setSaturation(s);
      setLightness(l);
    }
  };

  const handlePresetSelect = (hex: string) => {
    setSelectedHex(hex.toUpperCase());
    setHexInput(hex.toUpperCase());
    const { h, s, l } = hexToHsl(hex);
    setHue(h);
    setSaturation(s);
    setLightness(l);
  };

  const handleApply = () => {
    onApplyColor(selectedHex);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="w-full max-w-lg mx-auto rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl border transition-all duration-300 transform animate-in slide-in-from-bottom-6 sm:zoom-in-95"
        style={{
          backgroundColor: theme.isDark ? "#171F20" : "#F4F1E4",
          borderColor: theme.border,
          color: theme.text,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-black/10 dark:border-white/10 mb-4">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shadow-sm"
              style={{ backgroundColor: `${theme.accent}30`, color: theme.accent }}
            >
              <Pipette className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold tracking-tight">اختيار لون مخصص</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5 opacity-70" />
          </button>
        </div>

        {/* Selected Color Preview Banner */}
        <div
          className="w-full h-16 rounded-2xl shadow-inner border flex items-center justify-between px-4 mb-5 transition-colors relative overflow-hidden"
          style={{ backgroundColor: selectedHex, borderColor: theme.border }}
        >
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-full backdrop-blur-md border shadow-sm"
            style={{
              backgroundColor: theme.isDark ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.85)",
              color: theme.isDark ? "#FFFFFF" : "#121A1B",
              borderColor: theme.border,
            }}
          >
            {selectedHex}
          </span>
          <span
            className="text-xs font-medium opacity-80 px-2 py-0.5 rounded"
            style={{
              color: lightness > 60 ? "#000000" : "#FFFFFF",
            }}
          >
            معاينة اللون
          </span>
        </div>

        {/* Color Sliders */}
        <div className="space-y-4 mb-5">
          {/* Hue Slider */}
          <div>
            <div className="flex justify-between text-xs font-medium mb-1.5 opacity-80">
              <span>درجة اللون (Hue)</span>
              <span>{hue}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="360"
              value={hue}
              onChange={handleHueChange}
              className="w-full h-3 rounded-lg appearance-none cursor-pointer focus:outline-none"
              style={{
                background:
                  "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
              }}
            />
          </div>

          {/* Saturation Slider */}
          <div>
            <div className="flex justify-between text-xs font-medium mb-1.5 opacity-80">
              <span>الشباع (Saturation)</span>
              <span>{saturation}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={saturation}
              onChange={handleSaturationChange}
              className="w-full h-3 rounded-lg appearance-none cursor-pointer focus:outline-none"
              style={{
                background: `linear-gradient(to right, ${hslToHex(hue, 0, lightness)}, ${hslToHex(hue, 100, lightness)})`,
              }}
            />
          </div>

          {/* Lightness Slider */}
          <div>
            <div className="flex justify-between text-xs font-medium mb-1.5 opacity-80">
              <span>السطوع (Lightness)</span>
              <span>{lightness}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={lightness}
              onChange={handleLightnessChange}
              className="w-full h-3 rounded-lg appearance-none cursor-pointer focus:outline-none"
              style={{
                background: `linear-gradient(to right, #000000, ${hslToHex(hue, saturation, 50)}, #ffffff)`,
              }}
            />
          </div>
        </div>

        {/* Hex Code Manual Input */}
        <div className="mb-5">
          <label className="block text-xs font-medium mb-1.5 opacity-80">رمز اللون (HEX Code)</label>
          <div className="relative flex items-center">
            <input
              type="text"
              value={hexInput}
              onChange={handleHexInputChange}
              maxLength={7}
              placeholder="#FFFFFF"
              className="w-full px-3.5 py-2 rounded-xl border text-sm font-mono tracking-wider focus:outline-none transition-all dir-ltr text-center"
              style={{
                backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                borderColor: theme.border,
                color: theme.text,
              }}
            />
            <div
              className="absolute left-2.5 w-5 h-5 rounded-md border shadow-inner"
              style={{ backgroundColor: selectedHex, borderColor: theme.border }}
            />
          </div>
        </div>

        {/* Quick Swatches Palette */}
        <div className="mb-6">
          <label className="block text-xs font-medium mb-2 opacity-80">ألوان سريعة جاهزة</label>
          <div className="grid grid-cols-8 gap-2">
            {QUICK_PRESETS.map((hex) => {
              const isSelected = selectedHex.toUpperCase() === hex.toUpperCase();
              return (
                <button
                  key={hex}
                  type="button"
                  onClick={() => handlePresetSelect(hex)}
                  className={`w-full aspect-square rounded-full transition-all duration-150 flex items-center justify-center relative shadow-sm hover:scale-110 active:scale-95 ${
                    isSelected ? "ring-2 ring-offset-2 scale-105" : "opacity-90"
                  }`}
                  style={{
                    backgroundColor: hex,
                    border: hex === "#FFFFFF" ? "1px solid rgba(0,0,0,0.2)" : "none",
                    // @ts-ignore
                    "--tw-ring-color": theme.accent,
                    "--tw-ring-offset-color": theme.isDark ? "#171F20" : "#F4F1E4",
                  }}
                  title={hex}
                >
                  {isSelected && (
                    <Check
                      className="w-3.5 h-3.5"
                      style={{
                        color: hexToHsl(hex).l > 60 ? "#000000" : "#FFFFFF",
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2 border-t border-black/10 dark:border-white/10">
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 py-2.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:opacity-90 active:scale-95 transition-all cursor-pointer"
            style={{
              backgroundColor: theme.accent,
              color: theme.isDark ? "#121A1B" : "#FFFFFF",
            }}
          >
            <Check className="w-4 h-4" />
            <span>تطبيق اللون</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl font-medium text-sm border hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer opacity-80 hover:opacity-100"
            style={{
              borderColor: theme.border,
              color: theme.text,
            }}
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
};

export default DarAlHikayatColorPickerSheet;
