# Security review — PatchLlama

**Commit reviewed:** `9e46033f8d6122ba3d4fd77e0efb51f582c4ee32` on `main` (`origin/main`)

**Includes:** Neon persistence (`b652ae4`), auth/git/PR hardening (`94361f8`), pipeline failure recovery + free-text secret redaction (`9e46033`)

## Status legend

| Label | Meaning |
|-------|---------|
| Implemented and tested | Code + automated unit/regression tests executed against this commit |
| Implemented, not integration-tested | Code present; live external system not exercised in the verification pass |
| Requires infrastructure | Needs Docker / OAuth / Muse Spark / dedicated Neon test DB |
| Known limitation | Honest residual risk |

## Protections (must remain intact)

| Control | Status |
|---------|--------|
| Auth.js session identity; never trust client `userId` | Implemented and tested |
| Production auth fail-closed (strong secret + GitHub) | Implemented and tested |
| Demo login disabled in production | Implemented and tested |
| Git credentials via GIT_ASKPASS (not URL-embedded) | Implemented and tested |
| PR stages approved patch files only; owned + verified + confirm | Implemented and tested |
| Docker fail-closed if isolation unavailable | Implemented and tested (unavailable path); live Docker E2E **not verified** this pass |
| Docker env scrubbed of model/GitHub secrets | Implemented and tested |
| Path guards + command allowlists | Implemented and tested |
| Rate limits, body size limits, ownership checks | Implemented and tested |
| Production Postgres required; no silent JSON fallback | Implemented and tested |
| Optimistic session `version` concurrency | Implemented and tested (JSON unit path); live Neon concurrency **not re-verified** this pass |
| Text/stdout/stderr redaction (best-effort regex) | Implemented and tested |
| Analysis failure → `blocked` (not stuck `analyzing`) | Implemented and tested |
| Patch `create`/`replace` integrity + multi-file rollback | Implemented and tested |

## Secret redaction — limits

Automated redaction covers common token formats, DB URLs, Bearer headers, env-style assignments, and PEM blocks in free-form text. **This is best-effort only. It does not guarantee every possible secret is detected.** Prefer not placing credentials in workspaces, test output, or model context.

## Verification status (commit `9e46033`)

| Check | Result |
|-------|--------|
| `npm run typecheck` | Passed |
| `npm run test` | **43** passed, **2** skipped, **0** failed across **16** files |
| `npm run build` | Passed |
| `npm run test:db` | **Not run** — dedicated `PATCHLLAMA_TEST_DATABASE_URL` unavailable |
| Live Neon persistence | **Not verified** this pass |
| Real Docker verification (container exec) | **Not verified** this pass |
| Live Muse Spark API | **Not verified** this pass |
| Live GitHub OAuth / PR creation | **Not verified** this pass |

The two skipped unit-suite tests are the Neon postgres integration cases gated without a test database URL.

## Remaining risks / infrastructure

1. Start Docker Desktop before claiming VERIFIED on real baseline/verify paths.
2. Production deploy must set strong `AUTH_SECRET`, GitHub OAuth, `DATABASE_URL`, and `PATCHLLAMA_STORAGE=postgres` (or rely on production default).
3. In-process session lock is single-node; cross-instance safety relies on DB `version`.
4. A process crash after `applying` is persisted but before apply finishes can leave a transitional session until retry/ops.
5. Rotate any Neon password that was ever pasted into chat or tickets.

## Staging / production readiness

**Conditionally ready for staging** when auth, Neon `DATABASE_URL`, migrations, and Docker health are configured and smoke-checked. **Not claimed production-ready** until live Neon smoke, Docker verify, and staging E2E succeed. This document does not assert any live deployment status.
