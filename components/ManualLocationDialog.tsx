import React, { useState, useMemo } from "react";
import { CITIES, CityData } from "../lib/prayer-cities";
import { Search, MapPin, Check, X, Navigation, Compass } from "lucide-react";
import { useApp } from "../contexts/AppContext";

interface ManualLocationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCity: (city: CityData) => void;
  onUseGPS: () => void;
  selectedCityName: string;
}

export const ManualLocationDialog: React.FC<ManualLocationDialogProps> = ({
  isOpen,
  onClose,
  onSelectCity,
  onUseGPS,
  selectedCityName,
}) => {
  const { currentTheme } = useApp();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<string>("مصر");

  const countries = useMemo(() => {
    const list = Array.from(new Set(CITIES.map((c) => c.countryAr)));
    // Put Egypt and Saudi Arabia first
    return list.sort((a, b) => {
      if (a === "مصر") return -1;
      if (b === "مصر") return 1;
      if (a === "السعودية") return -1;
      if (b === "السعودية") return 1;
      return a.localeCompare(b, "ar");
    });
  }, []);

  const filteredCities = useMemo(() => {
    return CITIES.filter((city) => {
      const matchSearch =
        !searchTerm.trim() ||
        city.nameAr.includes(searchTerm.trim()) ||
        city.countryAr.includes(searchTerm.trim());
      const matchCountry = !searchTerm.trim()
        ? city.countryAr === selectedCountry
        : true;
      return matchSearch && matchCountry;
    });
  }, [searchTerm, selectedCountry]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md max-h-[85vh] flex flex-col border shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
        style={{
          borderRadius: "28px",
          backgroundColor: currentTheme.bg,
          borderColor: currentTheme.border,
          boxShadow: `0 20px 40px -10px ${currentTheme.shadow}`,
        }}
      >
        {/* Header */}
        <div
          className="p-4 sm:p-5 border-b flex items-center justify-between"
          style={{ borderColor: currentTheme.border }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 flex items-center justify-center border shadow-xs"
              style={{
                borderRadius: "9999px",
                backgroundColor: `${currentTheme.accent}15`,
                borderColor: `${currentTheme.accent}30`,
                color: currentTheme.accent,
              }}
            >
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3
                className="font-zain-bold text-lg leading-tight"
                style={{ color: currentTheme.text }}
              >
                تحديد موقع الصلاة
              </h3>
              <p
                className="font-zain-reg text-xs opacity-70"
                style={{ color: currentTheme.secondary }}
              >
                اختر مدينتك لحساب أوقات الصلاة بدقة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
            style={{ borderRadius: "9999px", color: currentTheme.text }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* GPS Quick Action */}
        <div className="p-3.5 sm:p-4 border-b" style={{ borderColor: currentTheme.border }}>
          <button
            onClick={() => {
              onUseGPS();
              onClose();
            }}
            className="w-full py-2.5 px-4 border shadow-sm flex items-center justify-center gap-2.5 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
            style={{
              borderRadius: "16px",
              backgroundColor: `${currentTheme.accent}15`,
              borderColor: `${currentTheme.accent}35`,
              color: currentTheme.accent,
            }}
          >
            <Navigation className="w-4 h-4" />
            <span className="font-zain-bold text-sm">
              استخدام الموقع الحالي التلقائي (GPS)
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="p-3.5 sm:p-4 pb-2">
          <div
            className="relative flex items-center border px-3.5 py-2.5 shadow-inner"
            style={{
              borderRadius: "16px",
              backgroundColor: currentTheme.isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
              borderColor: currentTheme.border,
            }}
          >
            <Search className="w-4 h-4 opacity-50 ml-2" style={{ color: currentTheme.text }} />
            <input
              type="text"
              placeholder="ابحث عن مدينة أو دولة..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent font-zain-reg text-sm outline-none"
              style={{ color: currentTheme.text }}
              dir="rtl"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="opacity-50 hover:opacity-100 mr-1 text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Countries Pills (if not searching) */}
        {!searchTerm && (
          <div className="px-4 py-1.5 flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
            {countries.map((country) => {
              const isSelected = selectedCountry === country;
              return (
                <button
                  key={country}
                  onClick={() => setSelectedCountry(country)}
                  className={`px-3 py-1 text-xs font-zain-bold whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? "shadow-xs"
                      : "opacity-60 hover:opacity-100 hover:bg-black/5"
                  }`}
                  style={{
                    borderRadius: "9999px",
                    backgroundColor: isSelected
                      ? `${currentTheme.accent}20`
                      : "transparent",
                    color: isSelected ? currentTheme.accent : currentTheme.text,
                    border: isSelected
                      ? `1px solid ${currentTheme.accent}40`
                      : "1px solid transparent",
                  }}
                >
                  {country}
                </button>
              );
            })}
          </div>
        )}

        {/* Cities List */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 pt-2 space-y-1.5 max-h-72">
          {filteredCities.length === 0 ? (
            <div className="text-center py-8 opacity-60">
              <p className="font-zain-reg text-sm" style={{ color: currentTheme.text }}>
                لا توجد مدن مطابقة للبحث...
              </p>
            </div>
          ) : (
            filteredCities.map((city) => {
              const isSelected = selectedCityName === city.nameAr;
              return (
                <button
                  key={`${city.countryAr}-${city.nameAr}`}
                  onClick={() => {
                    onSelectCity(city);
                    onClose();
                  }}
                  className={`w-full px-4 py-2.5 flex items-center justify-between border transition-all cursor-pointer ${
                    isSelected
                      ? "shadow-sm"
                      : "hover:bg-black/5 dark:hover:bg-white/5 border-transparent"
                  }`}
                  style={{
                    borderRadius: "16px",
                    backgroundColor: isSelected
                      ? `${currentTheme.accent}12`
                      : "transparent",
                    borderColor: isSelected
                      ? `${currentTheme.accent}30`
                      : "transparent",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <MapPin
                      className={`w-4 h-4 ${isSelected ? "opacity-100" : "opacity-40"}`}
                      style={{ color: isSelected ? currentTheme.accent : currentTheme.text }}
                    />
                    <div className="text-right">
                      <p
                        className={`font-zain-bold text-sm ${isSelected ? "opacity-100" : "opacity-90"}`}
                        style={{ color: isSelected ? currentTheme.accent : currentTheme.text }}
                      >
                        {city.nameAr}
                      </p>
                      <p
                        className="font-zain-reg text-xs opacity-60"
                        style={{ color: currentTheme.secondary }}
                      >
                        {city.countryAr}
                      </p>
                    </div>
                  </div>
                  {isSelected && (
                    <div
                      className="w-5 h-5 flex items-center justify-center"
                      style={{
                        borderRadius: "9999px",
                        backgroundColor: currentTheme.accent,
                        color: currentTheme.bg,
                      }}
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default ManualLocationDialog;
