# Supabase Realtime Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every confirmed Dita/Restu edit persist in Supabase and appear on every open dashboard without redeploying the site.

**Architecture:** Keep the static dashboard and existing HTTP-only editor login. A protected Vercel Function serializes validated snapshots into one revisioned Supabase row; the browser reads that API, queues writes, and listens for row changes through a pinned Supabase Realtime client. The newest valid Chrome snapshot is seeded once, while `localStorage` becomes a non-authoritative cache only.

**Tech Stack:** Static HTML/CSS/JavaScript, Node.js Vercel Functions, Supabase Postgres/REST/Realtime, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-11-16-supabase-realtime-sync-design.md`

## Global Constraints

- Public visitors can read the dashboard; only a valid Dita or Restu editor cookie can write shared data.
- Never commit, log, return, or expose `SUPABASE_SECRET_KEY` or `AUTH_SESSION_SECRET` to browser code.
- Preserve every project/activity ID, array order, date, urgency, board stage, and current visual layout.
- Do not reintroduce the removed persistent “Real-time” badge; use toasts and an offline warning only.
- `updated_at` from Supabase is the only authoritative Last Update value.
- `localStorage` is cache/fallback after migration, never the source of truth.
- Use the current Chrome data when it is newer than the 18-project/125-activity deployed snapshot.
- Use Node's built-in `node:test`; do not add a frontend build system.

## Review Focus

- A newer Chrome-only edit must be selected for migration instead of the older committed snapshot; Task 5 verifies timestamps and full payload equality.
- Rapid status/date/reorder changes must reach the server in order without dropping the newest snapshot; Task 3 tests queued writes.
- Two editors saving the same revision must not silently overwrite each other; Task 2 tests HTTP 409 and Task 3 tests conflict adoption.
- An API outage must leave the last confirmed snapshot visible while disabling edits and clearly reporting stale data; Tasks 3 and 4 test/verify fallback behavior.
- Anonymous, cross-origin, malformed, or oversized writes must fail without changing Supabase; Tasks 1, 2, and 5 exercise these boundaries.

---

### Task 1: Extract and harden editor session verification

**Files:**
- Create: `api/_auth.mjs`
- Modify: `api/auth.mjs`
- Create: `tests/auth.test.mjs`

**Interfaces:**
- Produces: `createAuthService({ env, now })`, whose result exposes `authenticate(userId, password)`, `createSession(userId)`, and `readSessionUser(request)`; plus `sameOrigin(request)` and `json(body, status, headers)`.
- Consumes: existing Dita/Restu IDs, names, password hashes, cookie name, and eight-hour TTL from `api/auth.mjs`.

- [ ] **Step 1: Write failing auth tests**

  Test valid Dita/Restu credentials, invalid credentials, signed-cookie recovery, expired/tampered-cookie rejection, missing `AUTH_SESSION_SECRET`, and same-origin rejection. Assert returned user IDs/names and status codes, never password values.

- [ ] **Step 2: Run the auth tests and verify RED**

  Run: `node --test tests/auth.test.mjs`

  Expected: FAIL because `api/_auth.mjs` does not exist.

- [ ] **Step 3: Implement the shared auth service and refactor `api/auth.mjs`**

  Require `AUTH_SESSION_SECRET` for session signing, keep password comparison timing-safe, preserve cookie attributes, and make `api/auth.mjs` a thin GET/POST/DELETE wrapper around the shared service.

- [ ] **Step 4: Run auth and existing tests**

  Run: `node --test tests/auth.test.mjs tests/header.test.mjs`

  Expected: PASS with zero failures.

- [ ] **Step 5: Commit Task 1**

  ```bash
  git add api/_auth.mjs api/auth.mjs tests/auth.test.mjs
  git commit -m "refactor: share editor session verification"
  ```

### Task 2: Add validated, revision-safe Supabase data API

**Files:**
- Create: `api/_snapshot.mjs`
- Create: `api/_supabase-store.mjs`
- Create: `api/data.mjs`
- Create: `tests/snapshot-validation.test.mjs`
- Create: `tests/data-api.test.mjs`

**Interfaces:**
- Consumes: `readSessionUser`, `sameOrigin`, and `json` from Task 1.
- Produces: `validateSnapshot(projects)`; `createSupabaseStore({ env, fetchImpl, now })` with `read()` and `update({ projects, baseRevision, updatedBy })`; public `GET /api/data`; authenticated `PUT /api/data`.
- API response: `{ projects, revision, updatedAt, updatedBy, realtime: { url, anonKey, table, rowId } }`.

- [ ] **Step 1: Write failing snapshot-validation tests**

  Cover a valid current-shaped snapshot; non-array projects; duplicate/missing IDs; invalid task status/date/order fields; excessively long strings; and a serialized body over the fixed 1 MB limit.

- [ ] **Step 2: Run validation tests and verify RED**

  Run: `node --test tests/snapshot-validation.test.mjs`

  Expected: FAIL because `validateSnapshot` is missing.

- [ ] **Step 3: Implement `validateSnapshot(projects)`**

  Return a normalized clone on success and throw a typed validation error on failure. Preserve array order and allow only `todo`, `active`, or `done` statuses.

- [ ] **Step 4: Run validation tests and verify GREEN**

  Run: `node --test tests/snapshot-validation.test.mjs`

  Expected: PASS.

- [ ] **Step 5: Write failing store/API tests**

  With injected `fetchImpl`, test public GET, missing configuration, authenticated update, anonymous/cross-origin rejection, Supabase errors, successful revision increment, and empty PATCH result becoming a 409 response with the current server snapshot.

- [ ] **Step 6: Run data API tests and verify RED**

  Run: `node --test tests/data-api.test.mjs`

  Expected: FAIL because store and handlers do not exist.

- [ ] **Step 7: Implement the REST store and `/api/data` handlers**

  Use Supabase REST with the server-only secret key in the `apikey` header. PATCH only `id=eq.team1&revision=eq.<baseRevision>` with `Prefer: return=representation`; when no row is returned, read the current row and return 409. Add `Cache-Control: no-store` and never return the secret key.

- [ ] **Step 8: Run Task 2 and full tests**

  Run: `node --test`

  Expected: PASS with zero failures.

- [ ] **Step 9: Commit Task 2**

  ```bash
  git add api/_snapshot.mjs api/_supabase-store.mjs api/data.mjs tests/snapshot-validation.test.mjs tests/data-api.test.mjs
  git commit -m "feat: add revision-safe shared data API"
  ```

### Task 3: Build the browser synchronization controller

**Files:**
- Create: `dist/data-sync.js`
- Create: `dist/vendor/supabase.min.js`
- Create: `dist/vendor/supabase-LICENSE`
- Create: `tests/data-sync.test.mjs`

**Interfaces:**
- Consumes: Task 2's GET/PUT payload and Supabase row-change notification.
- Produces: `globalThis.Team1DataSync.create(options)` with `start()`, `save(projects)`, `subscribe(listener)`, `isReady()`, and `stop()`.
- Emits states: `loading`, `ready`, `saving`, `saved`, `stale`, `offline`, and `conflict`, each carrying the last confirmed snapshot and server metadata when applicable.

- [ ] **Step 1: Write failing controller tests**

  Test server-first startup, cache/deployed fallback, one serialized save, rapid edits coalescing to the newest snapshot, successful Last Update adoption, Realtime-triggered refresh, rollback on failure, 409 conflict replacement, reconnect behavior, and cleanup.

- [ ] **Step 2: Run controller tests and verify RED**

  Run: `node --test tests/data-sync.test.mjs`

  Expected: FAIL because `Team1DataSync` does not exist.

- [ ] **Step 3: Implement the controller with injected dependencies**

  Keep a confirmed snapshot/revision, serialize writes through one promise chain, coalesce pending changes, and use an injected Realtime factory so tests exercise real controller behavior without a network mock object becoming the assertion target.

- [ ] **Step 4: Vendor one exact Supabase JS UMD release and license**

  Record the exact version and SHA-256 in `dist/vendor/supabase-LICENSE`; expose only the public anon key from Task 2 to this client.

- [ ] **Step 5: Run controller and full tests**

  Run: `node --test`

  Expected: PASS with zero failures.

- [ ] **Step 6: Commit Task 3**

  ```bash
  git add dist/data-sync.js dist/vendor/supabase.min.js dist/vendor/supabase-LICENSE tests/data-sync.test.mjs
  git commit -m "feat: add realtime browser data sync"
  ```

### Task 4: Connect the existing dashboard to shared state

**Files:**
- Create: `dist/dashboard-data-bridge.js`
- Modify: `dist/index.html`
- Modify: `dist/app.js`
- Modify: `dist/styles.css`
- Create: `tests/dashboard-sync-contract.test.mjs`

**Interfaces:**
- Consumes: `Team1DataSync.create()` from Task 3 and existing rendering/edit handlers.
- Produces: `globalThis.Team1DashboardData.create({ controller, cache, onSnapshot, onStatus })` with `start()`, `save(projects)`, `canEdit()`, and `stop()`; plus server-first initialization, server-controlled Last Update, and an offline edit guard in `app.js`.

- [ ] **Step 1: Write failing dashboard contract tests**

  Exercise `Team1DashboardData` with a real Task 3 controller and deterministic fake network/storage dependencies. Assert that server state replaces deployed/cache state, `save(projects)` reaches the controller, server `updatedAt` is forwarded to `onSnapshot`, and offline/conflict states make `canEdit()` false while preserving confirmed data.

- [ ] **Step 2: Run dashboard contract tests and verify RED**

  Run: `node --test tests/dashboard-sync-contract.test.mjs`

  Expected: FAIL because the dashboard still writes directly to `localStorage`.

- [ ] **Step 3: Integrate scripts and replace local-only persistence**

  Implement the bridge, then load the pinned Supabase client, `data-sync.js`, and `dashboard-data-bridge.js` before `app.js`. Keep the deployed snapshot render, then adopt bridge snapshots. Route every existing `saveProjects()` call through `bridge.save(projects)`, keep local cache writes only after confirmation, and remove cross-tab `localStorage` as a data authority.

- [ ] **Step 4: Add save/offline/conflict feedback without a permanent badge**

  Reuse toast styling for saving/saved/conflict messages and add one dismissible offline/stale notice. Block data edits until the controller has live server state; keep view/search/hide preferences usable.

- [ ] **Step 5: Run syntax checks and full tests**

  Run: `node --check dist/app.js && node --check dist/data-sync.js && node --check dist/dashboard-data-bridge.js && node --test`

  Expected: all commands exit 0.

- [ ] **Step 6: Verify the local UI in desktop and narrow layouts**

  Open the dashboard locally, confirm no persistent “Real-time” badge appears, perform a status/date edit with a fake/local API, and confirm the board, timeline, report, Last Update, and editor drawer still render correctly.

- [ ] **Step 7: Commit Task 4**

  ```bash
  git add dist/dashboard-data-bridge.js dist/index.html dist/app.js dist/styles.css tests/dashboard-sync-contract.test.mjs
  git commit -m "feat: connect dashboard edits to shared state"
  ```

### Task 5: Create Supabase schema and migrate the newest data safely

**Files:**
- Create: `supabase/migrations/202611190001_dashboard_state.sql`
- Create: `scripts/seed-dashboard-state.mjs`
- Create: `tests/seed-dashboard-state.test.mjs`
- Modify: `.gitignore`
- Local-only, ignored: `.local-data/team1-dashboard-source.json`

**Interfaces:**
- Consumes: Task 2 validation/store modules and the newer of Chrome `team1-weekly-progress-v4` or `dist/latest-data.js`.
- Produces: one `public.dashboard_state` row with ID `team1`, revision 1, full project JSON, server timestamp, and `updated_by = 'migration'`.

- [ ] **Step 1: Write failing migration/seed tests**

  Test parsing `latest-data.js`, parsing a Chrome export envelope, newer-timestamp selection, payload validation, idempotent insert-only behavior, and read-back equality.

- [ ] **Step 2: Run seed tests and verify RED**

  Run: `node --test tests/seed-dashboard-state.test.mjs`

  Expected: FAIL because the seed script and SQL do not exist.

- [ ] **Step 3: Add idempotent schema, RLS, and Realtime SQL**

  Create `dashboard_state`; enable RLS; grant anonymous/authenticated SELECT for `id = 'team1'`; grant no browser writes; and add the table to `supabase_realtime` only when absent.

- [ ] **Step 4: Implement the seed script**

  Accept `--input <ignored-json-path>` and environment variables, refuse to overwrite an existing row unless `--expect-revision` matches, and print counts/revision only—never payloads or keys.

- [ ] **Step 5: Capture and validate the newest Chrome snapshot**

  Read the correct Chrome profile's `team1-weekly-progress-v4` and Last Update, write it only to the ignored `.local-data` path, compare timestamps/counts/IDs against the committed 18/125 fallback, and stop if the selected source is ambiguous or malformed.

- [ ] **Step 6: Apply schema and seed the selected snapshot**

  Run the SQL in the existing `projectreport-team1` Supabase project, then seed once. Verify full JSON equality, project/activity counts, revision 1, and server timestamp through the store/API.

- [ ] **Step 7: Verify security boundaries**

  Confirm an anonymous SELECT succeeds, an anonymous PATCH fails, and a server-service PATCH with a wrong revision returns no updated row.

- [ ] **Step 8: Run full tests and commit Task 5 artifacts**

  Run: `node --test`

  ```bash
  git add .gitignore supabase/migrations/202611190001_dashboard_state.sql scripts/seed-dashboard-state.mjs tests/seed-dashboard-state.test.mjs
  git commit -m "feat: add Supabase schema and safe data migration"
  ```

### Task 6: Configure Vercel, verify preview, and publish production

**Files:**
- Modify if needed: `vercel.json`
- Modify: `dist/latest-data.js` only after the selected migration payload is confirmed
- Modify: `docs/superpowers/specs/2026-11-16-supabase-realtime-sync-design.md`
- Add: `docs/superpowers/plans/2026-11-19-supabase-realtime-sync.md`

**Interfaces:**
- Consumes: tested API/frontend, seeded Supabase row, and Vercel project `team1-smea-report`.
- Produces: a verified preview and production deployment at `https://projectreport-team1-smea.vercel.app/`.

