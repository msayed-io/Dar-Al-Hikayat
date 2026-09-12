/**
 * Verification Script for Manual Mention System (نظام الاستهداف اليدوي)
 * Tests:
 * 1. findTextInContent with EXACT UNIQUE_MATCH
 * 2. findTextInContent with EXACT MULTI_MATCH
 * 3. findTextInContent with NORMALIZED UNIQUE_MATCH
 * 4. findTextInContent with NORMALIZED MULTI_MATCH
 * 5. findTextInContent with NO_MATCH
 * 6. validateAndHealMentions (VALID match)
 * 7. validateAndHealMentions (HEALED after offset shifts)
 * 8. validateAndHealMentions (HEALED after block relocation)
 * 9. validateAndHealMentions (DROPPED when text removed)
 * 10. formatMentionsForPrompt structure and formatting
 */

import {
  findTextInContent,
  validateAndHealMentions,
  formatMentionsForPrompt,
  type AttachedMention,
} from "../lib/editor-block-system";

// Minimal mock DOM nodes for Node environment
class MockTextNode {
  nodeType = 3;
  nodeValue: string;
  parentNode: any = null;
  childNodes: any[] = [];
  constructor(text: string) {
    this.nodeValue = text;
  }
  get length() {
    return this.nodeValue.length;
  }
}

class MockHTMLElement {
  nodeType = 1;
  tagName: string;
  attributes: Record<string, string> = {};
  childNodes: any[] = [];
  parentNode: any = null;

  constructor(tagName = "p") {
    this.tagName = tagName.toUpperCase();
  }

  setAttribute(name: string, value: string) {
    this.attributes[name] = value;
  }

  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  hasAttribute(name: string): boolean {
    return name in this.attributes;
  }

  removeAttribute(name: string) {
    delete this.attributes[name];
  }

  appendChild(child: any) {
    child.parentNode = this;
    this.childNodes.push(child);
  }

  get textContent(): string {
    return this.childNodes
      .map((c) => (c.nodeType === 3 ? c.nodeValue : c.textContent))
      .join("");
  }

  querySelectorAll(selector: string): any[] {
    const results: any[] = [];
    function traverse(node: any) {
      for (const child of node.childNodes) {
        if (child.nodeType === 1) {
          if (selector === "[data-block-id]" && child.hasAttribute("data-block-id")) {
            results.push(child);
          } else if (selector.startsWith('[data-block-id="')) {
            const id = selector.slice(16, -2);
            if (child.getAttribute("data-block-id") === id) {
              results.push(child);
            }
          }
          traverse(child);
        }
      }
    }
    traverse(this);
    return results;
  }

  querySelector(selector: string): any | null {
    const list = this.querySelectorAll(selector);
    return list.length > 0 ? list[0] : null;
  }
}

function createBlock(id: string, text: string): MockHTMLElement {
  const p = new MockHTMLElement("p");
  p.setAttribute("data-block-id", id);
  p.appendChild(new MockTextNode(text));
  return p;
}

function runTests() {
  console.log("=== STARTING MENTION SYSTEM TESTS ===");

  const root = new MockHTMLElement("div");
  const b1 = createBlock("block-1", "كانت الكاتبة رحمة تجلس في غرفتها الهادئة.");
  const b2 = createBlock("block-2", "وفجأة انبعثت أصوات غريبة من الشرفة، فتأملت المشهد.");
  const b3 = createBlock("block-3", "كانت الكاتبة تكتب روايتها بشغف كبير.");
  root.appendChild(b1);
  root.appendChild(b2);
  root.appendChild(b3);

  // Test 1: EXACT UNIQUE_MATCH
  const res1 = findTextInContent("غرفتها الهادئة", root as any);
  console.log("Test 1 (Exact Unique):", res1.status === "UNIQUE_MATCH" && res1.match?.blockId === "block-1" ? "PASS" : "FAIL", res1);

  // Test 2: EXACT MULTI_MATCH
  const res2 = findTextInContent("كانت الكاتبة", root as any);
  console.log("Test 2 (Exact Multi):", res2.status === "MULTI_MATCH" && res2.occurrences === 2 ? "PASS" : "FAIL", res2);

  // Test 3: NORMALIZED UNIQUE_MATCH (e.g. without tatweel/tashkeel or subtle hamza)
  const res3 = findTextInContent("غرفتها الـهـادئة", root as any); // with tatweel
  console.log("Test 3 (Normalized Unique):", res3.status === "UNIQUE_MATCH" && res3.match?.blockId === "block-1" ? "PASS" : "FAIL", res3);

  // Test 4: NO_MATCH
  const res4 = findTextInContent("نص غير موجود إطلاقا في القصة", root as any);
  console.log("Test 4 (No Match):", res4.status === "NO_MATCH" && res4.occurrences === 0 ? "PASS" : "FAIL", res4);

  // Test 5: Validation - VALID
  const mentionValid: AttachedMention = {
    id: "m-1",
    blockId: "block-1",
    selectedText: "غرفتها الهادئة",
    startOffset: 26,
    endOffset: 40,
  };
  const valRes1 = validateAndHealMentions([mentionValid], root as any);
  console.log("Test 5 (Validate Valid):", valRes1.valid.length === 1 && valRes1.healed.length === 0 ? "PASS" : "FAIL", valRes1);

  // Test 6: Validation - HEALED (offset shifted)
  const mentionShifted: AttachedMention = {
    id: "m-2",
    blockId: "block-1",
    selectedText: "غرفتها الهادئة",
    startOffset: 0, // Wrong start offset
    endOffset: 14,
  };
  const valRes2 = validateAndHealMentions([mentionShifted], root as any);
  console.log("Test 6 (Validate Healed Shifted):", valRes2.healed.length === 1 && valRes2.healed[0].startOffset === 26 ? "PASS" : "FAIL", valRes2);

  // Test 7: Validation - HEALED (relocated to different block)
  const mentionRelocated: AttachedMention = {
    id: "m-3",
    blockId: "block-999", // Non-existent block
    selectedText: "فتأملت المشهد",
    startOffset: 0,
    endOffset: 13,
  };
  const valRes3 = validateAndHealMentions([mentionRelocated], root as any);
  console.log("Test 7 (Validate Healed Relocated):", valRes3.healed.length === 1 && valRes3.healed[0].blockId === "block-2" ? "PASS" : "FAIL", valRes3);

  // Test 8: Validation - DROPPED (text deleted)
  const mentionDeleted: AttachedMention = {
    id: "m-4",
    blockId: "block-1",
    selectedText: "نص محذوف بالكامل",
    startOffset: 0,
    endOffset: 15,
  };
  const valRes4 = validateAndHealMentions([mentionDeleted], root as any);
  console.log("Test 8 (Validate Dropped):", valRes4.dropped.length === 1 && valRes4.valid.length === 0 && valRes4.healed.length === 0 ? "PASS" : "FAIL", valRes4);

  // Test 9: formatMentionsForPrompt
  const formatted = formatMentionsForPrompt([mentionValid]);
  console.log("Test 9 (Format Mentions):", formatted.includes("block-1") && formatted.includes("غرفتها الهادئة") ? "PASS" : "FAIL", "\n" + formatted);

  console.log("=== ALL TESTS COMPLETED ===");
}

runTests();
