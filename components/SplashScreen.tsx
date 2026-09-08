import React, { useEffect, useState } from "react";
import { Feather } from "lucide-react";

interface SplashScreenProps {
  onFinish: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [isMounted, setIsMounted] = useState(false);
  const [shouldUnmount, setShouldUnmount] = useState(false);

  useEffect(() => {
    // Trigger the entrance animations immediately after mount
    const mountTimer = setTimeout(() => setIsMounted(true), 50);

    // Sequence:
    // 0s: Start
    // 1.5s: Background transition completes
    // 2.2s: Begin exit sequence (fade out)
    // 2.8s: Remove component

    const exitTimer = setTimeout(() => {
      setShouldUnmount(true);
    }, 2200);

    const finishTimer = setTimeout(() => {
      onFinish();
    }, 2800);

    return () => {
      clearTimeout(mountTimer);
      clearTimeout(exitTimer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden transition-all duration-[1500ms] ease-in-out
        ${shouldUnmount ? "opacity-0 pointer-events-none" : "opacity-100"}
      `}
      dir="rtl"
      style={{
        backgroundColor: isMounted ? "#F4F1EA" : "#0F1617", // Transition from Deep Olive to Porcelain
      }}
    >
      <style>{`
        /* Explicitly define fonts here to match the rest of the app exactly */
        .font-zain-light { font-family: 'Zain', sans-serif; font-weight: 200; }
        .font-zain-reg   { font-family: 'Zain', sans-serif; font-weight: 400; }
        .font-zain-bold  { font-family: 'Zain', sans-serif; font-weight: 700; }
        .font-zain-xbold { font-family: 'Zain', sans-serif; font-weight: 900; }

        @keyframes entrance-3d {
          0% {
            opacity: 0;
            transform: perspective(1000px) rotateX(40deg) rotateY(-20deg) scale(0.5) translateZ(-100px);
          }
          100% {
            opacity: 1;
            transform: perspective(1000px) rotateX(0) rotateY(0) scale(1) translateZ(0);
          }
        }

        @keyframes shimmer-gold {
          0% { transform: translateX(-150%) skewX(-20deg); }
          50% { transform: translateX(150%) skewX(-20deg); }
          100% { transform: translateX(150%) skewX(-20deg); }
        }

        @keyframes blur-reveal {
          0% {
            opacity: 0;
            filter: blur(12px);
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            filter: blur(0);
            transform: translateY(0);
          }
        }

        .animate-entrance-3d {
          animation: entrance-3d 1.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        .animate-shimmer {
          animation: shimmer-gold 2.5s ease-in-out infinite;
        }

        .animate-blur-reveal {
          animation: blur-reveal 1.2s ease-out forwards;
          animation-delay: 0.4s; 
          opacity: 0; /* Start hidden */
        }
      `}</style>

      {/* --- Main Logo Container --- */}
      <div className="relative mb-8 p-1">
        {/* The Glass Box */}
        <div
          className={`
            relative w-28 h-28 rounded-3xl flex items-center justify-center
            backdrop-blur-xl border border-[#A7AA63]/40 shadow-2xl
            overflow-hidden animate-entrance-3d group
            transition-all duration-1000
          `}
          style={{
            background: isMounted
              ? "linear-gradient(135deg, rgba(255,255,255,0.4), rgba(255,255,255,0.1))"
              : "linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))",
            boxShadow: isMounted
              ? "0 20px 50px -12px rgba(167, 170, 99, 0.25)"
              : "0 20px 50px -12px rgba(0,0,0,0.5)",
          }}
        >
          {/* Shimmer Effect Layer */}
          <div className="absolute inset-0 z-10 opacity-40 animate-shimmer pointer-events-none bg-gradient-to-r from-transparent via-[#A7AA63]/50 to-transparent w-full h-full" />

          {/* Icon */}
          <img
            src={isMounted ? "/logo-light-bg.png" : "/logo-dark-bg.png"}
            alt="شعار الترحيب"
            className="w-24 h-24 md:w-24 md:h-24 object-contain relative z-20 transition-all duration-1000 drop-shadow-md"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              e.currentTarget.nextElementSibling?.removeAttribute("style");
            }}
          />
          <Feather
            className="w-16 h-16 drop-shadow-md relative z-20 transition-colors duration-1000 hidden"
            strokeWidth={1.2}
            style={{ color: "#A7AA63", display: "none" }}
          />

          {/* Internal Glow */}
          <div className="absolute inset-0 rounded-3xl opacity-30 bg-[#A7AA63]/10 mix-blend-overlay"></div>
        </div>
      </div>

      {/* --- Text Container --- */}
      <div className="text-center animate-blur-reveal flex flex-col items-center">
        {/* Title matches the Header style perfectly now */}
        <h1
          className="text-5xl font-zain-xbold tracking-wide mb-3 transition-colors duration-1000 drop-shadow-sm"
          style={{ color: "#A7AA63" }}
        >
          دَارُ الحِكَايَاتِ
        </h1>

        <div className="h-px w-16 bg-[#A7AA63]/40 mb-3"></div>

        {/* Subtitle with better contrast and matching font */}
        <p
          className="text-lg font-zain-reg tracking-[0.1em] transition-colors duration-1000"
          style={{
            // Dark Olive in light mode (very visible), Cream in dark mode (very visible)
            color: isMounted ? "#2C3E30" : "#EAE6D2",
          }}
        >
          للكاتبة رحمه السيد موافي
        </p>
      </div>
    </div>
  );
};

export default SplashScreen;
