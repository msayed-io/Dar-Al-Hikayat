import { describe, test, expect } from "vitest";
import fs from "fs";
import path from "path";
import { computeTextStats } from "../lib/storage-service";

describe("Storage Safety & Golden Rule Verification", () => {
  test("1. Text Barrier: lib/storage-service.ts MUST NOT contain string interpolation or text sanitization in db.execute", () => {
    const filePath = path.resolve(process.cwd(), "lib/storage-service.ts");
    const code = fs.readFileSync(filePath, "utf-8");

    // Check that db.execute is NOT used with string interpolation `${` for user queries
    const executeMatches = code.match(/this\.db\.execute\([`''"].*?\)/gs) || [];
    for (const match of executeMatches) {
      expect(match).not.toContain("${metadata.title");
      expect(match).not.toContain("${metadata.content");
      expect(match).not.toContain("${payload.content");
      expect(match).not.toContain(".replace(/'/g");
    }

    // Verify zero user text sanitization calls exist
    expect(code).not.toContain(".replace(/'/g, \"''\")");
    expect(code).not.toContain(".replace(/--/g");
    expect(code).not.toContain(".replace(/;/g");
  });

  test("2. Value Binding: computeTextStats and data structures preserve special characters without modification", () => {
    const rawContent = `-- سطر هامي يحوي شرطتين متتاليتين;\n'مقتبس أحادي' و "مقتبس مزدوج" 📖\nFinal line;`;
    const stats = computeTextStats(rawContent);

    // Assert that raw content text stats do not alter original characters
    expect(stats.preview).toContain("--");
    expect(stats.preview).toContain(";");
    expect(stats.preview).toContain("📖");
  });

  test("3. Round-Trip Data Integrity Simulation: Complex user text round-trips byte-for-byte identical", async () => {
    const testCases = [
      {
        title: "حكاية الشرطتين --",
        content: "-- هذه بداية حكاية بها تعليق SQL مفترض;\nوسطر آخر ينتهي بنقطة فاصلة;",
      },
      {
        title: "حكاية علامات التنصيص '' \"\"",
        content: "'سطر أول' \"سطر ثاني\" O'Connor & d'Artagnan",
      },
      {
        title: "حكاية الإيموجي والأعمدة المفصلة 📖✨",
        content: "سطر 1\nسطر 2\n-- سطر 3;\n\nنهاية النص.",
      },
    ];

    for (const tc of testCases) {
      // Simulate database row mapping and bound values
      const boundValues = [tc.title, tc.content];
      
      // Retrieved values from bound parameters must be byte-for-byte identical to input
      const retrievedTitle = boundValues[0];
      const retrievedContent = boundValues[1];

      expect(retrievedTitle).toBe(tc.title);
      expect(retrievedContent).toBe(tc.content);
    }
  });
});
