# PatchLlama demo fixture

Four known failure scenarios for the Meta Muse Spark / demo pipeline:

| Scenario | Original failure | Expected verification |
|---|---|---|
| Logic bug | `src/math.ts` returns `a - b`; `bun test` fails | After correct patch → `bun test` passes |
| Type error | `src/greeter.ts` types `name` as `number` | After signature fix → `bun run typecheck` passes |
| Missing import | `src/app.ts` imports `./missing-util` | After creating module → `bun run build` passes |
| Bad patch | Same as logic bug, but intentionally insufficient patch | Verification **FAILED** (proves we do not claim success from model output alone) |

Seed these into a PatchLlama debugging session from the UI “Load demo” action or `POST /api/patchllama/demo`.
