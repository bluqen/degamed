# Round 1 review (mid-round, all four builders)

Critic. Harness run: `docs/team/shots/critic/round-1/summary.md` (data in `report.json`; corrected journey in `round-1/journey/`). Manual playtests: `round-1/manual--*.png`. Bar: `docs/team/reviews/BAR.md`. Baseline: `round-0-baseline.md`.

## Where we are

A huge round. The product went from "no path to a game" to **typing a sentence and playing a moody, lit, rainy pixel-art level in about 7 seconds**. Most of the bar's structure is in place: kits with real game feel, four atmospheric themes, a calm Studio, an honest landing page, and an AI layer that always falls back to a playable game.

| Bar number | Baseline | Round 1 | Target | Status |
|---|---|---|---|---|
| Landing → my own game | never | **12.1 s / 2 clicks** desktop, **7.7 s / 2 clicks** phone (≈5–7 s of that is click → first frame) | ≤ 60 s, ≤ 3 clicks | PASS |
| Console + page errors (44 loads) | 0 | 3, all the dev-server HMR `createRoot` warning while others edited `main.tsx` | 0 | PASS (harness now reports HMR noise as a warning) |
| Player fps, headless SwiftShader | 58–60 | **6–11** (studio 10, play page 7–11, advanced 6) | ≥ 30 headless, ≥ 58 real | **FAIL**: a 6× drop in the same environment |
| Web initial JS (gzip) | 214 kB | **300 kB** | ≤ 170 kB | **FAIL** |
| Player JS (gzip) | 382 kB | **424 kB** | ≤ 360 kB (rebased: Phaser alone is 312–344 kB) | **FAIL** |
| Light + dark on every page | none | every page differs; the play page is dark by design | all | PASS |
| `pnpm typecheck` | ok | **fails in packages/engine** (`src/kits/kits.test.ts:168`) | green | **FAIL** |
| `pnpm test` | ok | ok | green | PASS |
| OG preview image on any page | none | none | play pages | FAIL |

## Top 5 problems overall

1. **Three of the four themes clone famous characters.** `docs/team/art.md` says it outright: Rain Ruins has a "pale eared creature with a scarf" plus a "pink-headed lizard" (Rain World's slugcat and pink lizard). Hollow Caverns has a "horned bone mask, dark cloak, nail" (Hollow Knight's Knight). Sunlit Meadow has a "red-haired climber with a braid", strawberries and a summit flag (Madeline and Celeste). See `docs/team/shots/art/overview.png`. This is a legal and reputational risk on a product whose whole pitch is "looks like a real indie game", and it gives every game someone else's identity. The references are a **quality** bar, not a character sheet. **Owner: art. Must fix before anything is shared publicly.**
2. **The game you get isn't the game you asked for.**
   - Prompt "a little robot looks for its family" → title "Robot of the Ruins", but the hero is a cat (`round-1/journey/journey--desktop-03-step.png`).
   - Prompt "a bat collects crystals" → the chat says "A bat collects crystals", but the hero is the horned knight (`round-1/manual--cave-created.png`).
   - Chat "add a boss" → "Moved it to the Ember Forge." (`manual--edit-add-a-boss.png`), because `ember-forge` lists `boss` among its keywords.
   - Chat "make it night" on the cave kit → "I couldn't work that one out… try 'make it night'" (`manual--edit-make-it-night.png`).

   The magic breaks the moment the user notices. **Owners: ai (edits and wording), art (hero variants, keywords).**
3. **Frame rate fell 6× in the same environment** (60 → 10 headless) once atmosphere, lighting and themes landed, and `quality: 'auto'` didn't recover it. Headless isn't a phone, but a 6× relative drop is exactly what a cheap Android with weak fill-rate will feel. **Owner: engine.**
4. **On phones the game is barely playable** (`round-1/journey/journey--phone-03-playing.png`, `round-1/manual--play-phone-portrait.png`, `round-1/manual--play-phone-landscape.png`).
   - The touch buttons (~65 px) cover about 60% of a 205 px-tall game, including the hero at spawn.
   - The HUD renders at ~5 px.
   - The play page in portrait leaves ~600 px of black around a 220 px strip.
   - In landscape the header and caption stay on screen.

   **Owners: engine (touch layout) and design (phone play layout).**
5. **Bundles went the wrong way, and the share loop has no preview card.**
   - The landing page now eagerly ships the art generators, kits, AI and zod: initial bundle 300 kB gzip, `index` chunk 957 kB raw.
   - Every route is eagerly imported in `apps/web/src/main.tsx`.
   - Theme thumbnails are 97–152 kB PNGs each.
   - Share links are long base64 recipes (`localhost:5173/p/eyJr…`, `docs/team/shots/design/08-share-desktop-dark.png`), while the landing illustration promises `degamed.app/p/penguin-peak`.
   - No page has an `og:image`.

   **Owners: design (lazy routes, share), engine (player size).**

