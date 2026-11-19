# Supabase Realtime Sync Design

## Intent

Move Team 1 project data from browser-local storage to the shared Supabase project `projectreport-team1` so edits made by Dita or Restu appear on every laptop without exporting Chrome data or redeploying the website.

The public dashboard remains readable without login. The existing editor login and its Dita/Restu credentials remain the only way to change shared data.

## Goals

- Make Supabase the single source of truth for project and activity data.
- Publish confirmed edits to every open dashboard through Supabase Realtime.
- Preserve the current dashboard, editor UI, project ordering, activity ordering, dates, urgency, board stage, and Last Update behavior.
- Keep Supabase service credentials server-side in Vercel environment variables.
- Prevent simultaneous editors from silently overwriting one another.
- Retain a read-only deployed snapshot and browser cache as recovery fallbacks when the network or database is unavailable.
- Migrate the current production snapshot of 18 projects and 125 activities without losing IDs or ordering.

## Non-goals

- Replacing the existing editor login with Supabase Auth.
- Adding new users, roles, approval workflows, or audit-report screens.
- Normalizing projects and activities into many relational tables in this phase.
- Offline editing or automatic merging of two concurrent edits.
- Moving display preferences such as the hidden Target Selanjutnya section into shared storage.

## Anti-goals

- Do not expose the Supabase secret key in browser JavaScript or committed files.
- Do not let anonymous visitors write data.
- Do not treat `localStorage` as authoritative after migration.
- Do not silently discard an editor's changes after a revision conflict or server failure.

## Constraints

- The site remains a static frontend in `dist/` with Vercel Functions under `api/`.
- The current HTTP-only editor session cookie created by `api/auth.mjs` remains in use.
- The Supabase project is on the Free plan and currently uses the automatically selected Northeast Asia (Seoul) region.
- The app has no package manager or frontend build step; browser dependencies must stay minimal.
- Public reads must continue to work at `https://projectreport-team1-smea.vercel.app/`.

## Approaches Considered

### 1. Supabase Realtime plus protected Vercel API — selected

The browser reads the shared snapshot and subscribes to a public read-only Realtime channel. Authenticated writes go through a Vercel Function that verifies the existing editor cookie and uses the server-only Supabase secret key.

This preserves the current login, provides near-instant cross-device updates, and keeps write credentials out of the browser. It adds a small amount of API and subscription code.

### 2. Vercel API with polling

The browser would request the latest snapshot every 5–10 seconds. This is simpler, but updates are delayed and every open dashboard generates repeated requests even when nothing changes.

### 3. Supabase Auth with direct browser writes

This is the most Supabase-native design, but it replaces the existing editor identities and login flow, requires separate Supabase user accounts, and expands the scope well beyond data synchronization.

## Architecture

### Shared data model

Create one public-schema table named `dashboard_state` with a single row:

- `id text primary key`, fixed value `team1`
- `projects jsonb not null`
- `revision bigint not null default 1`
- `updated_at timestamptz not null default now()`
- `updated_by text not null`

The JSON project shape remains identical to `globalThis.TEAM1_PROJECT_DATA.projects`. Keeping the current shape avoids a risky rewrite of the large rendering and editing layer. Project and activity order remain array order.

Enable Row Level Security. Anonymous and authenticated Supabase clients receive `SELECT` access to the single `team1` row. No browser role receives insert, update, or delete access. Realtime publication includes `dashboard_state`.

### Vercel API

Add `api/data.mjs`:

- `GET /api/data` returns `{ projects, revision, updatedAt, updatedBy }` with no-store caching. This endpoint is public.
- `PUT /api/data` requires a valid existing editor session. Its body is `{ projects, baseRevision }`.
- The function validates the project snapshot before writing.
- The update succeeds only when the stored revision equals `baseRevision`; success increments the revision and records the editor name and server timestamp.
- A stale revision returns HTTP 409 with the current server snapshot. Invalid data returns 400. Missing editor authentication returns 401.

Refactor the reusable session verification from `api/auth.mjs` into a small server-only module so both functions enforce the same signed cookie.

