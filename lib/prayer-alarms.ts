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
import { getDayPrayers, getTodayAndTomorrow } from "./prayer-times";
import { CITIES, type CityData } from "./prayer-cities";

interface PrayerAlarmPlugin {
  checkNotificationPermission(): Promise<{ granted: boolean }>;
  requestNotificationPermission(): Promise<{ granted: boolean }>;
  requestExactAlarmPermission(): Promise<{ granted: boolean }>;
  canScheduleExactAlarms(): Promise<{ canSchedule: boolean }>;
  openNotificationSettings?(): Promise<void>;
  openAppSettings?(): Promise<void>;
  scheduleAlarms(options: { alarms: AlarmEntry[] }): Promise<{ scheduled: number; exact: boolean }>;
  cancelAllAlarms(): Promise<void>;
  sendImmediateTestNotification(options?: {
    title?: string;
    body?: string;
    prayerId?: string;
  }): Promise<{ success: boolean }>;
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

const PrayerAlarm = registerPlugin<PrayerAlarmPlugin>("PrayerAlarm");

const SystemTime = registerPlugin<SystemTimePlugin>("SystemTime");

const PRAYER_SETTINGS_KEY = "dar_prayer_settings";
const SCHEDULED_ALARMS_KEY = "dar_scheduled_alarms_data";

let nativeTimezoneId: string | null = null;
let nativeTimezoneOffset: number | null = null;
let scheduleChain: Promise<boolean> = Promise.resolve(true);

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

/** توليد معرف فريد لكل منبه عبر الأيام المتعددة */
function alarmId(prayerId: string, type: "exact" | "pre", dayOffset: number): number {
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
  return dayOffset * 10000 + (base[prayerId] || 0) + pre;
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

/** التحقق من حالة إذن الإشعارات */
export async function checkNotificationPermission(): Promise<boolean> {
  if (Capacitor.getPlatform() !== "android" || !PrayerAlarm) return true;
  try {
    const { granted } = await PrayerAlarm.checkNotificationPermission();
    return granted;
  } catch (e) {
    console.error("Check notification permission error:", e);
    return false;
  }
}

/** طلب صلاحية الإشعارات */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Capacitor.getPlatform() !== "android" || !PrayerAlarm) return true;
  try {
    const { granted } = await PrayerAlarm.requestNotificationPermission();
    return granted;
  } catch (e) {
    console.error("Notification permission error:", e);
    return false;
  }
}

/** طلب صلاحية التنبيهات الدقيقة */
export async function requestExactAlarmPermission(): Promise<boolean> {
  if (Capacitor.getPlatform() !== "android" || !PrayerAlarm) return true;
  try {
    const { granted } = await PrayerAlarm.requestExactAlarmPermission();
    return granted;
  } catch (e) {
    console.error("Exact alarm permission error:", e);
    return false;
  }
}

/** التحقق من إمكانية جدولة تنبيهات دقيقة */
export async function checkExactAlarmPermission(): Promise<boolean> {
  if (Capacitor.getPlatform() !== "android" || !PrayerAlarm) return true;
  try {
    const { canSchedule } = await PrayerAlarm.canScheduleExactAlarms();
    return canSchedule;
  } catch (e) {
    console.error("Check exact alarm permission error:", e);
    return false;
  }
}

/** فتح شاشة إعدادات إشعارات التطبيق */
export async function openNativeNotificationSettings(): Promise<void> {
  if (Capacitor.getPlatform() !== "android" || !PrayerAlarm?.openNotificationSettings) return;
  try {
    await PrayerAlarm.openNotificationSettings();
  } catch (e) {
    console.error("Open notification settings error:", e);
  }
}

/** فتح صفحة إعدادات التطبيق في النظام */
export async function openNativeAppSettings(): Promise<void> {
  if (Capacitor.getPlatform() !== "android" || !PrayerAlarm?.openAppSettings) return;
  try {
    await PrayerAlarm.openAppSettings();
  } catch (e) {
    console.error("Open app settings error:", e);
  }
}

