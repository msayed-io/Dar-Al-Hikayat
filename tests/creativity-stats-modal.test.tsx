/** @vitest-environment jsdom */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CreativityStatsModal } from "../components/CreativityStatsModal";
import { Note } from "../contexts/AppContext";
import { setupDom } from "./helpers/handwriting-dom";

describe("CreativityStatsModal Component Tests", () => {
  let dom: ReturnType<typeof setupDom>;
  beforeEach(() => {
    dom = setupDom();
  });
  afterEach(() => {
    dom.cleanup();
  });

  const mockNotes: Note[] = [
    {
      id: 1,
      title: "الحكاية الأولى",
      content: "محتوى",
      preview: "محتوى",
      date: "١٥ يناير ٢٠٢٥",
      category: "حكاية",
      styles: {
        fontSize: 18,
        fontWeight: 400,
        textAlign: "right",
        textColor: "#121A1B",
        paperStyleIndex: 0,
      },
      word_count: 1000,
      char_count: 5000,
      status: "مكتملة",
    } as unknown as Note,
    {
      id: 2,
      title: "الحكاية الثانية",
      content: "محتوى",
      preview: "محتوى",
      date: "١٦ يناير ٢٠٢٥",
      category: "حكاية",
      styles: {
        fontSize: 18,
        fontWeight: 400,
        textAlign: "right",
        textColor: "#121A1B",
        paperStyleIndex: 0,
      },
      word_count: 2000,
      char_count: 10000,
      status: "مسودة",
    } as unknown as Note,
    {
      id: 3,
      title: "الحكاية الثالثة",
      content: "محتوى",
      preview: "محتوى",
      date: "١٧ يناير ٢٠٢٥",
      category: "حكاية",
      styles: {
        fontSize: 18,
        fontWeight: 400,
        textAlign: "right",
        textColor: "#121A1B",
        paperStyleIndex: 0,
      },
      word_count: 1500,
      char_count: 7500,
      status: "مكتملة",
    } as unknown as Note,
  ];

  it("renders modal with exact title, subtitle, and 6 rows in correct order", async () => {
    const handleClose = vi.fn();
    await dom.render(
      <CreativityStatsModal
        isOpen={true}
        onClose={handleClose}
        notes={mockNotes}
      />,
    );

    // Title & Subtitle
    expect(dom.host.textContent).toContain("إحصائيات الإبداع");
    expect(dom.host.textContent).toContain("ملخص أرقام ونبض قلمك في الدار");

    // 6 Row Titles in correct order
    const rowTitles = [
      "إجمالي الكلمات",
      "عدد الحكايات",
      "متوسط الكلمات",
      "نشاط الأسبوع",
      "سلسلة الكتابة",
      "المكتملة",
    ];

    let lastIndex = -1;
    for (const title of rowTitles) {
      expect(dom.host.textContent).toContain(title);
      const currentIndex = dom.host.textContent!.indexOf(title);
      expect(currentIndex).toBeGreaterThan(lastIndex);
      lastIndex = currentIndex;
    }

    // Calculated values for the 3 test notes:
    // Total: 4,500
    expect(dom.host.textContent).toContain("٤٬٥٠٠");
    // Stories: 3
    expect(dom.host.textContent).toContain("٣");
    // Average: 1,500
    expect(dom.host.textContent).toContain("١٬٥٠٠");
    // Completed: 2
    expect(dom.host.textContent).toContain("٢");

    // Units
    expect(dom.host.textContent).toContain("كلمة");
    expect(dom.host.textContent).toContain("حكاية");
    expect(dom.host.textContent).toContain("أيام");
    expect(dom.host.textContent).toContain("حكايات");
  });

  it("calls onClose when close button is clicked", async () => {
    const handleClose = vi.fn();
    await dom.render(
      <CreativityStatsModal
        isOpen={true}
        onClose={handleClose}
        notes={mockNotes}
      />,
    );

    const closeBtn = dom.host.querySelector("button[aria-label='إغلاق']") as HTMLButtonElement;
    expect(closeBtn).toBeTruthy();
    closeBtn.click();
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("does not render when isOpen is false", async () => {
    const handleClose = vi.fn();
    await dom.render(
      <CreativityStatsModal
        isOpen={false}
        onClose={handleClose}
        notes={mockNotes}
      />,
    );
    expect(dom.host.children.length).toBe(0);
  });

  it("verifies exact geometric styles, padding, gap, and dot properties per specification", async () => {
    const handleClose = vi.fn();
    await dom.render(
      <CreativityStatsModal
        isOpen={true}
        onClose={handleClose}
        notes={mockNotes}
      />,
    );

    const modal = dom.host.querySelector(".stats-modal") as HTMLElement;
    expect(modal).toBeTruthy();
    expect(modal.style.width).toBe("calc(var(--u) * 390)");
    expect(modal.style.borderRadius).toBe("calc(var(--u) * 45)");
    expect(modal.style.paddingTop).toBe("calc(var(--u) * 33)");
    expect(modal.style.paddingBottom).toBe("calc(var(--u) * 43)");

    // Close button: top left, 41x41
    const closeBtn = dom.host.querySelector("button[aria-label='إغلاق']") as HTMLButtonElement;
    expect(closeBtn.style.top).toBe("calc(var(--u) * 28)");
    expect(closeBtn.style.left).toBe("calc(var(--u) * 31)");
    expect(closeBtn.style.width).toBe("calc(var(--u) * 41)");
    expect(closeBtn.style.height).toBe("calc(var(--u) * 41)");

    // Rows container
    const rowsContainer = dom.host.querySelector(".stats-modal__rows") as HTMLElement;
    expect(rowsContainer.style.gap).toBe("calc(var(--u) * 15)");
    expect(rowsContainer.style.marginTop).toBe("calc(var(--u) * 26)");

    // Stat rows
    const rows = dom.host.querySelectorAll(".stat-row");
    expect(rows.length).toBe(6);

    rows.forEach((row) => {
      const el = row as HTMLElement;
      expect(el.style.height).toBe("calc(var(--u) * 62)");
      expect(el.style.paddingInline).toBe("calc(var(--u) * 22)");
      expect(el.style.gap).toBe("calc(var(--u) * 14)");
      expect(el.style.borderRadius).toBe("9999px");
    });

    // Diamonds
    const dots = dom.host.querySelectorAll(".stat-row__dot");
    expect(dots.length).toBe(6);
    dots.forEach((dot) => {
      const el = dot as HTMLElement;
      expect(el.style.width).toBe("calc(var(--u) * 5)");
      expect(el.style.height).toBe("calc(var(--u) * 5)");
      expect(el.style.transform).toBe("rotate(45deg)");
      expect(el.style.display).toBe("block");
    });

    // Value containers
    const values = dom.host.querySelectorAll(".stat-row__value");
    expect(values.length).toBe(6);
    values.forEach((val) => {
      const el = val as HTMLElement;
      expect(el.style.marginInlineStart).toBe("auto");
      expect(el.style.gap).toBe("calc(var(--u) * 8)");
      expect(el.style.whiteSpace).toBe("nowrap");
    });
  });
});
