# ai: AI Game Builder log

Owner of `packages/ai/**` (`@degamed/ai`) and `apps/api/**`.

## Architecture

```
 prompt ──► createGame ──► provider ──► GameSpec ──► buildGame (engine kit) ──► checkProject ──► files
                │            │  (validate → repair once → fall back to instant)
                │            ├─ instant    keyword/synonym/intent matching, offline, free
                │            ├─ gemini     BYOK, browser fetch, gemini-2.5-flash, JSON mode, no thinking tokens
                │            ├─ openai     BYOK, gpt-4.1-mini, json_object
                │            ├─ anthropic  BYOK, claude-haiku-4-5, browser-access header, cacheable system prompt
                │            └─ degamed    our Worker: POST /ai/generate → Workers AI (Llama), capped per user
 request ─► editGame ──► short + understood by instant? ── yes ─► spec patch (free, no model call)
                │                   no
                │                    ▼
                │      model returns { summary, spec patch?, edits? [{path, find, replace}], needFiles? }
                │      spec patch → rebuild with a 3-way file merge (keeps the player's own changes)
                │      code edits → applied as exact find/replace, recorded in game.mods.json, replayed after rebuilds
                │      syntax check → one model fix → otherwise undo the code part
 errors ──► repairFromErrors ──► model minimal fix (validated) ──► else undo recorded AI code edits
```

Files in `packages/ai/src`:

| File | What it does |
|---|---|
| `index.ts` | Public API (the BRIEF contract plus additive extras). |
| `protocol.ts` | Pure, Worker-safe: request/response zod schemas with hard size limits (`LIMITS`), compact prompts, catalogue text, spec validation and param sanitising, `runTask` (validate → repair once). Imported by the Worker as `@degamed/ai/protocol`, so the browser and the server build identical prompts. |
| `catalog.ts` | The game backend (kits, themes, `buildGame`, `readSpec`) behind `getBackend()` / `setBackend()`. Currently a local stub: one platformer kit on the starter template + 3 theme ids; it applies gravity, speed, jump, enemy and coin params and writes `game.spec.json`. |
| `instant.ts` | Free instant mode: genre/mood concepts with synonyms, kit and theme scoring from catalogue keywords, generic "knobs" (difficulty, enemies, length, jump, gravity, speed, night, coins, lives, double jump) mapped onto any kit's params by name, number words ("three slimes", "50 enemies" clamped), fun titles and a one-line story. Chat edits: relative nudges ("floatier", "much harder"), world and genre switches, renames. |
| `providers.ts` | BYOK model calls, the hosted runner, `availableProviders`, plain-English errors. |
| `game.ts` | `createGame`, `editGame`, `repairFromErrors`, progress messages, token logging. |
| `patch.ts` | Exact find/replace edits, `game.mods.json`, 3-way rebuild merge. |
| `check.ts` | Static checks: JSON parses, manifest and scenes match the schema, referenced files exist, JS syntax (via `new Function`, never executed). |
| `suggest.ts` | 4–6 quick-action chips, each verified to work in instant mode (so chips are always free). |

Why it's cheap:
- The model writes a **spec of about 40–100 tokens**, not code. Kits turn it into a full game.
- Chips and short clear requests ("make it night") **never call a model**, whichever provider is picked.
- Spec-shaped edits send **no code**; code is only sent for requests the spec can't express, picked by relevance and capped at 6 files / 12k chars. The model can ask for one more file once (`needFiles`).
- History is trimmed to the last 6 turns × 400 chars. Output caps: 400 tokens (create), 900 (edit, repair).
- Gemini's hidden thinking is turned off (`thinkingBudget: 0`), which would otherwise multiply output cost.
- Static instructions + catalogue form a stable system prefix (cache-friendly); only the idea varies.
- Every call logs `[degamed/ai] <task> via <provider>: N in / M out tokens, K calls, T ms` (`setAiLogger` to redirect).

