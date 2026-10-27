# Security review — post-9e35661 hardening (unpushed)

Review date: 2026-10-27  
Base commit reviewed: `9e35661`  
Working tree: local fixes **not pushed** (awaiting review)

## Findings addressed

### 1. Authentication fail-closed
- Removed implicit demo Credentials provider when GitHub OAuth was missing.
- Added [`lib/auth-config.ts`](../lib/auth-config.ts): production requires strong `AUTH_SECRET` (≥32, not placeholder) **and** GitHub OAuth.
- Demo login requires `PATCHLLAMA_MODE=demo|local` **and** `AUTH_DEMO_LOGIN=1`, and is **always disabled** when `NODE_ENV=production`.
- [`/api/auth/demo-login`](../app/api/auth/demo-login/route.ts) returns `403 DEMO_LOGIN_DISABLED` / `503` when misconfigured.

### 2. GitHub credentials
- Stopped embedding tokens in Git URLs / remotes.
- New [`ai/github/git-credential.ts`](../ai/github/git-credential.ts): short-lived `GIT_ASKPASS` helper; password only in child env; `finally` cleanup; argv refusal if token-like material appears; stderr redaction.
- Clone/PR use clean `https://github.com/owner/repo.git` remotes only.
- OAuth scopes reduced to `read:user repo` (documented minimum for private clone + PR).

### 3. PR integrity
- New [`ai/github/pr.ts`](../ai/github/pr.ts): stages **only applied patch file paths**; validates remote URL; checks every git exit code; refuses head==base; never pushes default branch names as head; removes `origin` in `finally`.
- Route validates repo via GitHub API and confirms base branch exists.

### 4. Regression tests added
- Auth config / demo restrictions / production fail-closed
- Git argv token refusal + redaction
- PR staging policy (approved files only)
- Unauthorized session report/approve
- Existing: path-guard, env isolation, docker unavailable, ownership, fingerprint

### 5. Docker execution review
**Fixed / improved**
- Timeout now attempts process-tree kill (`taskkill /T` on Windows, process group elsewhere).
- Mount path must resolve under managed workspace roots (`assertWorkspaceRoot`).
- Concurrent approve/apply serialized per session (`session-lock.ts`).
- Sandbox env asserts no `MODEL_*` / `GIT_ASKPASS_PASSWORD`.

**Honest limitations (not claimed as complete)**
- Workspace mount remains **read-write** (needed for package managers/tests). Isolation is container + managed-root boundary, not a read-only project FS.
- Docker daemon was unavailable in earlier audits; Docker-dependent E2E remains **blocked** until Docker Desktop is healthy (`ISOLATION_UNAVAILABLE`).
- In-process session lock is single-node only (not distributed).

## Commands executed (this review)

| Command | Exit | Result |
|---------|------|--------|
| `npm run typecheck` | `0` | PASSED |
| `npm run test` | `0` | PASSED — **9 files / 17 tests** |
| `npm run build` | `0` | PASSED |

### Skipped / not run
- Live Muse Spark (`RUN_LIVE_META`) — not enabled
- Live Docker exec / real GitHub clone-PR E2E — Docker daemon / OAuth credentials not exercised in this pass
- Symlink escape test may no-op on Windows without symlink privilege (still covered when symlink creation succeeds)

## Diff summary (unpushed)

Modified: `lib/auth.ts`, `app/api/auth/demo-login/route.ts`, `ai/github/clone.ts`, `app/api/patchllama/github/pr/route.ts`, `ai/patchllama/docker-executor.ts`, `ai/patchllama/pipeline.ts`, workspace page auth error handling, `.env.example`

Added: `lib/auth-config.ts`, `ai/github/git-credential.ts`, `ai/github/pr.ts`, `ai/patchllama/session-lock.ts`, auth/git/PR/unauthorized tests, this document

## Remaining risks
1. Start Docker Desktop before claiming VERIFIED on real/demo baseline paths.
2. Production deploy must set strong `AUTH_SECRET` + GitHub OAuth; demo flags must stay off.
3. Postgres SessionStore still schema-only for multi-user hosting.
4. GIT_ASKPASS on Windows relies on cmd scripting; prefer Linux runners for production clone/PR if Windows askpass proves flaky.

## Push status
**Not pushed.** Present this review and local diff for approval before updating `origin/main`.
