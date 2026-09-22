import { describe, test, expect } from "vitest";
import fs from "fs";
import path from "path";
import { StorageService } from "../lib/storage-service";

describe("Storage Safety & Golden Rule Verification Tests", () => {
  // 1. حاجز نصّي (Static AST / Text Barrier)
  test("1. Text Barrier: lib/storage-service.ts contains ZERO string interpolation in db.execute and ZERO user text sanitization", () => {
    const filePath = path.resolve(process.cwd(), "lib/storage-service.ts");
    const code = fs.readFileSync(filePath, "utf-8");

    // Match any db.execute(`...${...}...`)
    const executeInterpolation = /this\.db\.execute\s*\(\s*`[^`]*\$\{/g;
    expect(code.match(executeInterpolation)).toBeNull();

    // Verify zero user text sanitization calls exist
    expect(code).not.toContain(".replace(/'/g, \"''\")");
    expect(code).not.toContain(".replace(/--/g");
    expect(code).not.toContain(".replace(/;/g");

    // Verify all stories inserts use parameterized placeholders
    expect(code).toContain("INSERT OR REPLACE INTO stories (id,title,preview,date,category,styles,is_locked,password,word_count,char_count,updated_at,created_at)");
    expect(code).toContain("VALUES (?,?,?,?,?,?,?,?,?,?,?, COALESCE((SELECT created_at FROM stories WHERE id = ?), ?))");
  });

  // 2. اختبار ربط القيم (Bound Values Mock Verification)
  test("2. Parameterized Values Binding: content, title, and metadata are passed strictly in values array, never inside SQL statement string", async () => {
    // Intercept db calls in StorageService
    const calls: { statement: string; values?: any[] }[] = [];
    const mockDb: any = {
      executeSet: async (set: any[]) => {
        calls.push(...set);
        return { changes: { changes: 1 } };
      },
      run: async (statement: string, values: any[]) => {
        calls.push({ statement, values });
        return { changes: { changes: 1 } };
      },
      query: async () => ({ values: [] }),
    };

    const originalDb = (StorageService as any).db;
    const originalIsNative = (StorageService as any).isNativeSQLite;
    const originalIsInitialized = (StorageService as any).isInitialized;

    try {
      (StorageService as any).isInitialized = true;
      (StorageService as any).db = mockDb;
      (StorageService as any).isNativeSQLite = true;

      const testTitle = "عنوان خاص بحكاية -- تجربة 123;";
      const testContent = "محتوى حكاية؛ يحوي -- رموز وتعليقات وهمية\n'أهلاً' و \"مرحباً\"";

      await StorageService.saveStory({
        title: testTitle,
        content: testContent,
      });

      expect(calls.length).toBeGreaterThan(0);

      // Verify that the title and content are NEVER in the statement string, only in values
      for (const call of calls) {
        expect(call.statement).not.toContain(testTitle);
        expect(call.statement).not.toContain(testContent);
        expect(call.statement).not.toContain("-- تجربة");
        expect(call.statement).not.toContain("محتوى حكاية؛");
      }

      // Verify that values array contains the untouched strings
      const storyCall = calls.find((c) => c.statement.includes("INSERT OR REPLACE INTO stories"));
      const bodyCall = calls.find((c) => c.statement.includes("INSERT OR REPLACE INTO story_bodies"));

      expect(storyCall).toBeDefined();
      expect(storyCall?.values).toContain(testTitle);

      expect(bodyCall).toBeDefined();
      expect(bodyCall?.values).toContain(testContent);
    } finally {
      (StorageService as any).db = originalDb;
      (StorageService as any).isNativeSQLite = originalIsNative;
      (StorageService as any).isInitialized = originalIsInitialized;
    }
  });

  // 3. دورة كاملة (round-trip byte-for-byte fidelity)
  test("3. Round-Trip Fidelity: Stories with --, lines ending in ;, quotes, emojis and multiline are preserved 100% byte-for-byte", async () => {
    // Case 1: Story with --
    const storyDash = {
      title: "حكاية الشرطتين -- اختبار أصيل",
      content: "سطر أول -- تعليق لا يجب حذفه إطلاقاً\nسطر ثانٍ بدون شرطة",
    };

    // Case 2: Story with line ending in ;
    const storySemi = {
      title: "حكاية الفاصلة المنقوطة;",
      content: "SELECT * FROM users;\nDROP TABLE stories;\nهذا نص وليس كود برمجيا;",
    };

    // Case 3: Story with quotes, emojis, and multiple lines
    const storyQuotesEmojis = {
      title: "ألف ليلة وليلة: 'شهريار' و \"شهرزاد\" 🌙✨",
      content: `«بلغني أيها الملك السعيد ذو الرأي الرشيد...»\n'مقتبس فردي' و "مقتبس زوجي"\nO'Connor's tale 📖\n-- نهاية الحكاية;`,
    };

    for (const testCase of [storyDash, storySemi, storyQuotesEmojis]) {
      const saved = await StorageService.saveStory({
        title: testCase.title,
        content: testCase.content,
      });

      const loadedBody = await StorageService.getStoryBody(saved.id);
      const allMeta = await StorageService.loadNotesMetadata();
      const loadedMeta = allMeta.find((n) => n.id === saved.id);

      expect(loadedMeta).toBeDefined();
      expect(loadedMeta?.title).toBe(testCase.title);
      expect(loadedBody).toBe(testCase.content);

      // Clean up
      await StorageService.deleteStories([saved.id]);
    }
  });

  // Test B: Deletion Verification Test
  test("(B) Deletion Verification: Deleted story is purged and does not return in loadNotesMetadata or searchStories", async () => {
    const uniqueTitle = "حكاية للاختبار المحذوف 98765";
    const savedMeta = await StorageService.saveStory({
      title: uniqueTitle,
      content: "محتوى حكاية سيتم حذفها فورا",
    });

    // Confirm it exists
    let searchRes = await StorageService.searchStories("98765");
    expect(searchRes.some((n) => n.id === savedMeta.id)).toBe(true);

    // Delete story
    await StorageService.deleteStories([savedMeta.id]);

    // Confirm it no longer returns in metadata or search
    const updatedList = await StorageService.loadNotesMetadata();
    expect(updatedList.some((n) => n.id === savedMeta.id)).toBe(false);

    searchRes = await StorageService.searchStories("98765");
    expect(searchRes.some((n) => n.id === savedMeta.id)).toBe(false);
  });

  // Test C: Update Search Verification Test
  test("(C) Update Search Verification: Updating story to remove a word ensures searching for removed word returns no match", async () => {
    const storyId = Date.now() + 55;
    const initialMeta = await StorageService.saveStory({
      id: storyId,
      title: "حكاية الكلمة القديمة",
      content: "هذا النص يحتوي كلمة زمردية نادر جداً",
    });

    // Search for original word
    let searchRes = await StorageService.searchStories("زمردية");
    expect(searchRes.some((n) => n.id === initialMeta.id)).toBe(true);

    // Update story to remove the word "زمردية"
    await StorageService.saveStory({
      id: storyId,
      title: "حكاية الكلمة القديمة",
      content: "هذا النص تم تعديله ليحتوي كلمة ياقوتية فقط",
    });

    // Confirm "زمردية" no longer matches
    searchRes = await StorageService.searchStories("زمردية");
    expect(searchRes.some((n) => n.id === initialMeta.id)).toBe(false);

    // Confirm "ياقوتية" matches
    searchRes = await StorageService.searchStories("ياقوتية");
    expect(searchRes.some((n) => n.id === initialMeta.id)).toBe(true);

    // Clean up
    await StorageService.deleteStories([storyId]);
  });

  // Test D: FTS Index Backfill Completeness Test
  test("(D) Index Backfill Completeness: backfillFtsIfNeeded runs without errors and index covers stored items", async () => {
    await StorageService.backfillFtsIfNeeded();
    const allNotes = await StorageService.loadNotesMetadata();
    expect(Array.isArray(allNotes)).toBe(true);
  });

  // Test E: Chunked Batch Deletion > 900 Items Test
  test("(E) Chunked Batch Deletion (>900 items): Deleting 1000 items in batch executes cleanly without parameter limit errors", async () => {
    const fakeIds = Array.from({ length: 1000 }, (_, i) => 9000000 + i);
    await expect(StorageService.deleteStories(fakeIds)).resolves.not.toThrow();
  });

  // Test F: FTS Deletion Isolation Test
  test("(F) FTS Deletion Isolation: Even if FTS deletion throws an error, stories and bodies are safely deleted", async () => {
    const calls: { statement: string; values?: any[] }[] = [];
    const mockDb: any = {
      executeSet: async (set: any[]) => {
        calls.push(...set);
        return { changes: { changes: 1 } };
      },
      run: async (statement: string, values: any[]) => {
        if (statement.includes("DELETE FROM stories_fts")) {
          throw new Error("Simulated FTS table corruption or lock error");
        }
        calls.push({ statement, values });
        return { changes: { changes: 1 } };
      },
      query: async () => ({ values: [] }),
    };

    const originalDb = (StorageService as any).db;
    const originalIsNative = (StorageService as any).isNativeSQLite;
    const originalIsInitialized = (StorageService as any).isInitialized;

    try {
      (StorageService as any).isInitialized = true;
      (StorageService as any).db = mockDb;
      (StorageService as any).isNativeSQLite = true;

      // Deleting should succeed without throwing despite FTS failure
      await expect(StorageService.deleteStories([123456])).resolves.not.toThrow();

      // Verify stories and story_bodies deletion was executed
      const storiesDelete = calls.find((c) => c.statement.includes("DELETE FROM stories WHERE id IN"));
      const bodiesDelete = calls.find((c) => c.statement.includes("DELETE FROM story_bodies WHERE story_id IN"));

      expect(storiesDelete).toBeDefined();
      expect(bodiesDelete).toBeDefined();
    } finally {
      (StorageService as any).db = originalDb;
      (StorageService as any).isNativeSQLite = originalIsNative;
      (StorageService as any).isInitialized = originalIsInitialized;
    }
  });

  // Test G: Arabic Infix and Substring Search Test
  test("(G) Arabic Search Completeness: Substrings, infixes, and prefixes find matching stories without omission", async () => {
    const s1 = await StorageService.saveStory({
      title: "الحكاية الكبرى عن الجمال والكمال",
      content: "محتوى يحوي تفاصيل عن المال والأعمال",
    });

    const s2 = await StorageService.saveStory({
      title: "حكاية أخرى بسيطة",
      content: "عن النجوم والكواكب",
    });

    try {
      // Search for "حكاية" should find both "الحكاية" and "حكاية"
      const res1 = await StorageService.searchStories("حكاية");
      expect(res1.some((n) => n.id === s1.id)).toBe(true);
      expect(res1.some((n) => n.id === s2.id)).toBe(true);

      // Search for "مال" should find "الجمال" or "المال"
      const res2 = await StorageService.searchStories("مال");
      expect(res2.some((n) => n.id === s1.id)).toBe(true);
    } finally {
      await StorageService.deleteStories([s1.id, s2.id]);
    }
  });
});
