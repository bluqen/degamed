# The Degamed bar

Owner: critic. This is the acceptance checklist for every round. If a box can be measured, the number is here and `node e2e/run.mjs --round N` checks it. If it can't be measured, it is judged against the reference screenshots and the questions below. **A feature that misses the bar is not done, however much code it took.**

Ratings used in reviews: **Must fix** (blocks the round or the launch), **Should fix** (visibly below the bar), **Nice to have**.

---

## 0. The five numbers that matter most

| # | Number | Target | How it's measured |
|---|---|---|---|
| 1 | Landing → playing **my own** game (typed prompt, free instant mode) | **≤ 60 s and ≤ 3 clicks** (stretch: ≤ 10 s, 2 clicks) | `e2e` journey: type the BRIEF prompt, click the nearest call to action, stop when the player posts `{type:'fps'}` |
| 2 | Console errors + uncaught exceptions on every key page | **0** | `e2e` pages × 2 viewports × 2 themes |
| 3 | Player frame rate, demo game, desktop | **median ≥ 58 fps, min ≥ 50**; on a 4-year-old phone ≥ 50 | player `{type:'fps'}` messages; headless SwiftShader warns below 30 |
| 4 | Shared play link weight (everything a phone downloads before the first frame) | **≤ 250 kB gzip JS**, ≤ 600 kB total incl. art; first frame ≤ 2.5 s on 4G | `e2e` bundle step builds `@degamed/play` (and the web play route once it exists) |
| 5 | Running cost per created game (hosted tier) | **≤ 2 Worker requests and ≤ 3,000 tokens** per new game; **≤ 1 request / ≤ 1,500 tokens** per chat edit; **0** for instant mode | `e2e` counts requests to `/api/`, `workers.dev`, `:8787`; ai agent logs token counts in tests |

---

## 1. Art (owner: art; renders through engine)

Reference: Rain World (layered industrial ruins, fog, rain, value depth), Hollow Knight (dark, readable silhouettes, soft rim light), Celeste (crisp sprites, colour-coded readability), Dead Cells (lighting on pixel art, colour grading). **Not**: flat vector shapes, smooth sine-wave hills, plain linear gradients, noise-speckled ground, stock-blue skies.

### Palette and value
- [ ] Each theme has a **curated palette of 16–32 colours** (not a hue wheel). Every pixel in every layer/sprite snaps to it (test: count unique colours per raster ≤ palette size).
- [ ] **Value structure, back → front:** far layers are lowest contrast and closest to the fog/sky colour; the gameplay plane has the highest contrast. Measured on a greyscale screenshot: luminance spread of the far layer **≤ 15%**, gameplay plane **≥ 45%**.
- [ ] **Hero reads first.** The hero's luminance differs from what's behind it by **≥ 30%** (or it carries a rim light/outline). Enemies differ from the background by ≥ 25% and are tinted toward a danger hue. Pickups are the most saturated thing on screen.
- [ ] Hue shifting in ramps (shadows go cooler/towards purple, highlights warmer). No ramp is just "the same hue, darker".
- [ ] A greyscale screenshot still reads: you can tell ground, hazards, hero, enemies and pickups apart. (Review: convert the shot, look at it.)

### Silhouette and sprites
- [ ] Hero is **at least 16×24 px** in a 480×270 game screen (≥ 8% of screen height), enemies ≥ 16×16. Readable as a recognisable shape when filled solid black.
- [ ] 1-px dark outline or selective outline (sel-out) on characters; no single-pixel noise ("pillow shading" and "banding" are fails).
- [ ] Animations, minimum frames: idle 4 (breathing), run 6–8, jump 2 (rise + apex), fall 2, land squash 1–2, hurt 2, enemy walk 4, pickup idle 6+ (spin or bob). Run cycle has a contact/passing/up pose; anticipation and follow-through visible on jump.
- [ ] Pixel grid is respected: integer scaling, no sub-pixel blur, no mixed pixel sizes between layers (only the camera may move in sub-pixels, and then with snapping on).

