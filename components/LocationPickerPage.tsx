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
  Plus,
  Minus,
} from "lucide-react";
import { useApp } from "../contexts/AppContext";
import {
  schedulePrayerAlarms,
  guessTimezone,
  autoDetectLocation,
} from "../lib/prayer-alarms";
import { reverseGeocodeCoordinates } from "../lib/reverse-geocoding";
import { ARAB_INDEXED_PLACES } from "../lib/egypt-places";

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
  const {
    currentTheme,
    closeLocationPicker,
    prayerState,
    updatePrayerState,
    clearLocationCache,
  } = useApp();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const fallbackTileRef = useRef<L.TileLayer | null>(null);

  const initialLat = prayerState.location?.latitude ?? 30.0444;
  const initialLng = prayerState.location?.longitude ?? 31.2357;
  const initialCity =
    prayerState.location?.cityNameAr ||
    prayerState.location?.cityName ||
    "موقع محدد على الخريطة";
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
  const lockedLocationRef = useRef<{
    lat: number;
    lng: number;
    name: string;
    country: string;
  } | null>(null);
  const requestIdRef = useRef(0);

  // ── Reverse Geocoding فائقة الدقة مع الحفاظ على التحديد اليدوي ──
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setIsReverseGeocoding(true);
    const currentId = ++requestIdRef.current;

    try {
      const geocode = await reverseGeocodeCoordinates(lat, lng);
      if (currentId !== requestIdRef.current) return;

      if (geocode?.placeName) {
        setCityNameOnly(geocode.placeName);
        setCountryNameOnly(geocode.countryName || "");
      } else {
        setCityNameOnly("موقع محدد على الخريطة");
      }
    } catch {
      if (currentId === requestIdRef.current) {
        setCityNameOnly("موقع محدد على الخريطة");
      }
    } finally {
      if (currentId === requestIdRef.current) {
        setIsReverseGeocoding(false);
      }
    }
  }, []);

  // ── تحديث طبقة خرائط جوجل التفاعلية (Google Maps Arabic) ──
  const updateTileLayer = useCallback((map: L.Map, mode: MapMode) => {
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }
    if (fallbackTileRef.current) {
      map.removeLayer(fallbackTileRef.current);
      fallbackTileRef.current = null;
    }

    const tileUrl =
      mode === "streets"
        ? "https://mt{s}.google.com/vt/lyrs=m&hl=ar&x={x}&y={y}&z={z}"
        : "https://mt{s}.google.com/vt/lyrs=y&hl=ar&x={x}&y={y}&z={z}";

    const newLayer = L.tileLayer(tileUrl, {
      maxZoom: 20,
      minZoom: 3,
      subdomains: ["0", "1", "2", "3"],
      attribution: "Google Maps",
      updateWhenIdle: false,
      updateWhenZooming: false,
      keepBuffer: 6,
    });

    let failedTileCount = 0;
    newLayer.on("tileerror", () => {
      failedTileCount++;
      if (failedTileCount > 6 && !fallbackTileRef.current) {
        // بديل احتياطي فوري إذا تعذر الاتصال بخوادم جوجل في بيئة المستخدم
        const osmFallback = L.tileLayer(
          "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            maxZoom: 19,
            attribution: "OpenStreetMap",
          }
        );
        osmFallback.addTo(map);
        fallbackTileRef.current = osmFallback;
      }
    });

    newLayer.addTo(map);
    tileLayerRef.current = newLayer;
  }, []);

  // ── تهيئة خريطة Leaflet وضبط RTL والأبعاد بدقة فورية ──
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
      fadeAnimation: false,
      markerZoomAnimation: true,
    });

    updateTileLayer(map, "streets");

    // ضبط فوري للأبعاد لتفادي أي وميض أو تأخر في ظهور الخريطة
    requestAnimationFrame(() => {
      map.invalidateSize();
    });
    const t1 = setTimeout(() => map.invalidateSize(), 60);
    const t2 = setTimeout(() => map.invalidateSize(), 200);
    const t3 = setTimeout(() => map.invalidateSize(), 500);

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);

    // ── حدث تحريك الخريطة وانتهائها ──
    map.on("moveend", () => {
      // إذا كان التحرك نتيجة نقر محدد أو اختيار من البحث، نحافظ على الإحداثيات الدقيقة
      if (isProgrammaticMoveRef.current) {
        return;
      }

      const center = map.getCenter();

      // إذا كان المركز لا يزال متطابقاً مع موقع البحث المختار، لا نستبدل الاسم
      if (
        lockedLocationRef.current &&
        Math.abs(center.lat - lockedLocationRef.current.lat) < 0.0008 &&
        Math.abs(center.lng - lockedLocationRef.current.lng) < 0.0008
      ) {
        setCurrentCoords({
          lat: lockedLocationRef.current.lat,
          lng: lockedLocationRef.current.lng,
        });
        setCityNameOnly(lockedLocationRef.current.name);
        return;
      }

      // تحريك يدوي جديد عبر السحب
      lockedLocationRef.current = null;
      setCurrentCoords({ lat: center.lat, lng: center.lng });

      if (geocodeTimeoutRef.current) {
        window.clearTimeout(geocodeTimeoutRef.current);
      }
      geocodeTimeoutRef.current = window.setTimeout(() => {
        reverseGeocode(center.lat, center.lng);
      }, 350);
    });

    // ── حدث الضغط اليدوي على الخريطة لتثبيت الموقع الملموس بدقة بالغة ──
    map.on("click", (e) => {
      lockedLocationRef.current = null;
      isProgrammaticMoveRef.current = true; // منع moveend من تشويش الإحداثيات الدقيقة

      if (geocodeTimeoutRef.current) {
        window.clearTimeout(geocodeTimeoutRef.current);
        geocodeTimeoutRef.current = null;
      }

      const targetLat = e.latlng.lat;
      const targetLng = e.latlng.lng;

      // تثبيت الإحداثيات الفعلية للنقطة الملموسة المضغوطة 100%
      setCurrentCoords({ lat: targetLat, lng: targetLng });
      map.panTo([targetLat, targetLng], { animate: true, duration: 0.25 });
      reverseGeocode(targetLat, targetLng);
    });

    map.on("dragstart", () => {
      lockedLocationRef.current = null;
      isProgrammaticMoveRef.current = false;
      if (geocodeTimeoutRef.current) {
        window.clearTimeout(geocodeTimeoutRef.current);
        geocodeTimeoutRef.current = null;
      }
    });

    mapInstanceRef.current = map;
    reverseGeocode(initialLat, initialLng);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener("resize", onResize);
      resizeObserver.disconnect();
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

    if (val.length < 2) {
      setSearchResults([]);
      setShowResultsDropdown(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setShowResultsDropdown(true);

    searchTimeoutRef.current = window.setTimeout(async () => {
      try {
        const norm = (s: string) =>
          s
            .replace(/[أإآ]/g, "ا")
            .replace(/ة/g, "ه")
            .replace(/ى/g, "ي")
            .toLowerCase();
        const queryNorm = norm(val);

        const localMatches: LocationResult[] = [];
        for (const place of ARAB_INDEXED_PLACES) {
          if (
            norm(place.name).includes(queryNorm) ||
            norm(place.parent).includes(queryNorm)
          ) {
            localMatches.push({
              placeId: `local-${place.name}-${place.lat}`,
              name: place.name,
              displayName: `${place.name}، ${place.parent}`,
              lat: place.lat,
              lng: place.lng,
              country: place.country,
              cityOrVillage: place.name,
            });
            if (localMatches.length >= 6) break;
          }
        }

        const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          val
        )}&format=json&addressdetails=1&limit=5&accept-language=ar`;
        const arcgisUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&singleLine=${encodeURIComponent(
          val
        )}&maxLocations=5`;

        const [nominatimRes, arcgisRes] = await Promise.allSettled([
          fetch(nominatimUrl, { signal: AbortSignal.timeout(4000) }).then(
            (res) => res.json()
          ),
          fetch(arcgisUrl, { signal: AbortSignal.timeout(4000) }).then((res) =>
            res.json()
          ),
        ]);

        const remoteMatches: LocationResult[] = [];

        if (
          nominatimRes.status === "fulfilled" &&
          Array.isArray(nominatimRes.value)
        ) {
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

        setSearchResults(combined.slice(0, 8));
      } catch (err) {
        console.warn("Live search API error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 400);
  };

  // ── اختيار وتثبيت نتيجة من نتائج البحث بدقة متناهية ودون قفزات ──
  const handleSelectSearchResult = (result: LocationResult) => {
    setShowResultsDropdown(false);
    setSearchQuery("");

    const chosenName = result.cityOrVillage || result.name;
    setCityNameOnly(chosenName);
    setCountryNameOnly(result.country);
    setCurrentCoords({ lat: result.lat, lng: result.lng });

    // قفل الموقع المختار برمجياً لمنع استبداله عبر reverseGeocode
    lockedLocationRef.current = {
      lat: result.lat,
      lng: result.lng,
      name: chosenName,
      country: result.country,
    };
    isProgrammaticMoveRef.current = true;

    if (geocodeTimeoutRef.current) {
      window.clearTimeout(geocodeTimeoutRef.current);
      geocodeTimeoutRef.current = null;
    }

    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([result.lat, result.lng], 16, {
        animate: true,
      });
    }
  };

  // ── إعادة التمركز إلى موقع الجهاز عبر GPS ──
  const handleRecenterToDeviceGPS = async () => {
    try {
      clearLocationCache();
      const loc = await autoDetectLocation();
      lockedLocationRef.current = null;
      isProgrammaticMoveRef.current = true;
      setCurrentCoords({ lat: loc.latitude, lng: loc.longitude });
      if (loc.cityNameAr) setCityNameOnly(loc.cityNameAr);
      if (loc.countryNameAr) setCountryNameOnly(loc.countryNameAr);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([loc.latitude, loc.longitude], 16, {
          animate: true,
        });
      }
    } catch {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.panTo([currentCoords.lat, currentCoords.lng], {
          animate: true,
          duration: 0.3,
        });
      }
    }
  };

  // ── تأكيد وحفظ الموقع المعتمد ──
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
        source: "manual_map" as const,
        capturedAt: Date.now(),
        accuracyMeters: null,
      };

      updatePrayerState({ location: finalLocation });

      await schedulePrayerAlarms(finalLocation, prayerState.method);

      setTimeout(() => {
        setIsSaving(false);
        closeLocationPicker();
      }, 250);
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
      {/* ── حاوية الخريطة (Leaflet بتقنية LTR لعرض وبكسلة دقيقة 100%) ── */}
      <div className="absolute inset-0 w-full h-full z-0 overflow-hidden">
        <div
          ref={mapContainerRef}
          dir="ltr"
          className="w-full h-full"
          style={{
            direction: "ltr",
            textAlign: "left",
            backgroundColor: currentTheme.isDark ? "#121A1B" : "#F4F1EA",
          }}
        />

        {/* ── الدبوس المركزي الدقيق (Tip مثبت على 50% 50% تماماً دون إزاحة) ── */}
        <div
          className="absolute top-1/2 left-1/2 pointer-events-none z-[300]"
          style={{ transform: "translate(0, 0)" }}
        >
          {/* حاوية الدبوس والكبسولة المنبثقة فوقه */}
          <div className="relative -translate-x-1/2 -translate-y-full flex flex-col items-center pointer-events-auto">
            {/* كبسولة تأكيد الموقع العلوية - كبسولة دائرية مدمجة وسلسة */}
            <div
              onClick={handleConfirmLocation}
              className="mb-1.5 px-3.5 py-1 rounded-full border shadow-xl text-xs font-zain-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-transform duration-150 hover:scale-105 active:scale-95"
              style={{
                borderRadius: "9999px",
                backgroundColor: currentTheme.text,
                color: currentTheme.bg,
                borderColor: currentTheme.border,
                boxShadow: `0 8px 24px ${currentTheme.shadow || "rgba(0,0,0,0.18)"}`,
              }}
              title="تأكيد اختيار هذا الموقع"
            >
              <Check
                className="w-3.5 h-3.5 shrink-0"
                strokeWidth={3}
                style={{ color: currentTheme.accent }}
              />
              <span className="truncate max-w-[170px]">{cityNameOnly}</span>
            </div>

            {/* أيقونة الدبوس المتجهة لمركز الخريطة بالضبط */}
            <div className="relative" style={{ width: 36, height: 46 }}>
              <svg width="36" height="46" viewBox="0 0 36 46" fill="none">
                <path
                  d="M18 0C8.05887 0 0 8.05887 0 18C0 29.5 18 46 18 46C18 46 36 29.5 36 18C36 8.05887 27.9411 0 18 0Z"
                  fill={currentTheme.accent}
                />
                <circle cx="18" cy="18" r="6.5" fill="#FFFFFF" />
              </svg>
            </div>
          </div>

          {/* نقطة الارتكاز المجهرية عند النقطة المحددة بالضبط */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full border border-black/40 shadow-xs pointer-events-none"
            style={{ backgroundColor: currentTheme.accent }}
          />
        </div>
      </div>

      {/* ── الشريط العلوي العائم (زر الرجوع + محول الخريطة + زر GPS) ── */}
      <div
        className="absolute left-4 right-4 pointer-events-auto flex items-center justify-between"
        style={{
          top: "20px",
          marginTop: "env(safe-area-inset-top, 0px)",
          zIndex: 999999,
        }}
      >
        {/* زر الخروج - كبسولة دائرية كاملة */}
        <button
          type="button"
          onClick={closeLocationPicker}
          className="h-10 w-10 rounded-full backdrop-blur-2xl border flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 shadow-md cursor-pointer shrink-0"
          style={{
            borderRadius: "9999px",
            backgroundColor: currentTheme.glass,
            borderColor: currentTheme.border,
            boxShadow: `0 8px 24px -4px ${currentTheme.shadow}`,
            color: currentTheme.text,
          }}
          title="خروج"
          aria-label="خروج"
        >
          <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
        </button>

        {/* كبسولة التبديل بين الخريطة والقمر الصناعي - كبسولة دائرية كاملة */}
        <div
          className="flex items-center p-1 rounded-full border shadow-md backdrop-blur-2xl transition-all"
          style={{
            borderRadius: "9999px",
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
              borderRadius: "9999px",
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
              mapMode === "satellite"
                ? "shadow-xs"
                : "opacity-60 hover:opacity-100"
            }`}
            style={{
              borderRadius: "9999px",
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

        {/* زر التمركز لموقع GPS الحقيقي - كبسولة دائرية كاملة */}
        <button
          type="button"
          onClick={handleRecenterToDeviceGPS}
          className="w-10 h-10 border flex items-center justify-center backdrop-blur-2xl transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer rounded-full shadow-md shrink-0"
          style={{
            borderRadius: "9999px",
            backgroundColor: currentTheme.glass,
            borderColor: currentTheme.border,
            boxShadow: `0 8px 24px -4px ${currentTheme.shadow}`,
            color: currentTheme.accent,
          }}
          title="موقعي الحالي عبر GPS"
          aria-label="موقعي الحالي عبر GPS"
        >
          <Crosshair className="w-4 h-4" strokeWidth={2.2} />
        </button>
      </div>

      {/* ── أدوات التقريب والتبعيد على جانب الخريطة ── */}
      <div
        className="absolute right-4 pointer-events-auto flex flex-col gap-2"
        style={{
          top: "calc(76px + env(safe-area-inset-top, 0px))",
          zIndex: 999998,
        }}
      >
        <button
          type="button"
          onClick={handleZoomIn}
          className="w-9 h-9 rounded-full border shadow-md flex items-center justify-center backdrop-blur-2xl transition-all hover:scale-105 active:scale-95 cursor-pointer"
          style={{
            borderRadius: "9999px",
            backgroundColor: currentTheme.glass,
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
          className="w-9 h-9 rounded-full border shadow-md flex items-center justify-center backdrop-blur-2xl transition-all hover:scale-105 active:scale-95 cursor-pointer"
          style={{
            borderRadius: "9999px",
            backgroundColor: currentTheme.glass,
            borderColor: currentTheme.border,
            color: currentTheme.text,
          }}
          title="تصغير"
          aria-label="تصغير"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>

      {/* ── بطاقة تحديد الموقع السفلية الفاخرة المطابقة تماماً للأصل (Screenshot_20260914_124258.jpg) ── */}
      <div className="fixed bottom-0 left-0 right-0 z-[400] pointer-events-auto flex flex-col items-center">
        <div
          className="w-full max-w-lg shadow-2xl px-5 pt-3 transition-all select-none flex flex-col"
          style={{
            borderTopLeftRadius: "32px",
            borderTopRightRadius: "32px",
            borderBottomLeftRadius: "0px",
            borderBottomRightRadius: "0px",
            backgroundColor: currentTheme.glass,
            borderTop: `1px solid ${currentTheme.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
            boxShadow: "0 -16px 40px rgba(0, 0, 0, 0.35)",
            paddingBottom: "max(env(safe-area-inset-bottom), 20px)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          {/* مقبض السحب العلوي الأنيق */}
          <div className="flex justify-center mb-3 shrink-0">
            <div
              className="w-12 h-1 rounded-full opacity-40"
              style={{
                backgroundColor: currentTheme.isDark ? "#E5DEC9" : "#6E685F",
              }}
            />
          </div>

          {/* العنوان الرئيسي للبطاقة */}
          <div className="text-center mb-3.5 shrink-0">
            <h2
              className="text-lg sm:text-xl font-zain-bold tracking-normal"
              style={{ color: currentTheme.text }}
            >
              تحديد موقع الصلاة
            </h2>
          </div>

          {/* محتوى حقل البحث وقائمة النتائج */}
          <div className="flex flex-col mb-3.5 shrink-0 relative">
            <div
              className="h-11 px-4 border transition-all rounded-full flex items-center gap-2.5 shrink-0"
              style={{
                borderRadius: "9999px",
                backgroundColor: currentTheme.isDark
                  ? "rgba(255, 255, 255, 0.04)"
                  : "rgba(0, 0, 0, 0.03)",
                borderColor: currentTheme.isDark
                  ? "rgba(255, 255, 255, 0.12)"
                  : "rgba(0, 0, 0, 0.12)",
              }}
            >
              <Search
                className="w-4 h-4 shrink-0 opacity-40"
                style={{ color: currentTheme.text }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="ابحث: طنطا، المحلة، المنصورة، المعادي..."
                className="w-full bg-transparent outline-none font-zain-reg text-sm placeholder:opacity-40 leading-normal"
                style={{ color: currentTheme.text }}
              />
              {isSearching && (
                <Loader2
                  className="w-4 h-4 animate-spin shrink-0 opacity-60"
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
                  className="w-5 h-5 rounded-full flex items-center justify-center opacity-50 hover:opacity-100 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* قائمة نتائج البحث الحية */}
            {showResultsDropdown && searchResults.length > 0 && (
              <div
                className="absolute top-full left-0 right-0 mt-1.5 z-50 flex flex-col gap-1 max-h-44 overflow-y-auto no-scrollbar p-1.5 rounded-2xl border shadow-xl backdrop-blur-xl"
                style={{
                  backgroundColor: currentTheme.glass,
                  borderColor: currentTheme.border,
                }}
              >
                {searchResults.map((item) => (
                  <button
                    key={item.placeId}
                    type="button"
                    onClick={() => handleSelectSearchResult(item)}
                    className="w-full h-10 px-3.5 rounded-full border flex items-center justify-between gap-2 transition-all cursor-pointer active:scale-[0.98] shadow-xs group"
                    style={{
                      borderRadius: "9999px",
                      backgroundColor: currentTheme.isDark
                        ? "rgba(255,255,255,0.06)"
                        : "rgba(0,0,0,0.03)",
                      borderColor: currentTheme.border,
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin
                        className="w-3.5 h-3.5 shrink-0"
                        style={{ color: currentTheme.accent }}
                      />
                      <span
                        className="font-zain-bold text-xs sm:text-sm truncate"
                        style={{ color: currentTheme.text }}
                      >
                        {item.cityOrVillage}
                      </span>
                    </div>

                    <span
                      className="text-[11px] font-zain-reg opacity-60 shrink-0 truncate max-w-[140px]"
                      style={{ color: currentTheme.secondary }}
                    >
                      {item.displayName.split("،")[1] || item.country}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* كبسولة عرض الموقع المحدد كبسولة متناسقة ومريحة */}
          <div className="flex items-center justify-center text-center my-2.5 shrink-0">
            {isReverseGeocoding ? (
              <div
                className="h-9 px-4 rounded-full border flex items-center gap-2 text-xs font-zain-reg shadow-xs"
                style={{
                  borderRadius: "9999px",
                  backgroundColor: currentTheme.isDark
                    ? "rgba(197, 160, 89, 0.15)"
                    : "rgba(197, 160, 89, 0.18)",
                  borderColor: currentTheme.isDark
                    ? "rgba(197, 160, 89, 0.3)"
                    : "rgba(197, 160, 89, 0.38)",
                  color: currentTheme.accent,
                }}
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                <span>جارٍ استطلاع بيانات المكان...</span>
              </div>
            ) : (
              <div
                className="h-9 px-4 rounded-full border text-xs sm:text-sm font-zain-bold shadow-xs flex items-center justify-center gap-2"
                style={{
                  borderRadius: "9999px",
                  backgroundColor: currentTheme.isDark
                    ? "rgba(197, 160, 89, 0.15)"
                    : "rgba(197, 160, 89, 0.18)",
                  borderColor: currentTheme.isDark
                    ? "rgba(197, 160, 89, 0.3)"
                    : "rgba(197, 160, 89, 0.38)",
                  color: currentTheme.accent,
                }}
              >
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate max-w-[230px]">{cityNameOnly}</span>
              </div>
            )}
          </div>

          {/* زر التأكيد: قصير ومدمج العرض في المنتصف ونازل لأسفل بمسافة مريحة بدون تلاصق */}
          <div className="flex justify-center w-full shrink-0 mt-4 mb-1">
            <button
              type="button"
              onClick={handleConfirmLocation}
              disabled={isSaving || isReverseGeocoding}
              className="w-auto min-w-[170px] max-w-[210px] h-10 px-5 font-zain-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer active:scale-[0.98] rounded-full shadow-md"
              style={{
                borderRadius: "9999px",
                backgroundColor: currentTheme.isDark ? "#EDE8D8" : "#222D2F",
                color: currentTheme.isDark ? "#121A1B" : "#FFFFFF",
                boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
                opacity: isSaving ? 0.7 : 1,
              }}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جارٍ الحفظ...</span>
                </>
              ) : (
                <>
                  <span>تأكيد الموقع</span>
                  <Check className="w-4 h-4" strokeWidth={2.5} />
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

