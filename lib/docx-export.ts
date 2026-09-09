/**
 * تصدير الحكاية إلى Word (.docx) مع الحفاظ الكامل والدقيق على التظليل، الألوان، والتنسيقات
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  UnderlineType,
} from "docx";
import type { NoteStyles } from "../contexts/AppContext";
import { downloadBlob } from "./pdf-export";

export interface ChapterExportItem {
  id: string;
  title: string;
  content: string;
}

/** تحويل كود اللون (Hex أو RGB أو اسم اللون) إلى Hex نظيف من 6 خانات لملفات Word */
export function normalizeHexColor(colorStr: string | null | undefined): string | null {
  if (!colorStr) return null;
  const str = colorStr.trim();
  if (str === "transparent" || str === "inherit" || str === "initial") return null;

  if (str.startsWith("#")) {
    const raw = str.replace("#", "");
    if (raw.length === 3) {
      return raw.split("").map((c) => c + c).join("").toUpperCase();
    }
    if (raw.length === 6) {
      return raw.toUpperCase();
    }
    if (raw.length === 8) {
      return raw.substring(0, 6).toUpperCase();
    }
  }

  const rgbMatch = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgbMatch) {
    const r = Math.min(255, Math.max(0, parseInt(rgbMatch[1], 10))).toString(16).padStart(2, "0");
    const g = Math.min(255, Math.max(0, parseInt(rgbMatch[2], 10))).toString(16).padStart(2, "0");
    const b = Math.min(255, Math.max(0, parseInt(rgbMatch[3], 10))).toString(16).padStart(2, "0");
    return `${r}${g}${b}`.toUpperCase();
  }

  const namedColors: Record<string, string> = {
    yellow: "FFE600",
    green: "4ADE80",
    pink: "FF729F",
    blue: "38BDF8",
    orange: "FB923C",
    black: "000000",
    white: "FFFFFF",
    red: "EF4444",
  };

  const lower = str.toLowerCase();
  if (namedColors[lower]) {
    return namedColors[lower];
  }

  return null;
}

/** تحديد اسم التظليل القياسي في Word لضمان التوافق مع برامج قراءة Word القديمة والحديثة */
export function hexToWordHighlightName(hex: string): string {
  const h = hex.toUpperCase();
  if (h.startsWith("FFE") || h.startsWith("FFD") || h === "FFFF00" || h === "FFE600") {
    return "yellow";
  }
  if (h === "4ADE80" || h.includes("4A") || h.includes("DE") || h.includes("80")) {
    return "green";
  }
  if (h === "FF729F" || h.startsWith("FF7") || h.includes("729F")) {
    return "magenta";
  }
  if (h === "38BDF8" || h.startsWith("38") || h.includes("BDF8")) {
    return "cyan";
  }
  if (h === "FB923C" || h.startsWith("FB") || h.includes("923C")) {
    return "yellow";
  }
  return "yellow";
}

interface InlineStyleContext {
  bold: boolean;
  italics: boolean;
  underline: boolean;
  textColorHex: string | null;
  highlightHex: string | null;
}

/** استخلاص التنسيقات من عنصر DOM وتمريرها للأبناء */
function getElementStyleContext(el: HTMLElement, parentStyle: InlineStyleContext): InlineStyleContext {
  const isBold =
    parentStyle.bold ||
    el.tagName === "B" ||
    el.tagName === "STRONG" ||
    el.classList.contains("font-zain-bold") ||
    el.classList.contains("font-zain-xbold") ||
    parseInt(el.style.fontWeight || "0", 10) >= 600;

  const isItalics =
    parentStyle.italics ||
    el.tagName === "I" ||
    el.tagName === "EM" ||
    el.style.fontStyle === "italic";

  const isUnderline =
    parentStyle.underline ||
    el.tagName === "U" ||
    Boolean(el.style.textDecoration?.includes("underline"));

  let textColorHex = parentStyle.textColorHex;
  if (el.style.color) {
    const parsedTextCol = normalizeHexColor(el.style.color);
    if (parsedTextCol) {
      textColorHex = parsedTextCol;
    }
  }

  let highlightHex = parentStyle.highlightHex;
  const isHighlightEl =
    el.classList.contains("highlight") ||
    el.classList.contains("hl") ||
    el.tagName === "MARK" ||
    Boolean(el.style.backgroundColor) ||
    Boolean(el.style.background) ||
    Boolean(el.getAttribute("style")?.includes("background"));

  if (isHighlightEl) {
    const rawBg = el.style.backgroundColor || el.style.background;
    let extractedBg = normalizeHexColor(rawBg);
    if (!extractedBg) {
      const styleAttr = el.getAttribute("style") || "";
      const bgMatch = styleAttr.match(/background(?:-color)?:\s*([^;]+)/i);
      if (bgMatch) {
        extractedBg = normalizeHexColor(bgMatch[1].trim());
      }
    }
    highlightHex = extractedBg || "FFE600";
    if (!textColorHex && el.style.color) {
      textColorHex = normalizeHexColor(el.style.color);
    }
  }

  return {
    bold: isBold,
    italics: isItalics,
    underline: isUnderline,
    textColorHex,
    highlightHex,
  };
}