## Hosted tier: `POST /ai/generate` (apps/api)

- Auth exactly like `/art/generate` (Supabase token; `DEV_ANON_ART=true` local dev mode also applies).
- Body must be a `TaskRequest` (`create` / `edit` / `repair`) that passes the zod schema with hard limits: prompt ≤ 600 chars, ≤ 6 files, ≤ 12k chars of code, ≤ 6 history turns, ≤ 8 errors. Anything else → 400. The server builds the prompt itself, caps `max_tokens`, uses JSON mode and returns only a validated spec or patch. It is not an open proxy.
- Daily cap per user: `AI_DAILY_LIMIT` (default **30**) via `usage_events` kind `'ai'`. Every request that reaches the model is counted, including failures, so the cap can't be dodged.
- Models (vars in `wrangler.toml`): `AI_TEXT_MODEL = @cf/meta/llama-3.1-8b-instruct-fast` for create and spec edits; `AI_CODE_MODEL = @cf/meta/llama-3.3-70b-instruct-fp8-fast` only when code is involved (edits with files, repairs).
- Response: `{ result, usage, attempts, remaining }`. The client re-validates `result`.

## Cost table

Token sizes measured from the real prompts (≈ 4 chars/token, rounded up for a full catalogue of ~4 kits and ~8 themes):

| Call | Input tokens | Output tokens |
|---|---|---|
| Create (spec) | ~700 | ~100 |
| Edit, spec only | ~800 | ~80 |
| Edit with code (player script in context) | ~1,500 | ~300 |
| Repair from errors | ~1,000 | ~200 |
| Chip / short clear request | 0 (instant) | 0 |

A bad reply costs one extra call (repair) at worst; then instant mode takes over for free.

Expected cost per 1,000 calls (list prices, Oct 2026; BYOK costs are paid by the player, not us):

| Provider | Model | Price $/M in / out | 1,000 creates | 1,000 spec edits | 1,000 code edits | Who pays |
|---|---|---|---|---|---|---|
| instant | none | 0 | **$0** | **$0** | n/a | nobody |
| gemini | gemini-2.5-flash | free tier, else 0.30 / 2.50 | **$0** on a free key (rate-limited), $0.46 paid | $0 / $0.44 | $0 / $1.20 | player |
| openai | gpt-4.1-mini | 0.40 / 1.60 | $0.44 | $0.45 | $1.08 | player |
| anthropic | claude-haiku-4-5 | 1.00 / 5.00 | $1.20 | $1.20 | $3.00 | player |
| degamed | Llama 3.1 8B fast (spec) | ≈0.045 / 0.384 | **$0.07** (~6 neurons each) | $0.07 (~6 neurons) | n/a | us |
| degamed | Llama 3.3 70B fp8-fast (code) | 0.293 / 2.253 | n/a | n/a | **$1.12** (~100 neurons each) | us |

**Workers AI free allowance:** 10,000 neurons per day (1,000 neurons = $0.011 after that, Workers Paid only; on the Free plan requests simply fail past the allowance, and the client falls back to instant mode). That is roughly:
- **~1,500 hosted game creations per day**, or
- ~100 code edits per day, or
- ~75 full sessions/day of 1 create + 3 AI spec edits + 1 code edit (≈130 neurons).

The allowance is shared with hosted FLUX images (`/art/generate`). With the per-user cap of 30, a single heavy user can spend at most ~3,000 neurons/day if every request were a code edit, ~200 if they're creates. Beyond the free allowance, 1,000 typical sessions cost about **$1.40**.

Caveat: Workers AI model ids and neuron rates change; the 8B "fast" rate above is the `-fp8-fast` list price. Verify both model ids in the Cloudflare dashboard before deploying (fallbacks: `@cf/meta/llama-3.1-8b-instruct-fp8-fast`, `@cf/meta/llama-4-scout-17b-16e-instruct`).

