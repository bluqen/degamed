# Degamed team brief

Five agents build Degamed together in rounds. The coordinator (the main session) runs the rounds, relays feedback, runs git, and deploys. **Read this whole file before starting, and re-read it at the start of every round.**

## What Degamed is

**An AI-powered game maker.** Not a general-purpose engine, and not a Godot/Unity clone. Someone types *"a moody rain-soaked platformer where a little robot looks for its family"* and within about a minute they're **playing a game that looks like a real indie game**. Then they change it by talking to it ("make the jumps floatier", "add a boss", "make it night") or with a few simple controls, and share a link that anyone can play on a phone or a PC.

The advanced tools (scene editor, code, animation) still exist, but they sit behind an **Advanced** door. They are never the first thing a person sees.

### The bar

1. **Art looks like a real game.** Think Rain World (moody, layered, atmospheric pixel art), Hollow Knight (dark, readable silhouettes, depth, soft light), Celeste and Dead Cells. No flat vector shapes, no programmer art, no plain gradients. Light, fog, particles, parallax depth, colour grading and hand-crafted sprites with proper pixel-art technique.
2. **The app looks and feels as polished as a first-party Microsoft app**, without copying Microsoft's style:
   - Calm and consistent, with one obvious primary action per screen.
   - Perfect spacing, alignment and type.
   - Fast and accessible.
   - Light and dark themes.
   - Smooth motion.
   - Plain-English copy.
   - Never a wall of panels.
3. **It's a hit.** Instant wow: a playable game in under a minute, games that feel good to play (game feel, juice), easy sharing and remixing, and games that work on phones.
4. **It's cheap to run.** The owner has very little money.
   - **Free instant mode:** with no AI at all, keyword matching picks a kit and a theme.
   - **Bring-your-own-key** for AI, where the AI calls run in the user's browser.
   - **A small hosted tier** on Cloudflare Workers AI's free daily allowance, with strict per-user caps.
   - The AI writes a **small game spec**, not thousands of lines of code, so token costs stay tiny.
   - No servers that render anything. Static hosting plus a small Worker.

## Team and file ownership

Only edit files you own. If you need something in another agent's area, write a request in `docs/team/BOARD.md` under their heading. The coordinator relays it at the end of the round.

| Agent | Owns | Job |
|---|---|---|
| **art** (Art Director) | `packages/engine/src/art/**` (new), `packages/engine/src/pixel.ts`, `packages/art/**`, `apps/web/public/art/**` | Game-quality art: themes with hand-crafted pixel sprites, tiles, layered atmospheric backgrounds, lighting and particle presets. Also the AI art prompt presets in `packages/art`. |
| **engine** (Engine & Game Feel) | `packages/engine/**` except `src/art/**` and `pixel.ts`; `packages/shared/**`; `apps/play/**` | The runtime: lighting, post effects, particles, camera, game feel, touch controls, performance. **Genre kits** (`packages/engine/src/kits/`) that turn a small spec into a complete, great-feeling game using an art theme. |
| **ai** (AI Game Builder) | `packages/ai/**` (new), `apps/api/**` | Prompt → game spec → game; chat edits; validation and auto-repair from runtime errors; providers (free instant mode, Gemini/OpenAI/Anthropic keys, hosted Workers AI with caps); cost control. |
| **design** (Product Designer & Front-end) | `apps/web/**` | The whole app experience: design system, landing page, the "describe your game" flow, generation progress, the **Studio** (play + chat + simple tweaks), sharing, and the Advanced tools tucked away and restyled. |
| **critic** (Producer & QA) | `docs/team/reviews/**`, `e2e/**` (new) | Holds the bar. Playtests, screenshots, compares against the bar and against competitors, finds bugs, measures performance and running cost, and writes ranked, specific feedback for each agent every round. Never edits product code. |

