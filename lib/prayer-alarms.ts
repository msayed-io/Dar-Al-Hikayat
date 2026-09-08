/**
 * جدولة منبهات الأذان — مطابقة لمنطق النسخة الإنتاجية (DST-aware)
 * تعمل عبر إضافة PrayerAlarm الأصلية على أندرويد، وتتخطى الويب بأمان.
 */
import { Capacitor, registerPlugin } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import type { PrayerLocation, PrayerId, CalculationMethodId } from "./prayer-config";
import {
  PRAYER_DEFINITIONS,
  PRE_ALARM_PRAYERS,
  PRE_ALARM_MINUTES,
  type PrayerState,
} from "./prayer-config";
import { getTodayAndTomorrow } from "./prayer-times";
import { CITIES, type CityData } from "./prayer-cities";

interface PrayerAlarmPlugin {
  requestNotificationPermission(): Promise<{ granted: boolean }>;
  scheduleAlarms(options: { alarms: AlarmEntry[] }): Promise<void>;
  cancelAllAlarms(): Promise<void>;
}

interface SystemTimePlugin {
  getTimeInfo(): Promise<{
    timezoneId: string;
    timezoneOffset: number;
    dst: boolean;
  }>;
}

interface AlarmEntry {
  timestamp: number;
  id: number;
  title: string;
  body: string;
  prayerId: string;
  type: "exact" | "pre" | "reschedule";
}

const PrayerAlarm = Capacitor.isPluginAvailable("PrayerAlarm")
  ? registerPlugin<PrayerAlarmPlugin>("PrayerAlarm")
  : (undefined as unknown as PrayerAlarmPlugin | undefined);

const SystemTime = Capacitor.isPluginAvailable("SystemTime")
  ? registerPlugin<SystemTimePlugin>("SystemTime")
  : (undefined as unknown as SystemTimePlugin | undefined);

const PRAYER_SETTINGS_KEY = "dar_prayer_settings";
const SCHEDULED_ALARMS_KEY = "dar_scheduled_alarms_data";

let nativeTimezoneId: string | null = null;
let nativeTimezoneOffset: number | null = null;

/** تحميل معلومات المنطقة الزمنية الأصلية (على أندرويد فقط) */
export async function ensureNativeTime(): Promise<void> {
  if (Capacitor.getPlatform() !== "android" || !SystemTime) return;
  try {
    const info = await SystemTime.getTimeInfo();
    nativeTimezoneOffset = info.timezoneOffset;
    nativeTimezoneId = info.timezoneId;
    console.log(
      `Native timezone: ${info.timezoneId}, offset: ${info.timezoneOffset}, DST: ${info.dst}`
    );
  } catch (e) {
    console.warn("Failed to load native timezone offset:", e);
  }
}

function currentTimezoneId(): string {
  return nativeTimezoneId || "Africa/Cairo";
}

/** توليد معرف فريد لكل منبه (كما في الإنتاج) */
function alarmId(prayerId: string, type: "exact" | "pre", isTomorrow: boolean): number {
  const base: Record<string, number> = {
    fajr: 1000,
    sunrise: 2000,
    duha: 3000,
    dhuhr: 4000,
    asr: 5000,
    maghrib: 6000,
    isha: 7000,
  };
  const pre = type === "pre" ? 100 : 0;
  const tomorrow = isTomorrow ? 500 : 0;
  return (base[prayerId] || 0) + pre + tomorrow;
}

function alarmTitle(prayerId: string, type: "exact" | "pre"): string {
  const def = PRAYER_DEFINITIONS[prayerId as PrayerId];
  if (!def) return "تذكير";
  return type === "pre"
    ? `اقترب وقت صلاة ${def.nameAr}`
    : `حان الآن وقت صلاة ${def.nameAr}`;
}

function alarmBody(prayerId: string, type: "exact" | "pre"): string {
  const def = PRAYER_DEFINITIONS[prayerId as PrayerId];
  if (!def) return "";
  return type === "pre" && def.preText ? def.preText : def.exactText;
}

