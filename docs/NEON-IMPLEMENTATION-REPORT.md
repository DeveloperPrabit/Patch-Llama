# Neon PostgreSQL integration — implementation report

**Shipped on `main`:** `b652ae4` — Neon PostgreSQL persistence  
**This document:** updated for the production-readiness follow-up on top of `b652ae4` (may be uncommitted — check `git status`).

## What is implemented

| Area | Status |
|------|--------|
| Drizzle client (`db/client.ts`) + schema + versioned `drizzle/` migrations | Implemented and tested |
| Storage facade → Postgres / JSON adapters | Implemented and tested |
| Production refuses JSON / missing `DATABASE_URL` | Implemented and tested |
| Ownership isolation + optimistic `version` | Implemented and tested (unit + Neon opt-in) |
| Optional JSON → Postgres import (idempotent skip by id; no source delete) | Implemented; idempotency policy unit-tested; live import **NOT RUN** unless operator invokes script |
| Execution/audit text secret redaction | Implemented and tested (best-effort; see SECURITY-REVIEW) |
| Analysis / apply failure recovery (no stuck `analyzing` / safer apply) | Implemented and tested |

## Migrations

```bash
npm run db:generate   # after schema edits
npm run db:migrate    # uses DATABASE_URL_UNPOOLED or DATABASE_URL
```

Migrations do **not** run on application request/startup.

## Tests (re-run on each readiness pass)

See the latest agent/report output for exact counts. Typical:

- Unit: `npm run test` — includes storage, sanitize, pipeline analysis/apply, auth, docker unavailable, path-guard, etc.
- Neon opt-in: set `PATCHLLAMA_TEST_DATABASE_URL` then `npm run test:db`
- Never reset/migrate a shared production database from tests

## JSON import

No automatic import. Operator-only:

```bash
npm run storage:import-json
```

If `.data/patchllama/sessions/` is empty, there is nothing to import.

## Security / ops notes

- Keep real `DATABASE_URL` in `.env.local` / host secrets only.
- Rotate credentials if exposed.
- Staging before production: auth + Neon + Docker health.

## Known limitations

- Regex redaction is incomplete by nature.
- Single-node in-process locks; rely on DB version across instances.
- Live Muse Spark / GitHub PR / Docker E2E require external infrastructure (often **NOT RUN** in CI-less local reviews).
