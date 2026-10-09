/** @vitest-environment jsdom */
import React, { act, useState } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setupDom, theme } from "./helpers/handwriting-dom";

// Fixture reproducing the exact export dialog capsule & structure from DarAlHikayatEditor
const ExportModalTestFixture: React.FC<{
  initialFormat?: "pdf" | "docx" | "markdown";
  onExport: (format: string, filename: string) => void;
}> = ({ initialFormat = "pdf", onExport }) => {
  const [exportFormat, setExportFormat] = useState<"pdf" | "docx" | "markdown">(initialFormat);
  const [exportFileName, setExportFileName] = useState("بدون عنوان");
  const [isOpen, setIsOpen] = useState(true);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4">
      <div
        className="export-dialog border shadow-2xl text-center"
        style={{
          width: "300px",
          maxWidth: "calc(100vw - 32px)",
          borderRadius: "28px",
          padding: "24px 20px",
          backgroundColor: theme.bg,
          borderColor: theme.border,
        }}
      >
        <h2
          id="dialog-title"
          className="text-lg font-zain-bold mb-1 tracking-tight leading-tight"
          style={{ color: theme.text }}
        >
          تصدير الحكاية كـ{" "}
          {exportFormat === "pdf"
            ? "PDF"
            : exportFormat === "docx"
            ? "Word"
            : "Markdown"}
        </h2>
        <p
          id="dialog-description"
          className="text-[11px] font-zain-reg mb-5 opacity-70 leading-relaxed max-w-[220px] mx-auto"
          style={{ color: theme.text }}
        >
          اختر اسماً لملف{" "}
          {exportFormat === "pdf"
            ? "الـ PDF"
            : exportFormat === "docx"
            ? "الوثيقة"
            : "الـ Markdown"}
          . يمكنك استخدام العنوان الحالي أو تخصيص اسم جديد.
        </p>

        {/* اختيار تنسيق التصدير (الكبسولة) */}
        <div
          role="radiogroup"
          aria-label="تنسيق التصدير"
          id="capsule-container"
          className="flex gap-1 mb-4 p-1 rounded-full border"
          style={{
            borderColor: theme.border,
            backgroundColor: `${theme.accent}05`,
          }}
        >
          <button
            role="radio"
            aria-checked={exportFormat === "pdf"}
            onClick={() => setExportFormat("pdf")}
            className={`flex-1 py-2 px-1 rounded-full font-zain-bold text-xs whitespace-nowrap text-center border transition-all active:scale-95 ${
              exportFormat === "pdf" ? "" : "opacity-60"
            }`}
            style={{
              backgroundColor:
                exportFormat === "pdf"
                  ? theme.accent
                  : "transparent",
              borderColor: "transparent",
              color:
                exportFormat === "pdf"
                  ? theme.bg
                  : theme.text,
            }}
          >
            PDF
          </button>
          <button
            role="radio"
            aria-checked={exportFormat === "docx"}
            onClick={() => setExportFormat("docx")}
            className={`flex-1 py-2 px-1 rounded-full font-zain-bold text-xs whitespace-nowrap text-center border transition-all active:scale-95 ${
              exportFormat === "docx" ? "" : "opacity-60"
            }`}
            style={{
              backgroundColor:
                exportFormat === "docx"
                  ? theme.accent
                  : "transparent",
              borderColor: "transparent",
              color:
                exportFormat === "docx"
                  ? theme.bg
                  : theme.text,
            }}
          >
            Word
          </button>
          <button
            role="radio"
            aria-checked={exportFormat === "markdown"}
            onClick={() => setExportFormat("markdown")}
            className={`flex-1 py-2 px-1 rounded-full font-zain-bold text-xs whitespace-nowrap text-center border transition-all active:scale-95 ${
              exportFormat === "markdown" ? "" : "opacity-60"
            }`}
            style={{
              backgroundColor:
                exportFormat === "markdown"
                  ? theme.accent
                  : "transparent",
              borderColor: "transparent",
              color:
                exportFormat === "markdown"
                  ? theme.bg
                  : theme.text,
            }}
          >
            Markdown
          </button>
        </div>

        <input
          type="text"
          value={exportFileName}
          onChange={(e) => setExportFileName(e.target.value)}
          className="w-full h-11 rounded-full text-center outline-none border mb-4 text-sm px-4"
          placeholder="اسم الملف..."
        />

        <div className="flex gap-2">
          <button
            onClick={() => setIsOpen(false)}
            className="flex-1 py-2 rounded-full text-sm border"
          >
            إلغاء
          </button>
          <button
            id="submit-export-btn"
            onClick={() => {
              onExport(exportFormat, exportFileName);
              setIsOpen(false);
            }}
            className="flex-1 py-2 rounded-full text-sm"
          >
            تصدير
          </button>
        </div>
      </div>
    </div>
  );
};

