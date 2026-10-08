# Surgical handwriting verification

Base: `228b3963bced16420ced8005f33691a28e56af1d` from main, checked against the remote before edits and again after the checks.

This is a separate Vite development entry, not imported by the app, with a DEV guard. No new application dependency, model, canvas layer, CSS change, or toolbar redesign is introduced.

## Reproduce

Use Node22, project dependencies, React19 type declarations, and Playwright Chromium in an external tooling directory. Neither application package.json nor a lockfile is changed by these repairs. In the recorded run, the tooling directory was `/var/tmp/dar-fix-tools`, and `node_modules` was a symlink to it.

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

CPU readback/handler measurements are desktop diagnostics, not input-to-photon or Android FPS. Physical stylus, Android WebView/backgrounding/SQLite, long-session native memory and release APK are unverified. The complete app dependency audit is not clean: the resolved unchanged application manifest includes advisories in existing PDF/build-tool dependencies. These repairs do not upgrade unrelated dependencies. No claim of a vulnerability-free application or unconditional release acceptance is made.