/** استخراج مصفوفة TextRun من شجرة DOM الحالية مع دعم التظليل والأسطر المتعددة */
function parseNodeToTextRuns(
  node: Node,
  style: InlineStyleContext,
  fontSizeHalfPoints: number
): TextRun[] {
  const runs: TextRun[] = [];

  if (node.nodeType === Node.TEXT_NODE) {
    const rawText = node.textContent || "";
    if (!rawText) return runs;

    const createRun = (t: string) => {
      const runOptions: any = {
        text: t,
        size: fontSizeHalfPoints,
        bold: style.bold,
        italics: style.italics,
        underline: style.underline ? { type: UnderlineType.SINGLE } : undefined,
        font: "Zain",
        rightToLeft: true,
      };

      if (style.textColorHex) {
        runOptions.color = style.textColorHex;
      }

      if (style.highlightHex) {
        runOptions.shading = {
          fill: style.highlightHex,
        };
        runOptions.highlight = hexToWordHighlightName(style.highlightHex);
      }

      return new TextRun(runOptions);
    };

    // معالجة الأسطر الجديدة النصية إن وجدت
    if (rawText.includes("\n")) {
      const lines = rawText.split("\n");
      lines.forEach((line, idx) => {
        if (line) {
          runs.push(createRun(line));
        }
        if (idx < lines.length - 1) {
          runs.push(new TextRun({ break: 1, font: "Zain", rightToLeft: true }));
        }
      });
    } else {
      runs.push(createRun(rawText));
    }
    return runs;
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement;

    if (el.tagName === "BR") {
      runs.push(new TextRun({ break: 1, font: "Zain", rightToLeft: true }));
      return runs;
    }

    const currentStyle = getElementStyleContext(el, style);

    el.childNodes.forEach((child) => {
      runs.push(...parseNodeToTextRuns(child, currentStyle, fontSizeHalfPoints));
    });
  }

  return runs;
}

