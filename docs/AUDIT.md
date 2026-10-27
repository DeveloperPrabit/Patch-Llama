# PatchLlama readiness audit

Recorded: 2026-10-27 (Phase 1 baseline, before readiness changes).

## Commands executed

### `npm run typecheck`

```text
> tsc --noEmit
ai/patchllama/pipeline.ts(289,11): error TS7022: 'files' implicitly has type 'any' ...
ai/patchllama/pipeline.ts(338,13): error TS7022: 'files' implicitly has type 'any' ...
```

- **Exit code:** `2` — **FAILED**

### `npm run build`

```text
> next build
Compiled successfully in 19.4s
Failed to compile. (same TS7022 errors in pipeline.ts)
```

- **Exit code:** `1` — **FAILED**

### `npm run test`

```text
npm error Missing script: "test"
```

- **Exit code:** `1` — **FAILED** (no test script exists)

### Docker daemon

```text
docker info → failed to connect to dockerDesktopLinuxEngine pipe
```

- **Exit code:** non-zero — **Docker daemon unavailable**
- CLI Client Version: 29.7.2

## Security gaps (pre-change)

| Area | Finding |
|------|---------|
| Auth | No authentication on session/demo/approve APIs |
| Identity | Client-supplied `userId` / `organizationId` / `workspaceRoot` trusted |
| Exec | Host `spawn` with full `process.env` (can leak `MODEL_API_KEY`) |
| Isolation | Temp dir only — not a container boundary |
| Paths | No realpath/symlink containment |
| Evidence | Demo fabricates stderr; baseline not executed before analyze |
| Store | JSON only; no ownership; listSessions is global |
| Tests | None |

## Policy for subsequent phases

- Real-project / verify execution **requires healthy Docker**; otherwise fail closed with `ISOLATION_UNAVAILABLE`.
- Demo UI remains; labels must distinguish `seeded_fixture` vs `executed_baseline`.
- PostgreSQL required for hosted multi-user; JSON only for local/demo storage mode.

## Post-change verification (same day)

### After TS7022 fix + readiness modules

| Command | Exit | Result |
|---------|------|--------|
| `npm run typecheck` | `0` | PASSED |
| `npm run test` (vitest) | `0` | PASSED — 5 files / 6 tests |
| `npm run build` | `0` | PASSED |

### Tests covered

- Path traversal / protected paths / symlink escape attempt
- Docker unavailability fail-closed (`ISOLATION_UNAVAILABLE`)
- Session ownership (cross-user cancel → 404)
- Workspace fingerprint change detection
- Sandbox env scrub (no `MODEL_*` / API keys)

### Remaining risks / blockers

- Docker daemon was **down** during audit — approve/verify/baseline will return `ISOLATION_UNAVAILABLE` until Docker Desktop is started.
- Live Muse Spark integration test not run in this pass (`RUN_LIVE_META` unset).
- Real GitHub end-to-end (clone → baseline → PR) not executed without OAuth credentials.
- Postgres store schema exists (`db/schema.ts`); JSON remains active until `DATABASE_URL` wired to a Drizzle repository implementation in a follow-up.
- Auth.js demo credentials login is for local/demo; production must set `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` and a strong `AUTH_SECRET`.
