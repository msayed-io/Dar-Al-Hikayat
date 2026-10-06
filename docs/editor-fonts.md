# Editor font library

Thirty bundled Arabic families (24 added in this expansion), plus the existing UI font as the editor's default option: 31 choices. The new fonts do not change application UI typography. All font files are bundled locally; no Google API key, runtime CDN, or network download is required. The collection combines reading, contemporary sans, calligraphic and display styles; decorative faces are not recommendations for long-form body text. It is not a mirror of the entire Google catalog.

## Provenance

`public/fonts/editor/SOURCES.json` pins the upstream google/fonts commit, source URLs, SHA-256, byte sizes, and actual weight axes. Each family includes its OFL licence. Font binaries are unmodified; two local variable-font filenames are URL-safe aliases. Total font binary size: 17,238,948 bytes across 62 files; this expansion adds 11,218,120 bytes in 45 files. `tests/editor-font-assets.test.ts` verifies integrity and catalog weights. Variable faces expose their real endpoints and standard 100-step weights within their real range (including Readex Pro 160 and Cairo 1000); static faces expose only bundled weights (Tajawal ExtraLight has the actual OS/2 weight 275, not an invented 200). No synthesized weights in previews or font-formatted text.

## Interaction and persistence

- Editor tools → Fonts closes tools and opens a nonmodal floating panel. Without a selection it applies to the current paragraph, including an empty paragraph.
- Selection capsule → Fonts targets exactly the selected text, even across formatting boundaries. Clicking another editor location or typing closes the panel rather than reusing an outdated target.
- Font name applies its regular face immediately; its bare chevron opens actual weights. Back returns to the library, X/Escape closes. Apply to all updates all current story/chapter body blocks and switches the current panel session to whole-document scope.
- No page backdrop or blur. The existing top/bottom masked dissolves are reused with shorter extents, over the scrollable font list only. Header/title/close and footer actions float over the list using the exact Home/Prayer capsule surface shared in `lib/floating-capsule.ts`. The panel measures the actual footer capsule, including split-pane mode. Opening it never adds document space or auto-scrolls the story.
- Browsing focuses a non-editable control first and then clears the live DOM selection; font targets remain in memory. Applying or closing remembers the range without calling `Selection.addRange`, which would focus contenteditable and summon Android IME. Normal editor input is neither disabled nor globally suppressed.
- Formatting lives in inline HTML with `data-editor-font`, so existing save, reopen, chapter serialization, and snapshot undo/redo preserve it. Text is split only at selection boundaries; links, highlights and block IDs remain intact. Empty paragraphs carry a default for subsequent typing.
- Font changes make discrete undo snapshots after capturing pending typed text. Chapter HTML synchronization also honors external undo/redo while focused.

## Export boundaries

PDF uses the locally loaded faces and preserves inline font formatting, including font-aware highlights. Word runs retain the selected family and regular/bold formatting for Arabic. **DOCX does not embed the fonts, and Word's handling of variable/intermediate weights depends on the receiving application and installed fonts**; pixel-identical appearance is not guaranteed there. Use PDF for fixed visual appearance. No claims of physical Android/OEM testing are made by the browser/unit suites.

## Expanded collection

Added Cairo, Tajawal, Almarai, Alexandria, Readex Pro, El Messiri, Changa, Harmattan, Lateef, Markazi Text, Mada, Vazirmatn, Kufam, Lalezar, Reem Kufi, Rakkas, Lemonada, Mirza, Gulzar, Noto Kufi Arabic, Marhey, Katibeh, Baloo Bhaijaan 2 and Qahiri. These are OFL-licensed upstream fonts, not copied commercial Canva/Adobe assets. Existing picker geometry, magnetic dissolves, selection handling and export implementations are unchanged by this expansion.

## Fixed-height Android WebView correction

The font sheet now has an explicit **420px border-box height**, matching the previously measured approved family-list height, independent of family/weight count. A `calc(100vh - 112px)` maximum makes it smaller only on short viewports; dynamic viewport units are an optional `@supports` enhancement, never the sole constraint. The wrapper has `flex: 1 1 0; min-height: 0`, and the padded list uses `height: 100%; box-sizing: border-box; overflow-y: auto`. Header/footer, dissolves, editor position and keyboard-selection logic are unchanged.

Root-cause reproduction in Chromium with unsupported `dvh` simulated in the stylesheet: the previous rules produced a 1626px panel with 31 choices. The corrected panel remained 420px for 7, 31 and 5031 rows and for the two-weight detail view. Six layout cases cover 320/390px widths, short 768×360 landscape (248px cap), and both modern/fallback styles. The scroll extent exceeded 240,000px without changing panel height or the editor/document scroll. This is a simulated compatibility test, not physical testing of an older Android WebView.
