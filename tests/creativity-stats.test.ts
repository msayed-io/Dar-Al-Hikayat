import { describe, it, expect } from "vitest";
import {
  calculateTotalWords,
  calculateTotalStories,
  calculateAverageWords,
  calculateCompletedStories,
  calculateWeeklyActivity,
  calculateWritingStreak,
  calculateCreativityStats,
  formatArabicNumber,
  formatStatValue,
  MIN_DAILY_WORDS_STREAK,
  DailyWritingEntry,
} from "../lib/creativity-stats";
import { Note } from "../contexts/AppContext";

describe("Creativity Statistics - Mathematical Verification & Acceptance Tests", () => {
  // Mock helper to build notes
  const createMockNote = (
    id: number,
    wordCount: number,
    status?: "completed" | "draft" | "مكتملة" | "مسودة",
  ): Note => ({
    id,
    title: `حكاية ${id}`,
    content: `<p>محتوى الحكاية ${id}</p>`,
    preview: `محتوى الحكاية ${id}`,
    date: "١٥ يناير ٢٠٢٥",
    category: "حكاية",
    styles: {
      fontSize: 18,
      fontWeight: 400,
      textAlign: "right",
      textColor: "#121A1B",
      paperStyleIndex: 0,
    },
    word_count: wordCount,
    char_count: wordCount * 5,
    ...(status ? { status } : {}),
  });

  describe("Section 7 - Mandatory Acceptance Test Table", () => {
    it("computes exact expected results for stories A, B, C while excluding deleted story D", () => {
      // Story A: 1000 words, completed, not deleted
      const storyA = createMockNote(1, 1000, "مكتملة");
      // Story B: 2000 words, draft, not deleted
      const storyB = createMockNote(2, 2000, "مسودة");
      // Story C: 1500 words, completed, not deleted
      const storyC = createMockNote(3, 1500, "مكتملة");
      // Story D: 900 words, draft, deleted (not included in active notes array)

      const activeNotes = [storyA, storyB, storyC];

      const stats = calculateCreativityStats(activeNotes);

      // Row 1: Total Words = 4,500
      expect(stats.totalWords).toBe(4500);
      expect(formatStatValue(stats.totalWords)).toBe("٤٬٥٠٠");

      // Row 2: Total Stories = 3
      expect(stats.totalStories).toBe(3);
      expect(formatStatValue(stats.totalStories)).toBe("٣");

      // Row 3: Average Words = 1,500
      expect(stats.averageWords).toBe(1500);
      expect(formatStatValue(stats.averageWords)).toBe("١٬٥٠٠");

      // Row 6: Completed Stories = 2
      expect(stats.completedStories).toBe(2);
      expect(formatStatValue(stats.completedStories)).toBe("٢");

      // Invariant: Completed <= Total Stories
      expect(stats.completedStories!).toBeLessThanOrEqual(stats.totalStories);
    });

    it("immediately recalculates when a story is deleted", () => {
      const storyA = createMockNote(1, 1000, "مكتملة");
      const storyB = createMockNote(2, 2000, "مسودة");
      const storyC = createMockNote(3, 1500, "مكتملة");

      let notes = [storyA, storyB, storyC];
      expect(calculateTotalWords(notes)).toBe(4500);
      expect(calculateTotalStories(notes)).toBe(3);
      expect(calculateAverageWords(4500, 3)).toBe(1500);

      // Delete Story B (2000 words)
      notes = notes.filter((n) => n.id !== 2);
      const totalWordsAfter = calculateTotalWords(notes);
      const totalStoriesAfter = calculateTotalStories(notes);
      const avgAfter = calculateAverageWords(totalWordsAfter, totalStoriesAfter);

      expect(totalWordsAfter).toBe(2500);
      expect(totalStoriesAfter).toBe(2);
      expect(avgAfter).toBe(1250);
      expect(formatStatValue(avgAfter)).toBe("١٬٢٥٠");
    });

    it("returns null for average and '—' for display when account has 0 stories without NaN/Infinity", () => {
      const emptyNotes: Note[] = [];
      const stats = calculateCreativityStats(emptyNotes);

      expect(stats.totalWords).toBe(0);
      expect(formatStatValue(stats.totalWords)).toBe("٠");

      expect(stats.totalStories).toBe(0);
      expect(formatStatValue(stats.totalStories)).toBe("٠");

      expect(stats.averageWords).toBeNull();
      expect(formatStatValue(stats.averageWords)).toBe("—");
      expect(formatStatValue(stats.averageWords)).not.toContain("NaN");
      expect(formatStatValue(stats.averageWords)).not.toContain("Infinity");
    });
  });

  describe("Section 5 - Formatting & Special Cases", () => {
    it("abbreviates numbers >= 100,000 using 'ألف' without wrap", () => {
      expect(formatArabicNumber(100000)).toBe("١٠٠ ألف");
      expect(formatArabicNumber(125000)).toBe("١٢٥ ألف");
      expect(formatArabicNumber(125400)).toBe("١٢٥٫٤ ألف");
      expect(formatArabicNumber(12480)).toBe("١٢٬٤٨٠");
      expect(formatArabicNumber(8)).toBe("٨");
    });

    it("formats null and undefined as '—'", () => {
      expect(formatStatValue(null)).toBe("—");
      expect(formatStatValue(undefined)).toBe("—");
    });
  });

  describe("Streak & Weekly Calculations Logic", () => {
    const formatDateKey = (d: Date): string => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    it("maintains streak ending yesterday if today threshold is not yet reached without resetting", () => {
      const now = new Date();
      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const dayBeforeYesterday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 2,
      );

      const logs: DailyWritingEntry[] = [
        { dateStr: formatDateKey(dayBeforeYesterday), wordsAdded: 120 },
        { dateStr: formatDateKey(yesterday), wordsAdded: 60 },
        // Today has 0 words yet
      ];

      const streak = calculateWritingStreak([], logs);
      expect(streak).toBe(2);
      expect(formatStatValue(streak)).toBe("٢");
    });

    it("resets streak to 0 if a full day was skipped", () => {
      const now = new Date();
      const threeDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3);

      const logs: DailyWritingEntry[] = [
        { dateStr: formatDateKey(threeDaysAgo), wordsAdded: 150 },
        // Yesterday and day before yesterday skipped!
      ];

      const streak = calculateWritingStreak([], logs);
      expect(streak).toBe(0);
      expect(formatStatValue(streak)).toBe("٠");
    });

    it("calculates weekly activity correctly for a 7-day rolling window", () => {
      const now = new Date();
      const twoDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2);
      const fourDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 4);
      const tenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 10);

      const logs: DailyWritingEntry[] = [
        { dateStr: formatDateKey(twoDaysAgo), wordsAdded: 500 },
        { dateStr: formatDateKey(fourDaysAgo), wordsAdded: 300 },
        { dateStr: formatDateKey(tenDaysAgo), wordsAdded: 1000 }, // outside 7-day window
      ];

      const activity = calculateWeeklyActivity([], logs);
      expect(activity).toBe(800);
      expect(formatStatValue(activity)).toBe("٨٠٠");
    });

    it("returns null for weekly activity, streak, and completed when data is absent per audit rule", () => {
      // Normal notes without extra status or daily log fields
      const normalNotes: Note[] = [
        createMockNote(1, 500),
        createMockNote(2, 300),
      ];

      const stats = calculateCreativityStats(normalNotes);
      expect(stats.totalWords).toBe(800);
      expect(stats.totalStories).toBe(2);
      expect(stats.averageWords).toBe(400);

      // Absent data rows safely return null (rendered as "—")
      expect(stats.weeklyActivity).toBeNull();
      expect(formatStatValue(stats.weeklyActivity)).toBe("—");

      expect(stats.writingStreak).toBeNull();
      expect(formatStatValue(stats.writingStreak)).toBe("—");

      expect(stats.completedStories).toBeNull();
      expect(formatStatValue(stats.completedStories)).toBe("—");
    });
  });
});
