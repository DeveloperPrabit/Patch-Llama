# Patch-Llama

**Find the bug. Fix the code. Prove it works.**

PatchLlama is an **evidence-based debugging product** powered by **Meta Muse Spark**.  
It is **not** a website builder and **not** a full AI coding platform dump.

This repository contains **only the PatchLlama product** — diagnose → propose patch → human approve → verify with real commands.

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
- Session history is stored as local JSON under `.data/patchllama/` (gitignored).

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
bun install   # or: npm install
cp .env.example .env
# optional: set MODEL_API_KEY for real Muse Spark
bun run dev
```

Open [http://localhost:3000/patchllama](http://localhost:3000/patchllama).

Without `MODEL_API_KEY`, demos still work in labeled mock mode.

### Env

See [`.env.example`](.env.example):

```bash
MODEL_API_KEY=LLM_your_meta_key
MODEL_API_BASE_URL=https://api.meta.ai/v1
MODEL_NAME=muse-spark-1.3
```

Never commit `.env`.

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
