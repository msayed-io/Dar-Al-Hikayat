# Android permission setup

## When it appears

Android only. On mount, nonprompting checks inspect app notification enablement and exact-alarm access. The first missing prerequisite is shown; setup that has not previously completed then offers location detection or the saved city. Previously completed setups with both permissions still available remain closed. Revoked notification or exact-alarm access can reopen the relevant step on a later launch.

“Later”, Escape and backdrop dismissal defer the card for this WebView session, without marking setup complete. Resume/focus and component remount cannot reopen a deferred card in that session. Incomplete setup can be offered next session. No UI claims that Settings contains a new re-entry action.

## Flow and ownership

- Startup and the background update check never request notification permission. The explicit setup button owns the prompt.
- Notification checks include Android's app-wide notification toggle, including pre-Android 13. Denial/blocked toggles lead to native notification settings; launch failures are visible.
- Exact-alarm access opens only its own system page. Battery-optimization settings must not cover that page. Native activity-launch errors reject and become retryable feedback.
- App resume/focus rechecks grants without opening another system prompt. Location permission is not treated as a GPS fix: after returning from app settings the writer explicitly detects their location or chooses the saved city.
- GPS failure offers retry/current city, never notification settings. A newly acquired location is passed directly to the serialized alarm scheduler, rather than waiting for React context to update.
- Completion is recorded only when that scheduler returns success. Scheduling failures retain a retry action. An already-issued native action cannot be physically cancelled by React dismissal, but late results never continue into a new prompt, location update or completion UI after dismissal/unmount.
- One in-flight operation prevents double presses and concurrent resume checks. Generation checks invalidate dismissed/unmounted work; late native listener registration is cleaned up.

## Visual contract

The story-lock dialog is the reference: centered themed background/border/shadow, 28px corners, 24px × 20px padding, one unframed 28px icon, Thmanyah display title, one brief sentence and 34px capsule action. Width is 320px, clamped to the viewport. No step badges, progress dots, handles, duplicate titles, battery detours or celebration screen. Only a concise actionable error and saved-city alternative appear when relevant. The dialog traps keyboard Tab and supports Escape.

## Verification and limits

21 additional unit/source-contract checks cover prompt ownership, denied/settings routes, GPS and scheduling failure, current-location scheduling, session deferral, concurrent callbacks and stale results/listeners. These mock the bridge, not Android itself. Chromium verifies 24 responsive dialog layouts and the font expansion (31 families/options, 152 advertised weights), plus the existing 12-layout font-sheet and four stationary-editor regressions. One fixed-delay remote-input browser assertion was replaced by waiting for the observed editor update after it failed under concurrent CPU load; all four cases then passed.

TypeScript, 299 tests / 35 files and the production web build pass. Android OEM settings UI, physical notification delivery and native APK/release compilation still require device/CI verification; browser tests do not establish those results.
