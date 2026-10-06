import { ensureBlockIdsInElement } from "./editor-block-system";
import { editorFontCssFamily, type EditorFont } from "./editor-fonts";

/** Text offsets, not live Range clones: survive normalization and preview changes. */
export interface FontTarget {
  root: HTMLElement;
  start: number;
  end: number;
  paragraph: HTMLElement | null;
}
function textOffset(root: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.setEnd(node, offset);
  return range.toString().length;
}
export function captureFontTargets(
  roots: HTMLElement[],
  range: Range | null,
): FontTarget[] {
  if (!range) return [];
  return roots
    .filter((root) => range.intersectsNode(root))
    .map((root) => {
      const start = root.contains(range.startContainer)
        ? textOffset(root, range.startContainer, range.startOffset)
        : 0;
      const end = root.contains(range.endContainer)
        ? textOffset(root, range.endContainer, range.endOffset)
        : (root.textContent || "").length;
      const node =
        range.startContainer.nodeType === Node.ELEMENT_NODE
          ? (range.startContainer as Element)
          : range.startContainer.parentElement;
      const block = node?.closest(
        "[data-block-id], p, div, h1, h2, h3, blockquote",
      ) as HTMLElement | null;
      return {
        root,
        start,
        end,
        paragraph:
          block && block !== root && root.contains(block) ? block : null,
      };
    });
}
function nodesIn(root: HTMLElement): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const result: Text[] = [];
  while (walker.nextNode()) result.push(walker.currentNode as Text);
  return result;
}
export function rangeForTarget(target: FontTarget): Range {
  const range = document.createRange();
  const collapsed = target.start === target.end;
  const scope =
    collapsed && target.paragraph?.isConnected ? target.paragraph : target.root;
  const base = scope === target.root ? 0 : textOffset(target.root, scope, 0);
  const nodes = nodesIn(scope);
  const point = (position: number, forward: boolean): [Node, number] => {
    let offset = 0;
    for (let i = 0; i < nodes.length; i++) {
      const text = nodes[i],
        end = offset + text.length;
      if (
        position < end ||
        (position === end && (!forward || i === nodes.length - 1))
      )
        return [text, Math.max(0, position - offset)];
      offset = end;
    }
    return [scope, scope.childNodes.length];
  };
  const [startNode, startOffset] = point(target.start - base, true);
  range.setStart(startNode, startOffset);
  if (collapsed) range.collapse(true);
  else {
    const [endNode, endOffset] = point(target.end - base, false);
    range.setEnd(endNode, endOffset);
  }
  return range;
}
function styleFont(element: HTMLElement, font: EditorFont, weight: number) {
  element.dataset.editorFont = font.id;
  element.style.setProperty(
    "font-family",
    `"${editorFontCssFamily(font)}", serif`,
    "important",
  );
  element.style.setProperty("font-weight", String(weight), "important");
  element.style.setProperty("font-synthesis", "none");
}
/** No extractContents/surroundContents across blocks: preserve links, highlight, IDs. */
export function applyFontToTarget(
  target: FontTarget,
  font: EditorFont,
  weight: number,
): boolean {
  if (!target.root.isConnected || !font.weights.includes(weight)) return false;
  const { root, start, end } = target;
  if (start === end) {
    ensureBlockIdsInElement(root);
    const paragraph = target.paragraph?.isConnected
      ? target.paragraph
      : (rangeForTarget(target).startContainer.parentElement?.closest(
          "[data-block-id]",
        ) as HTMLElement | null) || (root.firstElementChild as HTMLElement);
    if (!paragraph || !root.contains(paragraph)) return false;
    styleFont(paragraph, font, weight);
    paragraph
      .querySelectorAll<HTMLElement>("*")
      .forEach((el) => styleFont(el, font, weight));
    return true;
  }
  let offset = 0,
    changed = false;
  for (const text of nodesIn(root)) {
    const length = text.length;
    const from = Math.max(0, start - offset),
      to = Math.min(length, end - offset);
    offset += length;
    if (from >= to) continue;
    if (to < length) text.splitText(to);
    const selected = from > 0 ? text.splitText(from) : text;
    const parent = selected.parentElement!;
    if (
      parent.tagName === "SPAN" &&
      parent.hasAttribute("data-editor-font") &&
      parent.childNodes.length === 1
    )
      styleFont(parent, font, weight);
    else {
      const span = document.createElement("span");
      styleFont(span, font, weight);
      parent.insertBefore(span, selected);
      span.appendChild(selected);
    }
    changed = true;
  }
  ensureBlockIdsInElement(root);
  return changed;
}
export function applyFontToAll(
  roots: HTMLElement[],
  font: EditorFont,
  weight: number,
): boolean {
  if (!font.weights.includes(weight)) return false;
  for (const root of roots) {
    ensureBlockIdsInElement(root);
    // Store defaults on content blocks, not the transient editor div: saved HTML
    // and existing undo/redo snapshots therefore retain the complete formatting.
    root
      .querySelectorAll<HTMLElement>("*")
      .forEach((el) => styleFont(el, font, weight));
  }
  return roots.length > 0;
}