Required Vercel environment variables:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` (public browser key used only for read-only Realtime subscriptions)
- `SUPABASE_SECRET_KEY`
- existing `AUTH_SESSION_SECRET`, `DITA_PASSWORD`, and `RESTU_PASSWORD`

No secret values are committed.

### Browser synchronization

On startup:

1. Render the deployed snapshot immediately so the page is never blank.
2. Request `/api/data`.
3. Replace the displayed projects with the server snapshot and store a non-authoritative local cache.
4. Subscribe to changes for the `team1` row using a pinned, locally served Supabase browser client and the public Supabase URL and publishable/anonymous key.
5. When a newer revision arrives, fetch `/api/data` and re-render.

On editor change:

1. Update the in-memory model optimistically and show a saving indicator.
2. Send the complete snapshot and current revision to `PUT /api/data`.
3. On success, adopt the returned revision and server `updatedAt`, then show a saved confirmation.
4. On HTTP 409, replace local state with the server response and tell the editor that another update arrived first; the stale local write is not retried automatically.
5. On network/server failure, restore the last confirmed server state and show a clear save-failed message.

Writes are serialized through one browser-side queue so rapid date/status/reorder operations cannot arrive out of order.

### Fallback behavior

- `dist/latest-data.js` remains a deploy-time recovery snapshot, not the live database.
- `localStorage` stores only the last confirmed server response for faster recovery.
- If `/api/data` is unavailable, the dashboard displays cached or deployed data with an offline/stale notice.
- Editing is disabled while live server data is unavailable, preventing isolated local changes from appearing saved.

### Last Update

`Last Update` comes exclusively from the server's `updated_at`. Loading, refreshing, subscribing, or changing a local display preference does not alter it. Only a successful shared-data write changes the timestamp.

## Data migration

1. Capture `team1-weekly-progress-v4` and its Last Update value from the Chrome profile where the latest edits were made.
2. Compare it with the committed `dist/latest-data.js` snapshot and select the newer valid payload. The committed fallback currently contains 18 projects and 125 activities.
3. Validate IDs, ordering, required project/activity fields, and the activity count before any upload.
4. Insert the selected payload as revision 1 with `updated_by = 'migration'`.
5. Read it back through `/api/data` and compare the full JSON payload.
6. Only after verification, deploy the frontend synchronization code.

The migration is idempotent: it inserts the row only when `id = 'team1'` does not already exist.

## Security

- The Supabase secret key exists only in Vercel environment variables and server-side code.
- Anonymous Supabase access is read-only through RLS.
- All writes require the existing secure, HTTP-only, SameSite editor cookie.
- Write endpoints enforce same-origin requests and reject oversized or malformed payloads.
- Project/activity strings are still escaped before rendering.
- The API records the authenticated editor name in `updated_by`.

## Testing

- Unit-test session verification, data validation, revision conflicts, successful writes, and Supabase error handling with injected fetch/storage dependencies.
- Unit-test the browser sync state machine: initial load, queued saves, Realtime refresh, rollback after failure, and conflict replacement.
- Run syntax checks and the complete test suite before deployment.
- In production, edit one activity on the first browser and verify the second browser changes without reload.
- Confirm an anonymous write attempt fails and a logged-in Dita/Restu write succeeds.

## Deployment

1. Create the table, RLS policies, and Realtime publication in Supabase.
2. Seed and verify the current production snapshot.
3. Configure Vercel environment variables for Production and Preview.
4. Deploy the API and frontend to a preview deployment.
5. Run cross-browser and authentication checks.
6. Promote the verified deployment to production.

### Deployment record — 19 November 2026

- Supabase project `projectreport-team1` (`okpssgoblqfxnbjpjrqo`) is running the `dashboard_state` schema, read-only public RLS policy, server-role grant, and Realtime publication on the Free plan.
- The latest Chrome snapshot was selected over the older deployed fallback and seeded with 18 projects and 124 activities. The initial database row was revision 1; acceptance-test edits were restored to the identical project payload after every test.
- Vercel project `team1-smea-report` has the six required variables scoped to both Preview and Production. Secret values remain outside Git and browser responses.
- Final preview `https://team1-smea-report-mfn8lbvrs-smea2.vercel.app/` was Ready on commit `06e4e9054ff653081193aa15575a612a3d72caa6`.
- Production is public at `https://projectreport-team1-smea.vercel.app/` from the same commit. The final production row is revision 11 after a Restu-authenticated restoration, with the original 18-project/124-activity payload intact.
- Verification passed 33 automated tests and syntax/diff checks. Production checks covered public read, anonymous-write rejection, Dita and Restu login/write, stale revision 409, malformed payload 400, oversized payload 413, logout, and Chrome-to-in-app-browser Realtime update/restore without reload.
- No dedicated uptime alert is configured; failures remain visible through the dashboard offline/stale notice and Vercel/Supabase logs.

## Cost

The current workload is expected to remain within Supabase Free quotas. The main Free-plan operational constraint is that a project may pause after a week of inactivity; the first request after a pause can take longer while it resumes.
