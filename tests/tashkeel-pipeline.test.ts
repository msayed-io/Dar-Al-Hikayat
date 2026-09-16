import { describe, it, expect, beforeEach, vi } from "vitest";
import { JSDOM } from "jsdom";
import {
  undoDiacritizeJob,
  cancelDiacritizeJob,
  resetActiveJobs,
  saveJobSnapshotForTest,
  canUndoDiacritize,
  runDiacritizeJob,
} from "../lib/tashkeel-pipeline";

describe("Tashkeel Pipeline Snapshots & Cancellation", () => {
  let dom: JSDOM;

  beforeEach(() => {
    resetActiveJobs();
    dom = new JSDOM(`<!DOCTYPE html><div id="editor-root"></div>`);
    global.document = dom.window.document;
    global.window = dom.window as any;
    global.HTMLElement = dom.window.HTMLElement;
    (global as any).CustomEvent = dom.window.CustomEvent;
    vi.restoreAllMocks();
  });

  it("handles cancellation gracefully when no job is active", () => {
    const res = cancelDiacritizeJob();
    expect(res).toBe(false);
  });

  it("safely handles non-existent job in undoDiacritizeJob", () => {
    const dummyRoot = document.createElement("div");
    dummyRoot.innerHTML = "<p>النص الأصلي</p>";
    let committed = false;
    const res = undoDiacritizeJob("non_existent_id", dummyRoot, () => {
      committed = true;
    });
    expect(res).toBe(false);
    expect(committed).toBe(false);
  });

  it("restores snapshot correctly on undoDiacritizeJob", () => {
    const dummyRoot = document.createElement("div");
    dummyRoot.innerHTML = '<div data-block-id="b_1"><p>نَصٌّ مُشَكَّلٌ</p></div>';
    const originalHtml = '<div data-block-id="b_1"><p>نص غير مشكل</p></div>';
    const testJobId = "job_test_123";

    saveJobSnapshotForTest(testJobId, originalHtml);
    expect(canUndoDiacritize(testJobId)).toBe(true);

    let committed = false;
    const res = undoDiacritizeJob(testJobId, dummyRoot, () => {
      committed = true;
    });

    expect(res).toBe(true);
    expect(committed).toBe(true);
    expect(dummyRoot.innerHTML).toBe(originalHtml);
    // Snapshot should be consumed/removed after undo
    expect(canUndoDiacritize(testJobId)).toBe(false);
  });

  it("correctly reports FAILED with honest reason when both AI attempts throw HTTP 500", async () => {
    const dummyRoot = document.createElement("div");
    dummyRoot.innerHTML = '<div data-block-id="b_1"><p>وقف الكاتب أمام النافذة يتأمل المطر.</p></div>';

    // Mock fetch to simulate 500 error on both attempts
    global.fetch = vi.fn().mockImplementation(async () => {
      return {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => ({ error: { message: "Internal Server Error: 500", code: 500 } }),
        text: async () => JSON.stringify({ error: { message: "Internal Server Error: 500", code: 500 } }),
      };
    });

    const res = await runDiacritizeJob({
      target: "b_1",
      rootElement: dummyRoot,
    });

    expect(res.status).toBe("FAILED");
    expect(res.error).toBeDefined();
    expect(res.error).toContain("خطأ في الخادم");
    expect(res.error).toContain("500");
    // Make sure text was NOT modified
    expect(dummyRoot.querySelector('[data-block-id="b_1"]')?.textContent).toBe(
      "وقف الكاتب أمام النافذة يتأمل المطر."
    );
  });

  it("reports SUCCESS with invariant skip reason when model responds 200 but text fails invariant", async () => {
    const dummyRoot = document.createElement("div");
    dummyRoot.innerHTML = '<div data-block-id="b_1"><p>وقف الكاتب أمام النافذة.</p></div>';

    // Model responds 200 but alters a forbidden letter or word
    global.fetch = vi.fn().mockImplementation(async () => {
      return {
        ok: true,
        json: async () => ({
          text: "[1] جلس الكاتب أمام النافذة.", // changed "وقف" to "جلس"
        }),
      };
    });

    const res = await runDiacritizeJob({
      target: "b_1",
      rootElement: dummyRoot,
    });

    expect(res.status).toBe("SUCCESS");
    expect(res.report?.done).toBe(0);
    expect(res.report?.skipped).toBe(1);
    expect(res.report?.skippedReasons?.[0]).toContain("تعذر مطابقة الثابت أو التحليل");
    // Text was not modified
    expect(dummyRoot.querySelector('[data-block-id="b_1"]')?.textContent).toBe(
      "وقف الكاتب أمام النافذة."
    );
  });
});