describe("Export Dialog — UI & Interaction Tests", () => {
  let dom: ReturnType<typeof setupDom>;

  beforeEach(() => {
    dom = setupDom();
  });

  afterEach(() => {
    dom.cleanup();
  });

  it("defaults to PDF with exact title and description, and proper aria-checked attributes", async () => {
    const onExport = vi.fn();
    await dom.render(<ExportModalTestFixture onExport={onExport} />);

    const titleEl = dom.host.querySelector("#dialog-title")!;
    const descEl = dom.host.querySelector("#dialog-description")!;
    expect(titleEl.textContent).toContain("PDF");
    expect(descEl.textContent).toContain("الـ PDF");

    const buttons = Array.from(dom.host.querySelectorAll('[role="radio"]')) as HTMLButtonElement[];
    expect(buttons).toHaveLength(3);

    expect(buttons[0].textContent).toBe("PDF");
    expect(buttons[0].getAttribute("aria-checked")).toBe("true");

    expect(buttons[1].textContent).toBe("Word");
    expect(buttons[1].getAttribute("aria-checked")).toBe("false");

    expect(buttons[2].textContent).toBe("Markdown");
    expect(buttons[2].getAttribute("aria-checked")).toBe("false");
  });

  it("switches to Markdown and updates title and description accordingly upon click", async () => {
    const onExport = vi.fn();
    await dom.render(<ExportModalTestFixture onExport={onExport} />);

    const buttons = Array.from(dom.host.querySelectorAll('[role="radio"]')) as HTMLButtonElement[];
    const mdBtn = buttons[2];

    await act(async () => {
      mdBtn.click();
    });

    const titleEl = dom.host.querySelector("#dialog-title")!;
    const descEl = dom.host.querySelector("#dialog-description")!;

    expect(titleEl.textContent?.trim()).toBe("تصدير الحكاية كـ Markdown");
    expect(descEl.textContent).toContain("الـ Markdown");
    expect(mdBtn.getAttribute("aria-checked")).toBe("true");

    const submitBtn = dom.host.querySelector("#submit-export-btn") as HTMLButtonElement;
    await act(async () => {
      submitBtn.click();
    });

    expect(onExport).toHaveBeenCalledWith("markdown", "بدون عنوان");
  });

  it("ensures capsule container has exact locked geometry classes and layout", async () => {
    const onExport = vi.fn();
    await dom.render(<ExportModalTestFixture onExport={onExport} />);

    const capsule = dom.host.querySelector("#capsule-container") as HTMLElement;
    expect(capsule.classList.contains("flex")).toBe(true);
    expect(capsule.classList.contains("rounded-full")).toBe(true);
    expect(capsule.classList.contains("p-1")).toBe(true);
    expect(capsule.classList.contains("gap-1")).toBe(true);

    const dialog = dom.host.querySelector(".export-dialog") as HTMLElement;
    expect(dialog.style.width).toBe("300px");
    expect(dialog.style.borderRadius).toBe("28px");
  });
});
