# Neon PostgreSQL integration — implementation report

**Branch tip at start:** `94361f8`  
**Status:** Implemented locally; **not committed / not pushed** (awaiting review).

## What changed

| Area | Change |
|------|--------|
| `db/client.ts` | Server-only Drizzle + `postgres` pool (Neon pooler: `ssl: 'require'`, `prepare: false`) |
| `db/schema.ts` | FKs, indexes, `repair_attempts`; payload + child tables |
| `drizzle/` | Versioned migration `0000_*.sql` applied to configured Neon DB |
| `ai/patchllama/storage/*` | Typed store: JSON + Postgres adapters; mode selection; redaction; version conflicts |
| `ai/patchllama/store.ts` | Facade preserving `createSession` / `getSession` / `saveSession` / `listSessionsForUser` / `appendAudit` |
| `ai/patchllama/pipeline.ts` | Assigns `saveSession` return values so optimistic `version` stays coherent |
| `scripts/import-json-sessions.ts` | Optional idempotent JSON → Postgres import (does not delete source) |
| Docs | `docs/DATABASE.md`, README / `.env.example` updates |

## Storage selection

- `NODE_ENV=production` → **postgres only**; missing `DATABASE_URL` or `PATCHLLAMA_STORAGE=json` → hard fail (no JSON fallback).
- Local/demo default → `json` unless `PATCHLLAMA_STORAGE=postgres` + `DATABASE_URL`.

All API / pipeline persistence goes through `ai/patchllama/store.ts` → `getSessionStore()`.

## Migrations run

```text
npm run db:generate   # drizzle/0000_*.sql
npm run db:migrate    # applied successfully against configured Neon DATABASE_URL
```

## Tests

### Unit (default `npm run test`)

```text
Test Files  13 passed
Tests       27 passed | 2 skipped (Neon block skipped without PATCHLLAMA_TEST_DATABASE_URL)
```

Covered: storage config fail-closed, JSON CRUD + ownership list + version conflict, secret redaction, plus existing auth/docker/git/PR/path/ownership suites.

### Neon integration (executed)

```text
PATCHLLAMA_TEST_DATABASE_URL=<configured Neon>
vitest run ai/patchllama/__tests__/postgres-store.test.ts
→ 3 passed (create/read/update/list/isolation/persist, version conflict, gate)
```

### Skipped when URL unset

The two Neon cases inside `postgres-store.test.ts` are `describe.skip` without `PATCHLLAMA_TEST_DATABASE_URL` / `PATCHLLAMA_RUN_DB_TESTS`.

## Checks

| Command | Result |
|---------|--------|
| `npm run typecheck` | Pass |
| `npm run test` (unit) | Pass (27 / 2 skipped) |
| Neon integration | Pass (3) |
| `npm run build` | See below / latest run |
| `npm run db:migrate` | Pass on configured Neon |

## JSON data migration

No session JSON files were present under `.data/patchllama/sessions/` at implementation time (only workspace dirs). Import script is optional; documented in `docs/DATABASE.md`.

## Security notes

- Connection string must live only in env (`.env.local` gitignored). **Rotate the Neon password** — it was pasted into chat.
- Errors/API responses redact postgres URLs / `npg_` tokens.
- Audit/payload writes run through `redactSecrets`.
- `workspace_root` is not an authorization primitive.
- Session lock + optimistic `version` retained for approve/apply.

## Remaining risks

- Multi-instance deploys: in-process `withSessionLock` does not cross processes; DB `version` is the cross-instance guard.
- Large `files[]` in JSONB payload can grow sessions — same as prior JSON store.
- Prefer `DATABASE_URL_UNPOOLED` for future DDL if the pooler rejects migrations.
- Hosting must set `DATABASE_URL` + run `db:migrate` before serving production traffic.
