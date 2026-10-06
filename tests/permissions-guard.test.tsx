/** @vitest-environment jsdom */
import React, { act } from "react";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { setupDom, theme, click } from "./helpers/handwriting-dom";
const mock = vi.hoisted(() => ({
  platform: vi.fn(),
  listen: vi.fn(),
  remove: vi.fn(),
  geo: vi.fn(),
  context: vi.fn(),
  notification: vi.fn(),
  request: vi.fn(),
  exact: vi.fn(),
  access: vi.fn(),
  notificationSettings: vi.fn(),
  appSettings: vi.fn(),
  detect: vi.fn(),
  locationPermission: vi.fn(),
  schedule: vi.fn(),
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { getPlatform: mock.platform },
}));
vi.mock("@capacitor/app", () => ({ App: { addListener: mock.listen } }));
vi.mock("@capacitor/geolocation", () => ({
  Geolocation: { checkPermissions: mock.geo },
}));
vi.mock("../contexts/AppContext", () => ({ useApp: mock.context }));
vi.mock("../lib/prayer-alarms", () => ({
  getNotificationPermissionStatus: mock.notification,
  requestNotificationPermission: mock.request,
  checkExactAlarmPermission: mock.exact,
  requestExactAlarmAccess: mock.access,
  openNativeNotificationSettings: mock.notificationSettings,
  openNativeAppSettings: mock.appSettings,
  autoDetectLocation: mock.detect,
  checkOrRequestLocationPermissionSmartly: mock.locationPermission,
  schedulePrayerAlarms: mock.schedule,
}));
import PermissionsGuard from "../components/PermissionsGuard";
let dom: ReturnType<typeof setupDom>;
let listener: (s: { isActive: boolean }) => void;
const saved = {
  latitude: 30,
  longitude: 31,
  cityName: "Cairo",
  cityNameAr: "القاهرة",
  timezoneId: "Africa/Cairo",
};
const fresh = {
  ...saved,
  latitude: 31.2,
  longitude: 29.9,
  cityNameAr: "الإسكندرية",
};
const update = vi.fn();
const primary = ".permission-setup-actions button:first-child";
const later = ".permission-setup-actions button:last-child";
const dialog = () => document.querySelector('[role="dialog"]');
const text = () => dialog()?.textContent || "";
async function render() {
  await dom.render(
    <PermissionsGuard>
      <div>Writer</div>
    </PermissionsGuard>,
  );
}
async function resume() {
  await act(async () => {
    listener({ isActive: true });
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  dom = setupDom();
  mock.platform.mockReturnValue("android");
  mock.remove.mockResolvedValue(undefined);
  mock.listen.mockImplementation(async (_name, cb) => {
    listener = cb;
    return { remove: mock.remove };
  });
  mock.context.mockReturnValue({
    currentTheme: theme,
    prayerState: { location: saved, method: "egyptian" },
    updatePrayerState: update,
  });
  mock.notification.mockResolvedValue({ granted: false, canRequest: true });
  mock.request.mockResolvedValue(false);
  mock.exact.mockResolvedValue(false);
  mock.access.mockResolvedValue({ granted: false, openedSettings: true });
  mock.notificationSettings.mockResolvedValue(true);
  mock.appSettings.mockResolvedValue(true);
  mock.locationPermission.mockResolvedValue(true);
  mock.geo.mockResolvedValue({
    location: "granted",
    coarseLocation: "granted",
  });
  mock.detect.mockResolvedValue(fresh);
  mock.schedule.mockResolvedValue(true);
});
afterEach(() => {
  dom.cleanup();
  localStorage.clear();
  sessionStorage.clear();
});
it("checks without any startup permission prompts and uses a compact modal", async () => {
  await render();
  expect(text()).toContain("الإشعارات");
  expect(mock.request).not.toHaveBeenCalled();
  expect(mock.access).not.toHaveBeenCalled();
  expect(mock.locationPermission).not.toHaveBeenCalled();
  expect(
    document.querySelector(".permission-setup-dialog")?.querySelectorAll("svg"),
  ).toHaveLength(1);
  expect(text()).not.toMatch(/الخطوة|تهيئة|1\/3|توفير/);
});
it("does not mount Android setup on web", async () => {
  mock.platform.mockReturnValue("web");
  await render();
  expect(dialog()).toBeNull();
  expect(mock.notification).not.toHaveBeenCalled();
});
it("defers without claiming completion or reopening on resume/remount", async () => {
  await render();
  await click(later);
  expect(dialog()).toBeNull();
  expect(localStorage.getItem("dar_onboarding_completed")).toBeNull();
  await resume();
  expect(dialog()).toBeNull();
  await dom.render(<div />);
  await render();
  expect(dialog()).toBeNull();
  expect(mock.schedule).not.toHaveBeenCalled();
});
it("moves denied notifications to app notification settings and reports launch failure", async () => {
  await render();
  await click(primary);
  expect(document.querySelector(primary)?.textContent).toBe("فتح الإعدادات");
  mock.notificationSettings.mockResolvedValue(false);
  await click(primary);
  expect(text()).toContain("تعذّر فتح الإعدادات");
  expect(mock.request).toHaveBeenCalledTimes(1);
});
it("blocked toggles go directly to settings, including already-completed setup", async () => {
  localStorage.setItem("dar_onboarding_completed", "true");
  mock.notification.mockResolvedValue({ granted: false, canRequest: false });
  await render();
  await click(primary);
  expect(mock.notificationSettings).toHaveBeenCalledTimes(1);
  expect(mock.request).not.toHaveBeenCalled();
});
it("advances sequentially through exact alarm settings and fresh GPS scheduling", async () => {
  await render();
  mock.request.mockResolvedValue(true);
  mock.notification.mockResolvedValue({ granted: true, canRequest: false });
  await click(primary);
  expect(text()).toContain("الموعد المحدد");
  await click(primary);
  expect(mock.access).toHaveBeenCalledTimes(1);
  expect(mock.detect).not.toHaveBeenCalled();
  mock.exact.mockResolvedValue(true);
  await resume();
  expect(text()).toContain("مواقيت مدينتك");
  expect(mock.detect).not.toHaveBeenCalled();
  await click(primary);
  expect(update).toHaveBeenCalledWith({ location: fresh });
  expect(mock.schedule).toHaveBeenLastCalledWith(fresh, "egyptian");
  expect(localStorage.getItem("dar_onboarding_completed")).toBe("true");
  expect(dialog()).toBeNull();
});
it("shows exact-settings failures instead of claiming success", async () => {
  mock.notification.mockResolvedValue({ granted: true });
  mock.access.mockRejectedValue(new Error("settings unavailable"));
  await render();
  await click(primary);
  expect(text()).toContain("تعذّر إكمال الخطوة");
  expect(localStorage.getItem("dar_onboarding_completed")).toBeNull();
});
it("offers location-specific settings after denial, and does not equate permission with a GPS fix", async () => {
  mock.notification.mockResolvedValue({ granted: true });
  mock.exact.mockResolvedValue(true);
  mock.locationPermission.mockResolvedValue(false);
  await render();
  await click(primary);
  await click(primary);
  expect(mock.appSettings).toHaveBeenCalledTimes(1);
  expect(mock.notificationSettings).not.toHaveBeenCalled();
  await resume();
  expect(mock.detect).not.toHaveBeenCalled();
  expect(mock.schedule).not.toHaveBeenCalled();
  expect(document.querySelector(primary)?.textContent).toBe("تحديد موقعي");
});
it("GPS failure offers retry and current city; scheduling failure stays retryable", async () => {
  mock.notification.mockResolvedValue({ granted: true });
  mock.exact.mockResolvedValue(true);
  mock.detect.mockRejectedValue(new Error("GPS off"));
  mock.schedule.mockResolvedValue(false);
  await render();
  await click(primary);
  expect(text()).toContain("تعذّر تحديد الموقع");
  expect(text()).toContain("استخدام القاهرة");
  await click(".permission-saved-city");
  expect(mock.schedule).toHaveBeenLastCalledWith(saved, "egyptian");
  expect(text()).toContain("تعذّر تفعيل التنبيهات");
  expect(localStorage.getItem("dar_onboarding_completed")).toBeNull();
  mock.schedule.mockResolvedValue(true);
  await click(primary);
  expect(dialog()).toBeNull();
  expect(localStorage.getItem("dar_onboarding_completed")).toBe("true");
});
it("deduplicates pending actions and ignores late notification result after dismiss", async () => {
  let resolve!: (b: boolean) => void;
  mock.request.mockImplementation(
    () => new Promise<boolean>((r) => (resolve = r)),
  );
  await render();
  await click(primary);
  await act(async () => {
    listener({ isActive: true });
    window.dispatchEvent(new Event("focus"));
  });
  expect(mock.request).toHaveBeenCalledTimes(1);
  await click(later);
  mock.notification.mockResolvedValue({ granted: true });
  await act(async () => resolve(true));
  expect(dialog()).toBeNull();
  expect(mock.access).not.toHaveBeenCalled();
  expect(mock.schedule).not.toHaveBeenCalled();
});
it("ignores a late GPS fix after dismiss without changing location or scheduling", async () => {
  mock.notification.mockResolvedValue({ granted: true });
  mock.exact.mockResolvedValue(true);
  let resolve!: (v: typeof fresh) => void;
  mock.detect.mockImplementation(() => new Promise((r) => (resolve = r)));
  await render();
  await click(primary);
  await click(later);
  await act(async () => resolve(fresh));
  expect(update).not.toHaveBeenCalled();
  expect(mock.schedule).not.toHaveBeenCalled();
  expect(dialog()).toBeNull();
});
it("ignores late scheduling completion after dismiss", async () => {
  mock.notification.mockResolvedValue({ granted: true });
  mock.exact.mockResolvedValue(true);
  let resolve!: (b: boolean) => void;
  mock.schedule.mockImplementation(
    () => new Promise<boolean>((r) => (resolve = r)),
  );
  await render();
  await click(".permission-saved-city");
  await click(later);
  await act(async () => resolve(true));
  expect(localStorage.getItem("dar_onboarding_completed")).toBeNull();
  expect(dialog()).toBeNull();
});
it("does not reschedule completed setup on each launch", async () => {
  localStorage.setItem("dar_onboarding_completed", "true");
  mock.notification.mockResolvedValue({ granted: true });
  mock.exact.mockResolvedValue(true);
  await render();
  expect(dialog()).toBeNull();
  expect(mock.schedule).not.toHaveBeenCalled();
});
it("removes a listener even when registration resolves after unmount", async () => {
  let resolve!: (v: any) => void;
  mock.listen.mockImplementation(() => new Promise((r) => (resolve = r)));
  await render();
  await dom.render(<div />);
  await act(async () => resolve({ remove: mock.remove }));
  expect(mock.remove).toHaveBeenCalledTimes(1);
});
it("Escape dismisses the dialog", async () => {
  await render();
  await act(async () =>
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
  expect(dialog()).toBeNull();
  expect(localStorage.getItem("dar_onboarding_completed")).toBeNull();
});
