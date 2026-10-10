import { Note } from "../contexts/AppContext";

export const MIN_DAILY_WORDS_STREAK = 50;

export interface DailyWritingEntry {
  dateStr: string; // YYYY-MM-DD
  wordsAdded: number;
}

export interface CreativityStats {
  totalWords: number;
  totalStories: number;
  averageWords: number | null;
  weeklyActivity: number | null;
  writingStreak: number | null;
  completedStories: number | null;
}

/**
 * Format a number into Arabic-Indic numerals ('ar-EG') with thousands separator.
 * When num >= 100,000, abbreviates with 'ألف' without text wrapping.
 */
export function formatArabicNumber(num: number): string {
  if (num >= 100000) {
    const inThousands = num / 1000;
    const formatted = inThousands.toLocaleString("ar-EG", {
      maximumFractionDigits: 1,
    });
    return `${formatted} ألف`;
  }
  return num.toLocaleString("ar-EG");
}

/**
 * Formats a stat value:
 * - If null or undefined: returns "—" (dash)
 * - If number: returns formatted Arabic numeral
 */
export function formatStatValue(val: number | null | undefined): string {
  if (val === null || val === undefined) {
    return "—";
  }
  return formatArabicNumber(val);
}

/**
 * Calculate total words across all existing (non-deleted) stories.
 */
export function calculateTotalWords(notes: Note[]): number {
  if (!Array.isArray(notes) || notes.length === 0) return 0;
  return notes.reduce((sum, n) => {
    let count = typeof n.word_count === "number" && n.word_count > 0 ? n.word_count : 0;
    if (count === 0) {
      if (n.content) {
        const clean = (n.content || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").trim();
        count = clean === "" ? 0 : clean.split(/\s+/).filter(Boolean).length;
      } else if (n.preview) {
        const clean = (n.preview || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").trim();
        count = clean === "" ? 0 : clean.split(/\s+/).filter(Boolean).length;
      }
    }
    return sum + count;
  }, 0);
}

/**
 * Calculate total number of non-deleted stories.
 */
export function calculateTotalStories(notes: Note[]): number {
  if (!Array.isArray(notes)) return 0;
  return notes.length;
}

/**
 * Calculate average words per story = round(totalWords / totalStories).
 * Returns null if totalStories === 0 to safely render "—".
 */
export function calculateAverageWords(
  totalWords: number,
  totalStories: number,
): number | null {
  if (totalStories <= 0) return null;
  return Math.round(totalWords / totalStories);
}

/**
 * Calculate weekly activity: net positive words added over the last 7 rolling days
 * (beginning 6 days ago in local device time to now).
 * Returns null if no daily writing log is available in the data.
 */
export function calculateWeeklyActivity(
  notes: Note[],
  dailyLogs?: DailyWritingEntry[],
): number | null {
  if (dailyLogs && Array.isArray(dailyLogs) && dailyLogs.length > 0) {
    const now = new Date();
    // Start of the day 6 days ago (local time)
    const startOfWindow = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 6,
      0,
      0,
      0,
      0,
    ).getTime();

    let totalAdded = 0;
    for (const entry of dailyLogs) {
      const entryTime = new Date(`${entry.dateStr}T00:00:00`).getTime();
      if (entryTime >= startOfWindow && entryTime <= now.getTime()) {
        totalAdded += Math.max(0, entry.wordsAdded || 0);
      }
    }
    return totalAdded;
  }

  // Check if any note has an explicit daily_words log attached
  const anyNoteHasDailyLog = notes.some(
    (n) => Array.isArray((n as any).daily_words) && (n as any).daily_words.length > 0,
  );
  if (anyNoteHasDailyLog) {
    const now = new Date();
    const startOfWindow = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 6,
      0,
      0,
      0,
      0,
    ).getTime();

    let totalAdded = 0;
    for (const n of notes) {
      const logs = (n as any).daily_words as DailyWritingEntry[];
      if (Array.isArray(logs)) {
        for (const entry of logs) {
          const entryTime = new Date(`${entry.dateStr}T00:00:00`).getTime();
          if (entryTime >= startOfWindow && entryTime <= now.getTime()) {
            totalAdded += Math.max(0, entry.wordsAdded || 0);
          }
        }
      }
    }
    return totalAdded;
  }

  // Per Section 4 audit rule: no daily writing log exists in current schema
  return null;
}