### Depth and atmosphere
- [ ] **At least 4 parallax layers** behind the play plane (sky, far, mid, near) **plus 1 foreground layer** in front of the player (silhouetted plants, pipes, chains) with factor > 1.0.
- [ ] Atmospheric perspective: each layer further back is lighter/hazier toward the fog colour.
- [ ] At least one **ambient particle** type per theme (rain, dust motes, spores, embers, snow, fireflies) and one **foreground light source** (lamp, glow, moon shafts).
- [ ] Lighting: an ambient darkness level + point lights (hero carries a small light in dark themes). Bloom on emissive things only.
- [ ] Colour grade per theme (contrast/saturation/tint) and a vignette ≤ 0.35.
- [ ] Tiles: ground has a distinct **top edge** (grass/moss/snow cap), a body, and edge/corner variants; no repeating pattern visible at 1 screen width (≥ 3 variants of the fill tile).
- [ ] Props: ≥ 8 decorations per theme, scattered by the kit so no two screens look alike.

### Theme count and coverage
- [ ] Round 1: **2 themes** at the bar (e.g. *Rain Ruins* and one bright contrast theme such as *Mossy Hollow* or *Sunset Peaks*). Round 3: 5–6 themes. Two good themes beat ten swatches.
- [ ] Every theme is shown on the landing page and in the style picker as **an actual in-game screenshot**, never a palette swatch.

**Review method:** desktop game shot at 1440×900 and phone at 390×844, plus a greyscale version. Compare side by side with a Rain World / Hollow Knight still. Ask: "If this were a Steam capsule, would I click it?"

---

## 2. App UX (owner: design)

Reference feel: a first-party Microsoft app (Clipchamp, Designer, the Photos editor): calm, roomy, consistent, one clear next step, instant feedback. Not its visual style.

