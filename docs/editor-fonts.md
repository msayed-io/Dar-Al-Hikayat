# Editor font library

Thirty-eight bundled Arabic families, plus the existing UI font as the editor's default option: 39 choices. The new fonts do not change application UI typography. All font files are bundled locally; no Google API key, runtime CDN, or network download is required. The collection combines reading, contemporary sans, calligraphic and display styles; decorative faces are not recommendations for long-form body text. It is not a mirror of the entire Google catalog.

## Provenance

`public/fonts/editor/SOURCES.json` pins upstream google/fonts and the additional Mikhak repository commit, source URLs, SHA-256, byte sizes, and actual weight axes. New family licence files also have pinned URLs and SHA-256 hashes. Each family includes its OFL licence. Font binaries are unmodified; two local variable-font filenames are URL-safe aliases. Total font binary size: 20,875,600 bytes across 78 files. The latest curated expansion adds 3,636,652 bytes in 16 original TTFs. `tests/editor-font-assets.test.ts` verifies integrity and catalog weights. Variable faces expose their real endpoints and standard 100-step weights within their real range (including Readex Pro 160 and Cairo 1000); static faces expose only bundled weights (Tajawal ExtraLight has the actual OS/2 weight 275, not an invented 200). No synthesized weights in previews or font-formatted text.

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

The font sheet now has an explicit **420px border-box height**, matching the previously measured approved family-list height, independent of family/weight count. A `calc(100vh - 112px)` maximum makes it smaller only on short viewports; dynamic viewport units are an optional `@supports` enhancement, never the sole constraint. The original v1.0.122 wrapper/list layout is retained: no added flex-basis or percentage height. The list keeps its original 418px maximum (viewport-capped), padding and internal scrolling. Header/footer capsules, dissolve layers, editor position and keyboard-selection logic are unchanged.

Root-cause reproduction in Chromium with unsupported `dvh` simulated in the stylesheet: the previous rules produced a 1626px panel with 31 choices. The corrected panel remained 420px for 7, 31 and 5031 rows and for the two-weight detail view. Six layout cases cover 320/390px widths, short 768×360 landscape (248px cap), and both modern/fallback styles. The scroll extent exceeded 240,000px without changing panel height or the editor/document scroll. This is a simulated compatibility test, not physical testing of an older Android WebView.

## Original-design restoration after v1.0.123

Restored `EditorFontSheet.css` from commit `102a330` (v1.0.122), applying only shell height/viewport limits and legacy-unit fallbacks. Removed the v1.0.123 inner flex-fill and percentage-height changes. Capsule styles, spacing, floating controls, original magnetic masks and blur strengths were taken directly from that reference, not recreated.

Pixel-comparison QA: 18 PNG-exact comparisons against the original stylesheet (three themes × top/middle/end scroll × modern/unsupported-dvh simulation). All match, including the areas under the floating capsules. Six size/scroll stress cases also pass with 5031 rows, two-weight detail/back, short landscape and stationary editor. These are Chromium tests, not physical Android WebView verification. TypeScript, 302 unit tests/36 files and the production web build pass.

## Eight-family quality-first expansion

No paid fonts or duplicate weight-as-family entries. The approved font-sheet CSS, capsules, dimensions and editor selection lifecycle are untouched. Font preview/formatting/loading use an optional browser-only alias for Zain, which otherwise collides with legacy UI declarations. Browser-family lookup maps that alias back to Zain for reopening and Word export, while bare legacy `Zain` still resolves to the editor default rather than falsely selecting the new font. All files are local and unmodified. Mikhak is pinned separately to `9dea055eb3dfc752879442224460c6e5d6ebe232`; its non-weight axes remain at their original defaults. Only upright faces are offered by the current weight-only picker; Zain/Rubik italic files are not advertised or bundled.

| Family | Actual offered weights |
| --- | --- |
| Fustat | 200, 300, 400, 500, 600, 700, 800 |
| Zain | 200, 300, 400, 700, 800, 900 — no invented 500/600 |
| Rubik | 300, 400, 500, 600, 700, 800, 900 |
| Alan Sans | 300, 400, 500, 600, 700, 800, 900 |
| Playpen Sans Arabic | 100, 200, 300, 400, 500, 600, 700, 800 |
| Estedad | 100, 200, 300, 400, 500, 600, 700, 800, 900 |
| Ruwudu | 400, 500, 600, 700 |
| Mikhak | 100, 200, 300, 400, 500, 600, 700, 800, 900 |

`tests/editor-font-binary-weights.test.ts` independently decodes SFNT `OS/2` and `fvar` tables for **every shipped family**, comparing the actual weights to both catalog and manifest. `scripts/verify-curated-font-shaping.py` (requires Python `fonttools` and `uharfbuzz`) checks base Arabic letters, marks, punctuation, joining substitutions and three HarfBuzz samples at every offered new weight (57 weight choices). It is an offline reproducible QA command, not an extra app dependency. Font selection is a visual preference; these tests establish glyph/shaping availability, not perfect typography in every Arabic passage.

Chromium checks load all 209 advertised weights across 39 choices, apply each of the 57 new weights to the exact selected word without editable focus, and exercise apply-all. Eighteen original-style pixel comparisons and six fixed-height/large-list cases pass with the expanded list (5039 stress rows). Physical Android shaping and DOCX receiving-app behaviour still require device/application testing.

Final curated-expansion checks: TypeScript, 306 tests/37 files and production build pass. The three pre-existing `Zain`→Thmanyah UI faces remain unchanged; the six new Zain faces use `Dar Editor Zain`. DOCX alias resolution is tested independently.
