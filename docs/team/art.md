# Art Director log

## Round 1

### Done

**Four complete procedural themes**, all implementing the `ArtTheme` contract in `packages/engine/src/art/index.ts` (`ART_THEMES`, `getTheme`, plus `THEME_IDS` and `renderPreview`). Everything is pure TypeScript with no DOM, so it runs in Node and the browser. Themes build lazily on first access (about 0.2–0.5 s each) and are cached. Their metadata (`id`, `name`, `description`, `keywords`, `palette`, `background`) is free to read without generating any pixels.

| Theme | Mood | Hero | Enemy | Pickup | Goal |
|---|---|---|---|---|---|
| `rain-ruins` | Rain World: teal fog, colossal towers, rusted pipes, moss, rain | pale eared creature, rust scarf, tail, spear | lizard (pink head, sprawling legs, opening jaw) | glowing pearl | shelter gate with glyph |
| `hollow-caverns` | Hollow Knight: blue-black caves, lit distant spires, glow fungus, spores | horned bone mask, dark cloak, cape tail, nail | amber shell crawler | spinning crystal shard | stone arch with shimmering veil |
| `sunlit-meadow` | Celeste / Stardew: sunny, puffy clouds, snowy peaks, round trees | red-haired climber with bouncing braid | hopping jelly slime | strawberry | summit flag |
| `ember-forge` | Dead Cells / Blasphemous: plum stone, molten glow, gears, banners, embers | crested helm, glowing visor, flame plume | magma slug | soul flame | molten forge gate |

**What each theme contains:**

- **7 parallax layers**: sky/backdrop, far, mid-far, a mist/light-shaft layer, mid, near, and a `foreground` layer with `factor > 1` that the engine already draws in front. All layers wrap seamlessly. Far layers are hazed into the fog colour; silhouettes get rim light and dithered texture; seeded, periodic noise makes the organic shapes.
- **13 autotiles plus a spike strip**: `ground` ×3 variants, `groundLeft`, `groundRight`, `fill` ×2, `fillLeft`, `fillRight`, `ceiling`, `platform`, `platformLeft`, `platformRight`, `spike`. All are 16×16 and seamless (tested). Each has a lit top edge (moss, crust, grass or ledge) and a darker interior.
- **Hero sheet, 26 frames.** The rig is a puppet: hand-drawn head grids per costume, plus a posed cloak, legs, a scarf/hair/plume chain and a weapon. Shading uses hue-shifted ramps with rim, shade and selective-outline passes. Animations:
  - `idle`: breathing plus a blink
  - `run`: 8 frames with bob and leg arcs
  - `jump`: stretch on take-off
  - `fall`: cloak billows up
  - `land`: squash
  - `attack`: wind-up, slash arc, follow-through, recover
  - `hurt`: flash, then recoil
  - `crouch` and `wall`
  - Each sheet also carries `hitbox` and `anchor`.
- **Other sprites**: `enemy` (`walk`, `idle`, `hurt`, plus `attack` on the lizard), `pickup`, `goal`, `flyer` (`fly`, `hurt`) and `checkpoint` (`idle` unlit, `lit` flickering).
- **8–10 props** with `propInfo` (anchor, light with its offset, weight). Lamps, torches, lanterns, braziers, glow fungus and crystals all emit lights.
- **An `environment` preset**, `lights` for hero, pickup, goal and enemy, and `tileSize`.

**Tooling and tests:**

- **`renderPreview(theme, opts)`**: a software compositor. It renders a level screenshot with lighting, fog, particles, bloom, grade and vignette, mirroring the engine's `atmosphere.ts` semantics. It works for tests, previews and theme thumbnails.
- **Tests** in `packages/engine/src/art/art.test.ts` (47) check:
  - every theme meets the contract and every raster is rectangular;
  - the required animations exist, frame indices are in range, and run frames differ;
  - tiles and tiled layers wrap seamlessly, and ground flows into fill;
  - prop info and environment ranges are valid, and a preview renders;
  - hue-shifted ramps behave as intended.