- [ ] **Step 1: Configure scoped Vercel environment variables**

  Add `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `AUTH_SESSION_SECRET`, `DITA_PASSWORD`, and `RESTU_PASSWORD` for Preview and Production. Send publishable/secret keys in Supabase's `apikey` header rather than treating the new non-JWT keys as bearer tokens. Keep secret values out of CLI arguments, logs, commits, and browser-visible responses.

- [ ] **Step 2: Refresh the deploy-time fallback snapshot**

  Generate `dist/latest-data.js` from the exact confirmed migration payload and server Last Update, then verify its counts and full JSON equality.

- [ ] **Step 3: Push the feature branch and wait for a preview deployment**

  Verify intended team, project, branch, commit, and Preview target before publishing. Do not promote an untested build.

- [ ] **Step 4: Run preview API/auth/data tests**

  Confirm public GET; anonymous PUT rejection; Dita login/write; Restu login/write; Last Update change; malformed/oversized rejection; stale revision 409; and logout behavior.

- [ ] **Step 5: Run cross-browser Realtime acceptance test**

  Open the preview in two browser contexts, edit one harmless activity field in the authenticated context, and verify the second context adopts the new revision without reload. Restore the original value through a normal authenticated edit and verify both contexts again.

- [ ] **Step 6: Merge/push the tested commit to `main` and verify production**

  Wait for the Git-integrated Production deployment. Re-run public GET, authenticated edit/restore, cross-browser update, Last Update, and anonymous-write checks against the public domain.

- [ ] **Step 7: Run final verification and record deployment evidence**

  Run: `node --test`, `node --check dist/app.js`, `node --check dist/data-sync.js`, `git diff --check`, and production HTTP/API smoke checks. Record commit SHA, deployment URL/status, test counts, and any observability gap.

- [ ] **Step 8: Commit documentation/fallback changes if not already included**

  ```bash
  git add dist/latest-data.js vercel.json docs/superpowers/specs/2026-11-16-supabase-realtime-sync-design.md docs/superpowers/plans/2026-11-19-supabase-realtime-sync.md
  git commit -m "docs: record shared dashboard deployment"
  ```

