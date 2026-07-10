# Profile and Data Management Implementation Plan

## Objective

Implement the approved mobile-style My tab while preserving the current CycleBubble visual language and the real/demo dual-database boundary. The feature includes profile summary, period management, JSON and HTML exports, and password-confirmed transactional account deletion.

## 1. Backend access boundary

1. Add a real-user-only dependency in `backend/auth.py`.
2. Reject `X-Demo-Mode: 1` before profile export, period-management, or account-deletion work begins.
3. Require a valid bearer token for real-user operations and bind all data selection to the authenticated user.
4. Add `backend/routers/profile.py` and mount it in `backend/main.py` at `/api/profile`.

## 2. Profile summary and exports

1. Add `GET /api/profile/summary` returning only display-safe identity fields and counts for the authenticated account.
2. Add a shared export-data helper that queries only the current account's memories, cycles, and authored responses.
3. Add `GET /api/profile/export.json` as a UTF-8 attachment with a timestamped filename.
4. Keep the JSON package versioned and omit password hashes, JWTs, internal IDs, reports, unrelated user records, and demo data.
5. Add `GET /api/profile/export.html` as a self-contained offline report.
6. Render all user-controlled text through `html.escape()`; do not include external scripts, assets, or analytics.

## 3. Account deletion

1. Add `POST /api/profile/delete-account` accepting `password` and `acknowledged`.
2. Reject missing acknowledgement and invalid passwords without mutating data.
3. Within one transaction, delete in dependency order: reports filed by user, authored responses, reports against owned memories, responses attached to owned memories, memories, cycles, and user.
4. Roll back all deletion work on failure; return success only after commit.

## 4. Period API and client support

1. Extend `api.js` with profile summary, binary download, deletion, period update, and period delete methods.
2. Keep central request header handling; do not duplicate auth or demo-mode logic.
3. Update period PATCH handling in `backend/routers/cycle.py` to distinguish omitted fields from explicitly supplied null values, so optional end dates can be cleared.
4. Preserve existing owner checks and demo read-only blocks.

## 5. Mobile frontend

1. Add My, period-management, and account-deletion screens to `index.html`.
2. Add a fourth bottom-tab item that routes to My.
3. My contains compact identity/state, emotion and period counts, period-management/import entries, JSON/HTML exports, and deletion entry.
4. Period management lists, creates, edits, and deletes real-user records.
5. Demo mode renders its demo identity and directs users to login; it never enables export, period mutation, or account deletion.
6. Use `textContent` or equivalent DOM APIs for server-provided account data.
7. On successful deletion, clear auth/local state and route to login.

## 6. Visual design

1. Add profile-specific styling in `styles.css`, reusing existing colors, typography, borders, animation, and compact dimensions.
2. Use a compact Bubble-inspired identity mark rather than a generic dashboard hero.
3. Keep sections unframed; use light bordered rows only for individual actionable items.
4. Ensure four-tab spacing works in the fixed phone frame and narrow mobile viewport.
5. Use a restrained danger treatment for delete controls.

## 7. Tests and verification

1. Add pytest infrastructure and temporary real/demo database fixtures.
2. Test profile data isolation, exports, escaped report content, demo restrictions, nullable period updates, deletion rejection, deletion success, and rollback behavior.
3. Run backend tests and existing JS syntax checks.
4. Perform browser checks at phone-frame desktop and narrow-mobile dimensions for real empty/populated states, demo guidance, period CRUD, both downloads, deletion reset, and visual consistency against existing screens.
5. Capture ignored local screenshots for comparison before committing.