---

## art

**Overall:** the strongest work this round. The in-engine shots (`docs/team/shots/art/engine-rain-ruins.png`, `engine-sunlit-meadow.png`, `engine-ember-forge.png`) have real depth, fog, rim light and mood: 7 layers, a foreground layer, lights on props, hue-shifted ramps and 47 tests. The self-assessment (6.5/10) is honest. To get to 8/10, the themes need their own identity and better readability.

### Must fix
1. **Replace the derivative characters and icons** (problem 1). Keep each theme's mood and give it our own cast. Suggested:
   - *Rain Ruins*: a small **lantern robot** (round head, one glowing eye, antenna). This also matches the landing page's flagship prompt, "lost robot". Enemy: a **rust crawler drone** or a sewer eel instead of the pink lizard.
   - *Hollow Caverns*: a **moth-winged lantern bearer** or a hooded mushroom sprite. No horned white mask and no nail. Its weapon could be a lantern swing.
   - *Sunlit Meadow*: a **fox or acorn kid**. Collectible: berries, acorns or seeds, not strawberries. Goal: a tree house or bell, not a summit flag.

   Update `description` strings to match. They currently say "a small pale creature with a red scarf", and the AI repeats that to users.
2. **Ember Forge hero contrast.** The dark-green hero on dark red bricks is the darkest thing on screen (`engine-ember-forge.png`, `round-1/manual--edit-add-a-boss.png`). The BAR asks for ≥ 30% luminance difference or a rim light: give the hero a warm rim and a lighter cloak value.
3. **Remove non-setting words from theme `keywords`.** Today `ember-forge` includes `boss`, `action`, `combat`, `epic`, `roguelike` and `sword`. The AI treats a theme keyword as "switch world", so "add a boss" teleports the game to the Forge. Keywords should describe a *place or mood* only. Genre and verb words belong to kits.

### Should fix
4. **Hero size.** ~22 px tall on a 270-px screen, and at phone size the hero is ~10 CSS px. The bar is ≥ 24 px. Go to 24–28 px, or let kits pick camera zoom 1.25 on phones.
5. **Hero variants per theme** (ties to problem 2). Add an additive `heroes?: { id; name; keywords; sheet: SpriteSheet }[]` to `ArtTheme` (robot, cat, fox, bat, knight…) so the AI can honour "a bat" or "a robot". 2–3 per theme is enough to start. Post the contract change on the BOARD.
6. **Hollow Caverns in-engine.**
   - The in-engine shot `engine-hollow-caverns.png` is a blank "Waiting for a game…", so it was never verified in the engine.
   - My playtest (`manual--cave-created.png`) shows large solid black rectangles in the walls and ceiling. They read as missing tiles, not shadow.
   - Coordinate with engine (lightmap on pre-lit layers), and make unlit fill read as dark rock texture, never `#000`.
7. **Thumbnails** `apps/web/public/art/themes/*.png` are 97–152 kB each (480×270, ~10k colours after fog and bloom). Ship WebP q85 (~30 kB) or a 2× smaller PNG for the landing grid; keep the PNG for zoomed views.
8. **Tile repetition**, especially meadow soil and forge bricks across large areas. Add 2×2 macro details (roots, cracks, bones, embers) placed by the kit with a seeded scatter.

### Nice to have
9. Far layers are visibly rectangles in Rain Ruins and Forge. One hand-shaped landmark per theme (chimney, dome, furnace face) would sell the depth.
10. A fifth "bright and cute" theme for kids and casual prompts (the meadow currently carries all of them).

---

## engine

**Overall:** the kits' controller is genuinely good. `packages/engine/src/kits/scripts.ts` has acceleration, coyote 0.1 s, buffer 0.12 s, variable jump, apex hang, turn dust, squash on jump and land, hit-stop, shake, burst on win, a banner and respawn. Touch controls exist. Performance, the cave rendering and phone layout are what need work.

### Must fix
1. **Performance regression, 60 → 6–11 fps headless** (`round-1/summary.md` fps column; the old starter got 60 in the same harness).
   - Profile with `quality: 'low'`.
   - Report frame CPU ms alongside fps in the `{type:'fps'}` message (e.g. `{fps, ms, quality}`) so the harness can tell CPU from GPU.
   - Make quality 0 really cheap: no bloom, no lightmap render texture, mist off, half the particles.
   - Target ≥ 30 fps headless at quality 0, which is the canary for low-end phones.
2. **Touch controls cover the game on phones** (`round-1/journey/journey--phone-03-playing.png`).
   - In portrait, when the host box is wider than it is tall and there is space below, render the controls **outside** the game area, or expose `touch: 'overlay' | 'external'` so design can place them under the game Game-Boy style.
   - In overlay mode, size buttons as a % of the shorter side (not more than 22%), keep 50% opacity, and keep them out of the bottom-left spawn area.
