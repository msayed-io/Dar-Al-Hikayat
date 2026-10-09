import { describe, it, expect } from "vitest";
import YAML from "yaml";
import {
  convertStoryToMarkdown,
  generateMarkdownFilename,
  formatIsoWithTimezone,
  buildFrontmatter,
  escapeMarkdownText,
} from "../lib/markdown-export";

describe("Markdown Export Engine — Golden Tests & Specifications", () => {
  it("formats ISO 8601 with timezone offset properly", () => {
    const d = new Date("2026-10-08T02:13:00.000Z");
    const formatted = formatIsoWithTimezone(d);
    expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
  });

  it("builds Frontmatter with strictly ordered keys and quotes values", () => {
    const fm = buildFrontmatter({
      title: 'حكاية "الأميرة" والسر',
      createdAt: new Date("2026-10-08T02:13:00Z"),
      updatedAt: new Date("2026-10-08T02:40:00Z"),
      language: "ar",
      source: "دار الحكايات",
    });

    expect(fm.startsWith("---\n")).toBe(true);
    expect(fm.endsWith("\n---")).toBe(true);

    const parsed = YAML.parse(fm.replace(/^---\n/, "").replace(/\n---$/, ""));
    expect(parsed.title).toBe('حكاية "الأميرة" والسر');
    expect(parsed.language).toBe("ar");
    expect(parsed.source).toBe("دار الحكايات");
    expect(parsed.created).toBeDefined();
    expect(parsed.updated).toBeDefined();

    // Verify key ordering: title before created before updated before language before source
    const lines = fm.split("\n").filter((l) => l.includes(":"));
    const keys = lines.map((l) => l.split(":")[0].trim());
    expect(keys).toEqual(["title", "created", "updated", "language", "source"]);
  });

  it("omits empty keys from frontmatter completely and handles 'بدون عنوان'", () => {
    const fm = buildFrontmatter({
      title: "بدون عنوان",
      language: "ar",
      source: "دار الحكايات",
    });

    const parsed = YAML.parse(fm.replace(/^---\n/, "").replace(/\n---$/, ""));
    expect(parsed.title).toBeUndefined();
    expect(parsed.created).toBeUndefined();
    expect(parsed.updated).toBeUndefined();
    expect(parsed.language).toBe("ar");
    expect(parsed.source).toBe("دار الحكايات");
  });

  it("preserves fully diacritized Arabic text (tashkeel) and unvocalized text without modification", () => {
    const tashkeelText = "كَانَ يَامَا كَانَ فِي قَدِيمِ الزَّمَانِ، حِكَايَةٌ مَلِيئَةٌ بِالْعِبَرِ.";
    const plainText = "كان ياما كان في قديم الزمان";
    const content = `<p>${tashkeelText}</p><p>${plainText}</p>`;

    const md = convertStoryToMarkdown({
      title: "حكاية مشكولة",
      content,
    });

    expect(md).toContain(tashkeelText);
    expect(md).toContain(plainText);
  });

  it("escapes pseudo-markdown patterns correctly to remain literal text", () => {
    const trickyParts = [
      "# ليس عنواناً",
      "**ليس عريضاً**",
      "[ليس رابطاً](https://x)",
      "- ليس قائمة",
      "| أ | ب |",
      "`ليس كوداً`",
    ];

    const content = trickyParts.map((p) => `<p>${p}</p>`).join("");
    const md = convertStoryToMarkdown({
      title: "فحص التهريب",
      content,
    });

    // # should be escaped as \#
    expect(md).toContain("\\# ليس عنواناً");
    // ** should be escaped as \*\*
    expect(md).toContain("\\*\\*ليس عريضاً\\*\\*");
    // [ should be escaped as \[
    expect(md).toContain("\\[ليس رابطاً\\]");
    // - at start should be escaped as \-
    expect(md).toContain("\\- ليس قائمة");
    // ` should be escaped as \`
    expect(md).toContain("\\`ليس كوداً\\`");
  });

  it("safeguards against raw HTML injection: <script> and <img> with event handlers", () => {
    const evilContent = `<p>&lt;script&gt;alert(1)&lt;/script&gt;</p><p>&lt;img src=x onerror=alert(1)&gt;</p>`;
    const md = convertStoryToMarkdown({
      title: "فحص الأمان",
      content: evilContent,
    });

    // Ensure no unescaped HTML tags exist in the output
    expect(md).not.toMatch(/(?<!\\)<script>/);
    expect(md).not.toMatch(/(?<!\\)<img/);
    expect(md).toContain("\\<script\\>alert(1)\\</script\\>");
    expect(md).toContain("\\<img src=x onerror=alert(1)\\>");
  });

  it("formats poetry / consecutive lines with explicit CommonMark backslash break", () => {
    const poem = `<p>قفا نبكِ من ذكرى حبيبٍ ومنزلِ<br>بسقط اللوى بين الدخول فحوملِ<br>فتوضح فالمقراض لم يعفُ رسمها</p>`;
    const md = convertStoryToMarkdown({
      title: "معلقة امرئ القيس",
      content: poem,
    });

    // First two lines end with \
    expect(md).toContain("قفا نبكِ من ذكرى حبيبٍ ومنزلِ\\\nبسقط اللوى بين الدخول فحوملِ\\\nفتوضح فالمقراض لم يعفُ رسمها");
    // Last line must NOT end with \
    expect(md).not.toContain("رسمها\\");
  });

  it("preserves Arabic and Latin numerals, mixed Arabic & English words", () => {
    const mixed = "<p>في عام 2026 م الموافق ١٤٤٨ هـ، صدر الإصدار Version 3.0 مع دار الحكايات.</p>";
    const md = convertStoryToMarkdown({
      title: "أرقام ولغات",
      content: mixed,
    });

    expect(md).toContain("2026");
    expect(md).toContain("١٤٤٨");
    expect(md).toContain("Version 3.0");
  });

  it("handles empty title, 300-char title, and Windows reserved names", () => {
    // 1. Empty title
    const emptyFilename = generateMarkdownFilename("");
    expect(emptyFilename).toBe("بدون عنوان.md");

    const untitledMd = convertStoryToMarkdown({
      title: "",
      content: "<p>محتوى حكاية بدون عنوان</p>",
    });
    // Should NOT have # H1
    expect(untitledMd).not.toMatch(/^# /m);
    // Frontmatter should NOT have title
    const parsedUntitled = YAML.parse(untitledMd.split("---")[1]);
    expect(parsedUntitled.title).toBeUndefined();

    // 2. 300-char title
    const longTitle = "حكاية ".repeat(50);
    const longFilename = generateMarkdownFilename(longTitle);
    expect(longFilename.endsWith(".md")).toBe(true);
    const encoder = new TextEncoder();
    expect(encoder.encode(longFilename.replace(/\.md$/, "")).length).toBeLessThanOrEqual(150);

    // 3. Windows reserved name CON, PRN, AUX, NUL
    expect(generateMarkdownFilename("CON")).toBe("CON_.md");
    expect(generateMarkdownFilename("con")).toBe("con_.md");
    expect(generateMarkdownFilename("aux")).toBe("aux_.md");
    expect(generateMarkdownFilename("prn")).toBe("prn_.md");
    expect(generateMarkdownFilename("nul")).toBe("nul_.md");
  });

  it("preserves ZWNJ, emojis, and combined Unicode characters in NFC", () => {
    const zwnjContent = "<p>می‌خواهم 🌸 👨‍👩‍👧‍👦 نُورٌ عَلَىٰ نُورٍ</p>";
    const md = convertStoryToMarkdown({
      title: "يونيكود",
      content: zwnjContent,
    });

    expect(md).toContain("می‌خواهم");
    expect(md).toContain("🌸");
    expect(md).toContain("نُورٌ عَلَىٰ نُورٍ");
    // Ensure output is NFC normalized
    expect(md).toBe(md.normalize("NFC"));
  });

  it("renders GFM tables and converts pipe delimiters safely", () => {
    const tableHtml = `
      <table>
        <thead>
          <tr><th style="text-align: right">الشخصية</th><th style="text-align: center">الدور</th></tr>
        </thead>
        <tbody>
          <tr><td>سندباد | البحار</td><td>البطل</td></tr>
          <tr><td>شهرزاد</td><td>الراوية</td></tr>
        </tbody>
      </table>
    `;
    const md = convertStoryToMarkdown({
      title: "جدول الحكاية",
      content: tableHtml,
    });

    expect(md).toContain("| الشخصية | الدور |");
    expect(md).toContain("| ---: | :---: |");
    // Cell containing pipe must have pipe escaped
    expect(md).toContain("سندباد \\| البحار");
  });

  it("handles novel mode chapters with sub-headings correctly", () => {
    const md = convertStoryToMarkdown({
      title: "رواية كبرى",
      content: "",
      isNovelMode: true,
      chapters: [
        { id: "ch1", title: "الفصل الأول: البداية", content: "<p>بداية الرحلة</p>" },
        { id: "ch2", title: "الفصل الثاني: العاصفة", content: "<p>هبوب الرياح</p>" },
      ],
    });

    expect(md).toContain("# رواية كبرى");
    expect(md).toContain("## الفصل الأول: البداية");
    expect(md).toContain("بداية الرحلة");
    expect(md).toContain("## الفصل الثاني: العاصفة");
    expect(md).toContain("هبوب الرياح");
  });

  it("ensures file ends with exactly one newline and has no double blank lines", () => {
    const md = convertStoryToMarkdown({
      title: "فحص الفواصل",
      content: "<p>فقرة أولى</p><p></p><p><br></p><p>فقرة ثانية</p>",
    });

    expect(md.endsWith("\n")).toBe(true);
    expect(md.endsWith("\n\n")).toBe(false);
    expect(md).not.toContain("\n\n\n");
  });

  it("neutralizes unsafe link schemes (javascript:, data:) while allowing valid links", () => {
    const links = `
      <p><a href="javascript:alert(1)">رابط خطير</a></p>
      <p><a href="https://example.com/story?a=1&b=2">رابط آمن</a></p>
    `;
    const md = convertStoryToMarkdown({
      title: "روابط",
      content: links,
    });

    expect(md).not.toContain("javascript:");
    expect(md).toContain("رابط خطير");
    expect(md).toContain("[رابط آمن](https://example.com/story?a=1&b=2)");
  });

  it("satisfies idempotency and exact byte-for-byte reproducibility", () => {
    const input = {
      title: "الحكاية الأزلية",
      content: "<p>نص تجريبي أول مع <strong>كلمة عريضة</strong> و<em>مائلة</em>.</p><p>فقرة ثانية.</p>",
      createdAt: 1760000000000,
      updatedAt: 1760005000000,
    };

    const firstRun = convertStoryToMarkdown(input);
    const secondRun = convertStoryToMarkdown(input);

    expect(firstRun).toBe(secondRun);
    expect(Buffer.from(firstRun, "utf8")).toEqual(Buffer.from(secondRun, "utf8"));
  });

  it("satisfies YAML 1.2 round-trip parsing matching original metadata", () => {
    const original = {
      title: 'عنوان الحكاية: "رحلة السندباد"',
      createdAt: new Date("2026-10-08T02:13:00Z"),
      updatedAt: new Date("2026-10-08T02:40:00Z"),
      language: "ar",
      source: "دار الحكايات",
    };

    const md = convertStoryToMarkdown({
      title: original.title,
      content: "<p>المحتوى</p>",
      createdAt: original.createdAt,
      updatedAt: original.updatedAt,
      language: original.language,
      source: original.source,
    });

    const fmText = md.split("---")[1];
    const parsed = YAML.parse(fmText);

    expect(parsed.title).toBe(original.title);
    expect(parsed.language).toBe(original.language);
    expect(parsed.source).toBe(original.source);
    expect(new Date(parsed.created).getTime()).toBe(original.createdAt.getTime());
    expect(new Date(parsed.updated).getTime()).toBe(original.updatedAt.getTime());
  });

  it("handles high performance without freezing for ~1MB text input", () => {
    const paragraph = "<p>" + "كان يا ما كان في قديم الزمان وسالف العصر والأوان، حكاية تدور حول حكيم عاش في الصحراء. ".repeat(15) + "</p>";
    // Construct ~1MB of HTML
    const largeContent = paragraph.repeat(700);

    const t0 = Date.now();
    const md = convertStoryToMarkdown({
      title: "حكاية ضخمة",
      content: largeContent,
    });
    const elapsed = Date.now() - t0;

    expect(md.length).toBeGreaterThan(500000);
    // Should complete comfortably in less than 2000ms
    expect(elapsed).toBeLessThan(2000);
  });
});