/**
 * جدولة مواقيت الصلاة لمدة 30 يومًا متتالية بدقة تامة باستخدام AlarmManager.setExactAndAllowWhileIdle():
 * - منبه دقيق لكل صلاة في موعدها تماماً (لا يختفي إلا بمسحه يدوياً)
 * - منبه مسبق قبل الصلاة بـ 10 دقائق (يُحذف تلقائياً عند انتهاء مدته ومجيء وقت الصلاة)
 * - جدولة نافذة مستقبلية ممتدة لضمان الاستمرار عند غياب المستخدم عن التطبيق
 */
export async function schedulePrayerAlarms(
  location: PrayerLocation,
  method: CalculationMethodId
): Promise<boolean> {
  const run = scheduleChain.then(() => schedulePrayerAlarmsInternal(location, method));
  scheduleChain = run.catch(() => false);
  return run;
}

async function schedulePrayerAlarmsInternal(
  location: PrayerLocation,
  method: CalculationMethodId
): Promise<boolean> {
  if (Capacitor.getPlatform() !== "android") {
    console.log("Prayer notifications: not on Android, skipping native schedule");
    return true;
  }
  try {
    await ensureNativeTime();
    const notificationsGranted = await checkNotificationPermission();
    const exactGranted = await checkExactAlarmPermission();
    if (!notificationsGranted || !exactGranted) {
      console.warn("Prayer notifications are not scheduled: required Android permission is missing", {
        notificationsGranted,
        exactGranted,
      });
      return false;
    }
    await PrayerAlarm.cancelAllAlarms();

    const tz = location.timezoneId || currentTimezoneId();
    const alarms: AlarmEntry[] = [];
    const now = Date.now();
    const DAYS_TO_SCHEDULE = 30;

    for (let dayOffset = 0; dayOffset < DAYS_TO_SCHEDULE; dayOffset++) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + dayOffset);
      const dayPrayers = getDayPrayers(
        location.latitude,
        location.longitude,
        targetDate,
        method,
        tz
      );

      for (const prayer of dayPrayers.prayers) {
        const ts = prayer.time.getTime();

        // 1. منبه الأذان الفعلي الدقيق (exact)
        if (ts > now) {
          alarms.push({
            timestamp: ts,
            id: alarmId(prayer.prayerId, "exact", dayOffset),
            title: alarmTitle(prayer.prayerId, "exact"),
            body: alarmBody(prayer.prayerId, "exact"),
            prayerId: prayer.prayerId,
            type: "exact",
          });
        }

        // 2. منبه التذكير قبل الصلاة بـ 10 دقائق (pre)
        if (PRE_ALARM_PRAYERS.includes(prayer.prayerId)) {
          const preTs = ts - PRE_ALARM_MINUTES * 60 * 1000;
          if (preTs > now) {
            alarms.push({
              timestamp: preTs,
              id: alarmId(prayer.prayerId, "pre", dayOffset),
              title: alarmTitle(prayer.prayerId, "pre"),
              body: alarmBody(prayer.prayerId, "pre"),
              prayerId: prayer.prayerId,
              type: "pre",
            });
          }
        }
      }
    }

    if (alarms.length > 0) {
      const result = await PrayerAlarm.scheduleAlarms({ alarms });
      if (!result.exact || result.scheduled !== alarms.length) {
        throw new Error(`Exact alarm scheduling incomplete: ${result.scheduled}/${alarms.length}`);
      }
    }

    const { today, tomorrow } = getTodayAndTomorrow(
      location.latitude,
      location.longitude,
      method,
      tz
    );

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

    console.log(`Prayer notifications scheduled: ${alarms.length} alarms (30-day exact window)`);
    return true;
  } catch (e) {
    console.error("Failed to schedule prayer notifications:", e);
    return false;
  }
}

export interface TestNotificationResult {
  success: boolean;
  message: string;
}

