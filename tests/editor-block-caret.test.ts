/** @vitest-environment jsdom */
import { afterEach, expect, it } from 'vitest';
import { ensureBlockIdsInElement } from '../lib/editor-block-system';
let root: HTMLDivElement;
function setup(html: string) {
 root = document.createElement('div');root.contentEditable = 'true';root.innerHTML = html;document.body.append(root);
 return window.getSelection()!;
}
afterEach(() => { window.getSelection()?.removeAllRanges();root?.remove(); });
it('preserves the caret after the first Arabic character is wrapped', () => {
 const s=setup('ر');const text=root.firstChild!;s.setBaseAndExtent(text,1,text,1);
 ensureBlockIdsInElement(root);
 expect(s.anchorNode).toBe(text);expect(s.anchorOffset).toBe(1);expect(s.isCollapsed).toBe(true);
 expect(root.textContent).toBe('ر');expect(root.firstElementChild?.hasAttribute('data-block-id')).toBe(true);
});
it('preserves a caret in the middle of text, not always the end', () => {
 const s=setup('رحمة');const text=root.firstChild!;s.setBaseAndExtent(text,2,text,2);
 ensureBlockIdsInElement(root);expect(s.anchorNode).toBe(text);expect(s.anchorOffset).toBe(2);
});
it('preserves backwards selections across inline nodes and a line break', () => {
 const s=setup('أ<b>ب</b><br>ج');const first=root.firstChild!,last=root.lastChild!;
 s.setBaseAndExtent(last,1,first,0);const selected=s.toString();ensureBlockIdsInElement(root);
 expect(s.anchorNode).toBe(last);expect(s.anchorOffset).toBe(1);expect(s.focusNode).toBe(first);expect(s.focusOffset).toBe(0);expect(s.toString()).toBe(selected);
});
it.each([0,1,2])('preserves a root boundary at offset %s during reparenting', offset => {
 const s=setup('أ<b>ب</b>');const nodes=Array.from(root.childNodes);s.setBaseAndExtent(root,offset,root,offset);
 ensureBlockIdsInElement(root);const wrapper=root.firstChild!;
 expect(s.anchorNode).toBe(wrapper);expect(s.anchorOffset).toBe(offset);expect(Array.from(wrapper.childNodes)).toEqual(nodes);
});
it('leaves a selection outside the normalized editor untouched', () => {
 const s=setup('ر');const other=document.createTextNode('خارج');document.body.append(other);s.setBaseAndExtent(other,2,other,2);
 ensureBlockIdsInElement(root);expect(s.anchorNode).toBe(other);expect(s.anchorOffset).toBe(2);other.remove();
});
it('normalization is idempotent and preserves the same block identifier', () => {
 const s=setup('ر');const text=root.firstChild!;s.setBaseAndExtent(text,1,text,1);
 expect(ensureBlockIdsInElement(root)).toBe(true);const html=root.innerHTML;expect(ensureBlockIdsInElement(root)).toBe(false);
 expect(root.innerHTML).toBe(html);expect(s.anchorNode).toBe(text);expect(s.anchorOffset).toBe(1);
});
