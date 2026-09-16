import { describe, it, expect, beforeEach } from "vitest";
import { JSDOM } from "jsdom";
import {
  undoDiacritizeJob,
  cancelDiacritizeJob,
  resetActiveJobs,
  saveJobSnapshotForTest,
  canUndoDiacritize,
} from "../lib/tashkeel-pipeline";

describe("Tashkeel Pipeline Snapshots & Cancellation", () => {
  let dom: JSDOM;

  beforeEach(() => {
    resetActiveJobs();
    dom = new JSDOM(`<!DOCTYPE html><div id="editor-root"></div>`);
    global.document = dom.window.document;
    global.window = dom.window as any;
    global.HTMLElement = dom.window.HTMLElement;
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
});