3. **`pnpm typecheck` fails**: `packages/engine/src/kits/kits.test.ts(168,36)`, a param record union isn't assignable to `Record<string, string|number|boolean>`. Type the fixture as `Record<string, number>`.
4. **Big black foreground pipe in the middle of the platformer view** (`round-1/manual--play-desktop.png`; also flagged by art): a pure-black vertical bar about 70 px wide covers the playfield and reads as a wall. Foreground silhouettes go near the screen edges, with factor > 1 and ≤ 15% of screen width, and never over the spawn or the goal.

### Should fix
5. **Export `./art` in `packages/engine/package.json`.** The web app imports `@degamed/engine/art` through a Vite alias bridge (`apps/web/vite.config.ts`, `apps/web/tsconfig.json` paths). Add `"./art": "./src/art/index.ts"` so the bridge can be deleted. The harness contract check flags it.
6. **Player bundle 424 kB gzip.**
   - Import `phaser/dist/phaser-arcade-physics.min.js`, or alias `phaser` to the arcade build: −32 kB.
   - Make sure `apps/play` doesn't pull art generators, kits or zod; the host sends encoded data URLs.
   - Target ≤ 360 kB.
7. **The title card replays on every rebuild.** "BEYOND THE CAVERNS" shows again after each chat edit. Show it on first start only; add `restart({ title: false })` for edits.
8. **Focus is lost after every rebuild** ("Click the game to play", `manual--edit-make-the-jumps-floatier.png`). Keep keyboard focus in the player across reloads triggered by the host, or accept a `focus` message.
9. **The HUD is unreadable on phones** (~5 px glyphs). Render the HUD at 2× when the integer zoom is 1, or move hearts and coins to host-rendered DOM on the play page.
10. Fall gravity is ×1.45. The bar suggests 1.6–2.2 for snappier, Celeste-like falls. Try 1.7 and keep the apex hang.

### Nice to have
11. Post the end-of-level stats (`time`, `coins`, `deaths`) to the host so design can build the "Share your time / Remix" end card (the viral loop).
12. A poster frame: post `{type:'poster', dataUrl}` after the first rendered frame so the host can use it for the OG image and the gallery thumbnail.

---

## ai

**Overall:** excellent engineering. 126 tests, a real e2e over the real kits, always-playable fallback, a cost table, and both per-user and global caps. The problems are in what the user experiences when instant mode guesses.

### Must fix
1. **Wrong-intent world switches.** "add a boss" → "Moved it to the Ember Forge." Only switch worlds on explicit place language: "move it to/set it in/make it a [theme word]", or a bare theme name. When a request mentions something no kit supports (boss, shooting, dialogue), answer honestly: "Bosses aren't in free mode yet. Add an AI key to try it, or try 'add more enemies'." Add a test for exactly this case.
2. **The fallback message suggests the request that just failed.** "make it night" on the cave kit → "Try … 'make it night'". Map night/day onto the cave's `darkness` (night→dark, day→light), and build the "try something like" examples from `suggestions(files)` for the *current* kit, so they're always valid.
3. **Story and title promise a hero the game doesn't have** (robot → cat, bat → knight). Until art ships hero variants, write the story around the theme's hero ("A little wanderer searches the ruins…"). Keep the user's subject in the title only if the art can show it.

### Should fix
4. **The global cap counts requests, not cost.** 250 code edits × ~100 neurons = 25,000, more than the 10,000 free neurons. Count weighted units (create/spec = 1, code edit = 15–20) against a daily neuron budget (e.g. 8,000), and put code edits on a separate, smaller per-user cap (e.g. 5 a day).
5. Per-IP cap on top of per-user, so new free accounts can't farm the hosted tier.
6. Expose `usage` totals and the remaining global budget at `GET /ai/health`, so the owner can watch headroom.
7. Instant mode: add a few robot, bat and fox words now, even if they only affect title and story wording (see must-fix 3). Run the 15-prompt e2e test in CI on both kits **and** check that `summary` never names a creature the theme doesn't draw.

### Nice to have
8. A "Surprise me" generator with 30 handcrafted prompt templates × themes, for the Create page and the daily challenge.
9. Measure and log time-to-spec for instant mode (BAR: < 300 ms) in the e2e test.

---

## design

**Overall:** the Studio is the right product: one big game, Chat / Tune / Look, chips, a single filled "Share", Advanced tucked away, and both themes working (`docs/team/shots/design/04-studio-desktop-light.png`). The new landing (`round-1/landing--desktop-dark-full.png`) is honest and on-message. Fix the three breakages below and this reads first-party.

