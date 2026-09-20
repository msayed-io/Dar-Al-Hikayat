import React, { useState } from "react";
import { CheckCircle2, AlertTriangle, Copy, Check, X, Ban } from "lucide-react";
import type { ThemeColors } from "../contexts/AppContext";

export interface FailedImportItem {
  id: any;
  title: string;
  reason: string;
}

interface ImportResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  importedCount: number;
  failedItems: FailedImportItem[];
  isCancelled?: boolean;
  theme: ThemeColors;
}

export const ImportResultModal: React.FC<ImportResultModalProps> = ({
  isOpen,
  onClose,
  importedCount,
  failedItems,
  isCancelled,
  theme,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const hasFailures = failedItems.length > 0;

  const handleCopyErrors = () => {
    const errorText = failedItems
      .map(
        (item, index) =>
          `${index + 1}. [المعرف: ${item.id}] ${item.title}\n   السبب: ${item.reason}`
      )
      .join("\n\n");
    navigator.clipboard.writeText(errorText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-md rounded-[28px] border shadow-2xl p-6 flex flex-col gap-4 max-h-[85vh] overflow-hidden"
        style={{
          backgroundColor: theme.bg,
          borderColor: theme.border,
          color: theme.text,
        }}
      >
        {/* Header Icon & Title */}
        <div className="flex items-center gap-3">
          {isCancelled ? (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${theme.accent}20`, color: theme.accent }}
            >
              <Ban className="w-5 h-5" />
            </div>
          ) : hasFailures ? (
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-amber-500/20 text-amber-500">
              <AlertTriangle className="w-5 h-5" />
            </div>
          ) : (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${theme.accent}20`, color: theme.accent }}
            >
              <CheckCircle2 className="w-5 h-5" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h3 className="font-zain-bold text-lg leading-tight">
              {isCancelled
                ? "تم إيقاف الاستيراد"
                : hasFailures
                ? `تم استيراد ${importedCount} — فشل ${failedItems.length}`
                : `تم استرجاع ${importedCount} حكاية بنجاح ✓`}
            </h3>
            {isCancelled && (
              <p className="font-zain-reg text-xs opacity-70 mt-0.5">
                تم حفظ {importedCount} حكاية تم استيرادها قبل الإيقاف.
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer opacity-70 hover:opacity-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Failed Items List */}
        {hasFailures && (
          <div className="flex flex-col gap-2 flex-1 min-h-0">
            <div className="flex items-center justify-between text-xs font-zain-bold opacity-80">
              <span>قائمة الحكايات المتعثرة:</span>
              <button
                onClick={handleCopyErrors}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 active:scale-95 transition-all cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "تم النسخ ✓" : "نسخ قائمة الأخطاء"}</span>
              </button>
            </div>

            <div
              className="overflow-y-auto space-y-2 p-3 rounded-2xl border text-xs max-h-52"
              style={{
                borderColor: `${theme.border}`,
                backgroundColor: theme.mode === "apple_dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
              }}
            >
              {failedItems.map((item, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl border border-red-500/20 bg-red-500/5 flex flex-col gap-0.5"
                >
                  <div className="flex items-center justify-between gap-2 font-zain-bold">
                    <span className="truncate">{item.title || "بدون عنوان"}</span>
                    <span className="text-[10px] opacity-60 flex-shrink-0">ID: {String(item.id)}</span>
                  </div>
                  <span className="text-[11px] text-red-500/90 font-zain-reg">{item.reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-full font-zain-bold text-sm active:scale-95 transition-all shadow-sm cursor-pointer"
            style={{
              backgroundColor: theme.accent,
              color: theme.bg,
            }}
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
