# Art Director log

## Round 2

### Done

**1. An original cast** (critic's must-fix). Every character, enemy, pickup and icon is now our own design. The themes keep their moods but describe them in our own words. Game names are gone from code, descriptions, keywords and the AI style prompts, and tests enforce it.

| Theme | Hero | Enemy | Pickup | Goal | Landmark |
|---|---|---|---|---|---|
| `rain-ruins` | **Pip**, a lantern robot: yellow dome, one big glowing eye, springy antenna with a bulb, patched tarp cape | rust crawler drone with a scanning red lens | battery cell | home hatch with a warm porthole | colossal radio mast with a **blinking red beacon** |
| `hollow-caverns` | **Lumen**, a moth: feathery antennae, huge glowing eyes, mantle of folded wings with an eyespot, lantern swinging on a rope | puffcap mushroom that waddles and puffs spores | crystal shard | stone arch with a shimmering veil | giant statue of a winged moth keeper with a lit lantern staff |
| `sunlit-meadow` | **Fen**, a fox kid: big ears, white muzzle, green tunic, huge bushy tail | jelly slime | golden acorn | bell arch with a swinging bell | windmill on the hills, turreted castle on the foothills |
| `ember-forge` | **Ash**, a forge warden: crested helm, glowing visor, flame plume, light verdigris cloak | magma slug with eye stalks | soul flame | molten forge gate | two colossal forge chimneys with furnace mouths and smoke |

**Related fixes:**

- Keywords are now places and moods only. A test bans genre, verb and character words (boss, sword, robot, knight…) and any franchise names.
- The forge hero's cloak is much lighter, with a warm rim. A test now requires every hero to be at least 30% brighter or darker than the backdrop behind it.
- New additive `heroes[]` gives every theme the whole cast, with its own hero first, so the AI can honour "a robot in a cave".

**2. Bigger, hand-keyed heroes** (`packages/engine/src/art/hero2.ts`):

- Heroes are 48×48 frames with a body about 34–38 px tall (was about 22 px).
- Every body pose is a **hand-drawn grid**: 9 cloaks and 13 leg poses, including the run keys contact, down, passing and up. Each of the 31 frames is keyed by hand from those parts: body bob, head lag, scarf angle.
- New animations: **dash** (stretch plus speed lines) and **turn** (skid, then straighten up).
- The chain system now covers scarves, tails, antennas and lanterns. It can root at the scarf, head, hand or hip; trail, hang or spring up; use a width profile (the fox's bushy tail); take a tip colour (white tail tip); and carry a tip sprite (antenna bulb, lantern).
- An emblem layer adds the robot's cape patch and the moth's wing eyespot.

**3. Enemies with personality.** All have 8-frame walks and a white hurt flash, which a test checks:

- **drone:** skitters on jointed legs; its lens sweeps while idle and flares when it attacks.
- **puffcap:** waddles and bounces its cap; puffs spores while idle.
- **slime:** squash-and-stretch hop through anticipation, launch, peak, fall, splat and rebound; squints on impact and blinks.
- **slug:** an inching compression wave runs along its body; eye stalks sway; it drips lava.

**4. Tile variation and back walls:**

- `fill3` variant.
- Darker back-wall tiles with bevelled edges (`back`, `backTop/Bottom/Left/Right`), so a back-wall area reads as a recessed alcove.
- 4–5 large **decals** per theme, for the engine to scatter over solid interiors: cracks, embedded pipes, vents, roots, fossils, bones, crystal and lava veins, buried stones, skulls, grates. They are drawn in `decals.ts`.

**5. Far-layer landmarks,** one per theme (see the table). The new `ParallaxLayer.glows` lets the engine animate the beacon, the furnace mouths and the statue's lantern.

**6. Animated overlays.** New additive `ambientSprites`, drawn in `overlays.ts`:

- drips, puddle ripples and swaying grass (rain);
- glow-worms, drips and grass (caverns);
- grass and two butterflies (meadow);
- lava shimmer and torch flames (forge).

**Also:**

- The preview level now has a ruined gatehouse with a back-wall alcove, decals and ambient sprites.
- Half-size landing thumbnails: `apps/web/public/art/themes/<id>-small.png`, 15–24 kB, as the critic asked.
- Tests: 67 art tests (51 before), covering the cast, keywords, contrast, decals, ambient sprites, back walls, dash/turn, hero height ≥ 32 px, and 6+ enemy walk frames. Engine 118 and art 26 pass; both typechecks are clean.

**Screenshots** (`docs/team/shots/art/`):

- `overview.png`: all four themes.
- **In the real engine:** `engine-<id>.png` and `engine-<id>-run.png`. All four themes render in the Studio with the new cast.
- Per theme:
  - `<id>-screenshot.png` and `-screenshot-2.png`
  - `-detail.png`
  - `-hero.png` (31 frames), `-enemy.png`
  - `-pickup.png`, `-goal.png`, `-flyer.png`, `-checkpoint.png`
  - `-tiles.png`, `-props.png`
  - `-decals.png`, `-ambient-*.png`

**Honest score: 7/10** against the quality bar (moody layered pixel art, readable silhouettes, crisp expressive sprites).

- **Better than round 1:**
  - The cast has its own identity and reads at a glance.
  - The heroes are big enough to act, with a legible run.
  - Every enemy has character.
  - Landmarks give each world a memorable skyline.
- **Still below a shipped game:**
  - Heroes share one body rig, so their silhouettes differ mainly in head, colour and chain.
  - Fill still repeats where the engine doesn't scatter decals.
  - The moth's lantern is tiny.
  - The forge chimneys compete with the gear layer.
  - Far layers outside the landmarks are still built from rectangles.

### Next

1. **Per-character bodies.** A boxier robot chassis, a moth with visible wing flaps when jumping or falling, and a fox with a digitigrade run. Then a bigger moth lantern that lights the scene.
2. **2×2 macro tiles** (cross-tile cracks and roots), slopes and inner corners.
3. More landmarks per theme (two or three set pieces spaced along the level), and broken silhouettes instead of rectangles in the mid layers.
4. **More themes:** neon city (rain and signage), frost peaks (snow) and deep sea, each with its own cast member.
5. **Ambient life:** birds and fish for the meadow, rats for the ruins, and an extra flyer per theme.

### Needs from others

- **engine:**
  - Scatter `decals` over solid interiors and use the back-wall bevel tiles and `fill3`.
  - Spawn `ambientSprites` by anchor.
  - Animate `ParallaxLayer.glows` (blink and flicker).
  - Play `turn` on direction flips and `dash` when the kit has one.
  - Confirm the 48×48 hero framing and hitbox, especially in cave-kit gaps.
  - Details are on the BOARD.
- **ai:** pick a hero from `theme.heroes[].keywords` when the prompt names one ("robot", "moth", "fox", "knight"), and use the cast names in stories.
- **design:** use the `-small.png` thumbnails on the landing; use cast names in Look.

### Known issues

- Ambient sprites and decals appear in my preview, but not in-engine until the engine places them.
- The meadow castle and windmill can be hidden behind the gatehouse in the preview level. They show in-engine (`engine-sunlit-meadow-run.png`).
- The hero rigs share proportions; a fox and a robot run the same way.
- Theme build time is still 0.2–0.5 s per theme on first use; hero sheets are now shared across themes.

## Round 1 (summary)

- Shipped four procedural themes with seven parallax layers each, 13 seamless autotiles plus spikes, animated sprites, props with lights, and environment presets.
- Added `renderPreview` (a pure software compositor that mirrors the engine's atmosphere maths), 47 tests, AI style presets, and web thumbnails.
- The critic flagged that three of the round-1 heroes, enemies and icons resembled famous characters. Round 2 replaced all of them with the original cast above.