/** تحويل HTML إلى فقرات Word Paragraphs متكاملة التنسيق */
export function htmlToDocxParagraphs(
  html: string,
  options: {
    fontSize: number;
    textAlign?: NoteStyles["textAlign"];
    textColor?: string;
  }
): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const parsedDoc = new DOMParser().parseFromString(html, "text/html");
  const body = parsedDoc.body;

  const getAlignment = (align?: NoteStyles["textAlign"]) => {
    switch (align) {
      case "center":
        return AlignmentType.CENTER;
      case "left":
        return AlignmentType.LEFT;
      case "justify":
        return AlignmentType.JUSTIFIED;
      default:
        return AlignmentType.RIGHT;
    }
  };

  const alignment = getAlignment(options.textAlign);
  // الحجم بوحدة نصف النقطة (Half-points): 16px -> 32 half-points
  const fontSizeHalfPoints = Math.round(Number(options.fontSize || 16) * 2);
  const baseTextColor = normalizeHexColor(options.textColor) || "121A1B";

  const baseStyle: InlineStyleContext = {
    bold: false,
    italics: false,
    underline: false,
    textColorHex: baseTextColor,
    highlightHex: null,
  };

  // تفكيك المحتوى إلى كتل (Blocks)
  const isBlockElement = (el: HTMLElement) => {
    return ["DIV", "P", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "SECTION", "ARTICLE"].includes(
      el.tagName
    );
  };

  const blocks: HTMLElement[] = [];
  let pendingInlineNodes: Node[] = [];

  const flushPendingInlineNodes = () => {
    if (pendingInlineNodes.length === 0) return;
    const tempDiv = parsedDoc.createElement("div");
    pendingInlineNodes.forEach((n) => tempDiv.appendChild(n));
    blocks.push(tempDiv);
    pendingInlineNodes = [];
  };

  Array.from(body.childNodes).forEach((child) => {
    if (child.nodeType === Node.ELEMENT_NODE && isBlockElement(child as HTMLElement)) {
      flushPendingInlineNodes();
      blocks.push(child as HTMLElement);
    } else {
      pendingInlineNodes.push(child);
    }
  });
  flushPendingInlineNodes();

  if (blocks.length === 0) {
    // حالة النص المجرد
    const text = (body.textContent || "").trim();
    if (text) {
      text.split("\n").forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmed,
                size: fontSizeHalfPoints,
                color: baseTextColor,
                font: "Zain",
                rightToLeft: true,
              }),
            ],
            alignment,
            bidirectional: true,
            spacing: { after: 200, line: 360 },
          })
        );
      });
    }
    return paragraphs;
  }

  blocks.forEach((block) => {
    const isHeading = /^H[1-6]$/.test(block.tagName);
    const headingLevel = isHeading
      ? block.tagName === "H1"
        ? HeadingLevel.HEADING_1
        : HeadingLevel.HEADING_2
      : undefined;

    const runs = parseNodeToTextRuns(block, baseStyle, fontSizeHalfPoints);

    // تجاهل الفقرات الفارغة تماماً
    const hasVisibleContent = runs.some((r: any) => {
      return (r.text && r.text.trim().length > 0) || r.break;
    });

    if (!hasVisibleContent && !isHeading) return;

    paragraphs.push(
      new Paragraph({
        children: runs.length > 0 ? runs : [new TextRun({ text: " ", font: "Zain", rightToLeft: true })],
        alignment: isHeading ? AlignmentType.CENTER : alignment,
        heading: headingLevel,
        bidirectional: true,
        spacing: isHeading
          ? { before: 360, after: 180 }
          : { after: 180, line: 360 },
      })
    );
  });

  return paragraphs;
}

/** تصدير الحكاية الكاملة إلى ملف Word (.docx) وتنزيله للمستخدم */
export async function exportStoryToDocx(params: {
  title: string;
  content: string;
  styles: NoteStyles;
  isNovelMode: boolean;
  chapters: ChapterExportItem[];
  accentColor?: string;
}): Promise<void> {
  const displayTitle = params.title.trim() || "بدون عنوان";
  const safeTitle = displayTitle.replace(/[\\/:*?"<>|]/g, "_");

  const children: (Paragraph | PageBreak)[] = [
    // عنوان الوثيقة الرئيسي
    new Paragraph({
      children: [
        new TextRun({
          text: displayTitle,
          bold: true,
          size: 48,
          font: "Zain",
          color: "121A1B",
          rightToLeft: true,
        }),
      ],
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      bidirectional: true,
      spacing: { after: 400 },
    }),
  ];

  if (params.isNovelMode && params.chapters && params.chapters.length > 0) {
    params.chapters.forEach((chapter, index) => {
      if (chapter.title && chapter.title.trim()) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: chapter.title.trim(),
                bold: true,
                size: 36,
                font: "Zain",
                color: normalizeHexColor(params.accentColor) || "2C3E30",
                rightToLeft: true,
              }),
            ],
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.CENTER,
            bidirectional: true,
            spacing: { before: 400, after: 200 },
          })
        );
      }

      const chapterParagraphs = htmlToDocxParagraphs(chapter.content, {
        fontSize: params.styles.fontSize,
        textAlign: params.styles.textAlign,
        textColor: params.styles.textColor,
      });

      children.push(...chapterParagraphs);

      if (index < params.chapters.length - 1) {
        children.push(new Paragraph({ children: [new PageBreak()] }));
      }
    });
  } else {
    const contentParagraphs = htmlToDocxParagraphs(params.content, {
      fontSize: params.styles.fontSize,
      textAlign: params.styles.textAlign,
      textColor: params.styles.textColor,
    });

    children.push(...contentParagraphs);
  }

  const doc = new Document({
    creator: "دَارُ الحِكَايَاتِ",
    title: displayTitle,
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: children as any,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  await downloadBlob(blob, `${safeTitle}.docx`);
}