/**
 * Calculate consecutive writing streak of days meeting the 50-word threshold,
 * ending today or yesterday. Today does not break the streak before midnight.
 * Returns null if no daily writing log is available in the data.
 */
export function calculateWritingStreak(
  notes: Note[],
  dailyLogs?: DailyWritingEntry[],
): number | null {
  const getLogsMap = (): Map<string, number> | null => {
    if (dailyLogs && Array.isArray(dailyLogs) && dailyLogs.length > 0) {
      const map = new Map<string, number>();
      for (const entry of dailyLogs) {
        const current = map.get(entry.dateStr) || 0;
        map.set(entry.dateStr, current + Math.max(0, entry.wordsAdded || 0));
      }
      return map;
    }

    const anyNoteHasDailyLog = notes.some(
      (n) => Array.isArray((n as any).daily_words) && (n as any).daily_words.length > 0,
    );
    if (anyNoteHasDailyLog) {
      const map = new Map<string, number>();
      for (const n of notes) {
        const logs = (n as any).daily_words as DailyWritingEntry[];
        if (Array.isArray(logs)) {
          for (const entry of logs) {
            const current = map.get(entry.dateStr) || 0;
            map.set(entry.dateStr, current + Math.max(0, entry.wordsAdded || 0));
          }
        }
      }
      return map;
    }

    return null;
  };

  const logsMap = getLogsMap();
  if (!logsMap) {
    // Per Section 4 audit rule: no daily writing log exists in current schema
    return null;
  }

  const formatDateKey = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const now = new Date();
  const todayKey = formatDateKey(now);

  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yesterdayKey = formatDateKey(yesterday);

  const todayWords = logsMap.get(todayKey) || 0;
  const yesterdayWords = logsMap.get(yesterdayKey) || 0;

  // Streak start check
  let streak = 0;
  let checkDate: Date;

  if (todayWords >= MIN_DAILY_WORDS_STREAK) {
    // User already wrote today
    streak = 1;
    checkDate = yesterday;
  } else if (yesterdayWords >= MIN_DAILY_WORDS_STREAK) {
    // User hasn't reached threshold today yet, but streak through yesterday is active
    streak = 1;
    checkDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2);
  } else {
    // Yesterday also failed threshold -> streak broken
    return 0;
  }

  // Count backwards
  while (true) {
    const key = formatDateKey(checkDate);
    const words = logsMap.get(key) || 0;
    if (words >= MIN_DAILY_WORDS_STREAK) {
      streak += 1;
      checkDate = new Date(
        checkDate.getFullYear(),
        checkDate.getMonth(),
        checkDate.getDate() - 1,
      );
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Calculate completed stories count.
 * Returns null if no completion status field is defined across notes.
 */
export function calculateCompletedStories(notes: Note[]): number | null {
  if (!Array.isArray(notes)) return null;

  // Check if any note has an explicit completion flag or status
  const hasStatusField = notes.some(
    (n) =>
      (n as any).status !== undefined ||
      (n as any).is_completed !== undefined ||
      (n as any).isCompleted !== undefined ||
      n.category === "مكتملة",
  );

  if (!hasStatusField) {
    // Per Section 4 audit rule: no completion field in current Note schema
    return null;
  }

  return notes.filter((n) => {
    const status = (n as any).status;
    const isCompleted = (n as any).is_completed ?? (n as any).isCompleted;
    return (
      status === "completed" ||
      status === "مكتملة" ||
      isCompleted === true ||
      n.category === "مكتملة"
    );
  }).length;
}

/**
 * Master statistics selector function.
 */
export function calculateCreativityStats(
  notes: Note[],
  dailyLogs?: DailyWritingEntry[],
): CreativityStats {
  const totalWords = calculateTotalWords(notes);
  const totalStories = calculateTotalStories(notes);
  const averageWords = calculateAverageWords(totalWords, totalStories);
  const weeklyActivity = calculateWeeklyActivity(notes, dailyLogs);
  const writingStreak = calculateWritingStreak(notes, dailyLogs);
  const completedStories = calculateCompletedStories(notes);

  return {
    totalWords,
    totalStories,
    averageWords,
    weeklyActivity,
    writingStreak,
    completedStories,
  };
}
