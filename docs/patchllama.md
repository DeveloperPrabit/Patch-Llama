# PatchLlama architecture

See the root [README.md](../README.md) for the product story (problem, benefits, how to use on any codebase).

## Pipeline

```text
Intake → Muse Spark / DEMO diagnose → patch proposal → human approve
      → isolated write → bun test|build|typecheck → VERIFIED | FAILED
```

## Key modules

| Path | Role |
|------|------|
| `ai/muse-spark` | Meta Model API client (`chat/completions`) |
| `ai/patchllama` | Session store, seed demos, approve/verify |
| `app/api/patchllama` | HTTP API |
| `app/(patchllama)` | UI shell |
| `fixtures/patchllama-demo` | Reproducible failing unit test |

## Verification policy

Only allowlisted commands run. Model output alone never sets status to verified.