/** طلب صلاحية الإشعارات */
async function requestNotificationPermission(): Promise<boolean> {
  if (Capacitor.getPlatform() !== "android" || !PrayerAlarm) return true;
  try {
    const { granted } = await PrayerAlarm.requestNotificationPermission();
    return granted;
  } catch (e) {
    console.error("Notification permission error:", e);
    return false;
  }
}

/**
 * جدولة كل منبهات اليوم والغد (نفس خوارزمية الإنتاج):
 * - منبه دقيق لكل صلاة قادمة اليوم + غدًا
 * - منبه مسبق (10 دقائق) للصلوات الخمس
 * - منبه إعادة جدولة بعد الفجر بـ 30 دقيقة (id: 99999)
 */
export async function schedulePrayerAlarms(
  location: PrayerLocation,
  method: CalculationMethodId
): Promise<boolean> {
  if (Capacitor.getPlatform() !== "android" || !PrayerAlarm) {
    console.log("Prayer notifications: not on Android, skipping");
    return true;
  }
  try {
    await ensureNativeTime();
    if (!(await requestNotificationPermission())) {
      console.warn("Notification permission not granted");
    }
    await PrayerAlarm.cancelAllAlarms();

    const tz = currentTimezoneId() || location.timezoneId;
    const { today, tomorrow } = getTodayAndTomorrow(
      location.latitude,
      location.longitude,
      method,
      tz
    );

    const alarms: AlarmEntry[] = [];
    const now = Date.now();

    for (const day of [today, tomorrow]) {
      const isTomorrow = day === tomorrow;
      for (const prayer of day.prayers) {
        const ts = prayer.time.getTime();
        if (ts > now) {
          alarms.push({
            timestamp: ts,
            id: alarmId(prayer.prayerId, "exact", isTomorrow),
            title: alarmTitle(prayer.prayerId, "exact"),
            body: alarmBody(prayer.prayerId, "exact"),
            prayerId: prayer.prayerId,
            type: "exact",
          });
        }
        if (PRE_ALARM_PRAYERS.includes(prayer.prayerId)) {
          const preTs = ts - PRE_ALARM_MINUTES * 60 * 1000;
          if (preTs > now) {
            alarms.push({
              timestamp: preTs,
              id: alarmId(prayer.prayerId, "pre", isTomorrow),
              title: alarmTitle(prayer.prayerId, "pre"),
              body: alarmBody(prayer.prayerId, "pre"),
              prayerId: prayer.prayerId,
              type: "pre",
            });
          }
        }
      }
    }

    // منبه إعادة الجدولة: 30 دقيقة بعد فجر الغد
    const tomorrowFajr = tomorrow.prayers.find((p) => p.prayerId === "fajr");
    if (tomorrowFajr) {
      const rescheduleTs = tomorrowFajr.time.getTime() + 30 * 60 * 1000;
      if (rescheduleTs > now) {
        alarms.push({
          timestamp: rescheduleTs,
          id: 99999,
          title: "reschedule",
          body: "reschedule",
          prayerId: "reschedule",
          type: "reschedule",
        });
      }
    }

    if (alarms.length > 0) {
      await PrayerAlarm.scheduleAlarms({ alarms });
    }

    saveScheduledAlarmsData({
      location,
      method,
      todayPrayerMinutes: today.prayers.map((p) => ({
        prayerId: p.prayerId,
        minutesFromMidnight: p.minutesFromMidnight,
      })),
      tomorrowPrayerMinutes: tomorrow.prayers.map((p) => ({
        prayerId: p.prayerId,
        minutesFromMidnight: p.minutesFromMidnight,
      })),
      todayDate: today.date,
      tomorrowDate: tomorrow.date,
      timezoneId: tz,
    });

    const settings = loadPrayerSettings();
    settings.isInitialized = true;
    settings.lastScheduleDate = new Date().toISOString();
    savePrayerSettings(settings);

    console.log(`Prayer notifications scheduled: ${alarms.length} alarms (DST-aware)`);
    return true;
  } catch (e) {
    console.error("Failed to schedule prayer notifications:", e);
    return false;
  }
}

