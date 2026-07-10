# Mobile Profile and Data Management Design

## Goal

Add a fourth mobile-style bottom tab, "我的", that gives users a restrained account and data-management surface while preserving CycleBubble's existing soft, reflective Bubble visual language. The feature must keep demo and real data strictly isolated.

## Scope

The feature includes:

- A fourth bottom-tab item, "我的".
- A single-page profile workspace with identity, account state, and data summaries.
- Real-user entry points for period management and period import.
- Real-user export of a complete JSON data package.
- Real-user export of a human-readable, offline HTML review report.
- A destructive account-deletion confirmation page that requires the current password and an explicit acknowledgement.
- Backend endpoints for the authenticated real user to retrieve their data, export it, and permanently delete their account and related data.

The feature does not add notification preferences or public-sharing controls. It does not expose export or deletion operations in demo mode.

## Experience Design

### Navigation

The existing tab bar gains a fourth item: "我的". The new screen retains the existing phone frame, gentle page transition, muted ink text, rose and lavender accents, light borders, and small-radius framed elements. It does not introduce a dense traditional settings page or a separate visual system.

### My Screen

The screen is a single scrolling workspace with three unframed sections:

1. **Identity and account state**
   - A compact Bubble-inspired avatar, nickname, and email address.
   - A logged-in account is labelled as a private personal space without exposing any sensitive contents.
   - Demo mode instead shows a clearly labelled demo identity and a prominent existing-style login/register action.

2. **My data**
   - Two concise summaries: total emotion records and total period records.
   - Emotion-record summary navigates to the existing Growth screen.
   - Period-record summary navigates to a new period-management screen.
   - Import period data links to the existing import screen.

3. **Data and privacy**
   - Three bordered action rows: export JSON data package, export review report, and delete account.
   - Export actions trigger browser downloads only for authenticated real users.
   - The delete row uses a restrained danger treatment and opens a dedicated confirmation screen.

### Period Management

The new screen lists the authenticated user's period records by date, with start date, optional end date, and flow. It supports adding, editing, and deleting records through the existing period API endpoints. This screen is unavailable in demo mode because demo data is read-only; demo users see the existing login prompt instead.

### Exports

- **JSON data package:** A download containing account profile fields, memories, period records, and authored responses. Password hashes, authentication tokens, internal IDs not needed by the user, other users' content, reports, and any demo data are excluded.
- **Review report:** A self-contained HTML file that opens locally. It summarizes profile information, chronologically presents the user's memories, lists period records, and includes authored responses. It uses plain readable typography and no remote scripts, analytics, or external assets.

Exports are generated server-side from the real user's session, with attachment headers and a timestamped filename. The server never accepts a user ID from the client for export selection.

### Account Deletion

The confirmation page explains that profile information, memories, cycles, authored responses, and reports created by the account will be permanently removed. It requires both:

- Entry of the current password.
- A checked acknowledgement that the operation cannot be undone.

On submission, the backend validates the authenticated user and password, then deletes dependent rows and the user inside a single transaction. The server deletes responses authored by the user as well as responses attached to the user's memories, reports filed by the user, reports filed against the user's memories, then memories, cycles, and the user. Any failure rolls back the full transaction.

On success the frontend clears the stored token and mode-specific in-memory state, then routes to the login screen.

## Architecture and Data Flow

### Frontend

- `index.html` gains the My, period-management, and account-deletion screen markup plus the fourth tab item.
- `styles.css` adds narrowly scoped styles that reuse existing colour variables, typography, transition timing, borders, and sizing conventions.
- `script.js` loads the authenticated profile summary when My opens; it routes user actions and handles downloads without creating local replicas of server data.
- `api.js` gains scoped profile/data-management methods. Requests preserve existing mutually exclusive real/demo headers.

### Backend

A dedicated authenticated router provides real-user-only profile summary, exports, and account deletion. Existing `get_current_user` and header-driven `get_session` preserve database routing. The router rejects `X-Demo-Mode: 1` for export and deletion before any query or mutation.

The schema gains no new persistent fields for the initial feature. The report model is included only to clean up existing report rows during account deletion.

## Security and Error Handling

- Every profile/data endpoint uses the authenticated current user, never a client-provided target account ID.
- Export responses contain only the current real user's data and use `Content-Disposition: attachment`.
- Password verification occurs server-side before deletion; an incorrect password returns a generic validation error and causes no mutation.
- The explicit acknowledgement is validated server-side, not only through the frontend checkbox.
- Demo mode cannot export, modify periods, or delete accounts. It receives a clear read-only response.
- Destructive actions are transactionally atomic and return a clear error if they fail.
- The frontend avoids rendering raw report data as HTML. User-supplied content is HTML-escaped in the generated report.

## Verification

Automated tests cover:

- Profile summary returns only the current real user's counts and identity fields.
- JSON and HTML exports omit password hashes, tokens, unrelated user data, and demo data.
- Demo-mode export/deletion/period mutations are rejected.
- Account deletion rejects a wrong password and unchecked acknowledgement without data loss.
- Account deletion removes all owned and dependent rows and invalidates subsequent authenticated use.

Manual browser verification covers:

- Desktop phone-frame and narrow mobile viewport layout.
- New My tab's visual consistency with the existing Bubble, Growth, and Resonance screens.
- Real account empty and populated states.
- Demo state shows login guidance rather than data-management actions.
- JSON and HTML downloads produce the expected content.
