import React, { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Smartphone,
  Copy,
  Check,
  X,
} from "lucide-react";
import {
  getDeviceLocalIp,
  listenForRemoteKeystrokes,
  RemoteKeystrokePayload,
  NetworkIpResult
} from "../lib/remote-keyboard-service";

interface RemoteKeyboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeystrokeReceived: (payload: RemoteKeystrokePayload) => void;
  currentTheme: any;
}

export const RemoteKeyboardModal: React.FC<RemoteKeyboardModalProps> = ({
  isOpen,
  onClose,
  onKeystrokeReceived,
  currentTheme,
}) => {
  const [sessionPin] = useState<string>(() =>
    Math.floor(100000 + Math.random() * 900000).toString()
  );
  const [networkInfo, setNetworkInfo] = useState<NetworkIpResult | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;

    // Reset connection state strictly on modal open
    setIsConnected(false);

    getDeviceLocalIp().then((info) => {
      setNetworkInfo(info);
    });

    const cleanup = listenForRemoteKeystrokes(
      sessionPin,
      (payload) => {
        setIsConnected(true);
        onKeystrokeReceived(payload);
      },
      (connected) => {
        setIsConnected(connected);
      }
    );

    return () => {
      cleanup();
    };
  }, [isOpen, sessionPin, onKeystrokeReceived]);

  if (!isOpen) return null;

  const targetUrl = networkInfo
    ? `${networkInfo.connectionUrl}?pin=${sessionPin}`
    : `${window.location.origin}/#remote-keyboard?pin=${sessionPin}`;

  const copyUrl = () => {
    navigator.clipboard.writeText(targetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
        className="w-full max-w-sm rounded-[24px] p-4 border shadow-2xl relative flex flex-col gap-3.5 overflow-hidden transition-all"
        style={{
          backgroundColor: themeBg,
          borderColor: themeBorder,
          color: themeText,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact Header */}
        <div
          className="flex items-center justify-between pb-2.5 border-b"
          style={{ borderColor: themeBorder }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
              style={{
                backgroundColor: `${themeAccent}18`,
                color: themeAccent,
              }}
            >
              <Smartphone className="w-3.5 h-3.5" />
            </div>
            <h3 className="font-zain-bold text-sm leading-none whitespace-nowrap truncate">
              ربط الكيبورد اللاسلكي
            </h3>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Status Indicator */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-zain-bold whitespace-nowrap shrink-0"
              style={{
                backgroundColor: isConnected
                  ? "rgba(16, 185, 129, 0.15)"
                  : `${themeAccent}15`,
                color: isConnected ? "#10B981" : themeAccent,
              }}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isConnected
                    ? "bg-emerald-500 animate-ping"
                    : "bg-amber-500 animate-pulse"
                }`}
              />
              <span>{isConnected ? "متصل" : "في انتظار الهاتف"}</span>
            </div>

            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer opacity-70 hover:opacity-100"
              style={{ color: themeText }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content Body - Side by Side */}
        <div className="flex items-center gap-3.5 py-0.5">
          {/* QR Code Container - Silky smooth rounded card */}
          <div
            className="shrink-0 p-2 bg-white rounded-2xl shadow-sm border flex items-center justify-center overflow-hidden bg-clip-padding transition-all"
            style={{
              borderColor: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)",
            }}
          >
            <QRCodeSVG
              value={targetUrl}
              size={102}
              level="M"
              includeMargin={true}
              fgColor="#0F172A"
              bgColor="#FFFFFF"
            />
          </div>

          {/* Details Column */}
          <div className="flex-1 flex flex-col justify-center gap-2 min-w-0">
            {/* Direct URL Box */}
            <div className="flex flex-col gap-1">
              <span
                className="text-[10px] font-zain-reg leading-none"
                style={{ color: themeSecondary }}
              >
                افتح الرابط في الهاتف:
              </span>
              <div
                className="flex items-center justify-between px-3 py-1.5 rounded-full border min-w-0 bg-clip-padding"
                style={{
                  backgroundColor: isDark
                    ? "rgba(0, 0, 0, 0.25)"
                    : "rgba(0, 0, 0, 0.04)",
                  borderColor: themeBorder,
                }}
              >
                <span
                  className="truncate text-[10px] font-mono dir-ltr min-w-0 pl-1"
                  style={{ color: themeAccent }}
                >
                  {targetUrl}
                </span>
                <button
                  onClick={copyUrl}
                  className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-zain-bold transition cursor-pointer shrink-0 mr-1 active:scale-95 whitespace-nowrap"
                  style={{
                    backgroundColor: `${themeAccent}25`,
                    color: themeAccent,
                  }}
                  title="نسخ الرابط"
                >
                  {copied ? (
                    <Check className="w-2.5 h-2.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-2.5 h-2.5" />
                  )}
                  <span>{copied ? "تم" : "نسخ"}</span>
                </button>
              </div>
            </div>

            {/* PIN Code Box */}
            <div
              className="flex items-center justify-between px-3 py-1.5 rounded-full border text-xs bg-clip-padding"
              style={{
                backgroundColor: isDark
                  ? "rgba(255, 255, 255, 0.02)"
                  : "rgba(0, 0, 0, 0.02)",
                borderColor: themeBorder,
              }}
            >
              <span
                className="font-zain-reg text-[10px]"
                style={{ color: themeSecondary }}
              >
                رمز الأمان (PIN):
              </span>
              <span
                className="font-mono font-bold tracking-widest text-xs"
                style={{ color: themeAccent }}
              >
                {sessionPin}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Action Bar */}
        <div
          className="flex items-center justify-between pt-2.5 border-t"
          style={{ borderColor: themeBorder }}
        >
          <span
            className="text-[10px] font-zain-reg opacity-80 leading-none"
            style={{ color: themeSecondary }}
          >
            سيعمل الاتصال في الخلفية
          </span>

          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-full font-zain-bold text-[11px] shadow-sm transition cursor-pointer active:scale-95 shrink-0 whitespace-nowrap"
            style={{
              backgroundColor: themeAccent,
              color: isDark ? "#121A1B" : "#FFFFFF",
            }}
          >
            الانتقال للمحرر
          </button>
        </div>
      </div>
    </div>
  );
};

export default RemoteKeyboardModal;