Shared files: `docs/team/BOARD.md` (append only, under the right heading) and `docs/team/<agent>.md` (each agent's own log).

## Contracts between agents

You may add to these, but never remove from or rename them. Note every change on the BOARD.

### art → engine: `packages/engine/src/art/index.ts`
```ts
import type { Raster } from '../pixel';
export interface SheetAnim { frames: number[]; fps: number; loop: boolean }
export interface SpriteSheet { raster: Raster; frameWidth: number; frameHeight: number; animations: Record<string, SheetAnim> }
export interface ArtTheme {
  id: string;                 // 'rain-ruins'
  name: string;               // 'Rain Ruins'
  description: string;        // one line, used by the AI to choose a theme
  keywords: string[];         // for free instant mode
  palette: string[];          // hex colours
  background: string;         // clear colour
  layers: { name: string; raster: Raster; factor: number; y?: number; tiled?: boolean }[]; // back → front
  tiles: { ground: Raster; fill: Raster; platform: Raster; [k: string]: Raster };
  sprites: {
    hero: SpriteSheet;        // must have idle, run, jump, fall (may add attack, hurt)
    enemy: SpriteSheet;       // must have walk (may add idle, hurt)
    pickup: SpriteSheet;      // must have idle
    goal: SpriteSheet;        // must have idle
    [k: string]: SpriteSheet;
  };
  props: Record<string, Raster>;  // decorations: plants, pipes, lamps, rocks…
  environment: Environment;        // see below (lighting, fog, particles, grade)
}
export const ART_THEMES: ArtTheme[];
export function getTheme(id: string): ArtTheme;
```

### engine → everyone: scene `environment` (in `packages/shared`)
These are additive scene fields that the engine renders:
```ts
environment?: {
  ambient?: { color: string; intensity: number };        // darkness and tint of unlit areas
  fog?: { color: string; density: number; height?: number };
  bloom?: { strength: number; threshold?: number };
  vignette?: number;                                       // 0..1
  grade?: { contrast?: number; saturation?: number; tint?: string };
  particles?: { type: 'rain' | 'dust' | 'fireflies' | 'snow' | 'embers' | 'spores'; density: number; color?: string }[];
}
```
There is also a new `Light` component: `{ color, radius, intensity, flicker? }`.

### engine → ai/design: `packages/engine/src/kits/index.ts`
```ts
export interface KitParam { key: string; label: string; type: 'number' | 'boolean' | 'choice'; min?: number; max?: number; step?: number; choices?: string[]; default: number | boolean | string; group?: string }
export interface Kit { id: string; name: string; description: string; keywords: string[]; params: KitParam[] }
export interface GameSpec { kit: string; title: string; theme: string; seed?: number; params?: Record<string, number | boolean | string>; story?: string }
export const KITS: Kit[];
export function buildGame(spec: GameSpec, encode: Encoder): ProjectFiles;   // always produces a valid, playable game
export function readSpec(files: ProjectFiles): GameSpec | null;              // the spec is stored in the project (e.g. game.spec.json)
```

### ai → design: `packages/ai/src/index.ts`
```ts
export type ProviderId = 'instant' | 'gemini' | 'openai' | 'anthropic' | 'degamed';
export interface AiSettings { provider: ProviderId; apiKey?: string; model?: string; apiUrl?: string; authToken?: string }
export interface Progress { stage: 'understanding' | 'designing' | 'building' | 'testing' | 'fixing' | 'done'; message: string }
export interface ChatTurn { role: 'user' | 'assistant'; text: string }
export function createGame(i: { prompt: string; settings: AiSettings; encode: Encoder; signal?: AbortSignal; onProgress?: (p: Progress) => void }):
  Promise<{ files: ProjectFiles; spec: GameSpec; title: string; summary: string }>;
export function editGame(i: { files: ProjectFiles; request: string; history?: ChatTurn[]; settings: AiSettings; encode: Encoder; signal?: AbortSignal; onProgress?: (p: Progress) => void }):
  Promise<{ files: ProjectFiles; summary: string; changed: string[] }>;
export function suggestions(files: ProjectFiles): string[];   // quick-action chips
export function availableProviders(keys: Record<string, string | undefined>, hosted: boolean): ProviderId[];
```
`instant` must always work, offline and for free.

**Until a dependency lands, build against the contract with a small local stub, then switch to the real thing.**

## Environment

- **Dev servers are already running.** Don't start others on these ports.
  - Web: <http://localhost:5173>
  - Player: <http://localhost:5174>
  - Both hot-reload. The demo editor is at `/editor/demo`.
- **Screenshots** (Playwright, already installed). Save PNGs under `docs/team/shots/<agent>/` and **look at them yourself with the Read tool**. Iterate until they meet the bar. A screenshot you haven't looked at doesn't count.
  ```js
  import { createRequire } from 'node:module';
  const require = createRequire('/opt/node22/lib/node_modules/');
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  ```
  Put scripts in your own scratch folder, not in the repo.
- **Network:** outside network access is mostly blocked. Google Fonts and image APIs may not load. Don't rely on fetching anything at runtime in tests. There are no AI API keys here, so test AI code with mocked providers.
- **Checks:**
  - `pnpm --filter <pkg> typecheck`
  - `pnpm --filter <pkg> test`
  - `pnpm typecheck && pnpm test` at the end of your round. If another agent's area is failing, note it on the BOARD and don't fix it.
- **Pixel helpers:** `packages/engine/src/pixel.ts` has `Raster`, `rasterize`, `sheetOf` and palettes. Templates encode rasters to PNG data URLs through an `Encoder` passed in from the browser.

## Rules

1. **Never run git commands that change state** (commit, push, checkout, reset, stash, rebase). The coordinator does git.
2. Stay inside your files. Contract changes are **additive** and noted on the BOARD.
3. Avoid new dependencies. If one is essential, run `pnpm --filter <your-package> add <dep>` and note it on the BOARD.
4. Keep your package's tests green, and add tests for logic you write.
5. **Ship working increments, not plans.** Each round must end with something visibly better that runs.
6. At the end of every round, update `docs/team/<agent>.md`:
   - **Done** (with screenshot paths)
   - **Next**
   - **Needs from others**
   - **Known issues**
7. Write for real people: plain English in the UI, no jargon.
