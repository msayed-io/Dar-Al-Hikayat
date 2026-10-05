# Editor font library

Six curated Arabic families plus the existing UI font as the editor's default option. The new fonts do not change application UI typography. All font files are bundled locally; no Google API key, runtime CDN, or network download is required. This is the initial curated library, not a mirror of the entire Google catalog.

## Provenance

`public/fonts/editor/SOURCES.json` pins the upstream google/fonts commit, source URLs, SHA-256, byte sizes, and actual weight axes. Each family includes its OFL licence. Font binaries are unmodified; two local variable-font filenames are URL-safe aliases. Total added font binary size: 6,020,828 bytes. `tests/editor-font-assets.test.ts` verifies integrity and catalog weights. Variable faces expose standard 100-step weights within their real range; static faces expose only bundled weights. No synthesized weights in previews or font-formatted text.

## Interaction and persistence

- Editor tools → Fonts closes tools and opens a nonmodal floating panel. Without a selection it applies to the current paragraph, including an empty paragraph.
- Selection capsule → Fonts targets exactly the selected text, even across formatting boundaries. Clicking another editor location or typing closes the panel rather than reusing an outdated target.
- Font name applies its regular face immediately; its bare chevron opens actual weights. Back returns to the library, X/Escape closes. Apply to all updates all current story/chapter body blocks and switches the current panel session to whole-document scope.
- No page backdrop or blur. The existing masked dissolve is reused only in a short strip over the scrollable font list. The panel measures the actual footer capsule, including split-pane mode. Additional temporary bottom space keeps selected text visible above it.
- Formatting lives in inline HTML with `data-editor-font`, so existing save, reopen, chapter serialization, and snapshot undo/redo preserve it. Text is split only at selection boundaries; links, highlights and block IDs remain intact. Empty paragraphs carry a default for subsequent typing.
- Font changes make discrete undo snapshots after capturing pending typed text. Chapter HTML synchronization also honors external undo/redo while focused.

## Export boundaries

PDF uses the locally loaded faces and preserves inline font formatting, including font-aware highlights. Word runs retain the selected family and regular/bold formatting for Arabic. **DOCX does not embed the fonts, and Word's handling of variable/intermediate weights depends on the receiving application and installed fonts**; pixel-identical appearance is not guaranteed there. Use PDF for fixed visual appearance. No claims of physical Android/OEM testing are made by the browser/unit suites.
