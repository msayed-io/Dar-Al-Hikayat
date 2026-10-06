import { beforeEach, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
const mock = vi.hoisted(() => ({
  platform: vi.fn(),
  plugin: {
    checkNotificationPermission: vi.fn(),
    requestExactAlarmPermission: vi.fn(),
    openNotificationSettings: vi.fn(),
    openAppSettings: vi.fn(),
  },
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { getPlatform: mock.platform },
  registerPlugin: (name: string) => (name === "PrayerAlarm" ? mock.plugin : {}),
}));
import {
  checkNotificationPermission,
  getNotificationPermissionStatus,
  openNativeNotificationSettings,
  openNativeAppSettings,
  requestExactAlarmAccess,
} from "../lib/prayer-alarms";
beforeEach(() => {
  vi.resetAllMocks();
  mock.platform.mockReturnValue("android");
});
it("preserves boolean notification API and exposes settings-only state", async () => {
  mock.plugin.checkNotificationPermission.mockResolvedValue({
    granted: false,
    canRequest: false,
  });
  expect(await checkNotificationPermission()).toBe(false);
  expect(await getNotificationPermissionStatus()).toEqual({
    granted: false,
    canRequest: false,
  });
});
it("supports the older native boolean payload", async () => {
  mock.plugin.checkNotificationPermission.mockResolvedValue({ granted: false });
  expect(await getNotificationPermissionStatus()).toEqual({
    granted: false,
    canRequest: true,
  });
});
it("reports settings launch failures and successes instead of silent void", async () => {
  mock.plugin.openNotificationSettings.mockRejectedValue(
    new Error("No activity"),
  );
  mock.plugin.openAppSettings.mockRejectedValue(new Error("No activity"));
  expect(await openNativeNotificationSettings()).toBe(false);
  expect(await openNativeAppSettings()).toBe(false);
  mock.plugin.openNotificationSettings.mockResolvedValue(undefined);
  expect(await openNativeNotificationSettings()).toBe(true);
});
it("surfaces exact-alarm launch errors to setup", async () => {
  mock.plugin.requestExactAlarmPermission.mockRejectedValue(
    new Error("No activity"),
  );
  await expect(requestExactAlarmAccess()).rejects.toThrow("No activity");
});
it("native notification checks include the OS toggle and exact settings errors reject", () => {
  const source = readFileSync(
    "android/app/src/main/java/com/daralhikayat/app/PrayerAlarmPlugin.java",
    "utf8",
  );
  expect(source).toContain(
    "NotificationManagerCompat.from(getContext()).areNotificationsEnabled()",
  );
  expect(source).toContain('result.put("canRequest", runtimeMissing');
  expect(source).toContain(
    'pluginCall.reject("Failed to open exact alarm settings:',
  );
});
it("startup update check never competes for the notification prompt", () => {
  const app = readFileSync("App.tsx", "utf8");
  expect(app).not.toContain("requestNotificationPermission");
  expect(app).toContain("await checkNotificationPermission()");
  const guard = readFileSync("components/PermissionsGuard.tsx", "utf8");
  expect(guard).not.toContain("requestBatteryOptimizationExemption");
});
