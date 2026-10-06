import React, { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Geolocation } from "@capacitor/geolocation";
import { useApp } from "../contexts/AppContext";
import type { PrayerLocation } from "../lib/prayer-config";
import {
  getNotificationPermissionStatus,
  requestNotificationPermission,
  checkExactAlarmPermission,
  requestExactAlarmAccess,
  openNativeNotificationSettings,
  openNativeAppSettings,
  autoDetectLocation,
  checkOrRequestLocationPermissionSmartly,
  schedulePrayerAlarms,
} from "../lib/prayer-alarms";
import PermissionSetupDialog, {
  type PermissionStep,
} from "./PermissionSetupDialog";

const COMPLETE = "dar_onboarding_completed";
const DEFERRED = "dar_permissions_deferred_this_session";
const LOCATION_CONFIRMED = "dar_prayer_location_confirmed";
function flag(storage: Storage, key: string) {
  try {
    return storage.getItem(key) === "true";
  } catch {
    return false;
  }
}
function mark(storage: Storage, key: string) {
  try {
    storage.setItem(key, "true");
  } catch {
    /* permission flow still works without storage */
  }
}
function validLocation(
  location: PrayerLocation | null | undefined,
): location is PrayerLocation {
  return (
    !!location &&
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude) &&
    Math.abs(location.latitude) <= 90 &&
    Math.abs(location.longitude) <= 180
  );
}

