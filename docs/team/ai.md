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
| `catalog.ts` | The game backend (kits, themes, `buildGame`, `readSpec`) behind `getBackend()` / `setBackend()`. **Default (round 2): the engine's real kits (`@degamed/engine/kits`: platformer, runner, cave) and the art themes via `listThemes()`** (rain-ruins, hollow-caverns, sunlit-meadow, ember-forge, starter), listed lazily because listing builds the art. A small stub backend stays for engine-independent unit tests. |
| `instant.ts` | Free instant mode: genre/mood concepts with synonyms, kit and theme scoring from catalogue keywords, generic "knobs" (difficulty, enemies, length, jump, gravity, speed, night, coins, lives, double jump) mapped onto any kit's params by name, number words ("three slimes", "50 enemies" clamped), fun titles and a one-line story. Chat edits: relative nudges ("floatier", "much harder"), world and genre switches, renames. |
| `providers.ts` | BYOK model calls, the hosted runner, `availableProviders`, plain-English errors. |
| `game.ts` | `createGame`, `editGame`, `repairFromErrors`, progress messages, token logging. |
| `patch.ts` | Exact find/replace edits, `game.mods.json`, 3-way rebuild merge. |
| `check.ts` | Static checks: JSON parses, manifest and scenes match the schema, referenced files exist, JS syntax (via `new Function`, never executed). `checkPlayable` mirrors the player's own pre-flight (`parseProject` + `compileScripts` in the engine runtime) without Phaser: manifest, start scene, frames files and their sheets, sprite and parallax images, every script and its imports (`'degamed'` or relative only). |
| `suggest.ts` | 4–6 quick-action chips, each verified to work in instant mode (so chips are always free). |
| `heroes.ts` | Round 3: never promise a hero the art can't draw. Creature words → kinds (robot/bot/droid…, bat, fox, cat…); `heroFor(theme, kind)` checks the theme's hero variants (`heroes`, when art ships them) or else the hero its `description` names; `drawableText` rewrites anything else to "a little wanderer". |

Why it's cheap:
- The model writes a **spec of about 40–100 tokens**, not code. Kits turn it into a full game.
- Chips and short clear requests ("make it night") **never call a model**, whichever provider is picked.
- Spec-shaped edits send **no code**, and the current spec is sent without params that are at their defaults. Code is only sent for requests the spec can't express, picked by relevance and capped at 6 files / 20k chars (the kits' player script alone is ~10.5k chars). The model can ask for one more file once (`needFiles`).
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
- **Global ceiling** (round 2): `AI_GLOBAL_DAILY_LIMIT` (default **250**, `0` = off) caps hosted AI requests per day across all users, so a viral spike can't run past the free allowance. 250 × ~37 neurons (typical mix: 80% spec tasks at ~7, 20% code edits at ~155) ≈ 9,250 neurons, under the 10,000 free neurons. It is a row count, so a day of only creates stops well short of the allowance (~1,700 neurons); raise it if the logs show mostly spec tasks. Both limits return 429 with a machine-readable `code` (`ai_user_limit` / `ai_global_limit`); the client turns either into an instant-mode game with a kind notice ("Degamed AI is very busy today… so I made this one with free instant mode. Add your own Gemini key in Settings to keep using AI.").

## Cost table

Token sizes measured from the real prompts with the engine's real catalogue (3 kits with 11–13 params each, 5 themes; ≈ 4 chars/token):

| Call | Input tokens | Output tokens |
|---|---|---|
| Create (spec) | ~700 | ~100 |
| Edit, spec only | ~850 | ~80 |
| Edit with code (kit player script, ~10.5k chars, in context) | ~3,500 | ~300 |
| Repair from errors | ~2,700 | ~200 |
| Chip / short clear request | 0 (instant) | 0 |

A bad reply costs one extra call (repair) at worst; then instant mode takes over for free.

Expected cost per 1,000 calls (list prices, Oct 2026; BYOK costs are paid by the player, not us):

| Provider | Model | Price $/M in / out | 1,000 creates | 1,000 spec edits | 1,000 code edits | Who pays |
|---|---|---|---|---|---|---|
| instant | none | 0 | **$0** | **$0** | n/a | nobody |
| gemini | gemini-2.5-flash | free tier, else 0.30 / 2.50 | **$0** on a free key (rate-limited), $0.46 paid | $0 / $0.46 | $0 / $1.80 | player |
| openai | gpt-4.1-mini | 0.40 / 1.60 | $0.44 | $0.47 | $1.88 | player |
| anthropic | claude-haiku-4-5 | 1.00 / 5.00 | $1.20 | $1.25 | $5.00 | player |
| degamed | Llama 3.1 8B fast (spec) | ≈0.045 / 0.384 | **$0.07** (~6 neurons each) | $0.07 (~7 neurons) | n/a | us |
| degamed | Llama 3.3 70B fp8-fast (code) | 0.293 / 2.253 | n/a | n/a | **$1.70** (~155 neurons each) | us |

