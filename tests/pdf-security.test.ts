/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const pdf = vi.hoisted(() => {
  const worker = { set: vi.fn(), from: vi.fn(), outputPdf: vi.fn() };
  worker.set.mockImplementation(() => worker);
  worker.from.mockImplementation(() => worker);
  return { worker, factory: vi.fn(() => worker) };
});
vi.mock('html2pdf.js/src/index.js', () => ({ default: pdf.factory }));
import { exportStoryToPdf } from '../lib/pdf-export';
const styles = { fontSize: 20, fontWeight: 400, textAlign: 'right' as const, textColor: '#121A1B', paperStyleIndex: 0 };
const theme = { bg: '#fff', text: '#121A1B', secondary: '#444' };
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers();
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } });
  pdf.worker.outputPdf.mockResolvedValue(new Blob(['%PDF-test'], { type: 'application/pdf' }));
});
afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });
async function run(content: string) {
  const work = exportStoryToPdf('عنوان عربي', content, styles, theme);
  await vi.advanceTimersByTimeAsync(1501);
  return work;
}
describe('PDF export security boundary', () => {
  it('removes event handlers, script tags and executable links BEFORE content enters the live DOM', async () => {
    const work = exportStoryToPdf('عنوان عربي', '<p>نص<img src="data:image/png;base64,!" onerror="window.bad=1"><a href="javascript:alert(1)">رابط</a><script>window.bad=1</script></p>', styles, theme);
    const host = document.body.lastElementChild!;
    expect(host.querySelector('[onerror]')).toBeNull();
    expect(host.querySelector('script')).toBeNull();
    expect(host.querySelector('a')?.hasAttribute('href')).toBe(false);
    await vi.advanceTimersByTimeAsync(1501); await work;
    expect(document.body.children).toHaveLength(0);
  });
  it('preserves Arabic, explicit font weights, highlights and editor font metadata', async () => {
    await run('<p>رحمة <span data-editor-font="amiri" style="font-family: Amiri; font-weight:400; background-color:#ffe600">تكتب</span> <strong>حكايتها</strong></p>');
    const source = pdf.worker.from.mock.calls[0][0] as HTMLElement;
    const span = source.querySelector('[data-editor-font="amiri"]') as HTMLElement;
    expect(source.textContent).toContain('رحمة تكتب حكايتها');
    expect(span.style.fontFamily).toBe('Amiri');
    expect(span.style.fontWeight).toBe('400');
    expect(span.style.backgroundColor).toBe('rgb(255, 230, 0)');
    expect(pdf.worker.set.mock.calls[0][0].jsPDF.hotfixes).toEqual(['px_scaling']);
    expect(pdf.worker.outputPdf).toHaveBeenCalledWith('blob');
  });
  it('removes the export UI even when the PDF library rejects', async () => {
    pdf.worker.outputPdf.mockRejectedValue(new Error('controlled export failure'));
    const work = exportStoryToPdf('عنوان', '<p>نص</p>', styles, theme);
    const rejection = expect(work).rejects.toThrow('controlled export failure');
    await vi.advanceTimersByTimeAsync(1501); await rejection;
    expect(document.body.children).toHaveLength(0);
  });
});
