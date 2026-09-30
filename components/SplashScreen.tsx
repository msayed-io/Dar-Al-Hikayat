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

  const glassBg = currentTheme.mode === "apple_dark"
    ? "rgba(28, 28, 30, 0.92)"
    : isDark
    ? "rgba(23, 31, 33, 0.92)"
    : "rgba(255, 255, 255, 0.85)";

  const glassBorder = currentTheme.mode === "apple_dark"
    ? "rgba(255, 255, 255, 0.12)"
    : `${currentTheme.accent}40`;

  const glassShadow = isDark
    ? "0 16px 40px -10px rgba(0, 0, 0, 0.6)"
    : "0 16px 40px -10px rgba(167, 170, 99, 0.25)";

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
        .font-zain-reg   { font-family: 'Zain', sans-serif; font-weight: 400; }
        .font-zain-bold  { font-family: 'Zain', sans-serif; font-weight: 700; }
        .font-zain-xbold { font-family: 'Zain', sans-serif; font-weight: 900; }

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
      <div className="relative mb-6 p-1 animate-smooth-pop">
        <div
          className="relative w-28 h-28 rounded-3xl flex items-center justify-center border shadow-xl overflow-hidden"
          style={{
            background: glassBg,
            borderColor: glassBorder,
            boxShadow: glassShadow,
          }}
        >
          {/* Icon */}
          <img
            src={logoSrc}
            alt="شعار الترحيب"
            className="w-20 h-20 object-contain relative z-20 drop-shadow-md"
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
      <div className="text-center animate-text-fade flex flex-col items-center">
        {/* Title */}
        <h1
          className="text-4xl font-zain-xbold tracking-wide mb-2 drop-shadow-sm"
          style={{ color: titleColor }}
        >
          دَارُ الحِكَايَاتِ
        </h1>

        <div
          className="h-px w-16 mb-2"
          style={{ backgroundColor: `${currentTheme.accent}40` }}
        />

        {/* Subtitle */}
        <p
          className="text-base font-zain-reg tracking-[0.1em]"
          style={{ color: subtitleColor }}
        >
          للكاتبة رحمه السيد موافي
        </p>
      </div>
    </div>
  );
};

export default SplashScreen;