/** إشعار تجريبي بعد 5 ثوانٍ (كما في الإنتاج) */
export async function testPrayerNotification(): Promise<boolean> {
  if (Capacitor.getPlatform() !== "android" || !PrayerAlarm) {
    console.log("Test notification: not on Android");
    return false;
  }
  try {
    await ensureNativeTime();
    if (!(await requestNotificationPermission())) return false;
    await PrayerAlarm.scheduleAlarms({
      alarms: [
        {
          timestamp: Date.now() + 5000,
          id: 88888,
          title: "حان الآن وقت صلاة الظهر",
          body: "إنَّ هَذَا وقتٌ تُفْتَحُ فِيهِ أَبْوَابُ السَّمَاءِ.",
          prayerId: "dhuhr",
          type: "exact",
        },
      ],
    });
    console.log("Test prayer notification scheduled in 5 seconds");
    return true;
  } catch (e) {
    console.error("Failed to test prayer notification:", e);
    return false;
  }
}

/** الكشف التلقائي عن الموقع بدقة متناهية مع دعم البدائل الذكية (GPS -> IP -> Timezone) لمنع أي أخطاء */
export async function autoDetectLocation(): Promise<PrayerLocation> {
  let lat: number | null = null;
  let lng: number | null = null;
  let resolvedName = "موقعي الحالي";
  let resolvedCountry = "مصر";

  // 1. المحاولة أولاً عبر Capacitor Geolocation إن وُجد (تطبيقات أندرويد وiOS)
  if (Capacitor.isPluginAvailable("Geolocation")) {
    try {
      const perm = await Geolocation.checkPermissions();
      if (perm.location !== "granted") {
        await Geolocation.requestPermissions();
      }
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 6000,
      });
      if (pos && pos.coords) {
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      }
    } catch (e) {
      console.warn("Capacitor Geolocation unavailable, trying browser navigator...", e);
    }
  }

  // 2. المحاولة عبر navigator.geolocation القياسي (متصفحات الجوال والويب)
  if (lat === null && typeof navigator !== "undefined" && "geolocation" in navigator) {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 6000,
          maximumAge: 10000,
        });
      });
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch (e) {
      console.warn("High-accuracy browser GPS timed out or denied, trying standard accuracy...", e);
      try {
        const fallbackPos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 4000,
            maximumAge: 60000,
          });
        });
        lat = fallbackPos.coords.latitude;
        lng = fallbackPos.coords.longitude;
      } catch (err2) {
        console.warn("Browser GPS permission not granted or unavailable, switching to network IP / timezone fallback:", err2);
      }
    }
  }

  // 3. المحاولة عبر IP Geolocation إذا كان مستشعر GPS محظوراً بالمتصفح أو في بيئة iframe
  if (lat === null || lng === null) {
    try {
      const ipRes = await fetch("https://ipwho.is/?lang=ar", {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(4000),
      });
      if (ipRes.ok) {
        const ipData = await ipRes.json();
        if (ipData && ipData.success !== false && ipData.latitude && ipData.longitude) {
          lat = ipData.latitude;
          lng = ipData.longitude;
          if (ipData.city) resolvedName = ipData.city;
          if (ipData.country) resolvedCountry = ipData.country;
        }
      }
    } catch (ipErr) {
      console.warn("IP Geolocation fallback note:", ipErr);
    }
  }

  // 4. المحاولة عبر المنطقة الزمنية للنظام (Intl Timezone Mapping) كضمان نهائي
  if (lat === null || lng === null) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Cairo";
    const tzMap: Record<string, { lat: number; lng: number; city: string; country: string }> = {
      "Africa/Cairo": { lat: 30.0444, lng: 31.2357, city: "القاهرة", country: "مصر" },
      "Africa/Alexandria": { lat: 31.2001, lng: 29.9187, city: "الإسكندرية", country: "مصر" },
      "Asia/Riyadh": { lat: 24.7136, lng: 46.6753, city: "الرياض", country: "السعودية" },
      "Asia/Dubai": { lat: 25.2048, lng: 55.2708, city: "دبي", country: "الإمارات" },
      "Asia/Kuwait": { lat: 29.3759, lng: 47.9774, city: "الكويت", country: "الكويت" },
      "Asia/Qatar": { lat: 25.2854, lng: 51.531, city: "الدوحة", country: "قطر" },
      "Asia/Bahrain": { lat: 26.2285, lng: 50.586, city: "المنامة", country: "البحرين" },
      "Asia/Muscat": { lat: 23.588, lng: 58.3829, city: "مسقط", country: "عمان" },
      "Asia/Amman": { lat: 31.9454, lng: 35.9284, city: "عمان", country: "الأردن" },
      "Asia/Jerusalem": { lat: 31.7683, lng: 35.2137, city: "القدس", country: "فلسطين" },
      "Asia/Gaza": { lat: 31.5, lng: 34.4667, city: "غزة", country: "فلسطين" },
      "Asia/Baghdad": { lat: 33.3152, lng: 44.3661, city: "بغداد", country: "العراق" },
      "Asia/Damascus": { lat: 33.5138, lng: 36.2765, city: "دمشق", country: "سوريا" },
      "Asia/Beirut": { lat: 33.8938, lng: 35.5018, city: "بيروت", country: "لبنان" },
      "Africa/Tripoli": { lat: 32.8872, lng: 13.1913, city: "طرابلس", country: "ليبيا" },
      "Africa/Tunis": { lat: 36.8065, lng: 10.1815, city: "تونس", country: "تونس" },
      "Africa/Algiers": { lat: 36.7538, lng: 3.0588, city: "الجزائر", country: "الجزائر" },
      "Africa/Casablanca": { lat: 33.5731, lng: -7.5898, city: "الدار البيضاء", country: "المغرب" },
      "Africa/Khartoum": { lat: 15.5007, lng: 32.5599, city: "الخرطوم", country: "السودان" },
      "Asia/Aden": { lat: 12.7855, lng: 45.0187, city: "عدن", country: "اليمن" },
    };

    const match = tzMap[tz] || tzMap["Africa/Cairo"];
    lat = match.lat;
    lng = match.lng;
    resolvedName = match.city;
    resolvedCountry = match.country;
  }

  // 5. قراءة اسم المكان الحقيقي بدقة متناهية (قرية / عزبة / مركز / مدينة) باللغة العربية
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&accept-language=ar&addressdetails=1`,
      {
        headers: { "Accept-Language": "ar" },
        signal: AbortSignal.timeout(4000),
      }
    );
    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const primaryLocality =
        addr.village ||
        addr.hamlet ||
        addr.suburb ||
        addr.town ||
        addr.neighbourhood ||
        addr.city ||
        addr.district ||
        addr.county ||
        addr.road ||
        data.name ||
        (data.display_name ? data.display_name.split(",")[0].trim() : null);

      if (primaryLocality) {
        resolvedName = primaryLocality;
      }
      if (addr.country) {
        resolvedCountry = addr.country;
      }
    }
  } catch (err) {
    console.warn("Reverse geocode in autoDetect note:", err);
    const nearest = findNearestCity(lat, lng);
    if (nearest) {
      resolvedName = nearest.nameAr;
      resolvedCountry = nearest.countryAr;
    }
  }

  const timezone = guessTimezone(lat, lng);

  return {
    latitude: lat,
    longitude: lng,
    cityName: resolvedName,
    cityNameAr: resolvedName,
    countryNameAr: resolvedCountry,
    timezoneId: timezone,
    isAutoDetected: true,
  };
}

/** أقرب مدينة من قاعدة البيانات */
export function findNearestCity(lat: number, lng: number): CityData | null {
  let best: CityData | null = null;
  let bestDist = Infinity;
  for (const city of CITIES) {
    const d = Math.hypot(city.latitude - lat, city.longitude - lng);
    if (d < bestDist) {
      bestDist = d;
      best = city;
    }
  }
  return best;
}

/** تخمين المنطقة الزمنية من الإحداثيات (خريطة الإنتاج الحرفية) */
export function guessTimezone(lat: number, lng: number): string {
  return (
    (lat >= 22 && lat <= 32 && lng >= 24 && lng <= 37) ? "Africa/Cairo" :
    (lat >= 16 && lat <= 32 && lng >= 35 && lng <= 55) ? "Asia/Riyadh" :
    (lat >= 22 && lat <= 27 && lng >= 51 && lng <= 57) ? "Asia/Dubai" :
    (lat >= 28 && lat <= 31 && lng >= 46 && lng <= 49) ? "Asia/Kuwait" :
    (lat >= 24 && lat <= 27 && lng >= 50 && lng <= 52) ? "Asia/Qatar" :
    (lat >= 25 && lat <= 27 && lng >= 50 && lng <= 51) ? "Asia/Bahrain" :
    (lat >= 16 && lat <= 26 && lng >= 51 && lng <= 60) ? "Asia/Muscat" :
    (lat >= 29 && lat <= 34 && lng >= 34 && lng <= 40) ? "Asia/Amman" :
    (lat >= 31 && lat <= 33 && lng >= 34 && lng <= 36) ? "Asia/Hebron" :
    (lat >= 33 && lat <= 35 && lng >= 35 && lng <= 37) ? "Asia/Beirut" :
    (lat >= 32 && lat <= 37 && lng >= 35 && lng <= 42) ? "Asia/Damascus" :
    (lat >= 29 && lat <= 38 && lng >= 38 && lng <= 49) ? "Asia/Baghdad" :
    (lat >= 27 && lat <= 36 && lng >= -13 && lng <= -1) ? "Africa/Casablanca" :
    (lat >= 30 && lat <= 38 && lng >= 8 && lng <= 12) ? "Africa/Tunis" :
    (lat >= 19 && lat <= 37 && lng >= -2 && lng <= 9) ? "Africa/Algiers" :
    (lat >= 19 && lat <= 33 && lng >= 9 && lng <= 25) ? "Africa/Tripoli" :
    (lat >= 3 && lat <= 23 && lng >= 21 && lng <= 39) ? "Africa/Khartoum" :
    (lat >= 36 && lat <= 42 && lng >= 26 && lng <= 45) ? "Europe/Istanbul" :
    (lat >= 23 && lat <= 37 && lng >= 60 && lng <= 78) ? "Asia/Karachi" :
    (lat >= -11 && lat <= 6 && lng >= 95 && lng <= 141) ? "Asia/Jakarta" :
    (lat >= 1 && lat <= 7 && lng >= 99 && lng <= 119) ? "Asia/Kuala_Lumpur" :
    (lat >= 49 && lat <= 61 && lng >= -8 && lng <= 2) ? "Europe/London" :
    (lat >= 42 && lat <= 51 && lng >= -5 && lng <= 8) ? "Europe/Paris" :
    (lat >= 25 && lat <= 49 && lng >= -125 && lng <= -66) ? "America/New_York" :
    "Africa/Cairo"
  );
}

/* ─────────────── التخزين ─────────────── */

interface StoredPrayerSettings {
  method: CalculationMethodId;
  isInitialized: boolean;
  lastScheduleDate?: string;
}

export function loadPrayerSettings(): StoredPrayerSettings {
  try {
    const raw = localStorage.getItem(PRAYER_SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to load prayer settings:", e);
  }
  return { method: "egyptian", isInitialized: false, lastScheduleDate: "" };
}

export function savePrayerSettings(s: StoredPrayerSettings): void {
  try {
    localStorage.setItem(PRAYER_SETTINGS_KEY, JSON.stringify(s));
  } catch (e) {
    console.error("Failed to save prayer settings:", e);
  }
}

function saveScheduledAlarmsData(data: unknown): void {
  try {
    localStorage.setItem(SCHEDULED_ALARMS_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save alarm data:", e);
  }
}

/** تحويل مدينة من قاعدة البيانات إلى موقع صلاة */
export function cityToLocation(city: CityData): PrayerLocation {
  return {
    latitude: city.latitude,
    longitude: city.longitude,
    cityName: city.nameAr,
    timezoneId: city.timezoneId,
    isAutoDetected: false,
  };
}
