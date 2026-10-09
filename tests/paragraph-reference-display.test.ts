/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { captureParagraphReferences, displayParagraphReferences, referencedParagraphIds, retainReferencedParagraphs } from '../lib/paragraph-reference-display';
import { detectAnalysisCalls, ANALYSIS_TOOLS } from '../lib/literary-analysis';
import { AGENTIC_TOOL_DECLARATIONS } from '../lib/ai-assistant-service';

describe('display-only paragraph resolution', () => {
  it.each(['b_8ebf0298', '[b_8ebf0298]', '`[b_8ebf0298]`', '`b_8ebf0298`', 'b\\_8ebf0298', '\\[b\\_8ebf0298\\]'])('resolves %s without changing input or source mapping', reference => {
    const refs = Object.freeze({ b_8ebf0298: 'رفعت عينيها الزرقاوين.' });
    expect(displayParagraphReferences('الفقرة ' + reference, refs)).toBe('الفقرة «رفعت عينيها الزرقاوين.»');
    expect(referencedParagraphIds(reference)).toEqual(['b_8ebf0298']);
  });
  it('does not touch IDs, HTML, node identities, selection, focus, or generate IDs for untagged paragraphs', () => {
    const root = document.createElement('article'); root.innerHTML = '<p data-block-id="b_a"><strong>نص أصلي</strong><br>سطر آخر</p><p>بلا معرّف</p>';
    document.body.append(root); const before = root.outerHTML; const nodes = [...root.querySelectorAll('*')];
    const range = document.createRange(); range.selectNodeContents(root.querySelector('strong')!); window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range);
    const observer = new MutationObserver(() => {}); observer.observe(root, { attributes: true, childList: true, subtree: true, characterData: true });
    const refs = captureParagraphReferences(root);
    expect(refs.b_a).toBe('نص أصلي\nسطر آخر'); expect(root.outerHTML).toBe(before); expect([...root.querySelectorAll('*')]).toEqual(nodes);
    expect(window.getSelection()!.toString()).toBe('نص أصلي'); expect(observer.takeRecords()).toEqual([]); observer.disconnect(); root.remove();
  });
  it('never guesses missing or duplicate paragraphs or uses another story snapshot', () => {
    const root = document.createElement('article'); root.innerHTML = '<p data-block-id="b_a">واحد</p><p data-block-id="b_a">اثنان</p>';
    expect(captureParagraphReferences(root).b_a).toBeNull();
    expect(displayParagraphReferences('[b_a]', captureParagraphReferences(root))).toContain('تعذّر العثور');
    expect(displayParagraphReferences('[b_missing]', {})).not.toContain('b_missing');
    expect(displayParagraphReferences('[b_a]', { b_a: null }, { currentFallback: { b_a: 'عمل آخر' } })).not.toContain('عمل آخر');
  });
  it('supports chapter-qualified IDs while rejecting ambiguous unqualified duplicates', () => {
    const refs = captureParagraphReferences(null, [{ id: 'one', content: '<p data-block-id="b_x">الفصل الأول</p>' }, { id: 'two', content: '<p data-block-id="b_x">الفصل الثاني</p>' }]);
    expect(refs.b_x).toBeNull(); expect(displayParagraphReferences('c2:b_x', refs)).toBe('«الفصل الثاني»');
  });
  it('does not mistake live chapters for duplicate stored copies', () => {
    const root = document.createElement('article'); root.innerHTML = '<section data-chapter-id="one"><p data-block-id="b_x">النص الحي</p></section>';
    const refs = captureParagraphReferences(root, [{ id: 'one', content: '<p data-block-id="b_x">نسخة قديمة</p>' }]);
    expect(refs.b_x).toBe('النص الحي'); expect(refs['c1:b_x']).toBe('النص الحي');
  });
  it('keeps raw model payload and persisted IDs intact; freezes only referenced paragraph snapshots', () => {
    const raw = { content: 'راجعي [b_one]', rawParts: [{ functionCall: { name: 'replace_text', args: { block_id: 'b_one' } } }] };
    const before = JSON.stringify(raw); const refs = retainReferencedParagraphs(raw.content, undefined, { b_one: 'القديم', b_two: 'غير مستخدم' });
    expect(refs).toEqual({ b_one: 'القديم' }); expect(displayParagraphReferences(raw.content, refs)).toContain('القديم');
    expect(retainReferencedParagraphs(raw.content, refs, { b_one: 'الجديد' })).toEqual(refs); expect(JSON.stringify(raw)).toBe(before);
  });
  it('labels current text used for old conversations rather than claiming it is the original quote', () => {
    expect(displayParagraphReferences('[b_one]', {}, { currentFallback: { b_one: 'النص الآن' } })).toContain('قد يختلف عن وقت الرد');
  });
  it('escapes paragraph markdown/HTML and does not recursively interpret IDs within quoted text', () => {
    const text = '<img src=x onerror=alert(1)> **نص** [رابط](javascript:alert(1)) b_other';
    const shown = displayParagraphReferences('[b_one]', { b_one: text }, { markdown: true });
    expect(shown).toContain('\\<img'); expect(shown).toContain('\\*\\*نص'); expect(shown).toContain('b\\_other');
    expect(displayParagraphReferences('https://example.org/b_one', { b_one: 'نص' })).toBe('https://example.org/b_one');
  });
});
describe('four tools only, without search', () => {
  it('removes the search declaration and route, preserving ordinary requests', () => {
    expect(Object.keys(ANALYSIS_TOOLS)).toHaveLength(4); expect(AGENTIC_TOOL_DECLARATIONS).toHaveLength(13);
    expect(JSON.stringify(AGENTIC_TOOL_DECLARATIONS)).not.toContain('historical_and_cultural_reference_agent');
    expect(detectAnalysisCalls('تحقق من المعلومة التاريخية بالبحث')).toEqual([]);
  });
  it.each(['لا تحلل الإيقاع', 'متراجعش أسلوب الكلام', 'مش عايزة مراجعة الشخصيات', 'ما تفحصش الحبكة', 'احذف الفقرة', 'استبدل اسم الشخصية'])('does not hijack negative or unrelated editing intent: %s', prompt => {
    expect(detectAnalysisCalls(prompt)).toEqual([]);
  });
});