- **AI style presets** (`packages/art/src/styles.ts`): `pixel-rain-ruins`, `pixel-hollow-caverns`, `pixel-sunlit-meadow` and `pixel-ember-forge`, linked to the procedural themes by a new optional `theme` field and covered by a test.
- **Web thumbnails**: `apps/web/public/art/themes/<id>.png` (480×270), for a theme picker.

**Screenshots** (everything in `docs/team/shots/art/`):

- `overview.png`: all four themes, 2×2
- `<id>-screenshot.png` and `<id>-screenshot-2.png`: 480×270 at 3×; the second has the camera scrolled to show parallax
- `<id>-detail.png`: an in-game crop at 5×
- `<id>-hero.png`, `-enemy.png`, `-flyer.png`, `-pickup.png`, `-goal.png`, `-checkpoint.png`: sprite sheets at 6×
- `<id>-tiles.png`: each tile, plus a 6×6 tiled block and a platform run
- `<id>-props.png`
- `engine-<id>.png` and `engine-<id>-run.png`: the themes running in the **real engine** in the Studio, via Playwright

**Honest self-assessment against Rain World and Hollow Knight: 6.5/10.**

- **What works.** In screenshots the themes read as four different indie games. The layering, atmosphere, fog depth, rim light, readable silhouettes and colour moods are right. Meadow and Rain Ruins are the strongest. Ember Forge has a lot of mood.
- **What gives it away:**
  - The heroes are charming but small and simple (about 22 px tall). Their run cycles are procedural rather than hand-keyed per frame, so they lack the snap of Celeste or Dead Cells.
  - Tiles still repeat visibly over large areas.
  - Far layers are made of rectangles, not hand-painted shapes.
  - Enemies have only 4–6 frames.
  - Hollow Knight's painterly softness is out of reach with hard pixels; mine is a pixel-art cousin of it.

### Next

1. **Hero polish.** Hand-keyed overrides for key poses (contact, passing, take-off). A 2-frame turn and a dash/roll. Larger 40 px variants for close-up kits. Per-hero idle flourishes (ears twitch, plume flicker).
2. **Tile variety.** 32×32 macro variation (big cracks, roots, moss patches drawn across 2×2 tiles), slopes, wall-slide edges, inner corners and background-wall tiles (darker, unlit) for caves.
3. **Hand-shaped far silhouettes.** Bespoke landmark set-pieces per theme (a giant Rain World chimney, the Hollow Knight-style city dome, a forge furnace face) instead of only generated rectangles.
4. **More enemies per theme** (a second walker, a turret or plant) and boss-sized art.
5. **Animated tile overlays**: dripping water, lava shimmer, swaying grass, as small sprite sheets.
6. **More themes**: neon-city (synthwave rain), frost-peaks (snow) and deep-sea. With the toolkit in place, each takes about an hour.

### Needs from others

- **engine**:
  - Please keep parallax layers out of the lightmap. My layers are pre-lit, so multiplying them by ambient darkens them twice; this is very visible with the cave kit at `dim` or `dark`.
  - The kit's big black foreground pipe in the middle of the platformer view is heavy. Prefer my `foreground` layer, or keep such silhouettes near the screen edges.
  - Details are on the BOARD.
- **design**: the theme thumbnails are at `/art/themes/<id>.png`. `renderPreview` can also make live thumbnails in the browser.
- **critic**: please judge the themes in-engine (the `engine-*.png` shots) as well as in the previews.

### Known issues

- My preview mirrors the engine's fog and lighting maths, but particles and bloom are approximations. The engine is the source of truth.
- The cave kit's darkness setting plus the lightmap on parallax make Hollow Caverns very dark in-engine. I lifted the cave fill tiles a step, but the real fix is on the engine side (above).
- Repeating fill tiles are noticeable on large solid areas, especially the meadow soil.
- Theme generation costs 0.2–0.5 s per theme on first use (main thread). It is fine for now; it could move to a worker or be cached as PNGs if needed.
- The hero puppet's scarf/hair chain is driven by keyframed angles, not physics, so it does not react to sudden direction changes.
