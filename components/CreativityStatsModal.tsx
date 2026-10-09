import React, { useMemo } from "react";
import { Note } from "../contexts/AppContext";
import {
  calculateCreativityStats,
  formatStatValue,
} from "../lib/creativity-stats";

export interface CreativityStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
  isLoaded?: boolean;
}

export const CreativityStatsModal: React.FC<CreativityStatsModalProps> = ({
  isOpen,
  onClose,
  notes,
  isLoaded = true,
}) => {
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
        backgroundColor: "rgba(5, 9, 10, 0.55)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
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
            backgroundColor: "#111a1b",
            border: "1px solid #263027",
            boxShadow: "0 30px 70px rgba(0, 0, 0, 0.55)",
            paddingTop: "calc(var(--u) * 33)",
            paddingBottom: "calc(var(--u) * 43)",
            paddingInline: "calc(var(--u) * 31)",
            direction: "rtl",
            userSelect: "none",
            WebkitUserSelect: "none",
          } as React.CSSProperties
        }
        onClick={(e) => e.stopPropagation()}
      >
        {/* Circular Close Button at top corner (opposite to reading direction: top-left in RTL) */}
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
            border: "1px solid #2a342d",
            backgroundColor: "#131c1c",
            color: "#cfcab8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            cursor: "pointer",
            zIndex: 10,
            opacity: 0.85,
            transition: "opacity 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "1";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "0.85";
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
              color: "#efe9d6",
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
              color: "#9b9b93",
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
              backgroundColor: "#161e1e",
              border: "1px solid #2d3425",
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
                stroke="#8a9a5b"
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
                  color: "#efe9d6",
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
              }}
            >
              {isLoaded ? (
                <>
                  <span
                    className="stat-row__number"
                    style={{
                      fontFamily: "'Thmanyah Sans', sans-serif",
                      fontSize: "calc(var(--u) * 18)",
                      fontWeight: 700,
                      color: "#efe9d6",
                      whiteSpace: "nowrap",
                      unicodeBidi: "isolate",
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
                      backgroundColor: "#efe9d6",
                      transform: "rotate(45deg)",
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "'Thmanyah Sans', sans-serif",
                      fontSize: "calc(var(--u) * 15)",
                      fontWeight: 400,
                      color: "#9b9b93",
                      whiteSpace: "nowrap",
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
                    backgroundColor: "rgba(45, 52, 37, 0.4)",
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
              backgroundColor: "#161e1e",
              border: "1px solid #2d3425",
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
                stroke="#8a9a5b"
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
                  color: "#efe9d6",
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
              }}
            >
              {isLoaded ? (
                <>
                  <span
                    className="stat-row__number"
                    style={{
                      fontFamily: "'Thmanyah Sans', sans-serif",
                      fontSize: "calc(var(--u) * 18)",
                      fontWeight: 700,
                      color: "#efe9d6",
                      whiteSpace: "nowrap",
                      unicodeBidi: "isolate",
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
                      backgroundColor: "#efe9d6",
                      transform: "rotate(45deg)",
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "'Thmanyah Sans', sans-serif",
                      fontSize: "calc(var(--u) * 15)",
                      fontWeight: 400,
                      color: "#9b9b93",
                      whiteSpace: "nowrap",
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
                    backgroundColor: "rgba(45, 52, 37, 0.4)",
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
              backgroundColor: "#161e1e",
              border: "1px solid #2d3425",
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
                stroke="#8a9a5b"
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
                  color: "#efe9d6",
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
              }}
            >
              {isLoaded ? (
                <>
                  <span
                    className="stat-row__number"
                    style={{
                      fontFamily: "'Thmanyah Sans', sans-serif",
                      fontSize: "calc(var(--u) * 18)",
                      fontWeight: 700,
                      color: "#efe9d6",
                      whiteSpace: "nowrap",
                      unicodeBidi: "isolate",
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
                      backgroundColor: "#efe9d6",
                      transform: "rotate(45deg)",
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "'Thmanyah Sans', sans-serif",
                      fontSize: "calc(var(--u) * 15)",
                      fontWeight: 400,
                      color: "#9b9b93",
                      whiteSpace: "nowrap",
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
                    backgroundColor: "rgba(45, 52, 37, 0.4)",
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
              backgroundColor: "#161e1e",
              border: "1px solid #2d3425",
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
                stroke="#8a9a5b"
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
                  color: "#efe9d6",
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
              }}
            >
              {isLoaded ? (
                <>
                  <span
                    className="stat-row__number"
                    style={{
                      fontFamily: "'Thmanyah Sans', sans-serif",
                      fontSize: "calc(var(--u) * 18)",
                      fontWeight: 700,
                      color: "#efe9d6",
                      whiteSpace: "nowrap",
                      unicodeBidi: "isolate",
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
                      backgroundColor: "#efe9d6",
                      transform: "rotate(45deg)",
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "'Thmanyah Sans', sans-serif",
                      fontSize: "calc(var(--u) * 15)",
                      fontWeight: 400,
                      color: "#9b9b93",
                      whiteSpace: "nowrap",
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
                    backgroundColor: "rgba(45, 52, 37, 0.4)",
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
              backgroundColor: "#161e1e",
              border: "1px solid #2d3425",
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
                stroke="#8a9a5b"
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
                  color: "#efe9d6",
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
              }}
            >
              {isLoaded ? (
                <>
                  <span
                    className="stat-row__number"
                    style={{
                      fontFamily: "'Thmanyah Sans', sans-serif",
                      fontSize: "calc(var(--u) * 18)",
                      fontWeight: 700,
                      color: "#efe9d6",
                      whiteSpace: "nowrap",
                      unicodeBidi: "isolate",
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
                      backgroundColor: "#efe9d6",
                      transform: "rotate(45deg)",
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "'Thmanyah Sans', sans-serif",
                      fontSize: "calc(var(--u) * 15)",
                      fontWeight: 400,
                      color: "#9b9b93",
                      whiteSpace: "nowrap",
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
                    backgroundColor: "rgba(45, 52, 37, 0.4)",
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
              backgroundColor: "#161e1e",
              border: "1px solid #2d3425",
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
                stroke="#8a9a5b"
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
                  color: "#efe9d6",
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
              }}
            >
              {isLoaded ? (
                <>
                  <span
                    className="stat-row__number"
                    style={{
                      fontFamily: "'Thmanyah Sans', sans-serif",
                      fontSize: "calc(var(--u) * 18)",
                      fontWeight: 700,
                      color: "#efe9d6",
                      whiteSpace: "nowrap",
                      unicodeBidi: "isolate",
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
                      backgroundColor: "#efe9d6",
                      transform: "rotate(45deg)",
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "'Thmanyah Sans', sans-serif",
                      fontSize: "calc(var(--u) * 15)",
                      fontWeight: 400,
                      color: "#9b9b93",
                      whiteSpace: "nowrap",
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
                    backgroundColor: "rgba(45, 52, 37, 0.4)",
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