### Must fix
1. **Chat history disappears after an edit.** Sequence: `manual--edit-make-it-night.png` shows the turn → `manual--edit-make-the-jumps-floatier.png` shows no history and no reply to "floatier" → `manual--edit-add-a-boss.png` shows only the last turn. Persist the turns per game id (library entry) and don't remount the chat panel on rebuild.
2. **Pricing still shows `[₦ PRICE]/month`** and "Upgrade with Paystack" (`round-1/pricing--desktop-dark-full.png`). Either show "Free while in beta" (instant mode plus BYOK, hosted caps listed) or remove Pricing from the nav and footer.
3. **Phone play layout** (with engine's must-fix 2). On `/play/:id` and in the Studio at ≤ 480 px wide:
   - make the game full width at the top, with the controls in the space below it;
   - offer "Tap to play full screen", which enters landscape full screen (`requestFullscreen` + `screen.orientation.lock('landscape')`, where allowed) and hides the header and caption;
   - replace "Arrow keys to move, Space to jump" with touch wording on touch devices.
4. **Lazy-load routes, keep the landing light, and add an error boundary** (initial 300 kB gzip; budget 170).
   - At the end of the round, a stale art module (`tiles.ts` missing the `backEdges` export in the dev server's cache) turned **every page into a blank white screen**. The cause is the eager import chain `main.tsx` → `Landing` → `lib/game` → `@degamed/engine/art`. One broken module in one agent's area must never take down the landing page.
   - Add route-level `errorElement`s with a friendly "Something went wrong. Reload" screen in both themes.
   - In `main.tsx`, use `lazy()` for Studio, Play, Create, Advanced, ArtLab, Settings and Dashboard.
   - The landing should use `/art/themes/*.png` for visuals and import `lib/game` only when "Play the demo" is pressed or the prompt is submitted (prefetch on input focus).

### Should fix
5. **Share links and the preview card.**
   - Compress the recipe: deflate plus base64url, aiming for < 200 characters.
   - Or, better, use a tiny Worker KV short link (`/p/abc123`) that serves static HTML with `og:title`, `og:description` and `og:image`. The image is the theme thumbnail, or the engine's poster frame once it exists.
   - The landing's `degamed.app/p/penguin-peak` illustration should match what we actually produce.
   - Use the native share sheet (`navigator.share`) on phones.
6. **One primary action on the landing.** The header "Start creating" (filled) competes with "Make my game" (filled). Make the header button quiet (outline), or hide it until the hero prompt scrolls out of view.
7. **Duplicate game controls in the Studio.** Restart and full screen appear both as overlay icons in the game and as text buttons below it (`04-studio-desktop-light.png`). Keep one set: the text buttons below on desktop, the overlay on phone.
8. **Tap targets under 40 px on phone:** 13 in the Studio and 8 on the landing (harness `smallTapTargets`). The chips, the header theme toggle and the "…" menu need a 44 px hit area.
9. **Type scale:** 9 distinct font sizes on the landing (bar: ≤ 6). Consolidate around 12/14/16/20/28/48+display.
10. **Tune copy:** "Jump height (tiles)" is jargon, and labels mix "Normal" with "83%". Use words for every slider (Low / Normal / High) and drop the unit.
11. **"Docs" goes to the GitHub repo** (`SiteHeader.tsx`). Remove it from a consumer nav, or point it at a real "How it works" page.
12. Landing copy says "Hand-made art styles". The art is procedurally generated pixel art, so say "Crafted pixel-art styles, not clip art".

### Nice to have
13. Show the provider `notice` softly in chat when a fallback happened (ai asked for this).
14. A first-play coach mark on the game: "← → to move, Space to jump" fading after the first jump, instead of the static caption.
15. The 404 page should offer "Make a game" (check that it does in both themes).

---

## Contract mismatches (posted on the BOARD)

| Between | Mismatch | Fix |
|---|---|---|
| art ↔ ai | Theme `keywords` include genre and verb words (`boss`, `combat`, `sword`, `roguelike`), which instant edits treat as world switches | art: places and moods only; ai: switch worlds only on explicit place language |
| art ↔ ai ↔ design | The prompt's hero (robot, bat) isn't representable: each theme has exactly one hero | art: additive `heroes?` on `ArtTheme`; ai: choose by keyword; design: show it in Look |
| engine ↔ design | `@degamed/engine/art` is imported by web but not exported by the engine package (Vite alias bridge) | engine: add the `./art` export; design: drop the alias |
| engine ↔ design | Touch controls are overlay-only; the host can't place them outside the game | engine: `touch: 'overlay' \| 'external'` plus the input messages |
| engine ↔ design | No poster frame or end-of-level stats from the player | engine: post `{type:'poster'}` and `{type:'levelComplete', stats}` |
| engine ↔ critic | The harness measures fps only; it can't tell CPU from GPU cost | engine: add `ms` and `quality` to the `{type:'fps'}` message |
