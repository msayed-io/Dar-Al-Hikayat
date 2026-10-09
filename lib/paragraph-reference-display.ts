/** Presentation only. Never assign IDs, write editor DOM, or rewrite execution/history payloads. */
export type ParagraphReferences = Record<string, string | null>;
const token = String.raw`(?:c\d+:)?b(?:_|\\_)(?:[A-Za-z0-9-]|\\?_)+`;
const canonical = (id: string) => id.replace(/\\_/g, '_');
export function referencedParagraphIds(content: string): string[] {
  return [...new Set(Array.from(content.matchAll(new RegExp(token, 'g')), m => canonical(m[0])))];
}
function nodeText(element: Element): string {
  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll('script,style,noscript').forEach(n => n.remove());
  clone.querySelectorAll('br').forEach(n => n.replaceWith('\n'));
  return (clone.textContent || '').trim();
}
export function captureParagraphReferences(root: HTMLElement | null | undefined, chapters: Array<{ id: string; content: string }> = []): ParagraphReferences {
  const result: ParagraphReferences = Object.create(null);
  const visited = new Set<Element>();
  const add = (key: string, value: string) => { result[key] = Object.prototype.hasOwnProperty.call(result, key) ? null : value || null; };
  const collect = (host: Element, prefix?: string) => {
    const elements = [host, ...Array.from(host.querySelectorAll('[data-block-id]'))].filter(e => e.hasAttribute('data-block-id'));
    for (const element of elements) {
      const id = element.getAttribute('data-block-id')!;
      if (!/^b_[\w-]+$/.test(id)) continue;
      const value = nodeText(element);
      if (!visited.has(element)) { add(id, value); visited.add(element); }
      if (prefix) add(prefix + id, value);
    }
  };
  if (root) collect(root);
  chapters.forEach((chapter, i) => {
    const live = root && [root, ...Array.from(root.querySelectorAll('[data-chapter-id]'))].find(e => e.getAttribute('data-chapter-id') === chapter.id);
    const host = live || (chapters.length === 1 && root ? root : new DOMParser().parseFromString(chapter.content, 'text/html').body);
    collect(host, `c${i + 1}:`);
  });
  return result;
}
const escapeMarkdown = (s: string) => s.replace(/[\\`*_{}\[\]<>#|!]/g, '\\$&');
export function displayParagraphReferences(content: string, references: ParagraphReferences = {}, options: { markdown?: boolean; currentFallback?: ParagraphReferences } = {}): string {
  const pattern = new RegExp(String.raw`\x60?(?:\\?\[)?(${token})(?:\\?\])?\x60?`, 'g');
  return content.replace(pattern, (match, raw: string, offset: number) => {
    // Leave actual URLs intact; this resolver is for prose references, not destinations.
    if (/https?:\/\/[^\s<>]*$/.test(content.slice(0, offset))) return match;
    const id = canonical(raw);
    const saved = Object.prototype.hasOwnProperty.call(references, id);
    const value = saved ? references[id] : options.currentFallback?.[id];
    if (!value) return '«تعذّر العثور على نص الفقرة المشار إليها»';
    const quoted = options.markdown ? escapeMarkdown(value) : value;
    return `${saved ? '' : 'النص الحالي للفقرة (قد يختلف عن وقت الرد): '}«${quoted}»`;
  });
}
/** Persist only referenced source text, not another copy of the whole manuscript per message. */
export function retainReferencedParagraphs(content: string, existing: ParagraphReferences | undefined, snapshot: ParagraphReferences): ParagraphReferences {
  const result = { ...existing };
  for (const id of referencedParagraphIds(content)) {
    if (!Object.prototype.hasOwnProperty.call(result, id)) result[id] = snapshot[id] ?? null;
  }
  return result;
}
