/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import {
  getStoryStorageKey,
  loadStoredConversationsFromStorage,
  saveStoredConversationsToStorage,
  type StoredConversation,
} from "../components/DarAlHikayatAIAssistant";
import { StorageService } from "../lib/storage-service";

describe("Per-Story AI Conversation Isolation & Local Phone Persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("generates isolated, deterministic keys per story and draft", () => {
    expect(getStoryStorageKey(101)).toBe("dar_alhikayat_ai_convs_story_101");
    expect(getStoryStorageKey("story_abc")).toBe("dar_alhikayat_ai_convs_story_story_abc");
    expect(getStoryStorageKey(null)).toBe("dar_alhikayat_ai_convs_draft");
    expect(getStoryStorageKey(undefined)).toBe("dar_alhikayat_ai_convs_draft");
    expect(getStoryStorageKey("")).toBe("dar_alhikayat_ai_convs_draft");
  });

  it("strictly isolates conversations between Story A and Story B", () => {
    const keyA = getStoryStorageKey(101);
    const keyB = getStoryStorageKey(202);

    const convA: StoredConversation[] = [
      {
        id: "conv-1",
        title: "حوار حول شخصية البطل في قصة أ",
        lastMessageAt: new Date("2026-10-09T10:00:00Z"),
        pinnedAt: null,
        messages: [
          {
            id: "m1",
            role: "user",
            content: "كيف نبني شخصية البطل؟",
            timestamp: new Date("2026-10-09T10:00:00Z"),
          },
        ],
      },
    ];

    const convB: StoredConversation[] = [
      {
        id: "conv-2",
        title: "تطوير مشهد الصحراء في قصة ب",
        lastMessageAt: new Date("2026-10-09T11:00:00Z"),
        pinnedAt: null,
        messages: [
          {
            id: "m2",
            role: "user",
            content: "صِف لي الصحراء وقت الغروب",
            timestamp: new Date("2026-10-09T11:00:00Z"),
          },
        ],
      },
    ];

    saveStoredConversationsToStorage(keyA, convA);
    saveStoredConversationsToStorage(keyB, convB);

    const loadedA = loadStoredConversationsFromStorage(keyA);
    const loadedB = loadStoredConversationsFromStorage(keyB);

    expect(loadedA).toHaveLength(1);
    expect(loadedA[0].title).toBe("حوار حول شخصية البطل في قصة أ");
    expect(loadedA[0].messages[0].content).toBe("كيف نبني شخصية البطل؟");

    expect(loadedB).toHaveLength(1);
    expect(loadedB[0].title).toBe("تطوير مشهد الصحراء في قصة ب");
    expect(loadedB[0].messages[0].content).toBe("صِف لي الصحراء وقت الغروب");

    // Zero cross-contamination
    expect(loadedA.some((c) => c.id === "conv-2")).toBe(false);
    expect(loadedB.some((c) => c.id === "conv-1")).toBe(false);
  });

  it("cleans up story AI conversation archive when story is deleted", async () => {
    const storyId = 999;
    const key = getStoryStorageKey(storyId);

    saveStoredConversationsToStorage(key, [
      {
        id: "conv-temp",
        title: "محادثة مؤقتة",
        lastMessageAt: new Date(),
        pinnedAt: null,
        messages: [],
      },
    ]);

    expect(loadStoredConversationsFromStorage(key)).toHaveLength(1);

    // Call deleteStories from StorageService
    await StorageService.deleteStories([storyId]);

    // Conversation archive for this deleted story should be wiped completely
    const remaining = loadStoredConversationsFromStorage(key);
    expect(remaining).toHaveLength(0);
    expect(localStorage.getItem(key)).toBeNull();
  });
});
