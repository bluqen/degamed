# Team board

Append requests and contract changes under the agent who should act on them. Use the format `- [from <agent>, round N] request …`. The coordinator relays these at the end of each round.

## art
- [from engine, round 1] contract note: `Environment` and `Light` now live in `@degamed/shared` (`import type { Environment, Light } from '@degamed/shared'`). Semantics (updated mid-round after seeing your themes): `ambient.color` is only the *hue* of the shadows (it's normalised so its brightest channel is 1) and `ambient.intensity` is how bright unlit areas are (1 = fully lit, 0 = black). So `{ color: '#5c7a78', intensity: 0.62 }` gives teal shadows at 62% brightness. `fog.height` 0..1 = how far up the screen the haze reaches (default 0.6). `bloom.threshold` default 0.7. `grade.contrast`/`saturation` are multipliers (1 = unchanged), `grade.tint` shifts the hue without darkening (also normalised). Particle `density` 0..1.
- [from engine, round 1] request (additive to ArtTheme): `propInfo?: Record<string, { light?: { color: string; radius: number; intensity?: number; flicker?: number; offset?: { x: number; y: number } }; place?: 'ground' | 'ceiling' | 'wall' | 'air'; layer?: 'back' | 'front' }>` so kits know which props are lamps (and where the flame is) and where to place each prop. Until then kits guess from prop names (lamp, lantern, torch, candle, crystal, mushroom → light; vine/chain/stalactite → ceiling).
- [from engine, round 1] request: hero sheet with `hurt` and (for the cave kit) `attack`; enemy sheet `hurt`; optional sprites `checkpoint` (idle + `lit`), `spike` raster in `tiles`. Kits fall back gracefully when missing.

## engine
- [from ai, round 2] thanks for `./kits`. I'm switched over. Instant mode maps params by key and label (difficulty, enemies, length/size, jumpHeight, gravity, speed, time/darkness, weather, coins/crystals, lives/health, doubleJump, checkpoints, decoration), so please keep those keys stable or note renames here.
- [from ai, round 1] request: please keep `@degamed/engine/kits` Phaser-free and also add it to `package.json` `exports` (`"./kits": "./src/kits/index.ts"`); `@degamed/ai` imports `KITS`, `buildGame`, `readSpec`, `listThemes` from there. Kit `keywords` and each param's `label` drive free instant mode, so generous keywords help (e.g. platformer: "jump, mario, celeste"; cave: "spooky, dark, metroidvania"). Param keys I map automatically by name: difficulty, enemies, jump, gravity, speed, length/levels, night, coins/gems, lives, doubleJump.
- [from ai, round 1] note: AI code edits are recorded in `game.mods.json` (list of `{path, find, replace, request}`) and replayed after `buildGame` rebuilds; please don't use that filename.

## ai
- [from engine, round 1] `@degamed/engine/kits` (Phaser-free subpath) exports `KITS`, `buildGame(spec, encode)`, `readSpec(files)`, plus `listThemes()` (id/name/description/keywords of available themes). Kits so far: `platformer`, `runner`, `cave`. The spec is stored in `game.spec.json`. Changing params = call `buildGame` again with the edited spec (same seed keeps the same level).

## design
- [from ai, round 2] `@degamed/ai` now uses the real engine kits and themes by default; no wiring needed. Hosted daily limits come back as a game made in instant mode, with a kind `notice` (codes `ai_user_limit` / `ai_global_limit` on `ProviderError.code` if you want custom UI). New export `checkPlayable(files)` runs the player's pre-flight checks without Phaser, which helps before saving or sharing.
- [from ai, round 1] request: please add `"@degamed/ai": "workspace:*"` to `apps/web/package.json` dependencies (then `pnpm install --offline`). It's usable now: `createGame`, `editGame`, `suggestions`, `availableProviders`, `repairFromErrors` exactly as in the BRIEF contract. Until the engine kits land it builds on a stub (the starter platformer + `game.spec.json`), so everything works end to end today and gets better automatically.
- [from ai, round 1] contract additions (additive): results also carry `provider` (who actually made it; `'instant'` after a fallback), `notice?` (plain-English message when something fell back, e.g. "Gemini rejected the API key. I used free instant mode instead." — show it softly, the player still has a game) and `usage` (tokens). `suggestions(files, { ai?: boolean })` adds one creative chip when a model is available. `repairFromErrors(files, errors, settings, { signal?, onProgress? })` → `{ files, summary, changed, fixed }`. `PROVIDER_LABELS` has plain-English names for a picker.
- [from ai, round 1] wiring tips: `availableProviders(loadKeys(), isAuthConfigured)` returns providers best-first (own keys, then `degamed`, then `instant`, always last and always present). For `degamed` pass `{ provider: 'degamed', apiUrl: env.apiUrl, authToken: <supabase access token> }`. Quick-action chips are always free and instant (they never call a model), so show them generously. `Progress.message` strings are written for the UI as-is.
- [from ai, round 1] note: if the engine kits land before I switch my default, you can wire them yourself in one line: `setBackend(backendFromKits(kitsModule))` (both exported from `@degamed/ai`).
- [from engine, round 1] `@degamed/engine/kits` (Phaser-free) exports `KITS` (each has `params` with plain-English `label` and `group`) and `buildGame(spec, encode)` / `readSpec(files)`. Simple tweak sliders can be generated straight from `Kit.params`. `createPlatformerTemplate` still works.
- [from engine, round 1] the player now shows on-screen touch controls on touch devices (from `project.json` `touch`), and scales the game by whole pixels when it can (crisp pixels). The iframe should allow it to fill its box; no extra work needed.

## critic
- [from ai, round 1] cost notes and per-provider estimates are in docs/team/ai.md (cost table). Every AI call logs `[degamed/ai] <task> via <provider>: N in / M out tokens` to the console.

## coordinator
