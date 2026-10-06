import React, { useEffect, useRef } from "react";
import { AlarmClock, Bell, MapPin } from "lucide-react";
import type { ThemeColors } from "../contexts/AppContext";
import "./PermissionSetupDialog.css";
export type PermissionStep =
  "notifications" | "exactAlarms" | "location" | "finish";
interface Props {
  theme: ThemeColors;
  step: PermissionStep;
  busy: boolean;
  settings: boolean;
  message: string;
  savedCity?: string;
  onActivate: () => void;
  onDismiss: () => void;
  onUseSaved: () => void;
}
const copy = {
  notifications: {
    title: "الإشعارات",
    description: "لتنبيهات الصلاة والتحديثات.",
    action: "تفعيل",
    Icon: Bell,
  },
  exactAlarms: {
    title: "تنبيهات الصلاة",
    description: "اسمح بالتنبيه في الموعد المحدد.",
    action: "فتح الإعدادات",
    Icon: AlarmClock,
  },
  location: {
    title: "مواقيت مدينتك",
    description: "حدد موقعك لحساب مواقيت الصلاة.",
    action: "تحديد موقعي",
    Icon: MapPin,
  },
  finish: {
    title: "تنبيهات الصلاة",
    description: "إكمال إعداد تنبيهات الصلاة.",
    action: "إعادة المحاولة",
    Icon: AlarmClock,
  },
};
export default function PermissionSetupDialog({
  theme,
  step,
  busy,
  settings,
  message,
  savedCity,
  onActivate,
  onDismiss,
  onUseSaved,
}: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    panel.current
      ?.querySelector<HTMLButtonElement>("button")
      ?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        dismiss.current();
      }
      if (e.key === "Tab") {
        const buttons = Array.from(
          panel.current?.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          ) || [],
        );
        if (!buttons.length) return;
        const first = buttons[0],
          last = buttons.at(-1)!;
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            !panel.current?.contains(document.activeElement))
        ) {
          e.preventDefault();
          last.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            !panel.current?.contains(document.activeElement))
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      if (before?.isConnected) before.focus({ preventScroll: true });
    };
  }, []);
  const item = copy[step];
  const Icon = item.Icon;
  return (
    <div
      className="permission-setup-overlay"
      dir="rtl"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="permission-setup-title"
        aria-describedby="permission-setup-description"
        className="permission-setup-dialog shadow-2xl"
        style={{
          backgroundColor: theme.bg,
          borderColor: theme.border,
          color: theme.text,
          boxShadow: `0 20px 45px -10px ${theme.shadow || "rgba(0,0,0,0.3)"}`,
        }}
      >
        <Icon
          size={28}
          strokeWidth={2}
          aria-hidden="true"
          style={{ color: theme.accent }}
        />
        <h2 id="permission-setup-title">{item.title}</h2>
        <p id="permission-setup-description">{item.description}</p>
        {message && (
          <p role="status" className="permission-setup-message">
            {message}
          </p>
        )}
        <div className="permission-setup-actions">
          <button
            type="button"
            onClick={onActivate}
            disabled={busy}
            aria-busy={busy}
            style={{ backgroundColor: theme.accent, color: theme.bg }}
          >
            {busy ? "جارٍ التنفيذ…" : settings ? "فتح الإعدادات" : item.action}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            style={{ color: theme.secondary }}
          >
            لاحقًا
          </button>
        </div>
        {step === "location" && savedCity && (
          <button
            type="button"
            disabled={busy}
            className="permission-saved-city"
            onClick={onUseSaved}
            style={{ color: theme.secondary }}
          >
            استخدام {savedCity}
          </button>
        )}
      </div>
    </div>
  );
}
