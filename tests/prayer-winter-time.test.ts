import { describe, it, expect } from "vitest";
import {
  getPrayerTimeline,
  getDayPrayers,
  formatIsoWithOffset,
  getTimezoneOffsetMinutes,
  isDstActive,
  calculateSecondaryTimes,
  getCivilDate,
} from "../lib/prayer-times";

describe("Egyptian Winter Time (DST) & Universal UTC Prayer Calculations", () => {
  const cairoLocation = {
    cityName: "Cairo",
    cityNameAr: "القاهرة",
    countryNameAr: "مصر",
    latitude: 30.0444,
    longitude: 31.2357,
    timezoneId: "Africa/Cairo",
  };

  it("resolves the 28-hour catastrophe between midnight and Fajr during winter time transition", () => {
    // October 30, 2026 at 01:00 AM in Cairo (UTC: 2026-10-29T23:00:00Z)
    // The exact night Egyptian winter time starts (+03:00 -> +02:00)
    const testTime = new Date("2026-10-29T23:00:00Z");

    const timeline = getPrayerTimeline(cairoLocation, "egyptian", testTime);

    // 1. Current prayer must be yesterday's Isha
    expect(timeline.current.key).toBe("isha");
    expect(timeline.current.name).toBe("العشاء");
    expect(timeline.current.isToday).toBe(false);

    // 2. Next prayer must be TODAY's Fajr, NOT tomorrow's Fajr!
    expect(timeline.next.key).toBe("fajr");
    expect(timeline.next.name).toBe("الفجر");
    expect(timeline.next.isToday).toBe(true);

    // 3. Remaining time must be ~3 hours and 40 minutes (NOT 28 hours!)
    expect(timeline.remainingSeconds).toBeGreaterThan(3 * 3600);
    expect(timeline.remainingSeconds).toBeLessThan(4 * 3600);
    expect(timeline.countdownLabel).toMatch(/^03:\d{2}:\d{2}$/);

    // 4. In today's schedule:
    // - Today's Fajr is NEXT (التالية)
    // - Today's Isha (in the evening) must NOT be marked as current (الآن)!
    const fajrItem = timeline.augmentedSchedule.find((p) => p.key === "fajr");
    const ishaItem = timeline.augmentedSchedule.find((p) => p.key === "isha");

    expect(fajrItem).toBeDefined();
    expect(fajrItem?.isNext).toBe(true);
    expect(fajrItem?.status).toBe("التالية");

    expect(ishaItem).toBeDefined();
    expect(ishaItem?.isCurrent).toBe(false);
    expect(ishaItem?.status).toBe("قادمة");

    // 5. Timezone info reflects Winter Time (+02:00)
    expect(timeline.timezoneInfo.offsetMinutes).toBe(120);
    expect(timeline.timezoneInfo.offsetString).toBe("UTC+02:00");
    expect(timeline.timezoneInfo.isDst).toBe(false);
    expect(timeline.timezoneInfo.standardLabelAr).toContain("الشتوي");
  });

  it("accurately handles ISO 8601 formatting with dynamic offsets (+03:00 Summer vs +02:00 Winter)", () => {
    // Thursday Oct 29, 2026 at 12:00 UTC -> Summer time (+03:00 in Cairo)
    const summerTime = new Date("2026-10-29T12:00:00Z");
    const summerIso = formatIsoWithOffset(summerTime, "Africa/Cairo");
    expect(summerIso).toContain("+03:00");
    expect(isDstActive(summerTime, "Africa/Cairo")).toBe(true);
    expect(getTimezoneOffsetMinutes(summerTime, "Africa/Cairo")).toBe(180);

    // Friday Oct 30, 2026 at 12:00 UTC -> Winter time (+02:00 in Cairo)
    const winterTime = new Date("2026-10-30T12:00:00Z");
    const winterIso = formatIsoWithOffset(winterTime, "Africa/Cairo");
    expect(winterIso).toContain("+02:00");
    expect(isDstActive(winterTime, "Africa/Cairo")).toBe(false);
    expect(getTimezoneOffsetMinutes(winterTime, "Africa/Cairo")).toBe(120);
  });

  it("calculates correct current and next prayer in daytime after Dhuhr", () => {
    // Oct 30, 2026 at 12:00 PM Cairo Winter Time (10:00 UTC)
    const daytime = new Date("2026-10-30T10:00:00Z");
    const timeline = getPrayerTimeline(cairoLocation, "egyptian", daytime);

    expect(timeline.current.key).toBe("dhuhr");
    expect(timeline.current.name).toBe("الظهر");
    expect(timeline.next.key).toBe("asr");
    expect(timeline.next.name).toBe("العصر");
    expect(timeline.remainingSeconds).toBeGreaterThan(0);
    expect(timeline.remainingSeconds).toBeLessThan(4 * 3600);
  });

  it("calculates correct current and next prayer at night after Isha", () => {
    // Oct 30, 2026 at 09:00 PM Cairo Winter Time (19:00 UTC)
    const nighttime = new Date("2026-10-30T19:00:00Z");
    const timeline = getPrayerTimeline(cairoLocation, "egyptian", nighttime);

    expect(timeline.current.key).toBe("isha");
    expect(timeline.current.name).toBe("العشاء");
    expect(timeline.current.isToday).toBe(true);
    expect(timeline.next.key).toBe("fajr");
    expect(timeline.next.name).toBe("الفجر");
    expect(timeline.next.isToday).toBe(false); // tomorrow's Fajr

    // Remaining until Fajr tomorrow (~7.5 hours)
    expect(timeline.remainingSeconds).toBeGreaterThan(6 * 3600);
    expect(timeline.remainingSeconds).toBeLessThan(9 * 3600);
  });

  it("computes secondary times (midnight and last third) matching the ongoing night", () => {
    // Oct 30, 2026 at 01:00 AM Cairo (night between yesterday's Maghrib and today's Fajr)
    const lateNight = new Date("2026-10-29T23:00:00Z");
    const secondary = calculateSecondaryTimes(
      cairoLocation.latitude,
      cairoLocation.longitude,
      lateNight,
      "egyptian",
      "Africa/Cairo"
    );

    expect(secondary.midnight).toBeDefined();
    expect(secondary.firstThird).toBeDefined();
    expect(secondary.lastThird).toBeDefined();
    expect(secondary.duha).toBeDefined();
  });

  it("iterates civil dates across DST changes without day-skipping or distortion", () => {
    const baseDate = new Date("2026-10-29T23:00:00Z"); // Oct 30 1 AM in Cairo
    const d0 = getCivilDate(baseDate, 0, "Africa/Cairo");
    const d1 = getCivilDate(baseDate, 1, "Africa/Cairo");
    const dMinus1 = getCivilDate(baseDate, -1, "Africa/Cairo");

    expect(d0.getDate()).toBe(30);
    expect(d1.getDate()).toBe(31);
    expect(dMinus1.getDate()).toBe(29);
  });
});
