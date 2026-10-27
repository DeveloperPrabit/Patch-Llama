# Neon PostgreSQL integration — implementation report

**Commit reviewed:** `9e46033f8d6122ba3d4fd77e0efb51f582c4ee32` on `main` (`origin/main`)

**History:** Neon persistence landed in `b652ae4`; production-readiness follow-up (redaction, pipeline recovery, docs) landed in `9e46033`.

## What is implemented

| Area | Status |
|------|--------|
| Drizzle client (`db/client.ts`) + schema + versioned `drizzle/` migrations | Implemented; unit/config tested; live Neon **not re-verified** this pass |
| Storage facade → Postgres / JSON adapters | Implemented and tested (JSON default in unit suite) |
| Production refuses JSON / missing `DATABASE_URL` | Implemented and tested |
| Ownership isolation + optimistic `version` | Implemented and tested (JSON); Neon opt-in **not run** this pass |
| Optional JSON → Postgres import (idempotent skip by id; no source delete) | Implemented; idempotency **policy** unit-tested; live import **NOT RUN** |
| Execution/audit text secret redaction | Implemented and tested (**best-effort** only — see SECURITY-REVIEW) |
| Analysis / apply failure recovery (no stuck `analyzing` / safer apply) | Implemented and tested |

## Migrations

```bash
npm run db:generate   # after schema edits
npm run db:migrate    # uses DATABASE_URL_UNPOOLED or DATABASE_URL
```

Migrations do **not** run on application request/startup.

## Verification status (commit `9e46033`)

| Check | Result |
|-------|--------|
| `npm run typecheck` | Passed |
| `npm run test` | **43** passed, **2** skipped, **0** failed across **16** files |
| `npm run build` | Passed |
| `npm run test:db` | **Not run** — dedicated `PATCHLLAMA_TEST_DATABASE_URL` unavailable |
| Live Neon persistence | **Not verified** this pass |
| Real Docker verification | **Not verified** this pass |
| Live Muse Spark API | **Not verified** this pass |
| Live GitHub OAuth / PR creation | **Not verified** this pass |

Neon opt-in when available:

```bash
# Dedicated test database only — never production
set PATCHLLAMA_TEST_DATABASE_URL=...   # or equivalent
npm run test:db
```

Never reset or migrate a shared production database from tests.

## JSON import

No automatic import. Operator-only:

```bash
npm run storage:import-json
```

If `.data/patchllama/sessions/` is empty, there is nothing to import.

## Security / ops notes

- Keep real `DATABASE_URL` in `.env.local` / host secrets only.
- Rotate credentials if exposed.
- Free-text secret redaction is **best-effort**, not a guarantee.
- Staging before production: auth + Neon + Docker health.

## Known limitations

- Regex redaction is incomplete by nature.
- Single-node in-process locks; rely on DB version across instances.
- Live Muse Spark / GitHub PR / Docker E2E / hosted Neon require external infrastructure and were **not verified** in the `9e46033` verification pass.

## Staging / production readiness

**Conditionally ready for staging** with proper env and migrations. **Not claimed production-ready.** No live hosting status is asserted here.
