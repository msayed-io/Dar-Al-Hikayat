import React, { useState, useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ChevronRight,
  Search,
  MapPin,
  Loader2,
  X,
  Crosshair,
  Check,
  Layers,
  Plus,
  Minus,
} from "lucide-react";
import { useApp } from "../contexts/AppContext";
import { schedulePrayerAlarms, guessTimezone } from "../lib/prayer-alarms";
import {
  ARAB_INDEXED_PLACES,
  findNearestIndexedPlace,
  IndexedPlace,
} from "../lib/egypt-places";

interface LocationResult {
  placeId: string;
  name: string;
  displayName: string;
  lat: number;
  lng: number;
  country: string;
  cityOrVillage: string;
}

type MapMode = "streets" | "satellite";

export const LocationPickerPage: React.FC = () => {
  const { currentTheme, closeLocationPicker, prayerState, updatePrayerState } =
    useApp();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const initialLat = prayerState.location?.latitude ?? 30.0444;
  const initialLng = prayerState.location?.longitude ?? 31.2357;
  const initialCity =
    prayerState.location?.cityNameAr ||
    prayerState.location?.cityName ||
    "القاهرة";
  const initialCountry = prayerState.location?.countryNameAr || "مصر";

  const [currentCoords, setCurrentCoords] = useState<{
    lat: number;
    lng: number;
  }>({
    lat: initialLat,
    lng: initialLng,
  });

  const [mapMode, setMapMode] = useState<MapMode>("streets");
  const [cityNameOnly, setCityNameOnly] = useState<string>(initialCity);
  const [countryNameOnly, setCountryNameOnly] = useState<string>(initialCountry);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LocationResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showResultsDropdown, setShowResultsDropdown] = useState(false);

  const searchTimeoutRef = useRef<number | null>(null);
  const geocodeTimeoutRef = useRef<number | null>(null);
  const isProgrammaticMoveRef = useRef(false);

  // ── Reverse Geocoding فائقة الدقة باللغة العربية مع بديل محلي فوري ──
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setIsReverseGeocoding(true);

    // البديل المحلي الفوري لضمان عدم حدوث أي خطأ أو بطء
    const nearest = findNearestIndexedPlace(lat, lng);

    try {
      // محاولة عبر OpenStreetMap مع AbortSignal مهلة 3 ثوانٍ
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ar`,
        {
          headers: { "Accept-Language": "ar" },
          signal: AbortSignal.timeout(3000),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        const placeName =
          addr.hamlet ||
          addr.village ||
          addr.suburb ||
          addr.town ||
          addr.neighbourhood ||
          addr.city ||
          addr.district ||
          addr.county ||
          addr.road ||
          data.name ||
          (data.display_name
            ? data.display_name.split(",")[0].trim()
            : nearest.name);

        const country = addr.country || nearest.country;
        setCityNameOnly(placeName);
        setCountryNameOnly(country);
        setIsReverseGeocoding(false);
        return;
      }
    } catch {
      // إذا حدث حظر أو مهلة، نستخدم أقرب مكان مفهرس فورا بدقة تامة
    }

    setCityNameOnly(nearest.name);
    setCountryNameOnly(nearest.country);
    setIsReverseGeocoding(false);
  }, []);

  // ── دالة تحديث طبقة الخريطة (Google Maps Arabic) ──
  const updateTileLayer = useCallback((map: L.Map, mode: MapMode) => {
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const tileUrl =
      mode === "streets"
        ? "https://mt{s}.google.com/vt/lyrs=m&hl=ar&x={x}&y={y}&z={z}"
        : "https://mt{s}.google.com/vt/lyrs=y&hl=ar&x={x}&y={y}&z={z}";

    const newLayer = L.tileLayer(tileUrl, {
      maxZoom: 20,
      subdomains: ["0", "1", "2", "3"],
      attribution: "Google Maps",
    });

    newLayer.addTo(map);
    tileLayerRef.current = newLayer;
  }, []);

  // ── تهيئة خريطة Leaflet ──
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
    });

    updateTileLayer(map, "streets");

    // إعادة ضبط الأبعاد بعد ثوان لضمان دقة كاملة
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);

    map.on("moveend", () => {
      const center = map.getCenter();
      setCurrentCoords({ lat: center.lat, lng: center.lng });

      // منع تحديث اسم المكان إذا كان التحرك مبرمجاً (نتيجة اختيار بحث)
      if (isProgrammaticMoveRef.current) {
        isProgrammaticMoveRef.current = false;
        return;
      }

      if (geocodeTimeoutRef.current) {
        window.clearTimeout(geocodeTimeoutRef.current);
      }
      geocodeTimeoutRef.current = window.setTimeout(() => {
        reverseGeocode(center.lat, center.lng);
      }, 350);
    });

    map.on("click", (e) => {
      map.panTo(e.latlng, { animate: true, duration: 0.5 });
    });

    mapInstanceRef.current = map;
    reverseGeocode(initialLat, initialLng);

    return () => {
      window.removeEventListener("resize", onResize);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      if (geocodeTimeoutRef.current) {
        window.clearTimeout(geocodeTimeoutRef.current);
      }
      if (searchTimeoutRef.current) {
        window.clearTimeout(searchTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reverseGeocode, updateTileLayer]);

  // ── تبديل نمط الخريطة (خريطة / قمر صناعي) ──
  const toggleMapMode = (newMode: MapMode) => {
    setMapMode(newMode);
    if (mapInstanceRef.current) {
      updateTileLayer(mapInstanceRef.current, newMode);
    }
  };

  // ── أدوات التقريب والتبعيد ──
  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  };

  // ── البحث الفوري بنسبة 100% (محلي فوري + مصادر عالمية متعددة) ──
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    setSearchQuery(rawVal);

    if (searchTimeoutRef.current) {
      window.clearTimeout(searchTimeoutRef.current);
    }

    const val = rawVal.trim().toLowerCase();
    
    // لا تبدأ البحث إلا بعد كتابة 3 أحرف على الأقل
    if (val.length < 3) {
      setSearchResults([]);
      setShowResultsDropdown(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setShowResultsDropdown(true);

    searchTimeoutRef.current = window.setTimeout(async () => {
      try {
        // 1. تطابق محلي فوري (كأساس)
        const norm = (s: string) =>
          s
            .replace(/[أإآ]/g, "ا")
            .replace(/ة/g, "ه")
            .replace(/ى/g, "ي")
            .toLowerCase();
        const queryNorm = norm(val);

        const localMatches: LocationResult[] = [];
        for (const place of ARAB_INDEXED_PLACES) {
          if (norm(place.name).includes(queryNorm) || norm(place.parent).includes(queryNorm)) {
            localMatches.push({
              placeId: `local-${place.name}-${place.lat}`,
              name: place.name,
              displayName: `${place.name}، ${place.parent}`,
              lat: place.lat,
              lng: place.lng,
              country: place.country,
              cityOrVillage: place.name,
            });
            if (localMatches.length >= 5) break;
          }
        }

        // 2. البحث العالمي المزدوج (Nominatim + ArcGIS)
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&addressdetails=1&limit=5&accept-language=ar`;
        const arcgisUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&singleLine=${encodeURIComponent(val)}&maxLocations=5`;

        const [nominatimRes, arcgisRes] = await Promise.allSettled([
          fetch(nominatimUrl, { signal: AbortSignal.timeout(5000) }).then(res => res.json()),
          fetch(arcgisUrl, { signal: AbortSignal.timeout(5000) }).then(res => res.json())
        ]);

        const remoteMatches: LocationResult[] = [];

        // معالجة نتائج Nominatim
        if (nominatimRes.status === "fulfilled" && Array.isArray(nominatimRes.value)) {
          nominatimRes.value.forEach((item: any) => {
            const country = item.address?.country || "مصر";
            const name = item.name || item.display_name?.split(",")[0];
            remoteMatches.push({
              placeId: `nom-${item.place_id || Math.random()}`,
              name: name,
              displayName: item.display_name || name,
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
              country,
              cityOrVillage: name,
            });
          });
        }

        // معالجة نتائج ArcGIS
        if (arcgisRes.status === "fulfilled" && arcgisRes.value.candidates) {
          arcgisRes.value.candidates.forEach((item: any) => {
            const lat = item.location.y;
            const lng = item.location.x;
            const name = item.address?.split(",")[0] || "موقع محدد";
            remoteMatches.push({
              placeId: `arc-${Math.random()}`,
              name: name,
              displayName: item.address || name,
              lat,
              lng,
              country: "مصر",
              cityOrVillage: name,
            });
          });
        }

        // 3. دمج النتائج مع إزالة التكرار (أقل من 0.01 درجة)
        const combined = [...localMatches];
        for (const r of remoteMatches) {
          if (
            !combined.some(
              (c) =>
                Math.abs(c.lat - r.lat) < 0.01 &&
                Math.abs(c.lng - r.lng) < 0.01
            )
          ) {
            combined.push(r);
          }
        }

        setSearchResults(combined.slice(0, 10));
      } catch (err) {
        console.warn("Live search API error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 600);
  };

  // ── اختيار نتيجة من نتائج البحث ──
  const handleSelectSearchResult = (result: LocationResult) => {
    setShowResultsDropdown(false);
    setSearchQuery("");
    setCityNameOnly(result.cityOrVillage);
    setCountryNameOnly(result.country);
    setCurrentCoords({ lat: result.lat, lng: result.lng });

    if (mapInstanceRef.current) {
      isProgrammaticMoveRef.current = true;
      mapInstanceRef.current.flyTo([result.lat, result.lng], 16, {
        duration: 1.2,
      });
    }
  };

  // ── إعادة التمركز إلى موقع الجهاز (GPS) ──
  const handleRecenterToDeviceGPS = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setCurrentCoords({ lat: latitude, lng: longitude });
          if (mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([latitude, longitude], 16, {
              duration: 1.2,
            });
          }
          reverseGeocode(latitude, longitude);
        },
        () => {
          // في حال الرفض التلقائي، التمركز على الموقع الحالي
          if (mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([currentCoords.lat, currentCoords.lng], 16, {
              duration: 1.0,
            });
          }
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    }
  };

  // ── تأكيد وحفظ الموقع ──
  const handleConfirmLocation = async () => {
    setIsSaving(true);
    try {
      const finalTimezone = guessTimezone(currentCoords.lat, currentCoords.lng);

      const finalLocation = {
        latitude: currentCoords.lat,
        longitude: currentCoords.lng,
        cityName: cityNameOnly,
        cityNameAr: cityNameOnly,
        countryNameAr: countryNameOnly,
        timezoneId: finalTimezone,
        isAutoDetected: false,
      };

      // 1. تحديث حالة الصلاة فوراً
      updatePrayerState({ location: finalLocation });

      // 2. جدولة تنبيهات الصلاة على الإحداثيات الجديدة بدقة الثواني
      await schedulePrayerAlarms(finalLocation, prayerState.method);

      // 3. العودة إلى الصفحة
      setTimeout(() => {
        setIsSaving(false);
        closeLocationPicker();
      }, 300);
    } catch (e) {
      console.error("Error saving manual location:", e);
      setIsSaving(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[150] w-full h-full flex flex-col overflow-hidden select-none"
      style={{
        backgroundColor: currentTheme.bg,
        color: currentTheme.text,
      }}
    >
      {/* ── حاوية الخريطة (Leaflet تملأ الخلفية بالكامل) ── */}
      <div className="relative w-full flex-1 z-0">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* ── المؤشر البصري المركزي (دبوس إسقاط دقيق على مركز الخريطة) ── */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full pointer-events-auto z-[300] flex flex-col items-center cursor-pointer group"
          onClick={handleConfirmLocation}
          title="تأكيد اختيار هذا الموقع"
        >
          {/* كبسولة منبثقة تفاعلية فوق الدبوس لتأكيد الموقع بلمسة واحدة */}
          <div 
            className="mb-2.5 px-3 py-1.5 rounded-full border shadow-xl text-xs font-zain-bold flex items-center gap-1.5 whitespace-nowrap backdrop-blur-xl animate-bounce transition-all duration-300 hover:scale-105 active:scale-95 hover:brightness-110"
            style={{
              backgroundColor: currentTheme.text,
              color: currentTheme.bg,
              borderColor: currentTheme.border,
              boxShadow: `0 8px 24px ${currentTheme.shadow || "rgba(0,0,0,0.15)"}`,
            }}
          >
            <Check className="w-3.5 h-3.5" strokeWidth={3} style={{ color: currentTheme.accent }} />
            <span>تأكيد اختيار: {cityNameOnly}</span>
          </div>

          <div className="transition-transform duration-200 drop-shadow-xl group-hover:-translate-y-1 group-active:scale-95">
            <svg
              width="38"
              height="48"
              viewBox="0 0 36 46"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M18 0C8.05887 0 0 8.05887 0 18C0 29.5 18 46 18 46C18 46 36 29.5 36 18C36 8.05887 27.9411 0 18 0Z"
                fill={currentTheme.accent}
              />
              <circle cx="18" cy="18" r="6.5" fill="#FFFFFF" />
            </svg>
          </div>
          <div className="w-3.5 h-1.5 rounded-full bg-black/40 blur-[1px] -mt-1 transition-transform duration-200 group-hover:scale-75" />
        </div>
      </div>

      {/* ── الشريط العلوي العائم (زر الرجوع + محول الخريطة/القمر الصناعي + زر GPS) ── */}
      <div 
        className="absolute left-4 right-4 pointer-events-auto flex items-center justify-between" 
        style={{ top: "24px", marginTop: "env(safe-area-inset-top, 0px)", zIndex: 999999 }}
      >
        {/* زر الخروج بكبسولة علوية احترافية دائرية مطابقة لتصميم المحرر ووضع القراءة */}
        <div
          className="pointer-events-auto h-10 w-10 p-1 rounded-full backdrop-blur-2xl border shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 shrink-0"
          style={{
            backgroundColor: currentTheme.glass,
            borderColor: currentTheme.border,
            boxShadow: `0 12px 32px -4px ${currentTheme.shadow || "rgba(0,0,0,0.15)"}`,
          }}
        >
          <button
            onClick={closeLocationPicker}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer flex-shrink-0"
            style={{ color: currentTheme.text }}
            title="خروج"
            aria-label="خروج"
          >
            <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>

        {/* كبسولة التبديل بين الخريطة والقمر الصناعي بدقة فائقة */}
        <div
          className="flex items-center p-1 rounded-full border shadow-md backdrop-blur-xl transition-all"
          style={{
            backgroundColor: currentTheme.glass,
            borderColor: currentTheme.border,
            boxShadow: `0 8px 24px -4px ${currentTheme.shadow}`,
          }}
        >
          <button
            type="button"
            onClick={() => toggleMapMode("streets")}
            className={`px-3 py-1 rounded-full text-xs font-zain-bold transition-all cursor-pointer ${
              mapMode === "streets" ? "shadow-xs" : "opacity-60 hover:opacity-100"
            }`}
            style={{
              backgroundColor:
                mapMode === "streets" ? currentTheme.text : "transparent",
              color: mapMode === "streets" ? currentTheme.bg : currentTheme.text,
            }}
          >
            خريطة
          </button>
          <button
            type="button"
            onClick={() => toggleMapMode("satellite")}
            className={`px-3 py-1 rounded-full text-xs font-zain-bold transition-all cursor-pointer ${
              mapMode === "satellite" ? "shadow-xs" : "opacity-60 hover:opacity-100"
            }`}
            style={{
              backgroundColor:
                mapMode === "satellite" ? currentTheme.accent : "transparent",
              color:
                mapMode === "satellite"
                  ? currentTheme.isDark
                    ? "#000"
                    : "#fff"
                  : currentTheme.text,
            }}
          >
            قمر صناعي
          </button>
        </div>

        {/* زر التمركز إلى موقع الجهاز عبر GPS */}
        <button
          type="button"
          onClick={handleRecenterToDeviceGPS}
          className="w-10 h-10 border shadow-md flex items-center justify-center backdrop-blur-xl transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer rounded-full"
          style={{
            backgroundColor: currentTheme.bg,
            borderColor: currentTheme.border,
            boxShadow: `0 8px 24px -4px ${currentTheme.shadow}`,
            color: currentTheme.accent,
          }}
          title="موقعي الحالي"
          aria-label="موقعي الحالي"
        >
          <Crosshair className="w-4 h-4" strokeWidth={2.2} />
        </button>
      </div>

      {/* ── أدوات التقريب والتبعيد على جانب الخريطة ── */}
      <div 
        className="absolute right-4 pointer-events-auto flex flex-col gap-2"
        style={{ top: "calc(80px + env(safe-area-inset-top, 0px))", zIndex: 999998 }}
      >
        <button
          type="button"
          onClick={handleZoomIn}
          className="w-9 h-9 rounded-full border shadow-md flex items-center justify-center backdrop-blur-xl transition-all hover:scale-105 active:scale-95 cursor-pointer"
          style={{
            backgroundColor: currentTheme.bg,
            borderColor: currentTheme.border,
            color: currentTheme.text,
          }}
          title="تكبير"
          aria-label="تكبير"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="w-9 h-9 rounded-full border shadow-md flex items-center justify-center backdrop-blur-xl transition-all hover:scale-105 active:scale-95 cursor-pointer"
          style={{
            backgroundColor: currentTheme.bg,
            borderColor: currentTheme.border,
            color: currentTheme.text,
          }}
          title="تصغير"
          aria-label="تصغير"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>

      {/* ── النافذة السفلية الحقيقية المنبثقة من الأسفل مباشرةً (True Bottom Sheet) ── */}
      <div className="fixed bottom-0 left-0 right-0 z-[400] pointer-events-auto flex flex-col items-center">
        <div
          className="w-full max-w-lg border-t shadow-2xl px-5 pt-4 transition-all select-none flex flex-col"
          style={{
            borderTopLeftRadius: "36px",
            borderTopRightRadius: "36px",
            borderBottomLeftRadius: "0px",
            borderBottomRightRadius: "0px",
            backgroundColor: currentTheme.glass,
            borderColor: currentTheme.border,
            backdropFilter: "blur(28px)",
            WebkitBackdropFilter: "blur(28px)",
            boxShadow: `0 -12px 48px -8px ${currentTheme.shadow}`,
            paddingBottom: "max(env(safe-area-inset-bottom), 24px)",
            maxHeight: "85vh",
          }}
        >
          {/* مقبض السحب العلوي المعتمد للنوافذ السفلية */}
          <div className="flex justify-center mb-4 shrink-0">
            <div
              className="w-12 h-1.5 rounded-full opacity-35"
              style={{ backgroundColor: currentTheme.text }}
            />
          </div>

          {/* عنوان النافذة السفلية */}
          <h2
            className="font-zain-xbold text-xl sm:text-2xl text-center mb-4 leading-none shrink-0"
            style={{ color: currentTheme.text }}
          >
            تحديد موقع الصلاة
          </h2>

          {/* مساحة التمرير (حقل البحث + النتائج + الكبسولة) بحيث تنكمش وتتمدد دون إخفاء الزر */}
          <div className="shrink overflow-y-auto no-scrollbar flex flex-col mb-4">
            {/* حقل البحث */}
            <div className="flex flex-col mb-4 shrink-0">
              <div
                  className="flex items-center px-4 py-3.5 border transition-all rounded-[22px] shrink-0"
                  style={{
                    backgroundColor: currentTheme.isDark
                      ? "rgba(255,255,255,0.06)"
                      : "rgba(0,0,0,0.04)",
                    borderColor: currentTheme.border,
                  }}
                >
                  <Search
                    className="w-5 h-5 ml-2 opacity-50 shrink-0"
                    style={{ color: currentTheme.text }}
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="ابحث: طنطا، المحلة، المنصورة، المعادي..."
                    className="w-full bg-transparent outline-none font-zain-reg text-sm sm:text-base placeholder:opacity-40 leading-normal"
                    style={{ color: currentTheme.text }}
                  />
                  {isSearching && (
                    <Loader2
                      className="w-4 h-4 mr-2 animate-spin shrink-0 opacity-60"
                      style={{ color: currentTheme.accent }}
                    />
                  )}
                  {searchQuery && !isSearching && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        setSearchResults([]);
                        setShowResultsDropdown(false);
                      }}
                      className="w-6 h-6 rounded-full flex items-center justify-center opacity-50 hover:opacity-100 mr-1 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* قائمة نتائج البحث الحية: تظهر في مسار الصفحة لدفع المحتوى بدلاً من التغطية */}
              {showResultsDropdown && searchResults.length > 0 && (
                <div className="mt-3 flex flex-col gap-1.5 shrink-0">
                  {searchResults.map((item) => (
                    <button
                      key={item.placeId}
                      type="button"
                      onClick={() => handleSelectSearchResult(item)}
                      className="w-full text-right px-4 py-3 rounded-[22px] flex items-center gap-3 border border-transparent hover:border-black/5 dark:hover:border-white/5 bg-black/5 dark:bg-white/5 transition-all cursor-pointer text-sm font-zain-bold"
                      style={{ color: currentTheme.text }}
                    >
                      <MapPin
                        className="w-5 h-5 shrink-0 opacity-80"
                        style={{ color: currentTheme.accent }}
                      />
                      <div className="flex flex-col truncate">
                        <span className="font-zain-xbold text-base">
                          {item.cityOrVillage}
                        </span>
                        <span className="opacity-60 text-xs font-zain-reg truncate">
                          {item.displayName}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* كبسولة الموقع المحدد: مدمجة وصغيرة باسم المكان فقط */}
            <div className="flex items-center justify-center text-center shrink-0 min-h-[32px]">
              {isReverseGeocoding ? (
                <div className="flex items-center gap-2 opacity-60 text-sm font-zain-reg">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جارٍ قراءة بيانات المكان...</span>
                </div>
              ) : (
                <div
                  className="rounded-full border text-sm font-zain-bold shadow-2xs"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "4px 12px",
                    whiteSpace: "nowrap",
                    backgroundColor: `${currentTheme.accent}15`,
                    borderColor: `${currentTheme.accent}30`,
                    color: currentTheme.accent,
                  }}
                >
                  <MapPin style={{ width: "16px", height: "16px", flexShrink: 0, marginTop: "-2px" }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "200px", lineHeight: 1 }}>{cityNameOnly}</span>
                </div>
              )}
            </div>
          </div>

          {/* زر التأكيد الرئيسي: «تأكيد الموقع» (ثابت في الأسفل دوماً) */}
          <div className="shrink-0 mt-auto">
            <button
              type="button"
              onClick={handleConfirmLocation}
              disabled={isSaving || isReverseGeocoding}
              className="w-full h-12 font-zain-xbold text-lg border shadow-md flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer active:scale-95 rounded-[22px] shrink-0 mt-auto"
              style={{
                backgroundColor: currentTheme.text,
                color: currentTheme.bg,
                borderColor: currentTheme.border,
                boxShadow: `0 8px 24px -4px ${currentTheme.shadow}`,
                opacity: isSaving ? 0.7 : 1,
              }}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>تأكيد...</span>
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" strokeWidth={2.6} />
                  <span>تأكيد الموقع</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocationPickerPage;
