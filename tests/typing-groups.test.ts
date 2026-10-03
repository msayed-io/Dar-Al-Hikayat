/**
 * Undo granularity: the professional editor standard.
 *
 * Word, Google Docs and Apple Notes all coalesce a rapid typing burst into one
 * undo step and close it at a word boundary, a pause, or a burst-size limit;
 * deletes form their own step and paste is always discrete. These tests lock
 * that contract so undo can never regress to paragraph-sized steps again.
 */
import { describe, it, expect } from "vitest";
import {
  GROUP_IDLE_MS,
  GROUP_MAX_CHARS,
  decideTypingGroup,
  describeDecision,
  initialTypingState,
  isWordBoundary,
  nextTypingState,
  type TypingState,
} from "../lib/typing-groups";

/** Feeds a character sequence through the real decision/state pair. */
function feed(chars: string[], options: { start?: number; stepMs?: number; deleting?: boolean } = {}) {
  let state: TypingState = initialTypingState();
  let now = options.start ?? 1_000_000;
  const decisions: string[] = [];
  for (const char of chars) {
    const decision = decideTypingGroup(state, char, now, { deleting: options.deleting });
    decisions.push(decision);
    state = nextTypingState(state, decision, char, now, { deleting: options.deleting });
    now += options.stepMs ?? 120;
  }
  return { decisions, state, now };
}

describe("Word boundaries", () => {
  it("treats spaces, Arabic punctuation and newlines as boundaries", () => {
    for (const char of [" ", "\n", "\t", "،", "؟", ".", "!", "-", "«"]) {
      expect(isWordBoundary(char)).toBe(true);
    }
  });

  it("never treats a letter as a boundary", () => {
    for (const char of ["ا", "ب", "ح", "A", "z", "3"]) {
      expect(isWordBoundary(char)).toBe(false);
    }
  });
});

describe("Typing bursts", () => {
  it("merges a fast run of letters inside one word into a single step", () => {
    const { decisions } = feed(["م", "ر", "ح", "ب", "ا"]);
    expect(decisions).toEqual(["new", "merge", "merge", "merge", "merge"]);
  });

  it("closes the step right after a word boundary so Ctrl+Z removes the finished word", () => {
    const { decisions } = feed(["ا", "ل", "ح", "ك", "ا", "ي", "ة", " ", "و"]);
    // The space merges (it belongs to the word step), then the next letter opens a new step.
    expect(decisions.slice(0, 8)).toEqual(["new", "merge", "merge", "merge", "merge", "merge", "merge", "merge"]);
    expect(decisions[8]).toBe("flush-new");
  });

  it("treats a boundary-only group as mergeable even after a pause", () => {
    let state: TypingState = initialTypingState();
    state = nextTypingState(state, "new", " ", 10_000);
    expect(state.boundaryOnly).toBe(true);
    expect(decideTypingGroup(state, "ك", 10_000 + GROUP_IDLE_MS + 1)).toBe("flush-new");
  });

  it("opens a new step after a pause longer than the idle window", () => {
    let state: TypingState = initialTypingState();
    state = nextTypingState(state, decideTypingGroup(state, "ك", 10_000), "ك", 10_000);
    const decision = decideTypingGroup(state, "ت", 10_000 + GROUP_IDLE_MS + 1);
    expect(decision).toBe("flush-new");
  });

  it("merges when the pause is shorter than the idle window", () => {
    let state: TypingState = initialTypingState();
    state = nextTypingState(state, decideTypingGroup(state, "ك", 10_000), "ك", 10_000);
    expect(decideTypingGroup(state, "ت", 10_000 + GROUP_IDLE_MS)).toBe("merge");
  });

  it("closes the step once the burst reaches the character cap", () => {
    const { decisions } = feed(Array.from({ length: GROUP_MAX_CHARS + 3 }, () => "س"));
    // One flush is forced by the cap, and the counter restarts after it.
    expect(decisions.filter((decision) => decision === "flush-new").length).toBe(1);
    expect(decisions.filter((decision) => decision === "merge").length).toBe(GROUP_MAX_CHARS + 1);

    const saturated: TypingState = {
      lastAt: 50_000,
      chars: GROUP_MAX_CHARS,
      wordBoundary: false,
      boundaryOnly: false,
      kind: "typing",
    };
    expect(decideTypingGroup(saturated, "ص", 50_100)).toBe("flush-new");
  });
});

describe("Lone boundaries", () => {
  it("does not spend an undo step on a space: it joins the next word", () => {
    const { decisions } = feed([" ", "ج", "د", "ي", "د", "ة"]);
    expect(decisions).toEqual(["new", "merge", "merge", "merge", "merge", "merge"]);
  });

  it("still closes a real word when the space comes after letters", () => {
    const { decisions } = feed(["ق", "د", "ي", "م", "ة", " ", "و"]);
    expect(decisions[5]).toBe("merge"); // the space belongs to the finished word
    expect(decisions[6]).toBe("flush-new"); // the new word opens a step
  });
});

describe("Deletion bursts", () => {
  it("gives a backspace run its own step, separate from the typed word", () => {
    const typed = feed(["ن", "ص"]);
    const first = decideTypingGroup(typed.state, "", typed.now, { deleting: true });
    expect(first).toBe("new");
  });

  it("merges consecutive backspaces instead of one step per character", () => {
    let state: TypingState = initialTypingState();
    let now = 20_000;
    const deleteOnce = () => {
      const decision = decideTypingGroup(state, "", now, { deleting: true });
      state = nextTypingState(state, decision, "", now, { deleting: true });
      now += 90;
      return decision;
    };
    expect(deleteOnce()).toBe("new");
    expect(deleteOnce()).toBe("merge");
    expect(deleteOnce()).toBe("merge");
  });

  it("starts a fresh deletion step when the run pauses", () => {
    let state: TypingState = initialTypingState();
    state = nextTypingState(state, "new", "", 30_000, { deleting: true });
    const decision = decideTypingGroup(state, "", 30_000 + GROUP_IDLE_MS + 5, { deleting: true });
    expect(decision).toBe("new");
  });
});

describe("Discrete actions", () => {
  it("never merges a paste into the surrounding text step", () => {
    const typed = feed(["ف", "ص"]);
    expect(decideTypingGroup(typed.state, "نص طويل ملصوق", typed.now + 100, { discrete: true })).toBe("new");
  });

  it("keeps a discrete action discrete even inside a fast burst", () => {
    let state: TypingState = initialTypingState();
    state = nextTypingState(state, "new", "ب", 40_000);
    expect(decideTypingGroup(state, "نسخ", 40_050, { discrete: true })).toBe("new");
  });

  it("documents every decision for debugging", () => {
    expect(describeDecision("merge")).toContain("extend");
    expect(describeDecision("flush-new")).toContain("close");
    expect(describeDecision("new")).toContain("discrete");
  });
});
