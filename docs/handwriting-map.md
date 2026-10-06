# Handwriting source map — Phase 0, NOT accepted

Baseline: `d8dc0956843aea75c720f56c7c58f0912f3e58ed` (v1.0.125). Review date: 2026-10-06. Production source is unchanged. Line numbers refer to that baseline.

## Actual data flow

`canvas pointerdown → synchronous dot → window pointermove/coalesced points → incremental quadratic segments → pointerup/cancel/blur → vector/history commit → redraw → Editor in-memory styles → explicit save → AppContext → StorageService → loaded note styles → Editor → handwriting canvas / Home preview`

The existing system is **already vector based**, already smooths using midpoint quadratics, and already has a partial vector eraser. It is not a raw bitmap engine to replace.

| Location | Responsibility / boundary |
|---|---|
| `components/DarAlHikayatHandwriting.tsx:11–25` | Stroke points: x/y/pressure/time; stroke id/color/width/points. No new schema introduced. |
| Same, `87`, `128–192` | Callback canvas ref + `canvasNode`; React stroke/history state and synchronous refs. |
| Same, `199–257` | Full redraw: identity clear, DPR transform, pan transform, dot/quadratic path/final tail. |
| Same, `273–282` | External initial-stroke synchronization and history reset. See late-restore failure below. |
| Same, `333–372` | Conditional mount sizing, viewport, rounded backing dimensions, DPR capped at 2, resize/visualViewport listeners, 150/400 ms retries. Protected. |
| Same, `374–413` | Body scroll/touch lock, mode transitions, reading viewport aligned to first ink. |
| Same, `416–488` | Explicit PNG export; change notifications; undo/redo with ref updates and repaint. |
| Same, `587–713` | Start/move/finish. First dot is synchronous. Incremental drawing is direct, not a React state update per point. Width is selected fixed width; pressure/time are recorded. |
| Same, `716–868` | Canvas down, window move/up/cancel, coalesced-event fallback, passive:false touch suppression, blur finalization. Two-finger transition intentionally cancels provisional ink and pans. |
| Same, `910–940` | Imperative handle exposes vectors/export/history/clear. |
| Same, `1191–1679` | Existing collapsed/expanded bottom controls and popups; custom SVG tools. No redesign permitted. |
| Same, `1681` | Portal to document.body, independent of transformed editor ancestors. |
| `lib/handwriting-eraser.ts` | Segment/circle intersections, interpolated boundaries, vector splitting, small-fragment pruning, AABB rejection. Existing eraser is not pixel alpha deletion. |
| `lib/handwriting-document.ts` | Valid-ink detection and top-of-ink SVG preview geometry. |
| `components/HandwritingPreview.tsx` | Vector preview, theme-neutral color handling; PNG fallback when no vectors. |
| `components/DarAlHikayatEditor.tsx:864–944` | Initial styles / legacy `dar_hw_ID` fallback; in-memory changes and dirty flag. |
| Same, `1862+` | Explicit save reads imperative live vectors/ruled state; optional PNG failure must not lose vectors; waits for save result. |
| Same, `4737+` | Canvas component wiring; saved/read/edit transitions. |
| `contexts/AppContext.tsx:212+` | Validation, await storage, update note list/selection only on success; return false on failure. |
| `lib/storage-service.ts:298,439,453+` | Metadata/body loading and save. Native SQLite uses styles JSON and parameterized executeSet; web uses safe localforage stores, with memory fallback when persistence is unavailable. Native path was read, not executed. |
| `components/HomePage.tsx:1600+` | Vector or legacy-PNG preview selection. |
| `lib/remote-editing.ts:372+` | Existing plain-text insertion utility; only a candidate for a future minimal editor caret hook. OCR must not invoke network/AI-editing workflows. |

## Render/lifecycle facts and baseline discoveries

- Two canvases: ruled/background layer and ink layer. Ruled layer must not intercept pointers. Fixed viewport portal, z-index 999999, overflow hidden, touch-action none are protected.
- Existing tool union: pen/eraser. Five base widths: 1.5, 3.5, 7, 13, 24. Eight existing colors. History cap is 50 snapshots.
- Live/final images currently differ: at the tested x=195,y=160, alpha is 0 while moving and 255 after lifting. Middle ink remains 255. Ink-only screenshot crop differs by 824 pixels. The source's live midpoint versus finalized endpoint is consistent with this observation. This is an existing baseline characteristic, not a new smoothing success.
- **Separate failing scenario:** an off-mounted empty handwriting component receives external initial strokes and edit activation together. Returned vectors equal the saved 31 vectors, but canvas alpha is zero, including after another 500 ms. Decoded RGBA differs in 51,308 channels from the saved image. Ref/state/effect repaint ordering is a likely cause; exact causal trace and a safe repair are not completed. No production fix was made.
- **Control:** preload metadata before first component mount, matching the tested normal editor opening path. StorageService save/reload vectors and raw RGBA match exactly in three consecutive desktop rounds. This control does NOT erase the late-update failure.
- **Actual app smoke:** open a synthetic old-schema note through Home, inspect the real editor in read mode, tap into edit, and make Chromium-emulated touch ink. Visible alpha confirmed. Full editor Save-button flow, actual historical user content and Android SQLite remain unverified.

## Safe insertion decisions — proposed boundaries, NOT implemented

1. Keep old stroke drawing/storage untouched. Any new rendering metadata must be optional and versioned, with an explicit legacy path and static kill switch returning original behavior.
2. Stage 1: isolated algorithm/calibration module; only minimal delegation in stroke start/move/finish and render selection after baseline gate. Never replace the synchronous initial dot, sizing, listeners, context configuration or portal. Measure perfect-freehand versus existing incremental quadratic behavior on Android before selecting it; no full-stroke recompute on every point without cost evidence.
3. Stage 2: preserve existing partial eraser as default; isolate object hit-testing/indexing and history transactions. New fragment semantics cannot silently reinterpret old ink.
4. Stage 3: versioned highlighter semantics with light/dark and stacking tests; only matched-DPR, pointer-transparent auxiliary layers if justified.
5. Stage 4: isolated polygon selection, transform geometry and history. Proportional resize and persistence must use the same document source of truth; do not mutate saved points behind history.
6. Stage 5: named hold threshold in 400–600 ms range BEFORE lift; recognition after stroke in Worker; preserve original color/width and undo-to-original. Arabic negative corpus required before enabling.
7. Stage 6: offline, bundled recognition behind explicit action; isolated Worker + minimal caret insertion callback, original vectors retained. No model selected and no OCR button added.
8. Stage 7: existing popup patterns first. Do not squeeze additional buttons into the fixed bar. A layout proposal needs approval if those patterns cannot accommodate the tools.

These are boundaries, not authorization to advance a failed gate. The late-restore case and missing Android baseline must be resolved first.

## Evidence and missing coverage

See `handwriting-invariants.md`, `handwriting-phase0-report.md`, `evidence/handwriting/`, and `../tools/handwriting-baseline/README.md`. Desktop instrumentation is outside production. No native Android timing, physical stylus, Logcat, persistent-memory stability, Arabic OCR accuracy, or recognition false-positive results exist yet.