### First-run journey
- [ ] **≤ 60 s and ≤ 3 clicks** from landing to playing my own game, **no sign-in**, no settings, no language choice, no API key. (Typing the idea doesn't count as a click; focusing the box does.)
- [ ] The prompt box is the first thing on the landing page, above the fold at 390×844 and 1440×900, with 4–6 example chips that each start a game in **one** click.
- [ ] Generation shows real progress (understanding → designing → building → testing) with a preview forming, and never a blank screen for more than 1 s. Cancel is always available.
- [ ] The result opens in a **Studio** where the game fills ≥ 60% of the viewport on desktop and the full width on phone, already running, with keyboard focus already on the game (no "click the game to give it the keyboard").
- [ ] The next step is obvious: a chat box ("Change anything…") with 3–5 suggestion chips, and a **Share** button.

### Every screen
- [ ] **One primary action per screen**, styled uniquely (only one filled brand button visible at a time). Count them in each screenshot.
- [ ] Spacing on a 4-px grid (4/8/12/16/24/32/48/64). Type scale of **≤ 6 sizes** across the app (harness lists `fontSizes`); ≤ 2 families + 1 mono. Body text ≥ 14 px, nothing visible < 12 px except keyboard hints.
- [ ] Max one level of card nesting. No "wall of panels": the Simple Studio shows ≤ 3 regions (game, chat, a small tweak drawer).
- [ ] Plain English. No developer messages in the product ("Add your Supabase keys to apps/web/.env.local" is a fail). No promises the product can't keep ("export to Windows", "Python", "vector art").
- [ ] Empty, loading and error states designed for every screen. 404 has a way home.
- [ ] Motion: 150–250 ms ease-out for UI, respects `prefers-reduced-motion`.

### Themes
- [ ] Light and dark, following the system by default with a manual toggle. **Every** screen works in both: the harness's light/dark rows must all say "themes differ" and no text may vanish (contrast check below). A half-done light theme is worse than none.
- [ ] Logo/wordmark has a light-background variant.

### Accessibility basics
- [ ] Text contrast ≥ 4.5:1 (body) and ≥ 3:1 (large text, icons, borders of inputs) in both themes.
- [ ] Every control has an accessible name (`unnamedCount = 0`), every input a label, `<html lang>`, one `<h1>` per page.
- [ ] Full keyboard path through the first-run journey; visible focus ring; Escape closes dialogs.
- [ ] Game canvas has an `aria-label` and the controls are listed in text near it.

### Mobile (390×844)
- [ ] No horizontal scroll on any page (`horizontalOverflow = no`).
- [ ] Tap targets ≥ 44×44 px for primary controls (harness counts visible controls < 40 px).
- [ ] Header collapses to logo + one action + menu; it never wraps onto three rows.
- [ ] The game is playable with **on-screen touch controls** (left/right/jump at minimum), in landscape full screen, with no page scroll or zoom while playing.

---

## 3. Game feel (owner: engine; kits)

- [ ] **Input latency ≤ 1 frame** from key down to velocity change. Inputs read every frame, not on events only.
- [ ] Platformer feel: coyote time 80–120 ms, jump buffer 100–150 ms, variable jump height (release to cut), faster fall than rise (gravity × 1.6–2.2 on fall), max fall speed clamp, acceleration/deceleration curves (not instant), air control ~70%.
- [ ] Juice checklist (each must be present and tasteful): squash/stretch on jump and land, dust puffs on land/turn, screen shake on hurt (≤ 6 px, ≤ 200 ms), hit-stop 50–80 ms on hit, flash on hurt, pickup pop + sparkle + rising sound, camera lead in the facing direction with smoothing, camera deadzone, death → respawn in ≤ 1 s without a reload.
- [ ] Sound: at least jump, land, pickup, hurt, win SFX (synthesised is fine) and a mute button.
- [ ] Performance: 60 fps median at 1440×900; no GC hitches > 1 frame in a 30 s play (long tasks = 0 after boot). Particle budget ≤ 400 alive.
- [ ] A level has a beginning, a goal and an ending screen with "Play again" and "Share". 60–120 s of play per generated level.
- [ ] Touch: virtual stick/buttons auto-shown on touch devices, ≥ 64 px, semi-transparent, never covering the hero.

---

## 4. AI (owner: ai)

- [ ] **Always playable:** 100% of outputs pass `buildGame` validation and boot without errors. Test with ≥ 50 varied prompts (including nonsense, empty, non-English, hostile) in a fixture suite: 50/50 produce a playable game.
- [ ] Spec is small: **≤ 1.5 kB JSON** per game; the model never writes engine code for a new game.
- [ ] Instant mode: works offline, **< 300 ms** from submit to spec, deterministic for a given prompt+seed, picks a sensible kit/theme for ≥ 80% of the 50 fixture prompts (human-judged list in tests).
- [ ] Latency (hosted / BYOK): first progress event < 300 ms; playable game **< 8 s p50, < 15 s p95**; chat edit **< 5 s p50**. On timeout or provider error → fall back to instant mode, never a dead end.
- [ ] Cost: ≤ 3,000 input+output tokens per new game, ≤ 1,500 per edit; hosted caps per user/day enforced server-side (suggest 10 games + 30 edits/day) and per IP; a friendly message when the cap is hit with the instant-mode and BYOK alternatives.
- [ ] Keys: BYOK keys never leave the browser except to the provider; never logged; never in a share link.
- [ ] Edits are reversible (undo per chat turn) and `changed` is shown to the user in plain words.
- [ ] Prompt-injection safe: the spec is validated against a schema; strings are length-capped and escaped.

---

## 5. Running cost (owner: everyone; critic measures)

| Item | Budget |
|---|---|
| Web landing initial JS (entry + preloads) | **≤ 170 kB gzip** (baseline 214 kB) |
| Largest lazy chunk | ≤ 400 kB gzip |
| CSS | ≤ 35 kB gzip |
| Fonts | ≤ 2 families, self-hosted woff2, ≤ 100 kB total, `font-display: swap`; no Google Fonts requests |
| Player / play link JS | **≤ 250 kB gzip** (baseline 382 kB) |
| Art per theme (encoded at runtime from code, or PNG) | ≤ 150 kB; generated in < 200 ms on a phone |
| Worker requests per session (instant mode) | **0** |
| Worker requests per session (hosted, 1 game + 5 edits) | **≤ 7** |
| Workers AI free allowance (10,000 neurons/day) | design for ≥ 300 games/day on the free tier; show headroom in the API's `/health` |
| External hosts contacted at runtime | only our own origin (+ the AI provider the user chose) |
| Static hosting | Cloudflare Pages; no server rendering; images cached immutable |

---

## 6. Competitor scan (from what I know of them, autumn 2026)

| Tool | What it does well | Where it falls short | How Degamed wins |
|---|---|---|---|
| **Rosebud AI** | Prompt → playable browser game in one step; chat iteration; a public gallery with remix ("fork"). Strong "wow" in the first minute. | Output is LLM-written Three.js/JS code: often broken, generic look, slow and costly per edit; art is AI images pasted on, so games look inconsistent. | A **small spec + hand-tuned kits** is always playable, cheap and consistent; **real pixel art themes** make every game look authored. Edits are instant and reversible. |
| **GDevelop** | Mature no-code event system, huge template/asset store, exports everywhere, now has an AI assistant. | Event sheets and panels are intimidating; first game takes hours; default assets look like a template store. | First minute: we're playing, they're reading a tutorial. Advanced tools exist, but behind a door. |
| **Construct 3** | Polished browser editor, great performance, solid behaviours (platform, 8-direction). | Paid, pro-tool UI, nothing happens until you build it. No AI-first flow. | Our behaviours come pre-tuned in kits; the "Studio" is calm and talking-first. |
| **Buildbox** | "Drag and drop" + AI asset generation, aimed at hyper-casual mobile. | Desktop app install, generic hyper-casual look, monetisation-heavy. | Zero install, a link that plays on any phone, art with a soul. |
| **Roblox Assistant** | Massive audience, AI that writes Luau and builds scenes inside Studio; instant multiplayer distribution. | Needs Roblox Studio on desktop; outputs live only inside Roblox; heavy for beginners. | Web-native, shareable anywhere (WhatsApp, X, TikTok bio), no account to play. |
| **Scratch** | The gold standard for approachability, remix culture, and a gallery that teaches. | Looks childish, no AI, limited game feel. | Scratch's remix + gallery loop, with games that look like Steam indies. |

**Our wedge:** "*Describe it, play it in 10 seconds, it looks like a real indie game, send the link.*" None of the above does all four. Protect it: never ship a game that looks like programmer art, never make the first minute about settings.

---

## 7. What makes it a hit

1. **Shareable play links** `degamed.app/p/<id>`: open instantly on a phone, no account, no editor chrome. Big "Play" button over a real screenshot, touch controls, full screen on tap.
2. **Preview card**: Open Graph image = an actual frame of the game (captured in the browser at publish, uploaded as a small PNG), title, "Made with Degamed in 30 seconds". This is the single most important growth asset: it's what people see in WhatsApp/X/Discord.
3. **Remix**: every play page has "Make your own version" → opens the Studio with that spec, prompt prefilled ("Make it night", "Add a boss"). Credit chain ("remixed from @ada").
4. **Gallery**: a grid of games with live hover previews; sort by today/this week; one tap to play. Seeded with 20 great games we make ourselves (one per theme × kit).
5. **Daily challenge**: one prompt per day ("A game about a lighthouse keeper"), same seed for all, leaderboard by plays/likes. Gives a reason to come back and a reason to post.
6. **Viral loop (the short one):** Play a friend's link → "Make your own" (1 tap) → describe → play → Share (native share sheet on phones) → friend plays. Target: **≤ 4 taps from receiving a link to sending your own**.
7. **End-of-level screen** carries the loop: time, coins, "Play again", "Share your time", "Remix this game".

Measurables for the hit loop (once publishing exists): play page JS ≤ 250 kB gzip; first frame ≤ 2.5 s on mid phone 4G; OG image ≤ 120 kB; remix → playing ≤ 10 s.