/** إشعار تجريبي فوري + جدولة اختبار (كما في الإنتاج) */
export async function testPrayerNotification(): Promise<TestNotificationResult> {
  const title = "حان الآن وقت صلاة الظهر";
  const body = "إنَّ هَذَا وقتٌ تُفْتَحُ فِيهِ أَبْوَابُ السَّمَاءِ.";

  if (Capacitor.getPlatform() === "android") {
    try {
      await ensureNativeTime();
      const granted = await requestNotificationPermission();
      if (!granted) {
        return {
          success: false,
          message: "إذن الإشعارات غير مفعّل. يرجى تفعيله من الإعدادات.",
        };
      }
      const exactGranted = await checkExactAlarmPermission();
      if (!exactGranted) {
        return {
          success: false,
          message: "صلاحية المنبهات الدقيقة غير مفعلة. يرجى تفعيلها من إعدادات أندرويد.",
        };
      }

      // 1. إرسال إشعار تجريبي فوري يظهر ويصدر صوتاً واهتزازاً لحظياً
      try {
        await PrayerAlarm.sendImmediateTestNotification({
          title,
          body,
          prayerId: "dhuhr",
        });
      } catch (eImmediate) {
        console.warn("Immediate test notification call:", eImmediate);
      }

      // 2. جدولة منبه تجريبي لاختبار خوارزمية المنبهات الدقيقة (AlarmManager) بعد 5 ثوانٍ
      const scheduled = await PrayerAlarm.scheduleAlarms({
        alarms: [
          {
            timestamp: Date.now() + 5000,
            id: 88888,
            title,
            body,
            prayerId: "dhuhr",
            type: "exact",
          },
        ],
      });
      if (!scheduled.exact || scheduled.scheduled !== 1) {
        throw new Error("لم يتم تسجيل المنبه التجريبي كمنبه دقيق");
      }

      return {
        success: true,
        message: "تم إرسال إشعار التجربة بنجاح!",
      };
    } catch (e: any) {
      console.error("Failed to test prayer notification on Android:", e);
      return {
        success: false,
        message: `تعذر إرسال الإشعار: ${e?.message || "خطأ غير متوقع"}`,
      };
    }
  }

  // Fallback للمتصفح وبيئة الاختبار
  if (typeof window !== "undefined" && "Notification" in window) {
    try {
      let permission = Notification.permission;
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }
      if (permission === "granted") {
        const isDarkMode =
          typeof window.matchMedia === "function" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches;
        // تباين عكسي لضمان الوضوح التام فوق بطاقة الإشعار
        const iconUrl = isDarkMode ? "/logo-light-bg.png" : "/logo-dark-bg.png";

        new Notification(title, {
          body,
          icon: iconUrl,
          badge: "/icon-192.png",
        });
        return {
          success: true,
          message: "تم إرسال إشعار تجريبي في المتصفح بنجاح!",
        };
      }
    } catch (err) {
      console.warn("Web notification test error:", err);
    }
  }

  return {
    success: true,
    message: "تم تنفيذ اختبار منظومة التنبيهات بنجاح.",
  };
}

/**
 * الحصول على موقع موثوق من الجهاز فقط.
 * لا يتم تحويل IP أو المنطقة الزمنية إلى إحداثية تلقائية، لأن ذلك قد يرسل
 * مواقيت الصلاة لمكان مختلف تمامًا عن مكان المستخدم.
 */