## Round 1

### Done
- **`@degamed/ai` package** (workspace, typecheck + vitest like `packages/art`), implementing the BRIEF contract exactly: `createGame`, `editGame`, `suggestions`, `availableProviders`, types `ProviderId`, `AiSettings`, `Progress`, `ChatTurn`, `GameSpec`. Additive extras: results carry `provider`, `notice?`, `usage`; `repairFromErrors(files, errors, settings, opts?)`; `suggestions(files, { ai? })`; `setBackend`, `setAiLogger`, `PROVIDER_LABELS`, `DEFAULT_MODELS`, `LIMITS`, `instantSpec`, `instantEdit`, `checkProject`.
- **Spec-first generation** with zod validation against the catalogue (kit/theme ids matched case-insensitively or by name; params coerced, clamped to range/step, unknown keys dropped), one repair round with the errors shown to the model, then instant fallback. The player always gets a playable game; only a user cancel (AbortSignal) skips the fallback.
- **Edits**: spec patches with 3-way rebuild merge, targeted `{path, find, replace}` code edits (exact and unique only) recorded in `game.mods.json` and replayed after rebuilds, syntax check → one fix → undo. Free fast path for chips and short clear requests.
- **Instant mode** that's genuinely decent: "a moody rain-soaked platformer where a little robot looks for its family" → platformer, rain-ruins, "Robot of the Ruins", story "A little robot looks for its family."; spooky → hollow-caverns, happy → sunlit-meadow, "very hard", "short", "floaty", "at night", "three slimes", "called Moonfall", genre words (runner, top-down/zelda, shooter).
- **Providers**: instant, gemini, openai, anthropic (BYOK, browser fetch), degamed (hosted).
- **Hosted tier** `POST /ai/generate` with auth, 30/day cap, structured-task-only schema, JSON mode, `max_tokens`, small/big model split, friendly 429/502s. Bundle checked with `wrangler deploy --dry-run`: 145 kB gzipped, no Phaser.
- **Tests**: `@degamed/ai` 74 tests (instant mapping, schema validation, prompts and budgets, repair path, provider request shapes with mocked fetch, create/edit/repair flows, mods surviving rebuilds, suggestions, merge). `@degamed/api` 20 tests (8 new for `/ai/generate`).
- BOARD: asked design to add the dependency; asked engine to export `./kits`; noted contract additions.

### Next
- Switch the default backend from the stub to `@degamed/engine/kits` (the adapter `backendFromKits(mod)` is ready and tested; it can also be wired from the web app today with `setBackend(backendFromKits(await import(...)))`) (`KITS`, `buildGame`, `readSpec`, `listThemes`) as soon as it's exported; re-tune instant keywords against the real kits and themes.
- Run real prompts through each provider once keys are available and tune the prompts (few-shot example if 8B picks poorly).
- Optional global daily ceiling on the Worker so the free allowance can never be exceeded by many users together.
- Teach repair to use the engine's `ScriptError` line numbers to pick the exact snippet.

### Needs from others
- **engine**: add `"./kits": "./src/kits/index.ts"` to `packages/engine/package.json` exports (Phaser-free), with `listThemes()`. Generous kit `keywords` help instant mode.
- **design**: add `"@degamed/ai": "workspace:*"` to `apps/web` deps; show `notice` softly; pass `authToken` + `apiUrl` for `degamed`; feed player console errors to `repairFromErrors`.
- **coordinator**: `pnpm-lock.yaml` changed (new workspace package + `@degamed/ai` in apps/api).

### Known issues
- Until the engine kits land, every game is the starter platformer (only gravity, speed, jump, enemy and coin counts and the title change; the theme is stored but not drawn).
- Workers AI model ids/neuron rates are from memory and unverified here (no network). Easy to change via `wrangler.toml` vars.
- No live provider has been called (no keys in this environment); request shapes are tested against mocks of the documented APIs.
