# Handwriting invariants and gate ledger

Baseline `d8dc0956843aea75c720f56c7c58f0912f3e58ed`; 2026-10-06. **Phase 0 is blocked, not accepted.** No phase-ok tag is justified.

## Repair history to preserve

| Commit | Observed repair / relevant root cause |
|---|---|
| `d7c9b84` | Conditional canvas mount did not trigger layout sizing reliably; callback `canvasNode` makes the sizing effect run when the actual node exists. Prevents default 300×150 backing store, blur/scale/displacement. |
| `518c59f` | Removed viewport-bounds culling that could suppress ink; body scroll lock; valid fallback stroke/fill colors. Do not reintroduce those assumptions. |
| `5113c86` | Viewport/DPR≤2 handling and global pointer/touch cancellation behavior. Its temporary object-style eraser is superseded by `53999ab`. |
| `acf2221` | Pointer/touch/root-viewport handling and avoidance of problematic pointer-capture cancellation. |
| `11b0096` | Duplicate style prop correction; preserve the resultant style pipeline. |
| `c814522` | Portal / 1:1 viewport / navigation work. Do not move the canvas back under editor transforms. |
| `b886f63` | Theme-independent background and consistent capsule header. |
| `53999ab` | True partial vector erasing: split at circle intersections rather than delete the entire stroke. |
| `4ed3cbb` | Save/read/exit/title/top-ink preview behavior. |
| `4015748` | Inking/eraser/batching work; do not treat its performance comments as measurements. |
| `a470717`, `1bd9e41` | Original implementation; git history traces quadratic smoothing to `a470717`, not to this upgrade. |

History excerpt: `evidence/handwriting/history.txt`. Root-cause statements derive from source/history inspection; they are not a claim to have rerun old APKs or reproduced every historical failure on Android.

## Invariants

| ID | Rule | Evidence/status now |
|---|---|---|
| I01 | Pointerdown must synchronously create visible alpha; no await/library/Worker/state scheduling before first ink. | Real desktop canvas passes three rounds. Mutation suppressing fill/stroke fails with FIRST_PIXEL_MISSING. Physical input-to-photon latency unknown. |
| I02 | Motion adds visible ink and lifting never removes committed ink. | Middle alpha 255 during and after lift. Existing tail extends on lift; live/final identity NOT established. |
| I03 | Tool switch, undo/redo and canvas remount preserve correct visible vectors. | Tested pen↔eraser, undo blank/redo exact, off/edit exact, and 31 rapid strokes. Actual erasing sweep has existing unit tests; no new Android sweep measurement. |
| I04 | Save/reopen vectors and rendered content are nondestructive. | Preloaded-note StorageService web roundtrip: exact vectors/RGBA ×3. Late external update + activation: FAIL, empty canvas despite 31 vectors. Actual editor seeded-old-schema opening passes. Native save/reopen untested. |
| I05 | DPR, contexts, canvasNode effect, transforms, CSS, window/touch listeners remain unchanged. | Zero production content changes. Tested backing size 780×1640 for 390×820 at DPR2. Real Android viewport/IME/rotation coverage missing. |
| I06 | Bottom bar dimensions, spacing, icons, colors and animations are protected. | No production UI edit; screenshots/geometry recorded. Hidden expand-button rect is intentionally outside viewport during expanded state; it is not a visible clipping assertion. |
| I07 | No per-point React state / full-history copying, no heavy synchronous recognition, no idle/background loops added. | None added. Full long-session/idle-native performance audit pending. |
| I08 | Old vectors/legacy PNG remain readable; new schema optional/versioned, flags fall back to old path. | No schema or flags introduced. Existing tests passed; synthetic old-schema app fixture opens. Real historical note corpus / legacy-PNG Android visual validation pending. |
| I09 | Stroke history is one coherent transaction per semantic action. | Existing undo/redo and unit suite pass. Lasso/highlighter/shape/OCR history not implemented. |
| I10 | Recognition is local, bundled, explicit, outside inking hot path; original ink retained. | No recognition or model installed. No user ink sent to external services. Candidate web research uses public documentation only. |
| I11 | Shape recognition cannot convert Arabic letters/digits based merely on closure. | No recognizer enabled; negative corpus and measurements missing. |
| I12 | Build, desktop tests and vendor benchmarks cannot substitute for Android gate. | Android gate blocked; no SDK/adb/emulator/KVM, Java11 in this workspace. |

## Honest gate ledger

- PASS: desktop normal-path real-canvas suite, three consecutive rounds.
- PASS: deliberate dev-only fill/stroke mutation is detected; mutation affects only a fresh browser context and never production files. Subsequent non-mutated late-restore run passes first-pixel checks and reaches its independently failing assertion.
- PASS: actual editor old-schema fixture opening and Chromium CDP-emulated touch first pixel.
- PASS: TypeScript check, 306 tests / 37 files (one full unit run this phase), production web build.
- PASS: dev marker search finds no `__hwBaseline`, `FIRST_PIXEL_MISSING`, or fixture marker in production JS.
- FAIL: separate late-restore invariant; not ignored, not xfail'd into a green overall gate.
- BLOCKED: Android short/520-point/many-stroke baseline, min/intermediate/latest matrix, actual background/restore, Logcat, physical stylus, long-session memory, complete suite ×3 on target platform.
- NOT STARTED: stages 1–7. No phase-ok tags, no merge, no handwriting APK.

Desktop runs report two canvas-readback advisory warnings per round from diagnostic getImageData calls; they have zero page errors. We did NOT change production context attributes to silence the warnings. `willReadFrequently` can change the rasterization path; measurements with readback instrumentation must not be represented as uncontaminated GPU frame timing.

## Required Android gate, still pending

Proposed matrix: API24 minimum, API30 intermediate, and API37 current Android17 documented platform. Project compile/target remains36; testing on API37 does not authorize changing it. Record exact Android build, WebView package/version, ABI, resolution, DPR, refresh rate, device/GPU and release/debug build mode. Official Android17/API37 reference: [1](https://developer.android.com/about/versions/17/behavior-changes-17).

For each stage, baseline and candidate must use the same device, workload, build mode and instrumentation. Collect first CPU-visible ink plus independently measured presentation/input-to-photon latency where feasible, frame intervals/jank, handler costs, native/PSS and JS memory after repeated comparable cycles. Short strokes, ≥500-point strokes, many strokes, gestures, background, rotation/viewport, save/reopen and old-content screenshots are mandatory. A three-round desktop pass is NOT the requested final complete-suite three-run pass.

Manual physical-device checklist (all currently **غير مُتحقَّق منه**):

- Finger and stylus: tap dot, slow/fast stroke, lift, immediately start another stroke, pressure transitions.
- Pen/eraser changes, partial erasing, undo/redo, save, Home reopen, process kill/relaunch, airplane mode.
- Background mid-stroke and after lift; lock/unlock; navigation and pointer cancellation.
- One/two-finger transitions, long page pan, rotation, keyboard show/hide outside drawing, status/navigation bars.
- Light/dark themes; bar collapse/expand and each existing popup; no OS selection menu inside drawing.
- ≥30-minute repeated drawing/erase/history/save cycles with bounded post-GC memory and no idle rendering loop. Duration is a proposed test protocol, not an executed result.

## Stop rules

Do not alter protected core for the late-update issue before agreeing the bounded repair. Do not move to stage1 without an Android baseline. Do not choose OCR or add a misleading button without authentic Arabic samples, agreed accuracy threshold, local measurements and bundling/license clearance. Do not create phase-ok tags or merge main while any gate is unresolved.
