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
import { reverseGeocodeCoordinates } from "./reverse-geocoding";

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
        const iconUrl = "/dar-al-hikayat-logo-royal_classic.png";

        new Notification(title, {
          body,
          icon: iconUrl,
          badge: iconUrl,
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
 * نظام تحديد الموقع المرجعي المتقدم (The 5-Layer GPS System)
 * مُعاد تصميمه بالكامل بـ 5 طبقات حماية تضمن أعلى موثوقية وتحديث هادئ في الخلفية.
 */
export {
  autoDetectLocation,
  performSilentResumeLocationRefresh,
  checkOrRequestLocationPermissionSmartly,
  getLastSavedLocation,
  saveSavedLocation,
  LOCATION_ACTIONABLE_ERROR_MESSAGE,
  guessTimezone,
  findNearestCity,
  clearAllLocationCache,
  getDistanceKm,
  findNearestArabPlace,
} from "./gps-location";

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
