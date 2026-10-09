/**
 * محرك تصدير الحكاية إلى Markdown — متوافق بدقة مع معيار CommonMark 0.31.2 و GFM
 * 
 * يلتزم بالمبادئ الحاكمة:
 * 1. النص أولاً وبأقل عدد من الرموز.
 * 2. التزام صارم بـ CommonMark و GFM (جداول، قوائم مهام، شطب فقط).
 * 3. صفر HTML خام — جميع المحتويات نصوص صريحة مُهرّبة سياقياً.
 * 4. الحياد الاتجاهي والدقة قبل الزينة.
 * 5. واجهة دالة نقية (Pure Function) قابلة للاختبار المستقل.
 */
import YAML from "yaml";
import { downloadBlob } from "./pdf-export";

export interface ChapterMarkdownItem {
  id?: string;
  title: string;
  content: string;
}

export interface StoryMarkdownOptions {
  title?: string | null;
  content: string;
  isNovelMode?: boolean;
  chapters?: ChapterMarkdownItem[];
  createdAt?: number | string | Date | null;
  updatedAt?: number | string | Date | null;
  language?: string;
  source?: string;
}

/**
 * تنسيق التاريخ وفق ISO 8601 متضمناً المنطقة الزمنية الحالية بدقة (مثل: 2026-10-08T02:13:00+02:00)
 */
export function formatIsoWithTimezone(dateInput: Date | number | string): string {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date provided for ISO formatting");
  }
  const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const tzOffset = -date.getTimezoneOffset(); // بالدقائق
  const sign = tzOffset >= 0 ? "+" : "-";
  const tzHours = pad(Math.floor(Math.abs(tzOffset) / 60));
  const tzMinutes = pad(Math.abs(tzOffset) % 60);
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${tzHours}:${tzMinutes}`;
}

/**
 * بناء كتلة YAML Frontmatter الرسمية بمُسلسِل YAML 1.2
 * بترتيب مفاتيح إلزامي: title -> created -> updated -> language -> source
 * مع حذف أي مفتاح لا تتوفر له بيانات، واقتباس القيم النصية لحماية التواريخ والرموز.
 */
export function buildFrontmatter(meta: {
  title?: string | null;
  createdAt?: number | string | Date | null;
  updatedAt?: number | string | Date | null;
  language?: string;
  source?: string;
}): string {
  const doc = new YAML.Document();
  const map = new YAML.YAMLMap<string, unknown>();

  // 1. title: يُضاف فقط إن كان متاحاً وغير فارغ وليس "بدون عنوان"
  const cleanTitle = (meta.title || "").trim();
  if (cleanTitle && cleanTitle !== "بدون عنوان") {
    const titleVal = doc.createNode(cleanTitle);
    titleVal.type = "QUOTE_DOUBLE";
    map.set("title", titleVal);
  }

  // 2. created: يُضاف فقط إن توفر تاريخ إنشاء حقيقي
  if (meta.createdAt !== undefined && meta.createdAt !== null && meta.createdAt !== "") {
    try {
      const isoCreated = formatIsoWithTimezone(meta.createdAt);
      const createdVal = doc.createNode(isoCreated);
      createdVal.type = "QUOTE_DOUBLE";
      map.set("created", createdVal);
    } catch {
      // إذا كان التاريخ غير صالح، يُحذف المفتاح بالكامل
    }
  }

  // 3. updated: يُضاف فقط إن توفر تاريخ تعديل حقيقي
  if (meta.updatedAt !== undefined && meta.updatedAt !== null && meta.updatedAt !== "") {
    try {
      const isoUpdated = formatIsoWithTimezone(meta.updatedAt);
      const updatedVal = doc.createNode(isoUpdated);
      updatedVal.type = "QUOTE_DOUBLE";
      map.set("updated", updatedVal);
    } catch {
      // يُحذف المفتاح عند تعذر الصياغة
    }
  }

  // 4. language
  const lang = (meta.language || "ar").trim();
  if (lang) {
    const langVal = doc.createNode(lang);
    langVal.type = "QUOTE_DOUBLE";
    map.set("language", langVal);
  }

  // 5. source
  const src = (meta.source || "دار الحكايات").trim();
  if (src) {
    const srcVal = doc.createNode(src);
    srcVal.type = "QUOTE_DOUBLE";
    map.set("source", srcVal);
  }

  doc.contents = map;
  const yamlBody = doc.toString().trim();
  return `---\n${yamlBody}\n---`;
}

/**
 * تهريب النصوص سياقياً وفق جدول CommonMark و GFM:
 * - أي موضع: \ ` * _ [ ] < > ~ و & عند احتمال كيان HTML
 * - بداية السطر: # > + - * (إن تبعتها مسافة) والأرقام مع . أو ) وسطور الفواصل
 */