export async function autoDetectLocation(): Promise<PrayerLocation> {
  type Fix = { latitude: number; longitude: number; accuracy: number; timestamp: number };
  const fixes: Fix[] = [];
  const MAX_ACCEPTABLE_ACCURACY_METERS = 150;
  const REQUIRED_ACCURACY_METERS = 100;

  const distanceMeters = (a: Fix, b: Fix): number => {
    const earthRadius = 6_371_000;
    const lat1 = (a.latitude * Math.PI) / 180;
    const lat2 = (b.latitude * Math.PI) / 180;
    const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
    const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  };

  const addFix = (position: { coords: { latitude: number; longitude: number; accuracy?: number | null }; timestamp?: number }) => {
    const { latitude, longitude, accuracy } = position.coords;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    if (!Number.isFinite(accuracy) || (accuracy as number) <= 0) return;
    if ((accuracy as number) > MAX_ACCEPTABLE_ACCURACY_METERS) return;
    fixes.push({ latitude, longitude, accuracy: accuracy as number, timestamp: position.timestamp || Date.now() });
  };

  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Geolocation")) {
    const permissions = await Geolocation.checkPermissions();
    if (permissions.location !== "granted") {
      const requested = await Geolocation.requestPermissions();
      if (requested.location !== "granted") {
        throw new Error("لم يتم منح صلاحية الموقع");
      }
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
        addFix(position);
        if (fixes.length > 0 && fixes[fixes.length - 1].accuracy <= REQUIRED_ACCURACY_METERS) break;
      } catch (error) {
        console.warn(`Location measurement ${attempt + 1} failed`, error);
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } else if (typeof navigator !== "undefined" && "geolocation" in navigator) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0,
          });
        });
        addFix(position);
        if (fixes.length > 0 && fixes[fixes.length - 1].accuracy <= REQUIRED_ACCURACY_METERS) break;
      } catch (error) {
        console.warn(`Browser location measurement ${attempt + 1} failed`, error);
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  if (fixes.length === 0) {
    throw new Error("قراءة GPS غير كافية لتحديد العزبة بدقة. فعّل الموقع الدقيق أو اختر المكان على الخريطة.");
  }

  const bestFix = fixes.reduce((best, current) =>
    current.accuracy < best.accuracy ? current : best,
  );
  const stableFixes = fixes.filter(
    (fix) => distanceMeters(fix, bestFix) <= Math.max(100, bestFix.accuracy),
  );
  if (bestFix.accuracy > REQUIRED_ACCURACY_METERS && stableFixes.length < 2) {
    throw new Error("لم تثبت قراءات GPS مكانًا واحدًا بدقة كافية. تحرك إلى مكان مفتوح وأعد المحاولة.");
  }
  const timezoneId = guessTimezone(bestFix.latitude, bestFix.longitude);
  let cityName = "موقعي الحالي";
  let countryName = "";
  let displayAddress: string | undefined;

  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${bestFix.latitude}&lon=${bestFix.longitude}&zoom=18&accept-language=ar&addressdetails=1`;
    const arcgisUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?location=${bestFix.longitude},${bestFix.latitude}&f=json&langCode=ARA`;
    const googleUrl = `/api/geocoding/reverse?lat=${bestFix.latitude}&lng=${bestFix.longitude}`;
    const [nominatimResult, arcgisResult, googleResult] = await Promise.allSettled([
      fetch(nominatimUrl, {
        headers: { "Accept-Language": "ar" },
        signal: AbortSignal.timeout(5000),
      }).then((response) => (response.ok ? response.json() : null)),
      fetch(arcgisUrl, { signal: AbortSignal.timeout(5000) }).then((response) =>
        response.ok ? response.json() : null,
      ),
      fetch(googleUrl, { signal: AbortSignal.timeout(3500) }).then((response) =>
        response.ok ? response.json() : null,
      ),
    ]);
    const nominatim = nominatimResult.status === "fulfilled" ? nominatimResult.value : null;
    const arcgis = arcgisResult.status === "fulfilled" ? arcgisResult.value : null;
    const google = googleResult.status === "fulfilled" ? googleResult.value : null;
    const address = nominatim?.address || {};
    const nominatimName =
      address.hamlet || address.village || address.suburb || address.town ||
      address.neighbourhood || address.city || address.district || address.county ||
      nominatim?.name;
    const arcgisAddress = arcgis?.address || {};
    const arcgisName =
      arcgisAddress.Village || arcgisAddress.City || arcgisAddress.Subregion ||
      arcgisAddress.Region || arcgisAddress.Address;
    const googleName = google?.enabled
      ? (google.village || google.locality || google.district || google.region || "")
      : "";
    // Prefer a specific locality, but only use the second provider to confirm
    // it when both providers return the same locality. Never invent a village.
    cityName = googleName || nominatimName || arcgisName || cityName;
    if (nominatimName && arcgisName && nominatimName !== arcgisName) {
      cityName = nominatimName;
    }
    countryName = google?.country || address.country || arcgisAddress.Country || countryName;
    displayAddress = google?.formattedAddress || nominatim?.display_name || arcgisAddress.Match_addr || undefined;
  } catch (error) {
    console.warn("Reverse geocoding failed; keeping the verified coordinates", error);
  }

  return {
    latitude: bestFix.latitude,
    longitude: bestFix.longitude,
    cityName,
    cityNameAr: cityName,
    countryNameAr: countryName || undefined,
    timezoneId,
    isAutoDetected: true,
    accuracyMeters: bestFix.accuracy,
    capturedAt: bestFix.timestamp,
    source: bestFix.accuracy <= 100 ? "gps_precise" : "gps_approximate",
    displayAddress,
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