**Workers AI free allowance:** 10,000 neurons per day (1,000 neurons = $0.011 after that, Workers Paid only; on the Free plan requests simply fail past the allowance, and the client falls back to instant mode). That is roughly:
- **~1,500 hosted game creations per day**, or
- ~65 code edits per day, or
- ~55 full sessions/day of 1 create + 3 AI spec edits + 1 code edit (≈180 neurons).

The allowance is shared with hosted FLUX images (`/art/generate`). With the per-user cap of 30, a single heavy user can spend at most ~4,700 neurons/day if every request were a code edit, ~200 if they're creates; the global ceiling (250/day) bounds everyone together. Beyond the free allowance, 1,000 typical sessions cost about **$2.00**. Biggest lever left: send only the relevant part of the 10.5k-char player script for code edits (see Next).

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

## Round 2

### Done
- **Real kits by default.** `@degamed/engine/kits` landed with its `./kits` export; `getBackend()` now defaults to the engine's `KITS` / `buildGame` / `readSpec` / `listThemes` (platformer, runner, cave × rain-ruins, hollow-caverns, sunlit-meadow, ember-forge, starter). `engineBackend()` is exported; the stub remains only for unit tests.
- **Instant mode retuned for the real params:**
  - Enemies are a `none/few/some/lots` choice now. Counts map onto it: "2 enemies" gives few, "no enemies" gives none, and "lots of enemies" gives lots.
  - Time of day is a choice (`theme/day/dusk/night`), and the cave kit has `darkness` (`light/dim/dark`). Knobs can now pick a named choice ("make it night" gives `night`, "make it day" gives `day`, and on the cave "brighter" gives `light`), falling back to a level.
  - New knobs:
    - Weather ("a snowy meadow" gives `snow`, but never when the theme already has it, so "rain-soaked ruins" keeps the theme's own rain).
    - Dusk.
    - Decoration ("lush", "minimal").
    - Checkpoints.
    - Cave size ("a small cave").
    - Crystals as collectibles.
  - Genre names now win over setting words, so "a spooky cave platformer" stays a platformer and "metroidvania" picks the cave kit. Added a cave genre word list.
  - The plain `starter` theme is never picked at random. More cute and kid words map to the sunny theme, and the story leaves out settings ("a bunny with 2 enemies" no longer becomes the story).
- **Suggestions** use the real params, and every chip is verified to change the game for free on each kit (including weather, "Make it rain").
- **`checkPlayable`**, the player's pre-flight checks without Phaser, is now part of `checkProject`, so createGame's "testing" stage runs the same checks the player does.
- **End-to-end test** (`packages/ai/src/e2e.test.ts`):
  - 15 varied prompts go through `createGame` in instant mode on the **real kits**. Each asserts the kit, the theme, `readSpec` and `checkPlayable` / `checkProject` (and the same prompts run on the stub).
  - 9 chat edits on the real kits (night, harder, snow, floatier, no enemies, double jump, faster, brighter cave, more crystals), each still playable.
  - Every chip works on all 3 kits.
  - 7 tests of params on the real kits.
  - One check that the default backend really is the engine's.
- **Hosted hardening:**
  - `AI_GLOBAL_DAILY_LIMIT` (default 250, see the cost section) caps hosted requests across all users.
  - Both caps return 429 with `code: 'ai_user_limit' | 'ai_global_limit'`. `ProviderError` carries `code`.
  - `createGame` turns either into an instant-mode game with a kind notice, and `editGame` makes the change in instant mode when it can.
- **Budget:** raised code context to 14k chars per file / 20k total, because the kit player script is 10.5k. Edit prompts send a compact spec without default params. The cost table is updated with the real measurements.
- Tests: `@degamed/ai` **126** (was 74), `@degamed/api` **23** (was 20). Repo-wide `pnpm typecheck && pnpm test` passes.

### Next
- Code edits: send only the relevant methods of big scripts (the player script is ~2.6k tokens of a ~3.5k-token prompt), which would cut hosted code-edit cost by about half.
- Live-test the prompts against real providers once keys exist; few-shot example for the 8B model if it picks poorly.
- Teach repair to use the engine's `ScriptError.file` / line numbers.
- Count hosted usage in weighted units (a code edit costs ~20× a spec task), so the global ceiling can be looser for spec-heavy days.

### Needs from others
- **design**: add the `@degamed/ai` dependency if you haven't. Show `notice` when a game came from the fallback, especially the daily-limit ones. No extra wiring is needed for the kits: they are the default now.
- **engine**: keep param keys stable (instant mode maps by key and label: difficulty, enemies, length/size, jumpHeight, gravity, speed, time/darkness, weather, coins/crystals, lives/health, doubleJump, checkpoints, decoration). If you add a kit, generous `keywords` plus a genre word make instant mode pick it.

### Known issues
- The global ceiling counts requests, not cost, so it is conservative on days of mostly creates.
- Workers AI model IDs and neuron rates are still unverified (no network here).
- The stub backend (tests only) still wraps the starter template, so unit tests that use it don't see real kit params. The real kits are covered by the end-to-end tests.

## Round 3 (critic must-fixes from docs/team/reviews/round-1.md)

### Done
1. **The story and title no longer promise a hero the art can't draw.**
   - "A little robot looks for its family" on a theme without a robot becomes "A little wanderer looks for its family", and a "Robot of the Ruins" title becomes "Wanderer of the Ruins".
   - The same rule applies to model replies, so a model that ignores the instruction gets cleaned up too.
   - The rule covers the title, the story and the summary.
   - **Ready for hero variants:**
     - `ThemeInfo.heroes` and `GameSpec.hero` are new optional fields.
     - The catalogue shows models each theme's hero ids, the create prompt tells models to pick one, and `checkSpec` keeps a hero only if the theme lists it.
     - Instant mode picks the matching variant (`spec.hero`) and gives themes that can draw the asked-for creature a +4 bonus, so "a bat collects crystals" picks the cave theme that has a bat.
     - "play as a robot" swaps the hero in chat. When the world can't draw it, free mode says so: "This world can’t draw a dragon yet…".
   - **Requested on the BOARD:**
     - art: `ArtTheme.heroes` (first entry = default), with each `description` plainly naming the default hero.
     - engine: keep `spec.hero` through `normalizeSpec`, use the variant's sheet, and list `heroes` in `listThemes()`.
2. **Worlds only change on explicit place or mood words.**
   - Theme switches in chat only count place nouns (cave, forest, ruins, castle…), mood words (spooky, cheerful, rainy…) and theme names. Genre and verb keywords like `boss`, `sword` and `combat` can never move the world.
   - A named place wins over weather words in the same request ("take it to the rainy ruins").
   - Genre switches need the genre named outright ("make it an endless runner", "make it a metroidvania"), so "make it a cave" changes the world, not the kit.
   - Model edits get the same guard: if a model changes the theme and the request names no place or mood, the theme change is dropped. The edit prompt now says so too.
3. **Honest free mode, with suggestions that always work.**
   - Things free mode can't do get a plain answer, and the examples come from `suggestions()` for the current game, so each one is a real, working chip on this kit: "Bosses aren’t in free mode yet. Add an AI key in Settings to try it or try “make it day” or “make it harder”."
   - Covered requests: bosses, shooting, talking characters, shops, multiplayer, music, new moves, timers, puzzles.
   - Settings already at their limit say so instead of failing: "It’s already as dark as it gets." On the cave kit, night and day map onto `darkness` (night → dark, day → light), and back again.
4. **Regression tests** (`packages/ai/src/regressions.test.ts`, 26 tests), one group per finding:
   - **Hero honesty:**
     - unit tests for `drawableText`;
     - 5 engine prompts (robot, bat, fox, knight, cat) whose title, story and summary may only name drawable creatures;
     - hero variants picked and kept;
     - a model's robot story cleaned up;
     - hero ids validated;
     - hero swaps in chat.
   - **World switches:**
     - "add a boss", "give me a sword", "make it epic" and others keep the world, even against a theme that wrongly lists `boss`;
     - the honest "Bosses…" answer, where each suggested chip really changes the game;
     - a model's unrequested theme change is dropped;
     - explicit place and mood moves work;
     - genre switches need the genre name.
   - **Cave night and day:**
     - night, day and night again;
     - no chip that wouldn't change the game;
     - fallback chips that work on the cave, runner and night-platformer games;
     - the "already" wording.
   - **Also in the end-to-end suite:**
     - all 15 prompts now check that the summary never names an undrawable creature;
     - instant time-to-spec is measured at **~1 ms average** (the bar is under 300 ms) and must stay under 30 ms.
- Tests: `@degamed/ai` **154** (was 126); `@degamed/api` 23. Repo-wide typecheck and tests pass.

### Next
- Switch on hero variants as soon as art and engine ship them (only an end-to-end check needs adding; the logic is in place).
- The critic's should-fixes for the hosted tier:
  - weighted usage units (code edit ≈ 20× a spec task) against a daily neuron budget;
  - a small separate per-user cap for code edits;
  - a per-IP cap;
  - `GET /ai/health` with today's totals and remaining budget.
- Send only the relevant methods of big scripts for code edits.

### Needs from others
- **art:** `heroes` on `ArtTheme`, plain-English hero names in `description`, and keywords that are places and moods only.
- **engine:** `GameSpec.hero` passed through to the hero sheet; `heroes` in `listThemes()`.
- **design:** show `summary` as the reply even when nothing changed (the "already" and "isn't in free mode yet" answers).

### Known issues
- Until hero variants land, every creature that isn't named in a theme's `description` becomes "a little wanderer". Today that means robots, bats and foxes are never named. This is honest, but less personal.
- The global ceiling still counts requests, not cost (see Next).