export function escapeMarkdownText(text: string, isAtLineStart = false, isInsideTableCell = false): string {
  if (!text) return "";

  // 1. تهريب المحارف الخاصة في أي موضع
  let out = text
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/</g, "\\<")
    .replace(/>/g, "\\>")
    .replace(/~/g, "\\~");

  // تهريب & إذا كان يتبعه اسم كيان HTML أو رقم مرجعي
  out = out.replace(/&(?=[a-zA-Z0-9#]+;)/g, "\\&");

  // 2. داخل خلايا الجدول: تهريب علامة الأنبوب |
  if (isInsideTableCell) {
    out = out.replace(/\|/g, "\\|");
  }

  // 3. عند بداية السطر فقط: تهريب بادئات كتل Markdown
  if (isAtLineStart) {
    // بادئة العناوين: #
    out = out.replace(/^(\s*)(#+)/, "$1\\$2");
    // بادئة الاقتباس: >
    out = out.replace(/^(\s*)(>)/, "$1\\$2");
    // بادئات القوائم: + - * المتبوعة بمسافة
    out = out.replace(/^(\s*)([+\-*])(\s)/, "$1\\$2$3");
    // بادئات القوائم المرقمة: 1. أو 1)
    out = out.replace(/^(\s*)(\d+)([.)])(\s)/, "$1$2\\$3$4");
    // أسطر الفواصل والأفاريز: === أو --- أو *** أو ___
    out = out.replace(/^(\s*)([=\-*_]{3,})(\s*)$/, "$1\\$2$3");
    // سياج الكود: ``` أو ~~~
    out = out.replace(/^(\s*)([`~]{3,})/, "$1\\$2");
  }

  return out;
}

/** تهريب عنوان H1 أو رأس فقرة */
export function escapeHeadingTitle(title: string): string {
  // العناوين لا يجب أن تكسر على أسطر
  const singleLine = title.replace(/[\r\n]+/g, " ").trim();
  // تهريب الرموز مع معاملتها كبداية سطر
  return escapeMarkdownText(singleLine, false, false);
}

/** فحص الروابط لمنع المخططات الخطرة (javascript:, data:, vbscript:) */
export function sanitizeLinkUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:")
  ) {
    return null;
  }
  // ترميز الأقواس والمسافات
  return trimmed
    .replace(/ /g, "%20")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29");
}

/** محلل DOM آمن يعمل في المتصفح وبيئة الاختبار (jsdom) */
function getDomDocument(html: string): Document {
  if (typeof DOMParser !== "undefined") {
    return new DOMParser().parseFromString(html, "text/html");
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { JSDOM } = require("jsdom");
  return new JSDOM(html).window.document;
}

interface InlineRenderResult {
  text: string;
}

const NODE_TYPE_ELEMENT = 1;
const NODE_TYPE_TEXT = 3;

/**
 * تحويل العقد المضمنة (Inline Elements) إلى CommonMark
 */
function renderInlineNode(node: Node, options: { isAtLineStart?: boolean; isInsideTableCell?: boolean }): string {
  if (node.nodeType === NODE_TYPE_TEXT) {
    const raw = node.textContent || "";
    return escapeMarkdownText(raw, options.isAtLineStart, options.isInsideTableCell);
  }

  if (node.nodeType !== NODE_TYPE_ELEMENT) {
    return "";
  }

  const el = node as HTMLElement;
  const tag = el.tagName.toUpperCase();

  // فحص الكسر السطري الصريح
  if (tag === "BR") {
    return "\n";
  }

  // كود داخلي (Inline Code)
  if (tag === "CODE" || tag === "KBD" || tag === "SAMP") {
    const codeText = el.textContent || "";
    // حساب عدد الـ backticks المطلوبة لحصره
    const backtickMatches = codeText.match(/`+/g) || [];
    let maxBackticks = 0;
    for (const m of backtickMatches) {
      if (m.length > maxBackticks) maxBackticks = m.length;
    }
    const fence = "`".repeat(maxBackticks + 1);
    const pad = codeText.startsWith("`") || codeText.endsWith("`") ? " " : "";
    return `${fence}${pad}${codeText}${pad}${fence}`;
  }

  // صور
  if (tag === "IMG") {
    const src = el.getAttribute("src") || "";
    const alt = el.getAttribute("alt") || "";
    const isDataUrl = src.startsWith("data:");
    const isSafeRelativeOrHttp = /^https?:\/\//i.test(src) || src.startsWith("/") || src.startsWith("./");

    if (isSafeRelativeOrHttp && !isDataUrl) {
      const cleanSrc = sanitizeLinkUrl(src);
      if (cleanSrc) {
        return `![${escapeMarkdownText(alt, false, options.isInsideTableCell)}](${cleanSrc})`;
      }
    }
    // في حال Base64 أو مسار غير معتمد: كتابة سطر نصي بأقواس مهرّبة
    return alt
      ? `\\[صورة: ${escapeMarkdownText(alt, false, options.isInsideTableCell)}\\]`
      : "\\[صورة\\]";
  }

  // روابط
  if (tag === "A") {
    const href = el.getAttribute("href") || "";
    const cleanUrl = sanitizeLinkUrl(href);
    const inner = renderInlineChildren(el, options);
    if (!cleanUrl) {
      // مخطط محظور: نمرر النص المجرد دون وسم رابط
      return inner;
    }
    return `[${inner}](${cleanUrl})`;
  }

  // تجميع الأبناء لتطبيق التنسيق الشكلي
  const childContent = renderInlineChildren(el, { ...options, isAtLineStart: false });
  if (!childContent.trim()) {
    return childContent;
  }

  // فصل المسافات الخارجية لضمان تماسك محددات CommonMark
  const leadingSpace = childContent.match(/^\s*/)?.[0] || "";
  const trailingSpace = childContent.match(/\s*$/)?.[0] || "";
  const core = childContent.trim();
  if (!core) return childContent;

  // عريض
  const explicitWeight = el.style.fontWeight;
  const numWeight = Number.parseInt(explicitWeight, 10);
  const isBold =
    tag === "STRONG" ||
    tag === "B" ||
    explicitWeight === "bold" ||
    (Number.isFinite(numWeight) && numWeight >= 600) ||
    el.classList.contains("font-zain-bold") ||
    el.classList.contains("font-zain-xbold");

  // مائل
  const isItalic =
    tag === "EM" ||
    tag === "I" ||
    el.style.fontStyle === "italic";

  // مشطوب
  const isStrike =
    tag === "S" ||
    tag === "DEL" ||
    tag === "STRIKE" ||
    el.style.textDecoration?.includes("line-through");

  let formatted = core;

  if (isStrike) {
    formatted = `~~${formatted}~~`;
  }
  if (isItalic) {
    formatted = `*${formatted}*`;
  }
  if (isBold) {
    formatted = `**${formatted}**`;
  }

  return `${leadingSpace}${formatted}${trailingSpace}`;
}

/** تحويل أبناء عنصر مضمن إلى نصوص CommonMark */
function renderInlineChildren(parent: HTMLElement, options: { isAtLineStart?: boolean; isInsideTableCell?: boolean }): string {
  let result = "";
  const nodes = Array.from(parent.childNodes);
  for (let i = 0; i < nodes.length; i++) {
    const isStart = i === 0 && (options.isAtLineStart ?? false);
    result += renderInlineNode(nodes[i], { ...options, isAtLineStart: isStart });
  }
  return result;
}

/**
 * معالجة فقرة تحتوي على أسطر متعددة (مثل أسطر الشعر أو علامات <br>)
 * قاعدة CommonMark الإلزامية: كسر السطر الصريح ينتهي بشرطة مائلة عكسية \ في نهاية كل سطر ما عدا الأخير
 */
function renderParagraphLines(linesText: string): string {
  const rawLines = linesText.split("\n");
  const processed: string[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const isLast = i === rawLines.length - 1;

    // تهريب بداية السطر إن لزم
    let escapedLine = line;
    if (i > 0) {
      escapedLine = escapeMarkdownText(line, true, false);
    }

    if (!isLast) {
      // CommonMark explicit hard break: شرطة مائلة عكسية في نهاية السطر
      processed.push(`${escapedLine}\\`);
    } else {
      // آخر سطر في الفقرة لا يحمل شرطة مائلة
      processed.push(escapedLine);
    }
  }

  return processed.join("\n");
}

/**
 * تحويل جدول HTML إلى جدول GFM
 */
function renderTableElement(tableEl: HTMLTableElement): string {
  const rows = Array.from(tableEl.querySelectorAll("tr"));
  if (rows.length === 0) return "";

  const tableData: string[][] = [];
  const alignments: string[] = [];

  // فحص أول صف كـ Header
  const firstRowCells = Array.from(rows[0].querySelectorAll("th, td"));
  if (firstRowCells.length === 0) return "";

  for (const cell of firstRowCells) {
    const align = (cell as HTMLElement).style.textAlign || cell.getAttribute("align") || "";
    if (align === "center") {
      alignments.push(":---:");
    } else if (align === "right") {
      alignments.push("---:");
    } else if (align === "left") {
      alignments.push(":---");
    } else {
      alignments.push("---");
    }
  }

  for (const r of rows) {
    const cells = Array.from(r.querySelectorAll("th, td"));
    const rowCells: string[] = [];
    for (let colIdx = 0; colIdx < cells.length; colIdx++) {
      const cell = cells[colIdx] as HTMLElement;
      // دمج أسطر الخلية بمسافة واحدة وتهريب محتواها
      const text = renderInlineChildren(cell, { isInsideTableCell: true })
        .replace(/[\r\n]+/g, " ")
        .trim();
      rowCells.push(text || " ");
    }
    if (rowCells.length > 0) {
      // موازنة عدد الأعمدة مع الرأس
      while (rowCells.length < firstRowCells.length) {
        rowCells.push(" ");
      }
      tableData.push(rowCells);
    }
  }

  if (tableData.length === 0) return "";

  const headerRow = `| ${tableData[0].join(" | ")} |`;
  const separatorRow = `| ${alignments.join(" | ")} |`;
  const bodyRows = tableData
    .slice(1)
    .map((row) => `| ${row.join(" | ")} |`)
    .join("\n");

  if (bodyRows) {
    return `${headerRow}\n${separatorRow}\n${bodyRows}`;
  }
  return `${headerRow}\n${separatorRow}`;
}

/**
 * تحويل قائمة HTML (ul / ol) إلى قائمة CommonMark / GFM
 */
function renderListElement(listEl: HTMLElement, depth = 0): string {
  const isOrdered = listEl.tagName === "OL";
  const startNum = Number.parseInt(listEl.getAttribute("start") || "1", 10) || 1;
  const items = Array.from(listEl.children).filter((c) => c.tagName === "LI");
  const indent = "  ".repeat(depth);

  const lines: string[] = [];

  items.forEach((item, index) => {
    const li = item as HTMLElement;
    // فحص قوائم المهام (GFM Task List)
    const checkbox = li.querySelector('input[type="checkbox"]');
    let prefix = isOrdered ? `${startNum + index}. ` : "- ";

    if (checkbox instanceof HTMLInputElement) {
      const isChecked = checkbox.checked || checkbox.hasAttribute("checked");
      prefix = isChecked ? "- [x] " : "- [ ] ";
    }

    // استخراج النصوص المباشرة للأبناء
    let itemText = "";
    const nestedLists: HTMLElement[] = [];

    Array.from(li.childNodes).forEach((child) => {
      if (child.nodeType === NODE_TYPE_ELEMENT && (child as HTMLElement).tagName === "INPUT" && (child as HTMLElement).getAttribute("type") === "checkbox") {
        // تجاهل وسم الـ input نفسه لأنه عُولج في البادئة
        return;
      }
      if (child.nodeType === NODE_TYPE_ELEMENT && ["UL", "OL"].includes((child as HTMLElement).tagName)) {
        nestedLists.push(child as HTMLElement);
      } else {
        itemText += renderInlineNode(child, { isAtLineStart: false });
      }
    });

    lines.push(`${indent}${prefix}${itemText.trim()}`);

    for (const nested of nestedLists) {
      const nestedRendered = renderListElement(nested, depth + 1);
      if (nestedRendered) {
        lines.push(nestedRendered);
      }
    }
  });

  return lines.join("\n");
}

/**
 * استخراج وتحويل كتل المستند إلى Markdown
 */
export function convertHtmlToMarkdownBlocks(
  html: string,
  options: { baseHeadingLevel?: number } = {}
): string {
  const doc = getDomDocument(html);
  const body = doc.body;
  const baseLevel = options.baseHeadingLevel || 2; // H1 للمستند الرئيسي، فتبدأ عناوين المحتوى من H2
  let lastHeadingLevel = baseLevel - 1;

  const blocks: string[] = [];

  const isBlockElement = (el: HTMLElement) => {
    return [
      "DIV", "P", "H1", "H2", "H3", "H4", "H5", "H6",
      "BLOCKQUOTE", "PRE", "UL", "OL", "TABLE", "HR", "SECTION", "ARTICLE"
    ].includes(el.tagName);
  };

  const processBlockElement = (el: HTMLElement) => {
    const tag = el.tagName;

    // فاصل زخرفي أو HR
    if (tag === "HR" || el.textContent?.trim() === "❦") {
      blocks.push("***");
      return;
    }

    // كود مسبق التنسيق (Code Block)
    if (tag === "PRE") {
      const codeEl = el.querySelector("code") || el;
      const rawCode = codeEl.textContent || "";
      const classAttr = (codeEl as HTMLElement).className || el.className || "";
      const langMatch = classAttr.match(/(?:language|lang)-(\w+)/i);
      const language = langMatch ? langMatch[1] : "";

      // حساب طول السياج: أطول تسلسل backticks داخل الكود + 1 (بحد أدنى 3)
      const matches = rawCode.match(/`+/g) || [];
      let maxBackticks = 0;
      for (const m of matches) {
        if (m.length > maxBackticks) maxBackticks = m.length;
      }
      const fenceLength = Math.max(3, maxBackticks + 1);
      const fence = "`".repeat(fenceLength);

      blocks.push(`${fence}${language}\n${rawCode}\n${fence}`);
      return;
    }

    // عناوين H1 - H6
    if (/^H[1-6]$/.test(tag)) {
      const origLevel = Number.parseInt(tag.slice(1), 10);
      // إزاحة المستوى ليقع تحت الرئيسي
      let targetLevel = Math.min(6, origLevel + 1);
      // منع قفز المستويات: لا يقفز أكثر من خطوة واحدة فوق السابق
      if (targetLevel > lastHeadingLevel + 1) {
        targetLevel = lastHeadingLevel + 1;
      }
      lastHeadingLevel = targetLevel;

      const titleContent = escapeHeadingTitle(el.textContent || "");
      if (titleContent) {
        blocks.push(`${"#".repeat(targetLevel)} ${titleContent}`);
      }
      return;
    }

    // اقتباس (Blockquote)
    if (tag === "BLOCKQUOTE") {
      const innerBlocks = convertHtmlToMarkdownBlocks(el.innerHTML, { baseHeadingLevel: lastHeadingLevel + 1 });
      const bqLines = innerBlocks.split("\n").map((line) => (line.trim() ? `> ${line}` : ">"));
      blocks.push(bqLines.join("\n"));
      return;
    }

    // قوائم
    if (tag === "UL" || tag === "OL") {
      const renderedList = renderListElement(el);
      if (renderedList.trim()) {
        blocks.push(renderedList);
      }
      return;
    }

    // جداول
    if (tag === "TABLE") {
      const renderedTable = renderTableElement(el as HTMLTableElement);
      if (renderedTable.trim()) {
        blocks.push(renderedTable);
      }
      return;
    }

    // إذا كان DIV يحتوي على عناصر كتل داخله، نعالج الأبناء تفرعياً
    if (tag === "DIV" && el.querySelector("div, p, h1, h2, h3, h4, h5, h6, ul, ol, table, pre, blockquote")) {
      Array.from(el.children).forEach((child) => {
        if (child instanceof HTMLElement) {
          processBlockElement(child);
        }
      });
      return;
    }

    // فقرة عادية (P أو DIV طرفي)
    const rawParagraph = renderInlineChildren(el, { isAtLineStart: true });
    const trimmed = rawParagraph.trim();
    if (!trimmed || trimmed === "\\<br\\>") return;

    // التحقق إن كانت فاصل زخرفي
    if (trimmed === "❦" || trimmed === "\\*\\*\\*") {
      blocks.push("***");
      return;
    }

    const formattedParagraph = renderParagraphLines(rawParagraph);
    if (formattedParagraph.trim()) {
      blocks.push(formattedParagraph);
    }
  };

  // تفكيك محتوى الـ body إلى كتل
  const rootChildren = Array.from(body.childNodes);
  let pendingInlines: Node[] = [];

  const flushInlines = () => {
    if (pendingInlines.length === 0) return;
    const tempP = doc.createElement("p");
    pendingInlines.forEach((n) => tempP.appendChild(n));
    processBlockElement(tempP);
    pendingInlines = [];
  };

  for (const child of rootChildren) {
    if (child.nodeType === NODE_TYPE_ELEMENT && isBlockElement(child as HTMLElement)) {
      flushInlines();
      processBlockElement(child as HTMLElement);
    } else {
      pendingInlines.push(child);
    }
  }
  flushInlines();

  return blocks.filter(Boolean).join("\n\n");
}

/**
 * الدالة النقية الرئيسية (Pure Function): تحويل الحكاية بالكامل إلى نص Markdown متكامل
 */
export function convertStoryToMarkdown(options: StoryMarkdownOptions): string {
  const parts: string[] = [];

  const rawTitle = (options.title || "").trim();
  const hasCustomTitle = rawTitle.length > 0 && rawTitle !== "بدون عنوان";

  // 1. الطبقة الأولى: بيانات الوصف (Frontmatter)
  const frontmatter = buildFrontmatter({
    title: hasCustomTitle ? rawTitle : null,
    createdAt: options.createdAt,
    updatedAt: options.updatedAt,
    language: options.language,
    source: options.source,
  });
  parts.push(frontmatter);

  // 2. الطبقة الثانية: العنوان الظاهر (H1)
  if (hasCustomTitle) {
    const escapedH1 = escapeHeadingTitle(rawTitle);
    parts.push(`# ${escapedH1}`);
  }

  // 3. الطبقة الثالثة: المحتوى
  if (options.isNovelMode && options.chapters && options.chapters.length > 0) {
    // وضع الرواية (فصول متعددة)
    const chapterBlocks: string[] = [];
    const chapterHeadingLevel = hasCustomTitle ? 2 : 1;

    options.chapters.forEach((chapter) => {
      const chTitle = (chapter.title || "").trim();
      const chParts: string[] = [];

      if (chTitle && chTitle !== "فصل بدون عنوان") {
        const escapedChTitle = escapeHeadingTitle(chTitle);
        chParts.push(`${"#".repeat(chapterHeadingLevel)} ${escapedChTitle}`);
      }

      const chapterBody = convertHtmlToMarkdownBlocks(chapter.content, {
        baseHeadingLevel: chapterHeadingLevel + 1,
      });

      if (chapterBody.trim()) {
        chParts.push(chapterBody);
      }

      if (chParts.length > 0) {
        chapterBlocks.push(chParts.join("\n\n"));
      }
    });

    if (chapterBlocks.length > 0) {
      parts.push(chapterBlocks.join("\n\n"));
    }
  } else {
    // وضع الحكاية الفردية
    const storyBody = convertHtmlToMarkdownBlocks(options.content, {
      baseHeadingLevel: hasCustomTitle ? 2 : 1,
    });
    if (storyBody.trim()) {
      parts.push(storyBody);
    }
  }

  // تجميع النص
  let fullOutput = parts.join("\n\n");

  // التطبيع والتنقية الإلزامية:
  // - Unicode بصيغة NFC مع الحفاظ الكامل على التشكيل والأرقام والـ ZWNJ / ZWJ
  fullOutput = fullOutput.normalize("NFC");

  // - إزالة محارف التحكم C0 غير المسموحة ما عدا \t و \n
  fullOutput = fullOutput.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // - توحيد نهايات الأسطر إلى LF فقط
  fullOutput = fullOutput.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // - منع الأسطر الفارغة المزدوجة المتتالية في المتن
  fullOutput = fullOutput.replace(/\n{3,}/g, "\n\n");

  // - إزالة المسافات الزائدة في أواخر الأسطر
  fullOutput = fullOutput
    .split("\n")
    .map((l) => (l.endsWith("\\") ? l : l.replace(/[ \t]+$/, "")))
    .join("\n");

  // - سطر جديد واحد بالضبط في نهاية الملف
  if (!fullOutput.endsWith("\n")) {
    fullOutput += "\n";
  }

  return fullOutput;
}

/**
 * توليد اسم ملف Markdown آمن ونظيف وفق اشتراطات القسم الخامس:
 * 1. حذف الرموز المحظورة / \ : * ? " < > | ومحارف التحكم
 * 2. حد 120 حرفاً وحد 150 بايت UTF-8
 * 3. حماية أسماء Windows المحجوزة
 * 4. الامتداد .md دائماً
 * 5. الاسم الاحتياطي "بدون عنوان.md"
 */
export function generateMarkdownFilename(rawTitle?: string | null): string {
  const fallback = "بدون عنوان";
  let title = (rawTitle || "").trim();

  if (!title || title === fallback) {
    return `${fallback}.md`;
  }

  // حذف المحارف المحظورة والتحكم
  let clean = title
    .replace(/[/\\:*?"<>|]/g, "")
    .replace(/[\x00-\x1F\x7F]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/, "")
    .trim();

  if (!clean || clean === fallback) {
    return `${fallback}.md`;
  }

  // فحص الأسماء المحجوزة في ويندوز
  const winReserved = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i;
  if (winReserved.test(clean)) {
    clean = `${clean}_`;
  }

  // تحديد الطول بالحروف (120 حرفاً)
  if (clean.length > 120) {
    clean = clean.slice(0, 120).trim();
  }

  // تحديد الطول بالبايت (150 بايت UTF-8)
  const encoder = new TextEncoder();
  if (encoder.encode(clean).length > 150) {
    const chars = Array.from(clean);
    while (chars.length > 0 && encoder.encode(chars.join("")).length > 150) {
      chars.pop();
    }
    clean = chars.join("").trim();
  }

  if (!clean) {
    clean = fallback;
  }

  return `${clean}.md`;
}

/**
 * تصدير الحكاية الكاملة إلى ملف Markdown (.md) وتنزيله للمستخدم
 */
export async function exportStoryToMarkdown(params: {
  title?: string | null;
  content: string;
  isNovelMode?: boolean;
  chapters?: ChapterMarkdownItem[];
  createdAt?: number | string | Date | null;
  updatedAt?: number | string | Date | null;
  language?: string;
  source?: string;
}): Promise<void> {
  const markdownText = convertStoryToMarkdown(params);
  const filename = generateMarkdownFilename(params.title);
  const blob = new Blob([markdownText], { type: "text/markdown;charset=utf-8" });
  await downloadBlob(blob, filename);
}
