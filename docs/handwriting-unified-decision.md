# Unified implementation decision — user amendment

Date: 2026-10-06, after the Phase0 report. This document supersedes the **sequential development gate / late-restore blocking decision** in that report; it does not retroactively change test outcomes.

## User-authorized changes

1. Keep `run.cjs --late-restore` intact and executable. Its known failure is an explicit scope exception, not a blocker to feature development. Do not repair the production engine for this scenario. Do not report that assertion as passing.
2. Develop stages1–7 together on `handwriting-upgrade`, rather than waiting for independent stage gates. One integrated feature branch does **not** require a monolithic source file: isolated modules and surgical hooks remain mandatory.
3. Preserve earlier safeguards that were not explicitly revoked: immediate synchronous first ink, refs/direct canvas hot path, no per-point React state or heavy recognition, unchanged bottom-bar design, additive data, legacy rendering, offline privacy, real tests and honest verification status.
4. No merge to main or invented acceptance/phase-ok tags. Changes may be developed together, but unmeasured behavior must not be described as validated.

The user reports stable real-world production/web/phone/tablet behavior. That report is recorded as user-provided evidence; this agent has not independently performed Android tests in this workspace.

## Git backup now completed

After the user supplied fresh authorization, the following refs were pushed and checked with ls-remote:

- `refs/heads/handwriting-upgrade` → `7dbe4d32617526d120400f154841c6e6a66ade74` at initial publication of the Phase0 package.
- `refs/tags/handwriting-baseline-pre-upgrade^{}` → `d8dc0956843aea75c720f56c7c58f0912f3e58ed`.

No force push, main merge, release dispatch, or phase-ok tag occurred. The previous authentication failure log remains historical evidence, not the current publication status. Credentials are not stored in project files or this document.

## Incomplete amendment received

Both custom-response fields contained the same amendment and ended in the middle of section3 after:

> مسار الرسم الحي (Hot Path): الالتزام المطلق بـ (Refs) والرسم المباشر على الـ Canvas

The remainder of the strict execution guarantees was not received. It must not be invented. Ask for the remaining text in a normal message, rather than another long custom-option response, before editing protected core integration points. This is clarification of missing instructions, not reinstatement of the cancelled sequential gates.

## Unified scope, not completed features

- Incremental smoothing/velocity width with named calibration and measured library/alternative decision.
- Existing partial vector eraser preserved; object eraser added through consistent history/spatial hit testing.
- Highlighter compositing and drawing-only selection suppression; light/dark and stacking evidence.
- Polygon lasso and proportional transforms with nondestructive persistence/history.
- Conservative hold-before-lift shape recognition off the hot path, with Arabic negative corpus.
- Bundled offline Arabic OCR in an isolated lazy Worker, original ink retained and RTL caret insertion. Authentic handwriting and agreed acceptance criteria are still needed; no dummy OCR button or unsupported accuracy promise.
- UI integration through existing patterns, without resizing/re-spacing/replacing the existing bottom bar.

No feature implementation or feature-success claim is contained in this decision commit. The next work must follow the complete user amendment once its missing continuation is supplied.
