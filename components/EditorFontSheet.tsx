import React, { useLayoutEffect, useEffect, useRef, useState } from "react";
import { Check, ChevronRight, X } from "lucide-react";
import {
  EDITOR_FONTS,
  WEIGHT_LABELS,
  loadEditorFont,
  editorFontCssFamily,
  type EditorFont,
} from "../lib/editor-fonts";
import {
  FLOATING_CAPSULE_CLASS,
  floatingCapsuleStyle,
} from "../lib/floating-capsule";
import type { ThemeColors } from "../contexts/AppContext";
import "./EditorFonts.css";
import "./EditorFontSheet.css";
interface Props {
  theme: Pick<
    ThemeColors,
    | "bg"
    | "text"
    | "accent"
    | "border"
    | "shadow"
    | "secondary"
    | "glass"
    | "mode"
  >;
  anchor: HTMLElement | null;
  scope: "التحديد" | "الفقرة" | "الكل";
  initialFamily?: string;
  initialWeight?: number;
  onApply: (font: EditorFont, weight: number, all: boolean) => void;
  onClose: () => void;
}
export default function EditorFontSheet({
  theme,
  anchor,
  scope,
  initialFamily,
  initialWeight,
  onApply,
  onClose,
}: Props) {
  const initial =
    EDITOR_FONTS.find((f) => f.family === initialFamily) || EDITOR_FONTS[0];
  const [chosen, setChosen] = useState(initial);
  const [weight, setWeight] = useState(
    initial.weights.includes(initialWeight || 0) ? initialWeight! : 400,
  );
  const [detail, setDetail] = useState<EditorFont | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [geometry, setGeometry] = useState({
    left: 16,
    width: Math.min(384, window.innerWidth - 32),
  });
  const panel = useRef<HTMLElement>(null);
  const request = useRef(0);
  useLayoutEffect(() => {
    // Targets were captured before opening. Clear the live editor selection
    // before DOM normalization can restore it and reopen the soft keyboard.
    // The only focused element during font browsing is a non-editable control.
    // Blur the editable first: its blur handler otherwise restores a missing
    // selection while it still owns focus. Then clear the live range.
    panel.current
      ?.querySelector<HTMLButtonElement>('[aria-label="إغلاق الخطوط"]')
      ?.focus({ preventScroll: true });
    window.getSelection()?.removeAllRanges();
  }, []);
  useEffect(() => {
    const measure = () => {
      const r = anchor?.getBoundingClientRect();
      setGeometry(
        r
          ? { left: r.left, width: r.width }
          : {
              left: Math.max(16, (window.innerWidth - 384) / 2),
              width: Math.min(384, window.innerWidth - 32),
            },
      );
    };
    measure();
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : null;
    if (anchor) observer?.observe(anchor);
    window.addEventListener("resize", measure);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", key);
    // The list is non-modal: no backdrop, focus trap or background blur.
    return () => {
      request.current++;
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      document.removeEventListener("keydown", key);
    };
  }, [anchor, onClose]);
  async function choose(font: EditorFont, w: number, all = false) {
    const ticket = ++request.current;
    setBusy(true);
    setError("");
    try {
      await loadEditorFont(font, w);
      if (ticket !== request.current) return;
      onApply(font, w, all);
      setChosen(font);
      setWeight(w);
    } catch {
      if (ticket === request.current)
        setError("تعذّر تحميل الخط. حاول مرة أخرى.");
    } finally {
      if (ticket === request.current) setBusy(false);
    }
  }
  return (
    <section
      ref={panel}
      className="editor-font-sheet shadow-2xl"
      role="dialog"
      aria-modal="false"
      aria-labelledby="editor-font-title"
      dir="rtl"
      style={
        {
          ...geometry,
          background: theme.bg,
          color: theme.text,
          borderColor: theme.border,
          boxShadow: `0 20px 45px -10px ${theme.shadow || "rgba(0,0,0,0.3)"}`,
          "--font-sheet-accent": theme.accent,
          "--font-sheet-border": theme.border,
          "--font-sheet-bg": theme.bg,
        } as React.CSSProperties
      }
    >
      <div
        className="apple-magnetic-dissolve editor-font-top-dissolve"
        aria-hidden="true"
      />
      <div
        className="apple-magnetic-dissolve-bottom editor-font-bottom-dissolve"
        aria-hidden="true"
      />
      <header className="editor-font-sheet-heading">
        <div
          className={`editor-font-title-capsule editor-font-capsule ${FLOATING_CAPSULE_CLASS}`}
          style={floatingCapsuleStyle(theme)}
        >
          {detail && (
            <button
              aria-label="الرجوع إلى الخطوط"
              onClick={() => setDetail(null)}
              className="editor-font-arrow"
            >
              <ChevronRight size={16} strokeWidth={2.5} />
            </button>
          )}
          <h2
            id="editor-font-title"
            className="font-zain-xbold"
            style={{ color: theme.accent }}
            title={detail?.label}
          >
            {detail ? detail.label : "الخطوط"}
          </h2>
        </div>
        <button
          aria-label="إغلاق الخطوط"
          onClick={onClose}
          className={`editor-font-close editor-font-capsule ${FLOATING_CAPSULE_CLASS} apple-elastic-pinch`}
          style={{ ...floatingCapsuleStyle(theme), borderRadius: "50%" }}
        >
          <X size={16} strokeWidth={2.2} />
        </button>
      </header>
      <div className="editor-font-list-wrap">
        <div
          className="editor-font-list"
          aria-label={detail ? "أوزان الخط" : "قائمة الخطوط"}
          aria-busy={busy}
        >
          {detail
            ? detail.weights.map((w) => (
                <button
                  key={w}
                  className="editor-font-row editor-font-weight"
                  aria-pressed={chosen.id === detail.id && weight === w}
                  disabled={busy}
                  onClick={() => void choose(detail, w)}
                >
                  <span
                    className="editor-font-preview"
                    style={{ fontFamily: `"${editorFontCssFamily(detail)}"`, fontWeight: w }}
                  >
                    {WEIGHT_LABELS[w]}
                  </span>
                  <span className="editor-font-weight-number">{w}</span>
                  {chosen.id === detail.id && weight === w && (
                    <Check size={15} />
                  )}
                </button>
              ))
            : EDITOR_FONTS.map((font) => (
                <div
                  key={font.id}
                  className="editor-font-row"
                  data-selected={chosen.id === font.id}
                >
                  <button
                    className="editor-font-choice"
                    disabled={busy}
                    aria-pressed={chosen.id === font.id}
                    onClick={() => void choose(font, 400)}
                  >
                    <span
                      className="editor-font-preview"
                      style={{
                        fontFamily: `"${editorFontCssFamily(font)}"`,
                        fontWeight: 400,
                      }}
                    >
                      {font.label}
                    </span>
                    {chosen.id === font.id && <Check size={15} />}
                  </button>
                  {font.weights.length > 1 && (
                    <button
                      className="editor-font-arrow editor-font-detail"
                      aria-label={`أوزان ${font.label}`}
                      onClick={() => setDetail(font)}
                    >
                      <ChevronRight size={16} strokeWidth={2.5} />
                    </button>
                  )}
                </div>
              ))}
        </div>
      </div>
      {error && (
        <p role="alert" className="editor-font-error">
          {error}
        </p>
      )}
      <footer className="editor-font-actions">
        <span
          className={`editor-font-scope editor-font-capsule ${FLOATING_CAPSULE_CLASS}`}
          style={floatingCapsuleStyle(theme)}
        >
          {scope}
        </span>
        <button
          disabled={busy}
          onClick={() => void choose(chosen, weight, true)}
          className={`editor-font-capsule font-zain-bold ${FLOATING_CAPSULE_CLASS}`}
          style={{ ...floatingCapsuleStyle(theme), color: theme.accent }}
        >
          تطبيق على الكل
        </button>
      </footer>
    </section>
  );
}
