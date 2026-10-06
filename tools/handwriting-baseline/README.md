# Development-only handwriting baseline probes

**Not an Android gate and not a new handwriting engine.** Uses the real component, real Chromium Canvas2D, and the real web StorageService. Not imported by app entrypoints; not copied into `public/`. Main TSX has a DEV guard. Production build marker scan passed.

## Recorded environment

Node22, Playwright1.63.0, headless Chromium153.0.8010.12; 390×820 CSS px, DPR2. Dependencies/browser were installed outside the repository in `/var/tmp/dar-tools`; `node_modules` is a symlink. Temporary tooling is not guaranteed to survive workspace snapshots. No app package manifest or lockfile was edited. See `docs/evidence/handwriting/toolchain.json`.

From repo root, with project dependencies and Playwright available to Node:

```sh
# Terminal / long-running process; must accept preview host if accessed remotely.
npx vite --host 0.0.0.0 --port 3000

# Normal preloaded-note control: 3 consecutive rounds, real pixel assertions.
node tools/handwriting-baseline/run.cjs

# Expected exit 1, with FIRST_PIXEL_MISSING: intentional first-ink break.
node tools/handwriting-baseline/run.cjs --mutation

# Expected exit 1 at the baseline revision: independent lifecycle failure.
node tools/handwriting-baseline/run.cjs --late-restore

# Actual Home→Editor opening of synthetic old-schema note + emulated touch.
node tools/handwriting-baseline/editor-smoke.cjs
```

Use `PLAYWRIGHT_BROWSERS_PATH` for a nondefault browser install. `HW_BASE_URL` and `HW_EVIDENCE` override the main runner URL/output folder. The actual-editor smoke currently uses local port3000 and the standard evidence folder. These localhost addresses are for the sandbox Node runner, not user-facing browser code.

The normal runner checks first alpha, movement, post-lift middle ink, pen↔eraser pixel identity, undo/redo, 31 rapid strokes, synthetic blur, off/edit remount, web save/reload vectors and decoded RGBA, then short16-point / long520-point / 40×20-point workloads. Tool geometry/screenshots are evidence, not an automated complete design approval.

## Important distinctions

- `?restore=1` loads persisted vectors BEFORE first handwriting component mount, as in the tested normal editor opening. The original failed test instead supplied vectors to an already-mounted empty/off component and activated it in the same update. That path remains explicitly reproducible with `--late-restore`; its failure is NOT dismissed or patched out.
- The late scenario yields 31 vectors with zero visible alpha, still zero after an additional500ms. A repair has not been made. Preloaded-note control passes exact raw-pixel comparison; no tolerance was relaxed.
- `save()` exercises actual web storage but bypasses the full Editor/AppContext save-button transaction. `editor-smoke.cjs` exercises actual editor opening, NOT its Save-button path.
- Fixture IDs880000001 and880000009 exist only in fresh isolated browser contexts; no user notes are edited. The old-schema fixture is synthetic, not a recovered historical user document.
- Mutation replaces fill/stroke only for the ink canvas inside a fresh page context. No production source is modified, and closing the browser restores normal behavior. The failing scenario is intentionally an exit1 assertion, not a skipped test.
- CPU-visible alpha timing includes synthetic dispatch and readback; it is NOT display/input-to-photon latency. `meanRafHz` is observed callback cadence, NOT proven rendered FPS. The many-stroke harness inserts a frame between strokes, inflating some intervals toward33ms by design.
- Heap snapshots are sampled JS heap values before/after short runs, not native/PSS or post-GC leak evidence. `getImageData` readback can perturb performance; warnings are recorded without changing production context attributes.
- Browser emulation and dispatched blur do not prove Android WebView, native backgrounding, SQLite, physical touch/stylus, pressure, palm rejection or display behavior.
- Do not use these results to tag Phase0/1 accepted. Android gates and the independent late-update failure remain open.
