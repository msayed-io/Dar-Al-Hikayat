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
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="remote-keyboard-modal-title"
        className="remote-pairing-dialog w-full max-w-sm rounded-[24px] p-4 border shadow-2xl relative flex flex-col gap-3.5 overflow-hidden transition-all"
        style={{
          backgroundColor: themeBg,
          borderColor: themeBorder,
          color: themeText,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="remote-pairing-header" style={{ borderColor: themeBorder }}>
          <div className="remote-pairing-heading">
            <div className="remote-pairing-phone" style={{ backgroundColor: `${themeAccent}18`, color: themeAccent }}>
              <Smartphone size={16} aria-hidden="true" />
            </div>
            <h3 id="remote-keyboard-modal-title" className="remote-pairing-title">
              ربط الكيبورد اللاسلكي
            </h3>
          </div>
          <span className="remote-pairing-status" role="status" style={{
            backgroundColor: isConnected ? "rgba(16,185,129,0.12)" : `${themeAccent}15`,
            color: isConnected ? (isDark ? "#6EE7B7" : "#047857") : themeText,
          }}>
            {isConnected ? "متصل" : "في انتظار الاتصال"}
          </span>
          <button type="button" onClick={onClose} aria-label="إغلاق نافذة الاقتران"
            className="remote-pairing-close" style={{ color: themeSecondary }}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Content Body - Conditional on Connection State */}
        {isConnected ? (
          <div className="remote-pairing-connected">
            <p className="remote-pairing-ready" style={{ color: themeText }}>
              الهاتف متصل وجاهز للكتابة.
            </p>
            <button type="button" onClick={() => onDisconnect?.()}
              className="remote-pairing-disconnect"
              style={{ color: isDark ? "#FDA4AF" : "#BE123C", backgroundColor: "rgba(244,63,94,0.08)", borderColor: "rgba(244,63,94,0.24)" }}>
              قطع الاتصال
            </button>
          </div>
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
                <span className="font-zain-bold text-xs leading-snug" style={{ color: themeText }}>
                  ١. افتحي تطبيق «كيبورد الحكايات» على الهاتف
                </span>
                <span className="font-zain-bold text-xs leading-snug" style={{ color: themeText }}>
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
