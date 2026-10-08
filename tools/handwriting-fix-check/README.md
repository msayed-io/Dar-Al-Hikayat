# Ink-only rollback notice

At the user’s request, new pen drawing/storage now use the original 228b396 midpoint drawing and legacy replay path. History, shape/hold safeguards, lasso/eraser/highlighter fixes, PDF security and removal of text recognition remain unchanged. The versioned renderer and metadata helpers remain solely for compatibility with existing v1.0.127 saved ink; no saved notes are migrated or rewritten.

The browser runner below documents the previous repair and is historical: its live-versus-lift equality assertions are no longer the requested acceptance criterion for new legacy ink. Use `node tools/handwriting-fix-check/ink-rollback.cjs` with the original228b396 on port3171 and this tree on port3170. It checks identical live/lift pixels and point data for touch/pen in light/dark themes (40 snapshots); existing v1 read compatibility and retained tools are covered by the unit suite. These are desktop synthetic inputs, not a physical-device acceptance test.

---

# Surgical handwriting verification

Base: `228b3963bced16420ced8005f33691a28e56af1d` from main, checked against the remote before edits and again after the checks.

This is a separate Vite development entry, not imported by the app, with a DEV guard. The handwriting-only commit introduces no application dependency, model, canvas layer, CSS change, or toolbar redesign. A separately authorized PDF/dependency security follow-up is documented below.

## Reproduce

Use Node22, project dependencies, React19 type declarations, and Playwright Chromium in an external tooling directory. The handwriting-only commit did not change dependencies. For the final security follow-up, install the committed manifest and bun.lock with `bun install --frozen-lockfile` (recorded Bun 1.4.2). The final application node_modules symlink targeted `/var/tmp/dar-locked/node_modules`; external Playwright/Node tooling stayed in `/var/tmp/dar-fix-tools`. Set NODE_PATH to the external tooling node_modules when running the CJS browser scripts.

1. Serve the repaired tree with Vite on port3170.
2. Extract `git archive 228b396` into a temporary directory, add the same external node_modules symlink, and copy only this development entry's index.html/main.tsx into its tools/handwriting-fix-check directory. Serve that original tree on port3171.
3. Run `node tools/handwriting-fix-check/run.cjs`. Set PLAYWRIGHT_BROWSERS_PATH if Chromium is installed outside the default path.
4. Optional environment variables: HW_URL, HW_ORIGINAL, HW_EVIDENCE. The default evidence directory is `/home/user/handwriting-fix-evidence`.
5. Run `vitest run` and `tsc --noEmit` separately from the memory-heavy comparison servers. The recorded clean typecheck used NODE_OPTIONS=--max-old-space-size=1400. Then run the existing web build.

The runner makes isolated browser contexts and synthetic notes. It does not access a user's browser profile, data or device. It uses actual component Canvas2D and actual web StorageService, but not Android SQLite or the full editor save-button transaction.

## Coverage

- Exact old-format ink PNG identity against original code, light/dark themes.
- Exact toolbar DOM geometry and class identity against original code.
- Synchronous pen and highlighter alpha, motion, pen-up image identity.
- Pen/eraser switching; exact undo/redo images; real web storage/reload vectors and image identity.
- Selection frame excluded from exported PNG without changing the existing canvas layers.
- Lasso move and proportional scale, including pointerup before the queued animation frame; width metadata and undo preserved.
- No shape conversion without hold; conversion after hold; undo to original stroke/redo to shape; movement invalidation; no conversion on cancellation or blur.
- 520 movement samples, forty rapid strokes, partial and whole-stroke erasers and their undo/redo.
- Three consecutive complete browser rounds, zero page errors.

The separate regression test file uses jsdom for lifecycle/history and pure geometry checks. Those tests are NOT raster evidence. Eight tests were also exercised against the original source and failed; this includes new-format/helper coverage as well as reproduction of existing lifecycle/shape/history defects. The final suite has additional feature-switch coverage.

## Repair design boundaries

New pen strokes carry `renderVersion: 1` and optional per-point `inkWidth`. Replay and SVG previews use the same midpoint segments and recorded widths as live drawing; finishing does not append a differently rendered tail. Old strokes with no version keep their original renderer. Width metadata is scaled/interpolated during transforms/erasing, not recalculated from transformed point velocity.

A completed hold is required before shape conversion; resumed movement invalidates the candidate. History stores original ink immediately before its converted shape, preserving undo-to-original. Existing native pointer listeners, transforms, DPR/sizing and portal placement remain intact.

The current highlighter blending appearance is intentionally retained, not replaced with a new blend/layer architecture. Only first-mark timing and loss of tool metadata during partial erasing are repaired. Lasso transformations coalesce geometry work per animation frame and flush the last sample at lift; no pen-point React state update is added.

## Limits / release decision

CPU readback/handler measurements are desktop diagnostics, not input-to-photon or Android FPS. Physical stylus, Android WebView/backgrounding/SQLite, long-session native memory and release APK are unverified. The original audit found existing critical PDF and moderate build-tool advisories. The separately authorized follow-up now passes the project Bun lockfile audit and external npm audit with zero known advisories at the time of checking. This is not a general security certification. No claim of a vulnerability-free application or unconditional release acceptance is made.


## Authorized PDF/dependency follow-up

- Pin html2pdf.js 0.14.0 and DOMPurify 3.4.16; bun.lock resolves jsPDF 4.2.1.
- Import `html2pdf.js/src/index.js`, not its default prebuilt distribution: the latter embeds jsPDF 4.0.0 and DOMPurify 3.3.1 despite a clean external dependency audit. The package is pinned because this is a source entry, not a future-version compatibility promise.
- Sanitize the parsed body before attaching it to the live DOM. A benign invalid data-image/onerror marker executed before the repair and does not execute after it. No user data or remote exfiltration endpoint is used.
- Pin Capacitor CLI 8.4.1 to avoid the xcode → vulnerable uuid chain without a forced transitive major override. Core/Android remain at resolved 8.5.3. `cap sync android` passed in a disposable copy; native compilation/device behavior remains unverified.
- Include upstream PDF dependency license notices in public/licenses. No application CSS, font files, Android source, or workflow is modified.
- Final checks: clean frozen install; typecheck; 332 tests in 40 files × 3; real Canvas × 3; web build; shipped PDF version inspection; genuine PDF pixel comparison. Existing build chunk-size warning remains.

### PDF reproduction

`pdf.cjs` exports synthetic Arabic short, rich/highlight/font, and four-page fixtures through the genuine application function. It loads the real EditorFonts.css and verifies Amiri 400/700 faces load rather than silently relying on fallback fonts. Use `PDF_SIDE=before|after`, `PDF_CASE=short|rich|long`, and optional `HW_EVIDENCE`. Run sides separately on memory-constrained hosts.

The original tree must use a separately installed html2pdf.js 0.10.3 default distribution, via a temporary baseline-only Vite alias. Sharing upgraded dependencies without this alias is not an old-versus-new PDF comparison. The final rich-font outputs, and every page of the other fixtures, matched exactly after rasterization with PyMuPDF. PDF Producer changed from jsPDF 3.0.4 to 4.2.1. This is sample-based desktop verification, not a claim about all fonts/documents or Android PDF export.

`tests/pdf-security.test.ts` guards sanitization before live insertion, Arabic/font/highlight preservation, and cleanup on failure. Its library is mocked; the browser exports and raster comparison provide the independent real-library evidence.