/** One owner for foreground permission prompts; background launch/update checks never request them. */
export const PermissionsGuard: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { currentTheme, prayerState, updatePrayerState } = useApp();
  const latest = useRef({ prayerState, updatePrayerState });
  latest.current = { prayerState, updatePrayerState };
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<PermissionStep>("notifications");
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState(false);
  const [message, setMessage] = useState("");
  const mounted = useRef(false),
    shown = useRef(false),
    working = useRef(false),
    generation = useRef(0);
  const acceptedLocation = useRef<PrayerLocation | null>(null);
  const view = useRef({ step, settings });
  view.current = { step, settings };
  const current = (token: number) =>
    mounted.current && token === generation.current;
  const show = (next: PermissionStep, manual = false) => {
    view.current = { step: next, settings: manual };
    setStep(next);
    setSettings(manual);
    shown.current = true;
    setVisible(true);
  };
  const run = useCallback(async (work: (token: number) => Promise<void>) => {
    if (!mounted.current || working.current) return;
    const token = ++generation.current;
    working.current = true;
    setBusy(true);
    setMessage("");
    try {
      await work(token);
    } catch (e) {
      if (current(token)) {
        console.warn("Permission setup action failed", e);
        setMessage("تعذّر إكمال الخطوة. حاول مجددًا.");
      }
    } finally {
      if (current(token)) {
        working.current = false;
        setBusy(false);
      }
    }
  }, []);
  const advance = useCallback(async (token: number, initial = false) => {
    const [notifications, exact] = await Promise.all([
      getNotificationPermissionStatus(),
      checkExactAlarmPermission(),
    ]);
    if (!current(token)) return;
    if (!notifications.granted) {
      show("notifications", !notifications.canRequest);
      return;
    }
    if (!exact) {
      show("exactAlarms");
      return;
    }
    if (initial && flag(localStorage, COMPLETE)) {
      shown.current = false;
      setVisible(false);
      return;
    }
    const saved = latest.current.prayerState.location;
    const location =
      acceptedLocation.current ||
      ((flag(localStorage, LOCATION_CONFIRMED) ||
        flag(localStorage, COMPLETE)) &&
      validLocation(saved)
        ? saved
        : null);
    if (!validLocation(location)) {
      show("location");
      return;
    }
    show("finish");
    const scheduled = await schedulePrayerAlarms(
      location,
      latest.current.prayerState.method,
    );
    if (!current(token)) return;
    if (!scheduled) {
      setMessage("تعذّر تفعيل التنبيهات. حاول مجددًا.");
      return;
    }
    mark(localStorage, COMPLETE);
    shown.current = false;
    setVisible(false);
  }, []);
  const dismiss = useCallback(() => {
    ++generation.current;
    working.current = false;
    shown.current = false;
    mark(sessionStorage, DEFERRED);
    setBusy(false);
    setVisible(false);
    // Deferral is not successful setup, and never schedules or opens another prompt.
  }, []);
  const resume = useCallback(() => {
    if (!shown.current) return;
    void run(async (token) => {
      const wasLocation = view.current.step === "location";
      if (wasLocation && view.current.settings) {
        const permission = await Geolocation.checkPermissions();
        if (!current(token)) return;
        if (
          permission.location === "granted" ||
          permission.coarseLocation === "granted"
        ) {
          setSettings(false);
          view.current.settings = false;
        }
        return; // Permission != a GPS fix. The writer explicitly chooses Detect / saved city.
      }
      await advance(token);
    });
  }, [run, advance]);
  useEffect(() => {
    mounted.current = true;
    if (Capacitor.getPlatform() !== "android")
      return () => {
        mounted.current = false;
      };
    if (!flag(sessionStorage, DEFERRED))
      void run((token) => advance(token, true));
    let disposed = false;
    let listener: { remove: () => Promise<void> } | undefined;
    CapApp.addListener("appStateChange", (state) => {
      if (state.isActive) resume();
    })
      .then((handle) => {
        if (disposed) void handle.remove();
        else listener = handle;
      })
      .catch((e) => console.warn("Permission resume listener unavailable", e));
    window.addEventListener("focus", resume);
    return () => {
      disposed = true;
      mounted.current = false;
      ++generation.current;
      working.current = false;
      void listener?.remove();
      window.removeEventListener("focus", resume);
    };
  }, [advance, resume, run]);
  const acceptLocation = async (location: PrayerLocation, token: number) => {
    if (!current(token)) return;
    if (!validLocation(location)) {
      setMessage("الموقع غير صالح. حاول تحديده مجددًا.");
      return;
    }
    acceptedLocation.current = location;
    latest.current.updatePrayerState({ location });
    mark(localStorage, LOCATION_CONFIRMED);
    await advance(token);
  };
  const activate = () =>
    void run(async (token) => {
      const active = view.current;
      if (active.step === "notifications") {
        if (active.settings) {
          const opened = await openNativeNotificationSettings();
          if (current(token))
            setMessage(
              opened
                ? "فعّل الإشعارات ثم عُد للتطبيق."
                : "تعذّر فتح الإعدادات. حاول مجددًا.",
            );
          return;
        }
        const granted = await requestNotificationPermission();
        if (!current(token)) return;
        if (granted) await advance(token);
        else {
          show("notifications", true);
          setMessage("لم يُمنح الإذن. يمكنك تفعيله من الإعدادات.");
        }
      } else if (active.step === "exactAlarms") {
        const result = await requestExactAlarmAccess();
        if (!current(token)) return;
        if (result.granted) await advance(token);
        else setMessage("فعّل المنبّهات ثم عُد للتطبيق.");
        // Never launch battery settings over the exact-alarm screen.
      } else if (active.step === "location") {
        if (active.settings) {
          const opened = await openNativeAppSettings();
          if (current(token))
            setMessage(
              opened
                ? "اسمح بالموقع ثم عُد للتطبيق."
                : "تعذّر فتح الإعدادات. حاول مجددًا.",
            );
          return;
        }
        const granted = await checkOrRequestLocationPermissionSmartly();
        if (!current(token)) return;
        if (!granted) {
          show("location", true);
          setMessage(
            validLocation(latest.current.prayerState.location)
              ? "اسمح بالموقع، أو استخدم المدينة الحالية."
              : "اسمح بالموقع من إعدادات التطبيق.",
          );
          return;
        }
        try {
          const location = await autoDetectLocation();
          await acceptLocation(location, token);
        } catch {
          if (current(token))
            setMessage("تعذّر تحديد الموقع. فعّل خدمة الموقع وحاول مجددًا.");
        }
      } else await advance(token);
    });
  const saved = prayerState.location;
  return (
    <>
      {children}
      {visible && (
        <PermissionSetupDialog
          theme={currentTheme}
          step={step}
          busy={busy}
          settings={settings}
          message={message}
          savedCity={
            validLocation(saved)
              ? saved.cityNameAr || saved.cityName
              : undefined
          }
          onActivate={activate}
          onDismiss={dismiss}
          onUseSaved={() =>
            void run((token) =>
              acceptLocation(latest.current.prayerState.location!, token),
            )
          }
        />
      )}
    </>
  );
};
export default PermissionsGuard;
