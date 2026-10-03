/**
 * Typing groups — the professional undo/redo granularity.
 *
 * How the mainstream editors behave (Word, Google Docs, Apple Notes; verified
 * against their documentation and observed keyboard behaviour):
 *  - a continuous burst of characters is coalesced into ONE undo step;
 *  - a word boundary (space/newline/punctuation) or a short pause closes the
 *    step, so the first Ctrl+Z removes the word just typed;
 *  - a deletion burst is its own step;
 *  - paste/format changes are always their own single step.
 *
 * This module is pure so the behaviour is unit-testable; the editor feeds it the
 * InputEvent data and applies the decision to its snapshot history.
 */

export const GROUP_IDLE_MS = 900;
export const GROUP_MAX_CHARS = 24;

export type TypingDecision = "merge" | "flush-new" | "new";

export interface TypingState {
  /** Timestamp of the last committed/extended group. */
  lastAt: number;
  /** Characters accumulated in the current group. */
  chars: number;
  /** True when the previous inserted character closed a word. */
  wordBoundary: boolean;
  /** True while the group holds only boundaries (a lone space/newline). */
  boundaryOnly: boolean;
  /** Kind of the last input: typing, deleting or a discrete action. */
  kind: "typing" | "deleting" | "other";
}

export const initialTypingState = (): TypingState => ({
  lastAt: 0,
  chars: 0,
  wordBoundary: true,
  boundaryOnly: true,
  kind: "other",
});

/** True when every character of the payload is a word boundary. */
function isBoundaryOnly(data: string): boolean {
  return !!data && Array.from(data).every((char) => isWordBoundary(char));
}

const WORD_BOUNDARY = /[\s\u00A0.,!?؟،;:؛\-—()"'«»[\]{}…\n\t]/;

/** True for a run of characters that closes the current word. */
export function isWordBoundary(data: string): boolean {
  return WORD_BOUNDARY.test(data);
}

/**
 * Decides how an input event interacts with the undo stack.
 *
 *  - "merge": extend the current step (fast letters inside the same word)
 *  - "flush-new": commit the previous step and start a new one (word finished,
 *    or the burst hit its size/time limit)
 *  - "new": discrete action (paste, cut, formatting) → always its own step
 */
export function decideTypingGroup(
  state: TypingState,
  data: string,
  now: number,
  options: { discrete?: boolean; deleting?: boolean } = {},
): TypingDecision {
  if (options.discrete) return "new";

  const idle = now - state.lastAt > GROUP_IDLE_MS;
  const kind: TypingState["kind"] = options.deleting ? "deleting" : "typing";

  if (options.deleting) {
    // Backspace runs group together; whatever came before is already closed.
    if (state.kind !== "deleting") return "new";
    return idle || state.chars >= GROUP_MAX_CHARS ? "new" : "merge";
  }

  if (state.kind !== "typing") return "new";
  if (idle) return "flush-new";
  // A lone space/newline is not a step of its own: it travels with the word
  // that follows, exactly like Word and Google Docs.
  if (state.boundaryOnly) return "merge";
  if (state.wordBoundary) return "flush-new";
  if (state.chars >= GROUP_MAX_CHARS) return "flush-new";
  if (isWordBoundary(data)) return "merge";

  return "merge";
}

/** The next state after applying a decision. */
export function nextTypingState(
  state: TypingState,
  decision: TypingDecision,
  data: string,
  now: number,
  options: { deleting?: boolean } = {},
): TypingState {
  const kind: TypingState["kind"] = options.deleting ? "deleting" : "typing";
  const fresh = {
    lastAt: now,
    chars: (data || "").length,
    wordBoundary: isWordBoundary(data || ""),
    boundaryOnly: isBoundaryOnly(data || ""),
    kind,
  };
  if (decision === "new" || decision === "flush-new") return fresh;
  return {
    lastAt: now,
    chars: state.chars + (data || "").length,
    wordBoundary: isWordBoundary(data || ""),
    boundaryOnly: state.boundaryOnly && isBoundaryOnly(data || ""),
    kind,
  };
}

/** Human-readable summary used by tests and debugging. */
export function describeDecision(decision: TypingDecision): string {
  return decision === "merge"
    ? "extend current undo step"
    : decision === "flush-new"
      ? "close the word and start a new undo step"
      : "discrete action, its own undo step";
}
