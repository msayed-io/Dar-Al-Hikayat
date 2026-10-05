import React, { useEffect, useState } from "react";
import { Feather } from "lucide-react";
import { useApp } from "../contexts/AppContext";
import { logoTransparentAsset } from "../lib/logo-assets";

interface SplashScreenProps {
  onFinish: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const { currentTheme } = useApp();
  const [shouldUnmount, setShouldUnmount] = useState(false);

  useEffect(() => {
    // Fast, responsive, buttery-smooth timing
    const exitTimer = setTimeout(() => {
      setShouldUnmount(true);
    }, 1400);

    const finishTimer = setTimeout(() => {
      onFinish();
    }, 1900);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  const isDark = currentTheme.isDark;
  const logoSrc = logoTransparentAsset(currentTheme.mode);
  const titleColor = currentTheme.mode === "apple_dark" ? "#F5F5F5" : currentTheme.accent;
  const subtitleColor = currentTheme.mode === "apple_dark"
    ? "#A1A1A6"
    : (isDark ? "#E2DFD2" : "#2C3E30");

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden transition-opacity duration-500 ease-out
        ${shouldUnmount ? "opacity-0 pointer-events-none" : "opacity-100"}
      `}
      dir="rtl"
      style={{
        backgroundColor: currentTheme.bg,
      }}
    >
      <style>{`
        @keyframes smooth-pop {
          0% {
            opacity: 0;
            transform: scale(0.85) translateY(10px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes text-fade {
          0% {
            opacity: 0;
            transform: translateY(8px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-smooth-pop {
          animation: smooth-pop 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          will-change: transform, opacity;
        }

        .animate-text-fade {
          animation: text-fade 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.15s forwards;
          opacity: 0;
          will-change: transform, opacity;
        }
      `}</style>

      {/* --- Main Logo Container --- */}
      <div className="relative animate-smooth-pop"
        style={{ marginBottom: 16 }}>
        <div
          className="relative flex items-center justify-center"
          style={{
            width: 64,
            height: 64,
            background: "transparent",
            borderColor: "transparent",
            boxShadow: "none",
          }}
        >
          {/* Icon */}
          <img
            src={logoSrc}
            alt="شعار الترحيب"
            className="object-contain relative z-20 drop-shadow-md"
            style={{ width: 64, height: 64 }}
            onError={(e) => {
              e.currentTarget.style.display = "none";
              e.currentTarget.nextElementSibling?.removeAttribute("style");
            }}
          />
          <Feather
            className="w-14 h-14 drop-shadow-md relative z-20 hidden"
            strokeWidth={1.2}
            style={{ color: currentTheme.accent, display: "none" }}
          />
        </div>
      </div>

      {/* --- Text Container --- */}
      <div className="text-center animate-text-fade flex flex-col items-center"
        style={{ maxWidth: "100%", paddingInline: 24, boxSizing: "border-box" }}>
        {/* Title */}
        <h1
          className="drop-shadow-sm"
          style={{
            color: titleColor,
            fontFamily: "'Thmanyah Serif Display', 'Thmanyah Sans', serif",
            fontWeight: 900,
            fontSize: "clamp(32px, 5vw, 36px)",
            lineHeight: 1.4,
            letterSpacing: "normal",
            margin: "0 0 8px",
          }}
        >
          دَارُ الحِكَايَاتِ
        </h1>

        <div
          className="h-px w-16 mb-2"
          style={{ backgroundColor: `${currentTheme.accent}40` }}
        />

        {/* Subtitle */}
        <p
          className="dar-splash-byline"
          style={{
            color: subtitleColor,
            fontFamily: "'Thmanyah Serif Text', 'Thmanyah Sans', serif",
            fontWeight: 500,
            fontSize: 14,
            lineHeight: 1.7,
            letterSpacing: "normal",
            margin: 0,
          }}
        >
          للكاتبة رحمه السيد موافي
        </p>
      </div>
    </div>
  );
};

export default SplashScreen;
