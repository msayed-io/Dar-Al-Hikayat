import React, { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Smartphone, X, Wifi } from "lucide-react";
import "./RemoteKeyboardModal.css";
import {
  getDeviceLocalIp,
  NetworkIpResult
} from "../lib/remote-keyboard-service";

interface RemoteKeyboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  isConnected: boolean;
  onDisconnect?: () => void;
  sessionPin: string;
  currentTheme: any;
}

export const RemoteKeyboardModal: React.FC<RemoteKeyboardModalProps> = ({
  isOpen,
  onClose,
  isConnected,
  onDisconnect,
  sessionPin,
  currentTheme,
}) => {
  const [networkInfo, setNetworkInfo] = useState<NetworkIpResult | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    getDeviceLocalIp().then((info) => {
      setNetworkInfo(info);
    });
  }, [isOpen]);

  if (!isOpen) return null;

  // ONE official path only: the native "كيبورد الحكايات" app scans this QR.
  // The browser route is no longer offered as a pairing path (by design).
  const pairingUrl = networkInfo?.primaryIp
    ? `${networkInfo.connectionUrl}?pin=${sessionPin}`
    : null;

  const isDark = currentTheme?.isDark ?? true;
  const themeBg = currentTheme?.bg || (isDark ? "#121A1B" : "#EAE6D2");
  const themeBorder = currentTheme?.border || (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)");
  const themeText = currentTheme?.text || (isDark ? "#F4F1EA" : "#121A1B");
  const themeSecondary = currentTheme?.secondary || (isDark ? "#8E9899" : "#666666");
  const themeAccent = currentTheme?.accent || "#D97706";

  return (
    <div
      dir="rtl"
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200`}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="remote-keyboard-modal-title"
        className={isConnected
          ? "remote-pairing-dialog remote-pairing-connected-dialog border shadow-2xl text-center animate-in zoom-in-95 duration-200"
          : "remote-pairing-dialog remote-pairing-waiting-dialog w-full max-w-sm border shadow-2xl relative flex flex-col text-center animate-in zoom-in-95 duration-200"}
        style={{
          backgroundColor: themeBg,
          borderColor: themeBorder,
          color: themeText,
            width: isConnected ? "260px" : "384px",
            maxWidth: "calc(100vw - 32px)",
            borderRadius: "28px",
            padding: "24px 20px",
            boxShadow: `0 20px 45px -10px ${currentTheme?.shadow || "rgba(0,0,0,0.3)"}`,

        }}
        onClick={(e) => e.stopPropagation()}
      >
        {!isConnected && <>
        <div className="remote-pairing-waiting-icon">
          <Smartphone size={28} style={{ color: themeAccent }} strokeWidth={2} aria-hidden="true" />
        </div>
        <div className="remote-pairing-header">
          <div className="remote-pairing-heading">
            <h3 id="remote-keyboard-modal-title" className="remote-pairing-title">
              ربط الكيبورد اللاسلكي
            </h3>
          </div>
          <span className="remote-pairing-status" role="status" style={{
            backgroundColor: `${themeAccent}15`,
            color: themeText,
          }}>
            في انتظار الاتصال
          </span>
          <button type="button" onClick={onClose} aria-label="إغلاق نافذة الاقتران"
            className="remote-pairing-close" style={{ color: themeSecondary }}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        </>}

        {/* Content Body - Conditional on Connection State */}
        {isConnected ? (
          <>
            <div className="flex justify-center mb-3">
              <Smartphone className="w-7 h-7" style={{ color: themeAccent }} strokeWidth={2} aria-hidden="true" />
            </div>
            <h2 id="remote-keyboard-modal-title" role="status"
              className="text-base font-zain-xbold mb-1 leading-tight text-center">
              الكيبورد متصل
            </h2>
            <p className="remote-pairing-ready text-xs font-zain-reg mb-4 opacity-70 leading-relaxed text-center px-1">
              الهاتف جاهز للكتابة.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button type="button" onClick={() => onDisconnect?.()}
                className="remote-pairing-disconnect font-zain-bold text-xs shadow-sm active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                style={{ height: "34px", padding: "0 22px", borderRadius: "9999px", backgroundColor: themeAccent, color: themeBg, whiteSpace: "nowrap" }}>
                قطع الاتصال
              </button>
              <button type="button" onClick={onClose} aria-label="إغلاق نافذة الاقتران"
                className="remote-pairing-close-action font-zain-bold text-xs active:scale-95 transition-all cursor-pointer opacity-70 hover:opacity-100 flex items-center justify-center"
                style={{ height: "34px", padding: "0 16px", borderRadius: "9999px", color: themeSecondary, whiteSpace: "nowrap" }}>
                إغلاق
              </button>
            </div>
          </>
        ) : (
          /* PAIRING / QR CODE VIEW */
          <>
            <div className="remote-pairing-body flex items-center gap-3.5 py-0.5">
              {/* QR Code Container */}
              <div
                className="shrink-0 p-2 bg-white rounded-2xl shadow-sm border flex items-center justify-center overflow-hidden bg-clip-padding transition-all"
                style={{
                  borderColor: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)",
                }}
              >
                {pairingUrl ? (
                  <QRCodeSVG
                    value={pairingUrl}
                    size={102}
                    level="M"
                    includeMargin={true}
                    fgColor="#0F172A"
                    bgColor="#FFFFFF"
                  />
                ) : (
                  <div className="w-[134px] h-[134px] flex flex-col items-center justify-center gap-2 text-center px-2">
                    <Wifi className="w-5 h-5 opacity-60" style={{ color: themeAccent }} />
                    <span className="text-[10px] font-zain-reg" style={{ color: themeSecondary }}>
                      جارٍ تشغيل السيرفر المحلي…
                    </span>
                  </div>
                )}
              </div>

              {/* Single official path: the native كيبورد الحكايات app scans this code */}
              <div className="flex-1 flex flex-col justify-center gap-2 min-w-0">
                <span className="font-zain-reg text-xs leading-relaxed" style={{ color: themeSecondary }}>
                  ١. افتحي تطبيق «كيبورد الحكايات» على الهاتف
                </span>
                <span className="font-zain-reg text-xs leading-relaxed" style={{ color: themeSecondary }}>
                  ٢. امسحي الرمز بكاميرا التطبيق للاقتران
                </span>

              </div>
            </div>

          </>
        )}
      </div>
    </div>
  );
};

export default RemoteKeyboardModal;
