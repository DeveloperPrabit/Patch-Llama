# PatchLlama — Neon PostgreSQL

## Overview

Hosted PatchLlama persists sessions, patches, executions, and audit events in **Neon PostgreSQL** via Drizzle ORM.

| Mode | When | Backend |
|------|------|---------|
| `PATCHLLAMA_STORAGE=postgres` | Hosted / explicit | Neon (`DATABASE_URL`) |
| `PATCHLLAMA_STORAGE=json` | Local/demo only | `.data/patchllama/sessions/*.json` |
| `NODE_ENV=production` | Always | Postgres required; JSON refused |

Production never silently falls back to JSON files.

## Create a Neon project

1. Create a project at [console.neon.tech](https://console.neon.tech).
2. Copy the **pooled** connection string (host contains `-pooler`).
3. Optionally copy the **direct** connection string for migrations.

## Environment

Local (`.env` / `.env.local`, never commit):

```bash
PATCHLLAMA_STORAGE=postgres
DATABASE_URL=postgresql://USER:PASSWORD@ep-xxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require
# Optional for migrations if pooler blocks DDL:
DATABASE_URL_UNPOOLED=postgresql://USER:PASSWORD@ep-xxx.REGION.aws.neon.tech/neondb?sslmode=require
```

Hosting platform: set the same variables in the deployment environment. Do not print `DATABASE_URL` in logs or diagnostics.

## Migrations

Schema lives in `db/schema.ts`. SQL migrations are versioned under `drizzle/`.

```bash
# After schema edits (generates SQL under drizzle/):
npm run db:generate

# Apply to the database pointed at by DATABASE_URL_UNPOOLED or DATABASE_URL:
npm run db:migrate
```

Do **not** run destructive schema sync at application startup. Runtime only queries; migrations are an explicit operator step.

## Verify Neon is actually used

1. Set `PATCHLLAMA_STORAGE=postgres` and `DATABASE_URL`.
2. Create a debug session in the UI or via API.
3. In Neon SQL Editor:

```sql
SELECT id, user_id, status, version, updated_at FROM sessions ORDER BY updated_at DESC LIMIT 5;
SELECT COUNT(*) FROM patches;
SELECT COUNT(*) FROM executions;
SELECT COUNT(*) FROM audit_events;
```

4. Restart the app process and reload the session — data must still be present (not only under `.data/`).

## Optional JSON → Postgres import

If you have local JSON sessions under `.data/patchllama/sessions/`:

```bash
npm run storage:import-json
# or:
npx tsx scripts/import-json-sessions.ts --dir .data/patchllama/sessions
```

- Validates each record; skips duplicate IDs; does **not** delete source JSON.
- Do not import demo/untrusted files into production without an explicit operator decision.

If there are no JSON session files, skip this step.

## Backup and restore

Use Neon’s built-in **PITR / branches** or `pg_dump` / `pg_restore` against the direct host. Store dumps offline with restricted access.

## Credential rotation

If a connection string is exposed (chat, logs, screenshots):

1. Rotate the role password (or reset) in the Neon console.
2. Update `DATABASE_URL` / `DATABASE_URL_UNPOOLED` everywhere.
3. Redeploy so no process retains the old URL.
4. Revoke any leaked CI secrets.

## Security notes

- Identity comes only from the Auth.js server session; never trust client `userId`.
- `workspace_root` in the DB is a filesystem hint — path access still goes through the managed workspace + path guard.
- Tokens, OAuth secrets, and `DATABASE_URL` must never appear in `payload` / audit `meta` / stdout / stderr (best-effort redaction on write). Regex redaction is **not** a guarantee that every secret is detected.
- Keep transactions short: never hold a DB transaction open across Muse Spark or Docker runs.
- Migrations are operator-run (`npm run db:migrate`); they do not execute on every request.
