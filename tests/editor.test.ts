import { describe, it, expect, beforeEach } from "vitest";
import { JSDOM } from "jsdom";
import { validateBatchOperations, PlannedOperation } from "../lib/editor-block-system";

describe("Editor Block System - validateBatchOperations", () => {
  let dom: JSDOM;
  
  beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><div id="editor-root"></div>`);
    global.document = dom.window.document;
    global.window = dom.window as any;
    global.HTMLElement = dom.window.HTMLElement;
    (global as any).NodeFilter = dom.window.NodeFilter;
    global.Node = dom.window.Node;
  });

  function resetDOM(html: string) {
    const root = document.getElementById("editor-root")!;
    root.innerHTML = html;
    return root;
  }

  it("1. استبدال نص موجود مرة واحدة", () => {
    const root = resetDOM(`<p data-block-id="b_1">ذهبت إلى البيت مساءً.</p>`);
    const res = validateBatchOperations([
      { type: "REPLACE", blockId: "b_1", targetText: "البيت", newText: "المدرسة" }
    ], root);
    expect(res.isValid).toBe(true);
    expect(res.results[0].status).toBe("SUCCESS");
  });

  it("2. نص غير موجود", () => {
    const root = resetDOM(`<p data-block-id="b_1">ذهبت إلى البيت مساءً.</p>`);
    const res = validateBatchOperations([
      { type: "REPLACE", blockId: "b_1", targetText: "السوق", newText: "المدرسة" }
    ], root);
    expect(res.isValid).toBe(false);
    expect(res.results[0].status).toBe("NO_MATCH_FOUND");
  });

  it("3. نص متكرر", () => {
    const root = resetDOM(`<p data-block-id="b_1">البيت الكبير هو البيت القديم.</p>`);
    const res = validateBatchOperations([
      { type: "REPLACE", blockId: "b_1", targetText: "البيت", newText: "القصر" }
    ], root);
    expect(res.isValid).toBe(false);
    expect(res.results[0].status).toBe("AMBIGUOUS_MATCH");
  });

  it("4. معرف فقرة خاطئ", () => {
    const root = resetDOM(`<p data-block-id="b_1">البيت الكبير هو البيت القديم.</p>`);
    const res = validateBatchOperations([
      { type: "REPLACE", blockId: "b_999", targetText: "شيء", newText: "آخر" }
    ], root);
    expect(res.isValid).toBe(false);
    expect(res.results[0].status).toBe("BLOCK_NOT_FOUND");
  });

  it("5. منع حذف الفقرة الوحيدة", () => {
    const root = resetDOM(`<div class="editor-container"><p data-block-id="b_1">فقط هذه الفقرة.</p></div>`);
    const res = validateBatchOperations([
      { type: "DELETE", blockId: "b_1" }
    ], root.firstElementChild as HTMLElement);
    expect(res.isValid).toBe(false);
    expect(res.results[0].status).toBe("LAST_BLOCK");
  });

  it("6. عدة عمليات متتالية ناجحة (إدراج قبل وبعد، واستبدال وحذف)", () => {
    const root = resetDOM(`<div class="editor-container"><p data-block-id="b_1">الفقرة.</p><p data-block-id="b_2">الفقرة 2.</p></div>`);
    const res = validateBatchOperations([
      { type: "INSERT_BEFORE", blockId: "b_1", newText: "قبل" },
      { type: "INSERT_AFTER", blockId: "b_2", newText: "بعد" },
      { type: "REPLACE", blockId: "b_1", targetText: "الفقرة", newText: "النص" },
      { type: "DELETE", blockId: "b_2" }
    ], root);
    expect(res.isValid).toBe(true);
  });

  it("7. فشل في منتصف دفعة العمليات", () => {
    const root = resetDOM(`<div class="editor-container"><p data-block-id="b_1">الفقرة.</p><p data-block-id="b_2">الفقرة 2.</p></div>`);
    const res = validateBatchOperations([
      { type: "REPLACE", blockId: "b_1", targetText: "الفقرة", newText: "النص" },
      { type: "INSERT_AFTER", blockId: "b_1", newText: "فقرة جديدة" },
      { type: "REPLACE", blockId: "b_2", targetText: "غير موجود", newText: "خطأ" }
    ], root);
    expect(res.isValid).toBe(false);
    expect(res.results[2].isValid).toBe(false);
  });

  it("8. مطابقة النص العربي رغم التشكيل والمسافات الزائدة", () => {
    const root = resetDOM(`<p data-block-id="b_1">وَذَهَبَ   إِلَى البَيْتِ</p>`);
    const res = validateBatchOperations([
      { type: "REPLACE", blockId: "b_1", targetText: "وذهب إلى البيت", newText: "عاد" }
    ], root);
    expect(res.isValid).toBe(true);
    expect(res.results[0].status).toBe("SUCCESS");
  });

  // =========================================================================
  // حزمة S-Tools: اختبارات أدوات الدمج، النقل، والتقسيم
  // =========================================================================

  it("9. دمج فقرتين متجاورتين بنجاح (MERGE)", () => {
    const root = resetDOM(`
      <div class="editor-container">
        <p data-block-id="b_1">الفقرة الأولى.</p>
        <p data-block-id="b_2">الفقرة الثانية.</p>
      </div>
    `);
    const res = validateBatchOperations([
      { type: "MERGE", blockId: "b_1", targetBlockIdB: "b_2" }
    ], root);
    expect(res.isValid).toBe(true);
    expect(res.results[0].status).toBe("SUCCESS");
  });

  it("10. فشل دمج فقرتين غير متجاورتين (BLOCKS_NOT_ADJACENT)", () => {
    const root = resetDOM(`
      <div class="editor-container">
        <p data-block-id="b_1">الفقرة الأولى.</p>
        <p data-block-id="b_middle">فقرة فاصلة في الوسط.</p>
        <p data-block-id="b_2">الفقرة الثانية.</p>
      </div>
    `);
    const res = validateBatchOperations([
      { type: "MERGE", blockId: "b_1", targetBlockIdB: "b_2" }
    ], root);
    expect(res.isValid).toBe(false);
    expect(res.results[0].status).toBe("BLOCKS_NOT_ADJACENT");
  });

  it("11. نقل فقرة إلى بعد فقرة أخرى بنجاح (MOVE)", () => {
    const root = resetDOM(`
      <div class="editor-container">
        <p data-block-id="b_1">الفقرة 1.</p>
        <p data-block-id="b_2">الفقرة 2.</p>
        <p data-block-id="b_3">الفقرة 3.</p>
      </div>
    `);
    const res = validateBatchOperations([
      { type: "MOVE", blockId: "b_1", anchorBlockId: "b_3", position: "after" }
    ], root);
    expect(res.isValid).toBe(true);
    expect(res.results[0].status).toBe("SUCCESS");
  });

  it("12. منع نقل الفقرة إلى نفسها (BLOCK_NOT_FOUND)", () => {
    const root = resetDOM(`
      <div class="editor-container">
        <p data-block-id="b_1">الفقرة 1.</p>
        <p data-block-id="b_2">الفقرة 2.</p>
      </div>
    `);
    const res = validateBatchOperations([
      { type: "MOVE", blockId: "b_1", anchorBlockId: "b_1", position: "before" }
    ], root);
    expect(res.isValid).toBe(false);
    expect(res.results[0].status).toBe("BLOCK_NOT_FOUND");
  });

  it("13. شطر فقرة بنجاح عند نص محدد (SPLIT)", () => {
    const root = resetDOM(`
      <div class="editor-container">
        <p data-block-id="b_1">كانت ليلة هادئة. وفجأة دوى صوت انفجار في البعيد.</p>
      </div>
    `);
    const res = validateBatchOperations([
      { type: "SPLIT", blockId: "b_1", splitAfterText: "كانت ليلة هادئة." }
    ], root);
    expect(res.isValid).toBe(true);
    expect(res.results[0].status).toBe("SUCCESS");
  });

  it("14. فشل شطر الفقرة عند نص غير موجود (NO_MATCH_FOUND)", () => {
    const root = resetDOM(`
      <div class="editor-container">
        <p data-block-id="b_1">كانت ليلة هادئة تماماً.</p>
      </div>
    `);
    const res = validateBatchOperations([
      { type: "SPLIT", blockId: "b_1", splitAfterText: "نص غير موجود إطلاقاً" }
    ], root);
    expect(res.isValid).toBe(false);
    expect(res.results[0].status).toBe("NO_MATCH_FOUND");
  });

  it("15. فشل شطر الفقرة عند نص متكرر داخل نفس الفقرة (AMBIGUOUS_MATCH)", () => {
    const root = resetDOM(`
      <div class="editor-container">
        <p data-block-id="b_1">نقطة البداية هنا ثم نقطة البداية هناك.</p>
      </div>
    `);
    const res = validateBatchOperations([
      { type: "SPLIT", blockId: "b_1", splitAfterText: "نقطة البداية" }
    ], root);
    expect(res.isValid).toBe(false);
    expect(res.results[0].status).toBe("AMBIGUOUS_MATCH");
  });
});
