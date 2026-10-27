# Security review — PatchLlama

**Current commit (pre-push working tree):** production-readiness fixes on top of `b652ae4`  
**Previous hardening:** `94361f8` (auth/git/PR), `b652ae4` (Neon persistence)

## Status legend

| Label | Meaning |
|-------|---------|
| Implemented and tested | Code + automated tests executed in this environment |
| Implemented, not integration-tested | Code present; live external system not exercised |
| Requires infrastructure | Needs Docker / OAuth / Muse Spark / Neon credentials |
| Known limitation | Honest residual risk |

## Protections (must remain intact)

| Control | Status |
|---------|--------|
| Auth.js session identity; never trust client `userId` | Implemented and tested |
| Production auth fail-closed (strong secret + GitHub) | Implemented and tested |
| Demo login disabled in production | Implemented and tested |
| Git credentials via GIT_ASKPASS (not URL-embedded) | Implemented and tested |
| PR stages approved patch files only; owned + verified + confirm | Implemented and tested |
| Docker fail-closed if isolation unavailable | Implemented and tested (unavailable path); live Docker E2E requires infrastructure |
| Docker env scrubbed of model/GitHub secrets | Implemented and tested |
| Path guards + command allowlists | Implemented and tested |
| Rate limits, body size limits, ownership checks | Implemented and tested |
| Production Postgres required; no silent JSON fallback | Implemented and tested |
| Optimistic session `version` concurrency | Implemented and tested (JSON + Neon) |
| Text/stdout/stderr redaction (best-effort regex) | Implemented and tested |
| Analysis failure → `blocked` (not stuck `analyzing`) | Implemented and tested |
| Patch `create`/`replace` integrity + multi-file rollback | Implemented and tested |

## Secret redaction — limits

Automated redaction covers common token formats, DB URLs, Bearer headers, env-style assignments, and PEM blocks in free-form text. **It does not guarantee every possible secret is detected.** Prefer not placing credentials in workspaces, test output, or model context.

## Remaining risks / infrastructure

1. Start Docker Desktop before claiming VERIFIED on real baseline/verify paths.
2. Production deploy must set strong `AUTH_SECRET`, GitHub OAuth, `DATABASE_URL`, and `PATCHLLAMA_STORAGE=postgres` (or rely on production default).
3. In-process session lock is single-node; cross-instance safety relies on DB `version`.
4. Live Muse Spark, live GitHub clone/PR, and hosted Neon under production traffic were **not** E2E-exercised in every review pass — use staging first.
5. Rotate any Neon password that was ever pasted into chat or tickets.

## Push status

Document updates and readiness fixes may be **uncommitted**. Do not treat this file as proof that `origin/main` already contains the latest working tree.
