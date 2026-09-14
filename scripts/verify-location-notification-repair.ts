import { getDayPrayers } from "../lib/prayer-times";
import { guessTimezone } from "../lib/prayer-alarms";

const result = getDayPrayers(24.7136, 46.6753, new Date("2026-09-14T23:30:00.000Z"), "umm_al_qura", "Asia/Riyadh");
if (result.date !== "2026-09-15") {
  throw new Error(`Expected Riyadh calendar date 2026-09-15, got ${result.date}`);
}
if (result.prayers.some((prayer) => !Number.isFinite(prayer.time.getTime()))) {
  throw new Error("Prayer calculation returned an invalid timestamp");
}
if (guessTimezone(30.0444, 31.2357) !== "Africa/Cairo") {
  throw new Error("Timezone mapping regression");
}
console.log("location/prayer timezone verification passed");
