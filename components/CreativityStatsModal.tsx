import React, { useMemo, useContext } from "react";
import { AppContext, Note, ThemeColors } from "../contexts/AppContext";
import {
  calculateCreativityStats,
  formatStatValue,
} from "../lib/creativity-stats";

export interface CreativityStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
  isLoaded?: boolean;
  theme?: ThemeColors;
}

export const CreativityStatsModal: React.FC<CreativityStatsModalProps> = ({
  isOpen,
  onClose,
  notes,
  isLoaded = true,
  theme,
}) => {
  // Read theme dynamically from AppContext to adhere strictly to "أجواء الدار"
  const appContext = useContext(AppContext);
  const currentTheme: ThemeColors =
    theme ||
    appContext?.currentTheme || {
      mode: "night_whisper",
      bg: "#111718",
      text: "#E2DFD2",
      accent: "#9FA365",
      secondary: "#7F8C8E",
      glass: "rgba(23, 31, 33, 0.94)",
      border: "rgba(226, 223, 210, 0.09)",
      shadow: "0 4px 30px rgba(0, 0, 0, 0.35), 0 1px 3px rgba(0, 0, 0, 0.5)",
      isDark: true,
    };

  const isRoyalClassic = currentTheme.mode === "royal_classic";
  const isAppleDark = currentTheme.mode === "apple_dark";

  // Palette mappings per theme ("أجواء الدار")
  const backdropBg = isRoyalClassic
    ? "rgba(18, 26, 27, 0.38)"
    : isAppleDark
    ? "rgba(0, 0, 0, 0.72)"
    : "rgba(5, 9, 10, 0.55)";

  const modalBg = isRoyalClassic
    ? "#F4F1E4"
    : isAppleDark
    ? "#1C1C1E"
    : "#111a1b";

  const modalBorder = isRoyalClassic
    ? "1px solid rgba(18, 26, 27, 0.12)"
    : isAppleDark
    ? "1px solid rgba(255, 255, 255, 0.10)"
    : "1px solid #263027";

  const modalShadow = isRoyalClassic
    ? "0 30px 70px rgba(18, 26, 27, 0.22), 0 10px 25px rgba(18, 26, 27, 0.08)"
    : isAppleDark
    ? "0 30px 70px rgba(0, 0, 0, 0.75)"
    : "0 30px 70px rgba(0, 0, 0, 0.55)";

  const closeBtnBg = isRoyalClassic
    ? "rgba(18, 26, 27, 0.05)"
    : isAppleDark
    ? "#2C2C2E"
    : "#131c1c";

  const closeBtnBorder = isRoyalClassic
    ? "1px solid rgba(18, 26, 27, 0.12)"
    : isAppleDark
    ? "1px solid rgba(255, 255, 255, 0.12)"
    : "1px solid #2a342d";

  const closeBtnColor = isRoyalClassic
    ? "#121A1B"
    : isAppleDark
    ? "#F5F5F5"
    : "#cfcab8";

  const titleColor = isRoyalClassic
    ? "#121A1B"
    : isAppleDark
    ? "#F5F5F5"
    : "#efe9d6";

  const subtitleColor = isRoyalClassic
    ? "#4A5556"
    : isAppleDark
    ? "#8E8E93"
    : "#9b9b93";

  const rowBg = isRoyalClassic
    ? "rgba(18, 26, 27, 0.04)"
    : isAppleDark
    ? "#2C2C2E"
    : "#161e1e";

  const rowBorder = isRoyalClassic
    ? "1px solid rgba(18, 26, 27, 0.09)"
    : isAppleDark
    ? "1px solid rgba(255, 255, 255, 0.08)"
    : "1px solid #2d3425";

  const iconStroke = isRoyalClassic
    ? currentTheme.accent || "#A7AA63"
    : isAppleDark
    ? "#F5F5F5"
    : "#8a9a5b";

  const labelColor = isRoyalClassic
    ? "#121A1B"
    : isAppleDark
    ? "#F5F5F5"
    : "#efe9d6";

  const numberColor = isRoyalClassic
    ? "#121A1B"
    : isAppleDark
    ? "#FFFFFF"
    : "#efe9d6";

  const dotColor = isRoyalClassic
    ? currentTheme.accent || "#A7AA63"
    : isAppleDark
    ? "#F5F5F5"
    : "#efe9d6";

  const unitColor = isRoyalClassic
    ? "#4A5556"
    : isAppleDark
    ? "#8E8E93"
    : "#9b9b93";

  const skeletonBg = isRoyalClassic
    ? "rgba(18, 26, 27, 0.08)"
    : isAppleDark
    ? "rgba(255, 255, 255, 0.12)"
    : "rgba(45, 52, 37, 0.4)";

  // Compute stats reactively from notes
  const stats = useMemo(() => {
    return calculateCreativityStats(notes);
  }, [notes]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        backgroundColor: backdropBg,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      dir="rtl"
    >
      <div
        className="stats-modal text-center animate-in zoom-in-95 duration-200"
        style={
          {
            "--u":
              "min(calc((100vw - 32px) / 390), calc((100dvh - 36px) / 616), 1.15px)",
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "calc(var(--u) * 390)",
            maxWidth: "calc(100vw - 32px)",
            height: "auto",
            boxSizing: "border-box",
            borderRadius: "calc(var(--u) * 45)",
            backgroundColor: modalBg,
            border: modalBorder,
            boxShadow: modalShadow,
            paddingTop: "calc(var(--u) * 33)",
            paddingBottom: "calc(var(--u) * 43)",
            paddingInline: "calc(var(--u) * 31)",
            direction: "rtl",
            userSelect: "none",
            WebkitUserSelect: "none",
            transition: "background-color 0.25s ease, border-color 0.25s ease",
          } as React.CSSProperties
        }
        onClick={(e) => e.stopPropagation()}
      >
        {/* Circular Close Button at top corner */}
        <button
          onClick={onClose}
          aria-label="إغلاق"
          type="button"
          style={{
            position: "absolute",
            top: "calc(var(--u) * 28)",
            left: "calc(var(--u) * 31)",
            insetInlineEnd: "calc(var(--u) * 31)",
            width: "calc(var(--u) * 41)",
            height: "calc(var(--u) * 41)",
            borderRadius: "50%",
            border: closeBtnBorder,
            backgroundColor: closeBtnBg,
            color: closeBtnColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            cursor: "pointer",
            zIndex: 10,
            opacity: 0.9,
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "1";
            e.currentTarget.style.transform = "scale(1.05)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "0.9";
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          <svg
            style={{
              width: "calc(var(--u) * 16)",
              height: "calc(var(--u) * 16)",
              display: "block",
            }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <path d="M5 5l14 14M19 5L5 19" />
          </svg>
        </button>

        {/* Header Section */}
        <div
          style={{
            width: "100%",
            textAlign: "center",
          }}
        >
          <h2
            style={{
              fontFamily: "'Thmanyah Serif Display', serif",
              fontSize: "calc(var(--u) * 25)",
              fontWeight: 700,
              lineHeight: "calc(var(--u) * 34)",
              color: titleColor,
              margin: 0,
              whiteSpace: "nowrap",
            }}
          >
            إحصائيات الإبداع
          </h2>
          <p
            style={{
              fontFamily: "'Thmanyah Sans', sans-serif",
              fontSize: "calc(var(--u) * 16)",
              fontWeight: 400,
              lineHeight: "calc(var(--u) * 24)",
              color: subtitleColor,
              marginTop: "calc(var(--u) * 3)",
              marginBottom: 0,
              whiteSpace: "nowrap",
            }}
          >
            ملخص أرقام ونبض قلمك في الدار
          </p>
        </div>

        {/* 6 Capsule Rows Stack */}
        <div
          className="stats-modal__rows"
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "calc(var(--u) * 15)",
            marginTop: "calc(var(--u) * 26)",
            boxSizing: "border-box",
          }}
        >
          {/* Row 1: إجمالي الكلمات */}
          <div
            className="stat-row"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flex: "0 0 auto",
              width: "100%",
              height: "calc(var(--u) * 62)",
              paddingInline: "calc(var(--u) * 22)",
              gap: "calc(var(--u) * 14)",
              borderRadius: "9999px",
              backgroundColor: rowBg,
              border: rowBorder,
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "calc(var(--u) * 14)",
                minWidth: 0,
              }}
            >
              <svg
                style={{
                  width: "calc(var(--u) * 23)",
                  height: "calc(var(--u) * 23)",
                  flexShrink: 0,
                  display: "block",
                }}
                viewBox="0 0 24 24"
                fill="none"
                stroke={iconStroke}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path
                  d="M12 3l7 3.5-1.5 6.5-5.5 5.5-5.5-5.5L4.5 6.5z"
                  transform="rotate(35 12 12) scale(0.8) translate(3 3)"
                />
                <circle cx="12" cy="11" r="1.4" transform="rotate(35 12 12)" />
                <path d="M4 21l4-4" />
              </svg>
              <span
                className="stat-row__label"
                style={{
                  fontFamily: "'Thmanyah Sans', sans-serif",
                  fontSize: "calc(var(--u) * 18)",
                  fontWeight: 700,
                  color: labelColor,
                  whiteSpace: "nowrap",
                }}
              >
                إجمالي الكلمات
              </span>
            </div>

            <div
              className="stat-row__value"
              style={{
                marginInlineStart: "auto",
                display: "flex",
                alignItems: "center",
                gap: "calc(var(--u) * 8)",
                whiteSpace: "nowrap",
                flex: "none",
                lineHeight: 1,
              }}
            >
              {isLoaded ? (
                <>
                  <span
                    className="stat-row__number"
                    style={{
                      fontFamily:
                        "'Thmanyah Sans', 'Thmanyah Serif Display', sans-serif",
                      fontSize: "calc(var(--u) * 18)",
                      fontWeight: 700,
                      color: numberColor,
                      whiteSpace: "nowrap",
                      direction: "ltr",
                      unicodeBidi: "isolate",
                      fontVariantNumeric: "tabular-nums",
                      WebkitFontFeatureSettings: '"tnum"',
                      fontFeatureSettings: '"tnum"',
                      lineHeight: 1,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {formatStatValue(stats.totalWords)}
                  </span>
                  <span
                    className="stat-row__dot"
                    style={{
                      display: "block",
                      flex: "none",
                      width: "calc(var(--u) * 5)",
                      height: "calc(var(--u) * 5)",
                      backgroundColor: dotColor,
                      transform: "rotate(45deg)",
                      alignSelf: "center",
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "'Thmanyah Sans', sans-serif",
                      fontSize: "calc(var(--u) * 15)",
                      fontWeight: 400,
                      color: unitColor,
                      whiteSpace: "nowrap",
                      lineHeight: 1,
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    كلمة
                  </span>
                </>
              ) : (
                <div
                  style={{
                    width: "calc(var(--u) * 60)",
                    height: "calc(var(--u) * 16)",
                    borderRadius: "calc(var(--u) * 8)",
                    backgroundColor: skeletonBg,
                  }}
                />
              )}
            </div>
          </div>

          {/* Row 2: عدد الحكايات */}
          <div
            className="stat-row"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flex: "0 0 auto",
              width: "100%",
              height: "calc(var(--u) * 62)",
              paddingInline: "calc(var(--u) * 22)",
              gap: "calc(var(--u) * 14)",
              borderRadius: "9999px",
              backgroundColor: rowBg,
              border: rowBorder,
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "calc(var(--u) * 14)",
                minWidth: 0,
              }}
            >
              <svg
                style={{
                  width: "calc(var(--u) * 23)",
                  height: "calc(var(--u) * 23)",
                  flexShrink: 0,
                  display: "block",
                }}
                viewBox="0 0 24 24"
                fill="none"
                stroke={iconStroke}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 6c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-13C17 4 14 4.5 12 6z" />
                <path d="M12 6v13" />
              </svg>
              <span
                className="stat-row__label"
                style={{
                  fontFamily: "'Thmanyah Sans', sans-serif",
                  fontSize: "calc(var(--u) * 18)",
                  fontWeight: 700,
                  color: labelColor,
                  whiteSpace: "nowrap",
                }}
              >
                عدد الحكايات
              </span>
            </div>

            <div
              className="stat-row__value"
              style={{
                marginInlineStart: "auto",
                display: "flex",
                alignItems: "center",
                gap: "calc(var(--u) * 8)",
                whiteSpace: "nowrap",
                flex: "none",
                lineHeight: 1,
              }}
            >
              {isLoaded ? (
                <>
                  <span
                    className="stat-row__number"
                    style={{
                      fontFamily:
                        "'Thmanyah Sans', 'Thmanyah Serif Display', sans-serif",
                      fontSize: "calc(var(--u) * 18)",
                      fontWeight: 700,
                      color: numberColor,
                      whiteSpace: "nowrap",
                      direction: "ltr",
                      unicodeBidi: "isolate",
                      fontVariantNumeric: "tabular-nums",
                      WebkitFontFeatureSettings: '"tnum"',
                      fontFeatureSettings: '"tnum"',
                      lineHeight: 1,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {formatStatValue(stats.totalStories)}
                  </span>
                  <span
                    className="stat-row__dot"
                    style={{
                      display: "block",
                      flex: "none",
                      width: "calc(var(--u) * 5)",
                      height: "calc(var(--u) * 5)",
                      backgroundColor: dotColor,
                      transform: "rotate(45deg)",
                      alignSelf: "center",
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "'Thmanyah Sans', sans-serif",
                      fontSize: "calc(var(--u) * 15)",
                      fontWeight: 400,
                      color: unitColor,
                      whiteSpace: "nowrap",
                      lineHeight: 1,
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    حكاية
                  </span>
                </>
              ) : (
                <div
                  style={{
                    width: "calc(var(--u) * 45)",
                    height: "calc(var(--u) * 16)",
                    borderRadius: "calc(var(--u) * 8)",
                    backgroundColor: skeletonBg,
                  }}
                />
              )}
            </div>
          </div>

          {/* Row 3: متوسط الكلمات */}
          <div
            className="stat-row"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flex: "0 0 auto",
              width: "100%",
              height: "calc(var(--u) * 62)",
              paddingInline: "calc(var(--u) * 22)",
              gap: "calc(var(--u) * 14)",
              borderRadius: "9999px",
              backgroundColor: rowBg,
              border: rowBorder,
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "calc(var(--u) * 14)",
                minWidth: 0,
              }}
            >
              <svg
                style={{
                  width: "calc(var(--u) * 23)",
                  height: "calc(var(--u) * 23)",
                  flexShrink: 0,
                  display: "block",
                }}
                viewBox="0 0 24 24"
                fill="none"
                stroke={iconStroke}
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <path d="M5 20V12M12 20V5M19 20V9" />
              </svg>
              <span
                className="stat-row__label"
                style={{
                  fontFamily: "'Thmanyah Sans', sans-serif",
                  fontSize: "calc(var(--u) * 18)",
                  fontWeight: 700,
                  color: labelColor,
                  whiteSpace: "nowrap",
                }}
              >
                متوسط الكلمات
              </span>
            </div>

            <div
              className="stat-row__value"
              style={{
                marginInlineStart: "auto",
                display: "flex",
                alignItems: "center",
                gap: "calc(var(--u) * 8)",
                whiteSpace: "nowrap",
                flex: "none",
                lineHeight: 1,
              }}
            >
              {isLoaded ? (
                <>
                  <span
                    className="stat-row__number"
                    style={{
                      fontFamily:
                        "'Thmanyah Sans', 'Thmanyah Serif Display', sans-serif",
                      fontSize: "calc(var(--u) * 18)",
                      fontWeight: 700,
                      color: numberColor,
                      whiteSpace: "nowrap",
                      direction: "ltr",
                      unicodeBidi: "isolate",
                      fontVariantNumeric: "tabular-nums",
                      WebkitFontFeatureSettings: '"tnum"',
                      fontFeatureSettings: '"tnum"',
                      lineHeight: 1,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {formatStatValue(stats.averageWords)}
                  </span>
                  <span
                    className="stat-row__dot"
                    style={{
                      display: "block",
                      flex: "none",
                      width: "calc(var(--u) * 5)",
                      height: "calc(var(--u) * 5)",
                      backgroundColor: dotColor,
                      transform: "rotate(45deg)",
                      alignSelf: "center",
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "'Thmanyah Sans', sans-serif",
                      fontSize: "calc(var(--u) * 15)",
                      fontWeight: 400,
                      color: unitColor,
                      whiteSpace: "nowrap",
                      lineHeight: 1,
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    كلمة
                  </span>
                </>
              ) : (
                <div
                  style={{
                    width: "calc(var(--u) * 60)",
                    height: "calc(var(--u) * 16)",
                    borderRadius: "calc(var(--u) * 8)",
                    backgroundColor: skeletonBg,
                  }}
                />
              )}
            </div>
          </div>

          {/* Row 4: نشاط الأسبوع */}
          <div
            className="stat-row"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flex: "0 0 auto",
              width: "100%",
              height: "calc(var(--u) * 62)",
              paddingInline: "calc(var(--u) * 22)",
              gap: "calc(var(--u) * 14)",
              borderRadius: "9999px",
              backgroundColor: rowBg,
              border: rowBorder,
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "calc(var(--u) * 14)",
                minWidth: 0,
              }}
            >
              <svg
                style={{
                  width: "calc(var(--u) * 23)",
                  height: "calc(var(--u) * 23)",
                  flexShrink: 0,
                  display: "block",
                }}
                viewBox="0 0 24 24"
                fill="none"
                stroke={iconStroke}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
                <path d="M8 3v4M16 3v4M3.5 10h17" />
                <path d="M8 16l3-3 2 2 3-3" />
              </svg>
              <span
                className="stat-row__label"
                style={{
                  fontFamily: "'Thmanyah Sans', sans-serif",
                  fontSize: "calc(var(--u) * 18)",
                  fontWeight: 700,
                  color: labelColor,
                  whiteSpace: "nowrap",
                }}
              >
                نشاط الأسبوع
              </span>
            </div>

            <div
              className="stat-row__value"
              style={{
                marginInlineStart: "auto",
                display: "flex",
                alignItems: "center",
                gap: "calc(var(--u) * 8)",
                whiteSpace: "nowrap",
                flex: "none",
                lineHeight: 1,
              }}
            >
              {isLoaded ? (
                <>
                  <span
                    className="stat-row__number"
                    style={{
                      fontFamily:
                        "'Thmanyah Sans', 'Thmanyah Serif Display', sans-serif",
                      fontSize: "calc(var(--u) * 18)",
                      fontWeight: 700,
                      color: numberColor,
                      whiteSpace: "nowrap",
                      direction: "ltr",
                      unicodeBidi: "isolate",
                      fontVariantNumeric: "tabular-nums",
                      WebkitFontFeatureSettings: '"tnum"',
                      fontFeatureSettings: '"tnum"',
                      lineHeight: 1,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {formatStatValue(stats.weeklyActivity)}
                  </span>
                  <span
                    className="stat-row__dot"
                    style={{
                      display: "block",
                      flex: "none",
                      width: "calc(var(--u) * 5)",
                      height: "calc(var(--u) * 5)",
                      backgroundColor: dotColor,
                      transform: "rotate(45deg)",
                      alignSelf: "center",
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "'Thmanyah Sans', sans-serif",
                      fontSize: "calc(var(--u) * 15)",
                      fontWeight: 400,
                      color: unitColor,
                      whiteSpace: "nowrap",
                      lineHeight: 1,
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    كلمة
                  </span>
                </>
              ) : (
                <div
                  style={{
                    width: "calc(var(--u) * 60)",
                    height: "calc(var(--u) * 16)",
                    borderRadius: "calc(var(--u) * 8)",
                    backgroundColor: skeletonBg,
                  }}
                />
              )}
            </div>
          </div>

          {/* Row 5: سلسلة الكتابة */}
          <div
            className="stat-row"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flex: "0 0 auto",
              width: "100%",
              height: "calc(var(--u) * 62)",
              paddingInline: "calc(var(--u) * 22)",
              gap: "calc(var(--u) * 14)",
              borderRadius: "9999px",
              backgroundColor: rowBg,
              border: rowBorder,
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "calc(var(--u) * 14)",
                minWidth: 0,
              }}
            >
              <svg
                style={{
                  width: "calc(var(--u) * 23)",
                  height: "calc(var(--u) * 23)",
                  flexShrink: 0,
                  display: "block",
                }}
                viewBox="0 0 24 24"
                fill="none"
                stroke={iconStroke}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .3 1.2 1 2 2 2 0-3-.5-5 1-8z" />
              </svg>
              <span
                className="stat-row__label"
                style={{
                  fontFamily: "'Thmanyah Sans', sans-serif",
                  fontSize: "calc(var(--u) * 18)",
                  fontWeight: 700,
                  color: labelColor,
                  whiteSpace: "nowrap",
                }}
              >
                سلسلة الكتابة
              </span>
            </div>

            <div
              className="stat-row__value"
              style={{
                marginInlineStart: "auto",
                display: "flex",
                alignItems: "center",
                gap: "calc(var(--u) * 8)",
                whiteSpace: "nowrap",
                flex: "none",
                lineHeight: 1,
              }}
            >
              {isLoaded ? (
                <>
                  <span
                    className="stat-row__number"
                    style={{
                      fontFamily:
                        "'Thmanyah Sans', 'Thmanyah Serif Display', sans-serif",
                      fontSize: "calc(var(--u) * 18)",
                      fontWeight: 700,
                      color: numberColor,
                      whiteSpace: "nowrap",
                      direction: "ltr",
                      unicodeBidi: "isolate",
                      fontVariantNumeric: "tabular-nums",
                      WebkitFontFeatureSettings: '"tnum"',
                      fontFeatureSettings: '"tnum"',
                      lineHeight: 1,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {formatStatValue(stats.writingStreak)}
                  </span>
                  <span
                    className="stat-row__dot"
                    style={{
                      display: "block",
                      flex: "none",
                      width: "calc(var(--u) * 5)",
                      height: "calc(var(--u) * 5)",
                      backgroundColor: dotColor,
                      transform: "rotate(45deg)",
                      alignSelf: "center",
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "'Thmanyah Sans', sans-serif",
                      fontSize: "calc(var(--u) * 15)",
                      fontWeight: 400,
                      color: unitColor,
                      whiteSpace: "nowrap",
                      lineHeight: 1,
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    أيام
                  </span>
                </>
              ) : (
                <div
                  style={{
                    width: "calc(var(--u) * 45)",
                    height: "calc(var(--u) * 16)",
                    borderRadius: "calc(var(--u) * 8)",
                    backgroundColor: skeletonBg,
                  }}
                />
              )}
            </div>
          </div>

          {/* Row 6: المكتملة */}
          <div
            className="stat-row"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flex: "0 0 auto",
              width: "100%",
              height: "calc(var(--u) * 62)",
              paddingInline: "calc(var(--u) * 22)",
              gap: "calc(var(--u) * 14)",
              borderRadius: "9999px",
              backgroundColor: rowBg,
              border: rowBorder,
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "calc(var(--u) * 14)",
                minWidth: 0,
              }}
            >
              <svg
                style={{
                  width: "calc(var(--u) * 23)",
                  height: "calc(var(--u) * 23)",
                  flexShrink: 0,
                  display: "block",
                }}
                viewBox="0 0 24 24"
                fill="none"
                stroke={iconStroke}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 6c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-13C17 4 14 4.5 12 6z" />
                <path d="M9 11.5l2 2 4-4" />
              </svg>
              <span
                className="stat-row__label"
                style={{
                  fontFamily: "'Thmanyah Sans', sans-serif",
                  fontSize: "calc(var(--u) * 18)",
                  fontWeight: 700,
                  color: labelColor,
                  whiteSpace: "nowrap",
                }}
              >
                المكتملة
              </span>
            </div>

            <div
              className="stat-row__value"
              style={{
                marginInlineStart: "auto",
                display: "flex",
                alignItems: "center",
                gap: "calc(var(--u) * 8)",
                whiteSpace: "nowrap",
                flex: "none",
                lineHeight: 1,
              }}
            >
              {isLoaded ? (
                <>
                  <span
                    className="stat-row__number"
                    style={{
                      fontFamily:
                        "'Thmanyah Sans', 'Thmanyah Serif Display', sans-serif",
                      fontSize: "calc(var(--u) * 18)",
                      fontWeight: 700,
                      color: numberColor,
                      whiteSpace: "nowrap",
                      direction: "ltr",
                      unicodeBidi: "isolate",
                      fontVariantNumeric: "tabular-nums",
                      WebkitFontFeatureSettings: '"tnum"',
                      fontFeatureSettings: '"tnum"',
                      lineHeight: 1,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {formatStatValue(stats.completedStories)}
                  </span>
                  <span
                    className="stat-row__dot"
                    style={{
                      display: "block",
                      flex: "none",
                      width: "calc(var(--u) * 5)",
                      height: "calc(var(--u) * 5)",
                      backgroundColor: dotColor,
                      transform: "rotate(45deg)",
                      alignSelf: "center",
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "'Thmanyah Sans', sans-serif",
                      fontSize: "calc(var(--u) * 15)",
                      fontWeight: 400,
                      color: unitColor,
                      whiteSpace: "nowrap",
                      lineHeight: 1,
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    حكايات
                  </span>
                </>
              ) : (
                <div
                  style={{
                    width: "calc(var(--u) * 45)",
                    height: "calc(var(--u) * 16)",
                    borderRadius: "calc(var(--u) * 8)",
                    backgroundColor: skeletonBg,
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
