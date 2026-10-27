# Patch-Llama

**Find the bug. Fix the code. Prove it works.**

PatchLlama is an **evidence-based debugging product** powered by **Meta Muse Spark**.  
It is **not** a website builder and **not** a full AI coding platform dump.

This repository contains **only the PatchLlama product** — diagnose → propose patch → human approve → verify with real commands.

## Screenshots

### Home

![PatchLlama home](docs/images/01-home.png)

### Workspace (start a demo)

![PatchLlama workspace](docs/images/02-workspace.png)

### Diagnosis + proposed diff (`awaiting_approval`)

![Diagnosis and unified diff](docs/images/03-diagnosis.png)

### Applied patch + AI diagnosis

![Verified patch and diagnosis](docs/images/04-verified.png)

### Verification report (`bun test` exit 0 · PASS)

![Verification report and audit](docs/images/05-verification-report.png)

### Settings · Meta Muse Spark status

![Meta API settings](docs/images/06-settings.png)

---

## Major problem it solves

Most AI coding tools (Cursor, Copilot, Claude, Gemini, website builders, in-house agents) will:

1. Read a failure  
2. Write a patch  
3. Say “fixed”

That claim is usually **unproven**. A confident model answer is not a passing test.

**PatchLlama’s job:** turn “AI thinks it’s fixed” into **“the verification command exited 0.”**

It works the same way whether the broken code came from:

- your own app  
- another AI coding assistant  
- a generated SaaS / shop / API project  
- a teammate’s PR that fails CI  

PatchLlama does **not** care who wrote the bug. It cares about **failure evidence → minimal fix → proof**.

---

## What it does (to any product)

| Step | What happens |
|------|----------------|
| 1. Intake | You give failing command output + relevant source files |
| 2. Diagnose | Muse Spark (or labeled **DEMO / MOCK**) explains root cause with evidence |
| 3. Propose | A **minimal** patch / unified diff is proposed |
| 4. Approve | **You** must approve — nothing is applied silently |
| 5. Verify | Allowlisted real commands run: `bun test` / `bun run build` / `bun run typecheck` |
| 6. Report | Status is **VERIFIED** only if exit code is `0`. Otherwise **FAILED** |

A successful model patch **without** a passing verification command is **not** a verified fix.

---

## How it works

```text
User / CI failure
      ↓
/patchllama workspace  →  /api/patchllama/*
      ↓
Meta Muse Spark  (api.meta.ai/v1/chat/completions)
  OR labeled DEMO / MOCK when MODEL_API_KEY is missing
      ↓
Human: Approve & verify
      ↓
Isolated workspace write
      ↓
Allowlisted bun test | build | typecheck
      ↓
Verification report (real stdout/stderr + exit codes)
```

- **No silent failover** to OpenAI / Claude / Gemini for PatchLlama diagnosis or patching.  
- Demo mode is always labeled **DEMO / MOCK** in the UI.  
- Session history: **Neon PostgreSQL** for hosted/production; local JSON under `.data/patchllama/` only when `PATCHLLAMA_STORAGE=json` (demo/dev).

---

## How to use it on your product

1. Reproduce a failure (`test` / `build` / `typecheck`).
2. Open PatchLlama workspace.
3. Create a session with:
   - failure title + command + stderr/stdout  
   - the relevant source files  
4. Review Muse Spark diagnosis + proposed diff.  
5. Click **Approve & verify**.  
6. Only merge / ship if the report says **VERIFIED**.

For a zero-setup walkthrough, use the built-in demos (seeded from `fixtures/patchllama-demo`):

- **Demo: logic bug** → should end **VERIFIED** (`sum` returns `a + b`, `bun test` passes)  
- **Demo: bad patch** → should end **FAILED** (intentional wrong patch; proves AI text ≠ success)

---

## Quick start

```bash
npm install
cp .env.example .env
# Set AUTH_SECRET (required). AUTH_DEMO_LOGIN=1 enables local demo session.
# Start Docker Desktop before approve/verify (fail closed if unavailable).
npm run dev
```

Open [http://localhost:3000/patchllama](http://localhost:3000/patchllama).

Without `MODEL_API_KEY`, analysis uses labeled **DEMO / MOCK**.  
`evidenceSource: seeded_fixture` means intake stderr was seeded — not a Docker baseline.

### Security boundaries (read this)

| Control | Behavior |
|---------|----------|
| Auth | Auth.js session required on mutating APIs; identity from server session only |
| Workspaces | Server-managed under `.data/workspaces` — client cannot supply `workspaceRoot` |
| Execution | Docker only (non-root, `--network none`, scrubbed env, memory/CPU/pids/time limits) |
| Secrets | `MODEL_API_KEY` / `AUTH_*` / tokens never passed into project containers |
| Fail closed | If Docker is unhealthy → `ISOLATION_UNAVAILABLE` (no fake host sandbox) |
| Evidence | `INCONCLUSIVE` if baseline check exits 0; `VERIFIED` only after Docker exit 0 |
| Storage | JSON = local/demo only; **Neon Postgres (`DATABASE_URL`) required in production** — no silent JSON fallback |
| GitHub | Pin commit SHA; repair branch + PR after VERIFIED + explicit confirm; never push default branch |

See [docs/DATABASE.md](docs/DATABASE.md) for Neon setup, migrations, import, backup, and rotation.  
See [docs/AUDIT.md](docs/AUDIT.md) for measured baseline check results.

### Checks

```bash
npm run typecheck
npm run test
npm run build
```

### Env

See [`.env.example`](.env.example). Minimum for local demo:

```bash
AUTH_SECRET=replace-with-a-long-random-secret-at-least-32-chars
PATCHLLAMA_MODE=demo
AUTH_DEMO_LOGIN=1
PATCHLLAMA_STORAGE=json
MODEL_API_KEY=LLM_your_meta_key
MODEL_API_BASE_URL=https://api.meta.ai/v1
MODEL_NAME=muse-spark-1.3
```

Hosted / production:

```bash
PATCHLLAMA_STORAGE=postgres
DATABASE_URL=postgresql://USER:PASSWORD@HOST-pooler.../neondb?sslmode=require
npm run db:migrate
```

Never commit `.env` / `.env.local` or real connection strings.

---

## Repo layout (product only)

```text
ai/muse-spark/          Meta Muse Spark client + schemas
ai/patchllama/          diagnose → patch → approve → verify pipeline
app/(patchllama)/       UI (/patchllama/*)
app/api/patchllama/     REST API
fixtures/patchllama-demo/   Reproducible failing fixture
docs/                   Architecture + attribution
```

No marketing monorepo. No builder IDE. No unrelated services.

---

## API (high level)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/patchllama/meta/status` | Meta connection / demo mode |
| POST | `/api/patchllama/sessions` | Create debug session |
| POST | `/api/patchllama/sessions/[id]/analyze` | Diagnose + propose patch |
| POST | `/api/patchllama/sessions/[id]/patches/[patchId]/approve` | Apply + verify |
| GET | `/api/patchllama/sessions/[id]/report` | Verification report |
| POST | `/api/patchllama/demo` | Seed demo scenarios |

---

## Benefits

- **Proof over vibes** — exit codes, not chat confidence  
- **Human gate** — approve before any write  
- **Works across AI tools** — debug code produced by any model or human  
- **Safe demo path** — mock is labeled; never pretends to be Muse Spark  
- **Minimal surface** — small Next.js app focused on one job  

---

## License

AGPL-3.0-only. See [`LICENSE`](LICENSE) and [`docs/THIRD_PARTY_AND_ATTRIBUTION.md`](docs/THIRD_PARTY_AND_ATTRIBUTION.md).
