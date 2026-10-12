# Engine & Game Feel — log

## Round 1

### Done

**Atmosphere renderer** (`packages/engine/src/atmosphere.ts`, maths in `atmosphere-math.ts`)
- Scene `environment` in `@degamed/shared`:
  - ambient (normalised hue × intensity, plus an optional `background` dim for night),
  - fog, bloom, vignette, grade, and particles: rain, dust, fireflies, snow, embers, spores.
- `Light` component with color, radius, intensity, flicker and offset.
- Ambient darkness uses a half-resolution MULTIPLY lightmap. It has dithered soft lights, flicker, additive halos, and glowing particles that light their surroundings.
- **The background has its own camera underneath the world**, so the lightmap and filters touch only tiles, sprites and props. The pre-lit art layers are no longer darkened twice (art's request).
- Fog and the colour grade are baked into the parallax textures once at load, so they cost nothing per frame. Two drifting mist bands are added on top.
- Rain is two depth layers of angled streaks, plus splashes on real surfaces (tilemap tops and static bodies).
- Bloom uses Phaser 4's filter. The vignette is a single overlay quad.
- Parallax layers with `factor > 1` are drawn as a foreground.
- Crisp pixels: the game zooms by whole numbers when that wastes ≤ 15% of the space.
- The HUD uses a baked 5×7 outlined pixel font.
- **Adaptive quality** (2 → 1 → 0, measured on wall-clock frames):
  - **1:** no bloom, half the particles, far layers merged into one texture.
  - **0:** also drops the lightmap, the grade pass, the mist and the halos.
- `?quality=high|medium|low` pins the quality level.
- The fps message now carries `ms` (CPU per frame) and `quality`.

**Runtime additions** (`runtime.ts`)
- `Tilemap` component: rows of text, auto-tiled by neighbour into `ground`, `ground2/3`, `groundLeft/Right`, `fill`, `fill2`, `fillLeft/Right`, `ceiling`, `platform` and `platformLeft/Right`. It also supports one-way `=` platforms and `+` back walls, and is drawn with Phaser's culled tilemap.
- Prefabs: `Game.spawn(name, x, y)` copies inactive entities, including their children.
- Entity children are destroyed with their parent.
- Hitbox size and offset are set on `Body`.
- `Sprite.alpha` and `Sprite.scrollFactor`; `Text.align`.
- Camera: smoothing, look-ahead, dead-zone and a downward peek, computed after physics so lights never lag.
- `Game.state` keeps values across restarts.
- New entity properties and methods: `entity.light`, `gravity`, `solid`, `onWall`, `onCeiling`, `setHitbox`, `tint`, `alpha`, `hasAnimation`.
- `kit` helpers: `hitStop`, `slowMo`, `dust`, `sparkle`, `flashLight`, `light`, `banner` (with a blinking hint), `transition` (fade → callback → fade) and `after`.
- 9 new sounds.
- Protocol: the host can send `focus` and `input` messages.

**Touch controls** (`touch.ts`)
- They appear on touch devices.
- Placement:
  - **portrait:** controls go *under* the game, Game Boy style;
  - **wide landscape:** controls sit in the letterbox bars;
  - **otherwise:** an overlay at 50% opacity, at most 18% of the short side.
- On small screens (zoom < 1.5) the HUD is drawn at 2×.
- `?touch=overlay|external`, together with the new `input` message, lets the host page draw its own controls.

**Genre kits** (`packages/engine/src/kits/`, Phaser-free subpath `@degamed/engine/kits`, also `./art` now exported)
- `KITS`, `buildGame`, `readSpec`, `normalizeSpec`, `resolveParams` and `listThemes`. The spec is stored in `game.spec.json`. Every param has a plain-English label and a group.
- **platformer:**
  - 14 hand-designed chunks, picked by seed and difficulty, and only from chunks the hero can clear with the chosen jump, speed and gravity;
  - coins, walkers, flyers, spikes, checkpoints and a goal.
- **runner:**
  - auto-run that speeds up; jump, and slide under barriers;
  - an endless track made of chunk prefabs spawned ahead of the camera, which unlocks harder chunks with distance;
  - distance and best score.
- **cave:**
  - a random maze of hand-designed rooms joined by tunnels and climbing ropes;
  - crystals that open the exit, sword swipe, hearts, double jump, and a hero lantern.
- Decoration is driven by `propInfo`:
  - ground clutter, ceiling hangers, wall torches and signs;
  - lamps (a hanging lamp gets a generated post);
  - glowing props with real lights.
- Short silhouettes are drawn only for themes without their own foreground layer.
- The theme's `spike` strip, `checkpoint` (idle/lit), `flyer`, hitbox and anchor data are all used.
- `createPlatformerTemplate` now returns the platformer kit.
- Game feel:
  - coyote time, buffered jumps, variable jump height, apex hang, falls at about 1.7× gravity;
  - squash and stretch, landing, turn and run dust, double-jump sparkle;
  - hit-stop and shake on hits; pickup sparkle with a light flash and sound;
  - death with burst, fade and respawn at a checkpoint; game over;
  - level complete with slow-mo, light flare, burst and a banner showing stats.

**Tests**
- 114 engine tests, including:
  - every kit × every theme builds a valid project;
  - same seed gives the same level;
  - spec round-trip and clamping;
  - BFS reachability of the goal for 12 seeds at the weakest settings;
  - every cave crystal and exit reachable;
  - autotile, the atmosphere maths, the font and touch placement.
- 16 shared tests.

**Screenshots and recordings** (`docs/team/shots/engine/`)

| What | Files |
|---|---|
| Platformer | `platformer-{rain-ruins,hollow-caverns,sunlit-meadow,ember-forge}.png` |
| Runner | `runner-{rain-ruins,hollow-caverns,sunlit-meadow,ember-forge}.png` |
| Cave | `cave-{rain-ruins,hollow-caverns,sunlit-meadow,ember-forge}.png` |
| Atmosphere | `atmosphere-night-lights.png`, `atmosphere-snow-dusk.png`, `atmosphere-fireflies-night.png` |
| Game feel | `feel-level-complete.png` |
| Phones | `touch-portrait.png`, `touch-landscape-cave.png`, `touch-landscape-overlay.png` |
| Recordings | `platformer-rain-ruins.webm`, `runner-ember-forge.webm`, `cave-hollow-caverns.webm` (bot-played, medium quality, about 12 s each) |

**Measured fps** (headless SwiftShader, 480×270 game shown at 960×540, idle machine; `fps / CPU ms / quality`):

| Quality | fps | CPU ms per frame |
|---|---|---|
| 2 (full) | 20–26 | 2–3 |
| 1 | 17–30 | 2–3 |
| 0 | 48–60 | 1–2 |

- `auto` reaches quality 0 in about 5 s and then holds 48–56 fps.
- CPU cost is about 2 ms per frame, so the gap is software fill rate. A laptop GPU should run quality 2 at 60.
- I couldn't measure on real GPU hardware here.

### Next
- Post `{type:'levelComplete', stats}` and a poster frame to the host (critic's contract ask).
- Use art's new back-wall tiles (`back*`) for cave depth.
- Tile macro-details scattered by seed.
- More chunks and rooms, and a boss/arena chunk for the platformer.
- Moving platforms.
- Slide telegraph in the runner.
- Gamepad support.
- Measure on a real phone or GPU; consider starting phones at quality 1.
- Profile bloom on GPU; the half-res lightmap may need a smoother upscale.
- Player bundle: alias Phaser to the arcade-only build.

### Needs from others
- **art:**
  - a `back` tile set for cave background walls (I saw `backEdges` landing, thanks);
  - optional `rope`/`vine` prop sized for climbing (≤ 12 px wide);
  - keep `propInfo.light` offsets accurate (flipped props mirror them).
- **design:**
  - for Game Boy layouts drawn by the host, load the player with `?touch=external` and send `{type:'input', action, down}`;
  - send `{type:'focus'}` after rebuilds;
  - read `ms` and `quality` from fps messages.
- **ai:** param keys are unchanged. New optional `environment.ambient.background` (0..1 background dim); the kit's `time: night` sets it.

### Known issues
- At quality 0 dark themes lose their darkness (the lightmap is off); the background bake keeps fog and grade.
- In the cave kit, the meadow and forge themes read as floating dirt or brick chunks over open sky, because the parallax isn't a cave.
- The combat swipe has only been lightly verified headless (slow-motion fps makes bot tests unreliable).
- Banner text at 1× scale is small on phones (the HUD is fixed).
- The Vite dev server sometimes served a stale art module. My harness now builds projects in Node to avoid that (`scratchpad/engine/build.test.ts`).
- `pnpm --filter @degamed/engine typecheck` currently fails only in art's in-progress `src/art/overlays.ts` (4 errors, not mine).
