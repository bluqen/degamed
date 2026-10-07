# Degamed: AI-powered 2D game engine (full product plan, v3)

## Context
`bluqen/degamed` is an empty repo. Degamed is a **browser-based, professional-looking 2D game engine** with AI at its core.
- **Beginners**: type a prompt and get a beautiful game.
- **Experienced creators**: use the full editor and script in **JavaScript or Python** through Degamed's own `degamed` library.
- **Built in**: **AI art generation** in many styles (pixel art, hand-painted, anime and more), a sprite editor, a **music composer**, and **native builds** for desktop and Android.

Constraints you gave me:
- You are in **Nigeria**, so Stripe is not available.
- You have **little capital**, so AI and hosting costs must start near $0.
- You want **detailed UI mockups**.

Decisions made so far:
- Web app
- The AI writes code
- **AI-generated art** (changed from procedural/vector art; see "Art pipeline" below)
- The full product
- JS + Python
- A Pro editor with a Simple mode

---

## 1. Answers to your questions

### Should people bring their own API keys? Yes, and it solves the money dilemma.
**AI is the hook; the engine and platform are the product.** People pay for things that actually cost you money or that only you can provide, not for tokens.
- **BYOK (bring your own key) is free on every plan.**
  - Users paste an Anthropic, OpenAI, Google Gemini or OpenRouter key.
  - The **AI agent loop runs in the user's browser**, and the browser calls the AI provider directly (Anthropic allows browser calls with a specific header). The key is stored only in that browser (`localStorage`, optionally encrypted with a passphrase) and **never reaches your server**.
  - So BYOK users cost you about **$0 in AI**.
  - Gemini has a free API tier, so users without money can still use AI at no cost.
- **Hosted AI credits** are for people who don't want to deal with keys. They are paid, apart from a tiny free trial.
  - They go through a thin server proxy that meters credits.
  - Prompts are tuned for Claude: `claude-sonnet-5-5` by default, `claude-opus-5-5` in Pro, `claude-haiku-4-5` for cheap tasks and the free trial.
  - Other providers are "best effort".
- **What people pay for even with BYOK**:
  - **Native builds** (cloud build minutes cost money)
  - Private projects, more storage (music, sound and asset uploads), custom domains
  - No badge, analytics, team collaboration, commercial license
  - Marketplace selling, plus hosted credits

### Payments from Nigeria (no Stripe)
- **Paystack** for subscriptions and credit packs (Paystack is Nigerian and owned by Stripe).
  - Accepts Nigerian cards, bank transfer and USSD; international cards work once international payments are enabled on the account.
  - Has Plans/Subscriptions APIs, and a Transfers API for **creator payouts** to Nigerian (and some African) bank accounts.
- **Flutterwave** as a second provider, for wider international card coverage and payouts to more countries.
- All payment code sits behind one `PaymentProvider` interface (`createCheckout`, `webhook`, `payout`), so we can add Lemon Squeezy, Paddle or Stripe (through a Stripe Atlas US company) later without rewrites.
- Show **regional pricing**: Naira for Nigeria, USD elsewhere.
- *Check during signup: which currencies Paystack will let your business settle in, and its international-card limits.*

### Hosting: free to start, built so the free limits rarely matter

**Architecture choice made for the free tier**:
- The app is a **static React app** (Vite + React Router), with public pages prerendered for SEO. It is hosted on **Cloudflare Pages**, where loading static files is free and unlimited.
- All server logic lives in a **small Cloudflare Worker API** built with **Hono**. It covers the AI proxy, payment webhooks, the build trigger, signed upload URLs and OG images.
- This replaces Next.js. The free Workers plan caps a Worker at **3 MB**, and a full Next.js server bundle can exceed that; a small Hono API stays far below it.
- Heavy work happens in the user's browser: the editor, game previews, the AI agent loop (for BYOK users) and audio. Our servers do very little.

| Piece | Service (free tier) | Free limits | What uses it up |
|---|---|---|---|
| App, landing, editor, docs | Cloudflare Pages | Unlimited static requests and bandwidth; 500 deploys/month | Nothing realistic |
| Play sandbox | Second Pages project | Same as above | Nothing realistic |
| API | Cloudflare Workers (Hono) | **100k requests/day**, 10 ms CPU per request (time spent waiting on the network doesn't count), 3 MB script | Only API calls count, so this is roughly several thousand daily active users |
| Accounts, database | Supabase Free | 500 MB database, 50k monthly active users, 5 GB egress, **pauses after 7 days with no activity**, 2 projects | The database holds only metadata; project files and versions live in R2 |
| Files (projects, versions, music, uploads, builds) | Cloudflare R2 | 10 GB storage, 1M writes and 10M reads/month, **free egress** | Uploads and builds; content-addressed storage removes duplicates |
| Heavy libraries (Pyodide, Phaser) | Public CDN (jsDelivr), or self-hosted on Pages | Free | No cost to us |
| Native builds | **Export templates**, packaged in the user's browser (see 3.6) | $0 per build | Nothing. GitHub Actions (free on a public repo) only rebuilds the templates when Degamed releases a new engine version. |
| Email | Resend free | About 3,000 emails/month (100/day) | Sign-up and receipt emails |
| AI | BYOK | $0 to you | Hosted credits are only ever sold |
| Keep-alive | Workers cron trigger | Free | Pings Supabase daily so it never pauses |

**Will it look professional without paying? Yes, with one cheap exception.**
- The polish comes from the design, the speed (Cloudflare's global CDN) and the product, and none of that depends on paying.
- The only visible tells of a free setup:
  1. **The address** `degamed.pages.dev`. Fix it with your own domain (`degamed.app` or similar, about $10–15 a year). Cloudflare hosting on a custom domain is free.
  2. **Emails from a generic sender**, and Supabase's built-in email has very low sending limits. With your domain, Resend free sends from `hello@degamed.app`.
  3. **The Google sign-in screen shows the `…supabase.co` address**: **solved for free**, the same way as in Kavedi.
     - Use Google Identity Services ("Sign in with Google" popup and One Tap) with our own Google OAuth Client ID.
     - Google returns an ID token to our page, which we pass to `supabase.auth.signInWithIdToken({ provider: 'google', token, nonce })`.
     - Google's screen then shows **Degamed** and our own domain, never `supabase.co`.
     - GitHub sign-in still uses Supabase's standard redirect; it is lower priority.

**When you actually need to pay**:
| When | What | Approximate cost |
|---|---|---|
| Day 1 (recommended) | Domain | about $10–15 a year |
| **Before taking real customers' money** | **Supabase Pro**: no pausing, daily backups, 8 GB database, more egress | **$25/month**. This is the important one: paying users need backups. |
| Over about 100k API calls a day | Workers Paid (10M requests/month, 10 MB scripts) | $5/month |
| Over 10 GB of files | R2 | $0.015 per GB a month (100 GB ≈ $1.35) |
| Each payment | Paystack transaction fee (no monthly fee) | A percentage per transaction, and higher for international cards; check the current rates on Paystack's pricing page |
| Hosted AI | Your Anthropic bill | Only grows as people **buy** credits; credit prices include a margin |

**Rough monthly cost by stage**:
- **Building and beta** (0–1k users): about $1 a month (the domain)
- **Public launch with payments** (1k–10k users): about $25–30 a month
- **Growth**: costs grow with usage, and subscriptions plus build quotas cover them

### Music
- **Degamed Composer** is a built-in music workstation (see section 3). It feels more like a mini-DAW than BeepBox: clip-based arrangement, a piano roll, a drum step grid, synth instruments, effects, a mixer, **adaptive game music layers** and AI composing.
- People can also **upload their own music and sounds** (mp3, ogg, wav) and **import MIDI** into the Composer.

### Native builds
- **Web** (HTML5 zip/PWA)
- **Windows, macOS and Linux** via Tauri; the games stay small
- **Android** (APK/AAB) via Capacitor
- **iOS** later; it needs a Mac build runner and the user's own Apple Developer account
- Consoles are **not possible**: they require platform-holder NDAs and licensing.

---

## Art pipeline (AI image generation)
Art is generated by image models, then post-processed so every asset in a game matches. Code: `packages/art`.
1. **Pick a style** from the catalog: 13 styles, including 16-bit, 8-bit and HD pixel art, hand-painted, anime, cartoon, watercolour, dark fantasy, cozy, neon, paper, comic and flat. Each style is a prompt recipe plus processing settings.
2. **Generate.** Sprites are drawn on a solid magenta key colour.
   - Providers: **Degamed hosted**, which runs on Cloudflare Workers AI (FLUX.1 schnell) with a free daily quota per user and is free for us up to 10k neurons/day; **your own Gemini key**, which has a free tier and supports reference images for consistent characters; or **your own OpenAI key**.
3. **Process.**
   - Remove the background: a flood fill from the edges, so key-coloured details inside a sprite survive, plus despill on the edges.
   - Trim.
   - For pixel styles, reduce to a true low-resolution grid using the most common colour in each block (no blur), snap to the project palette or an automatic median-cut palette, and optionally add a 1px outline.
4. **Use.** The Art Lab shows the raw output next to the game-ready version and downloads PNGs. Next steps: "Use in game", animation frames from a reference image, and sprite sheets.

## 2. Tech stack
| Layer | Choice |
|---|---|
| App | Vite + React + TypeScript + React Router (a static app, with public pages prerendered), Tailwind CSS v4, shadcn/ui, lucide icons, Framer Motion |
| API | Hono on Cloudflare Workers (small and stateless) |
| Editor docking | `dockview` |
| Auth, DB | Supabase (Auth and Postgres with RLS) |
| Files | Cloudflare R2 via signed URLs |
| Payments | Paystack (primary), Flutterwave, behind a `PaymentProvider` interface |
| AI | Provider adapters (Anthropic, OpenAI, Gemini, OpenRouter). The agent runs **in the browser**. Hosted mode goes through `/api/ai/proxy`, which meters credits |
| Engine runtime | Phaser 3 underneath the Degamed engine layer |
| Python | **Pyodide** (WebAssembly), loaded lazily, plus the **`degamed` Python package** |
| Audio | Web Audio API with a custom synth and sequencer engine (AudioWorklet), and OfflineAudioContext for WAV/OGG rendering |
| Bundling | `esbuild-wasm` |
| Code editor | Monaco with Degamed API completions for JS and Python |
| Native builds | Tauri (desktop) and Capacitor (Android), built in a GitHub Actions "build farm" repo triggered by `workflow_dispatch` |
| Tests | Vitest and Playwright |
| Hosting | Cloudflare Workers and Pages, R2, Supabase (free tiers) |

---

## 3. Architecture

### 3.1 Project format
```
project.json                 title, resolution, palette, physics, input map, start scene, build targets
scenes/*.scene.json          entity tree with components
prefabs/*.prefab.json
scripts/*.py | *.js          Behaviours
assets/sprites/*.png         AI-generated sprites (+ frames)  assets/tiles/*.png
assets/anims/*.anim.json     keyframe animations
audio/songs/*.song.json      Composer songs                   audio/sfx/*.sfx.json  (procedural SFX)
audio/uploads/*              user mp3/ogg/wav (stored in R2, referenced by hash)
shaders/*.glsl
```
Every AI turn and every save creates an immutable **version**, which gives undo, history and restore.

### 3.2 One API definition, two first-class languages: the `degamed` library
- **Single source of truth**: `packages/api-spec`, a typed API definition. It generates:
  - `degamed` for JS (an ESM module plus `.d.ts`)
  - `degamed` for Python (a real package with type hints, `.pyi` stubs and docstrings)
  - The docs website
  - The AI's API reference
- **What the library covers**:
  - Core: `Behaviour`, `Entity`, `Scene`, `Vector2`, `Color`, `Time`
  - Input: `Input`, `Key`
  - Physics: `Body`, `Collider`, `Physics`, `Camera`
  - Effects: `Tween`, `Ease`, `Particles`, `Light2D`, `PostFX`
  - Audio and UI: `Audio`, `Music`, `UI`
  - Persistence and utilities: `Save` (local storage), `Random`, `Timer`
  - Art Kit: `kit` (palette, svg, fx, juice, bg, ui)
- **Inspector fields**: type-annotated class fields show up in the Inspector automatically.
- The Python package is also **published to PyPI** (as stubs plus docs), so people get autocomplete in VS Code when they work offline.

```python
from degamed import Behaviour, Input, Key, Music, kit

class Player(Behaviour):
    speed: float = 220          # shows in Inspector
    jump_force: float = 480

    def on_update(self, dt: float):
        self.body.velocity.x = Input.axis("horizontal") * self.speed
        if Input.pressed(Key.SPACE) and self.body.on_floor:
            self.body.velocity.y = -self.jump_force
            kit.juice.squash(self.entity, 0.8)
            self.audio.play("jump")

    def on_collide(self, other):
        if other.has_tag("enemy"):
            Music.stinger("hurt"); Music.intensity = 1.0
```
```js
import { Behaviour, Input, Key, kit } from "degamed";
export default class Player extends Behaviour {
  static props = { speed: 220, jumpForce: 480 };
  onUpdate(dt) { this.body.velocity.x = Input.axis("horizontal") * this.speed; /* … */ }
}
```
- **How Python runs**: in Pyodide inside the play iframe. A bridge maps the `degamed` Python objects to the engine. Per-frame calls are batched, and transforms sit in shared typed-array buffers to keep overhead low.

### 3.3 Engine (`packages/engine`)
- **Entity/component runtime** on Phaser.
- **Components**:
  - Transform, Sprite, AnimatedSprite, Tilemap
  - Body/Collider (Arcade or Matter), Camera
  - Particles, Light2D, PostFX, Parallax
  - Text/UI, AudioSource, MusicPlayer, Script
- **Art Kit** gives games a stunning look by default:
  - Curated palettes, SVG helpers
  - Bloom, glow, CRT and vignette effects
  - Parallax skies, juice effects, touch joystick, UI kit
- **Two run modes**:
  - **Edit mode** runs in the app with **no user scripts executing**.
  - **Play mode** runs in a **sandboxed iframe on a separate origin** (strict CSP, `postMessage` protocol).
- **Exporters**: a web zip, plus a build manifest for native builds.

### 3.4 Degamed Composer (`packages/audio`)
- **Song model**:
  - `bpm`, `key`, `scale`
  - `tracks[]`, each with an instrument, effects chain, volume, pan, mute/solo and an adaptive `layer`
  - `clips[]` placed on the timeline; each points to a `pattern`, which holds `notes[{t, len, pitch, vel}]`
  - `automation[]`
  - `sections` (intro, loop, boss…)
  - `stingers`
- **Instruments**:
  - Subtractive synth (2 oscillators, filter, ADSR, LFO)
  - FM synth
  - Wavetable/chip synth (pulse, triangle, noise, for the retro feel)
  - Drum machine (synthesized kicks, snares and hats with per-step parameters)
  - Sampler (user uploads, multi-sample, loop points)
- **Effects**: reverb, delay, chorus, distortion/bitcrush, filter, EQ and compressor, plus a master limiter.
- **What makes it different from BeepBox**:
  - Clip arrangement like a DAW
  - Scale lock and a chord helper ("pick chords, not notes")
  - **Adaptive music**: layers fade by intensity; sections switch on beat or bar; stingers
  - **AI compose**: "tense boss theme, D minor, 140 BPM, chiptune + orchestral pads"
  - **Variation**: "make this melody more heroic"
  - **Humanize**
- **Game API**:
  - `Music.play("theme")`
  - `Music.intensity = 0.7`
  - `Music.go_to("boss", sync="bar")`
  - `Music.stinger("win")`
- **Import and export**: import MIDI and audio files; export WAV/OGG/MIDI. Native builds pre-render songs only when the user chooses to; otherwise they synthesize live.
- **SFX Designer**: jsfxr-style generator presets (jump, coin, laser, explosion, hurt) with mutate/randomize and AI "describe the sound".

### 3.5 AI agent (`packages/agent`, runs in the browser)
- **Provider adapters**: Anthropic (default and best tuned), OpenAI, Gemini, OpenRouter.
  - BYOK calls the provider directly from the browser.
  - Hosted mode calls `/api/ai/proxy`, which checks auth, checks credits, forwards the request and records usage.
- **Tools**:
  - Files: `list/read/write/edit/delete_file`
  - Scene and assets: `add_entity`, `update_components`, `create_prefab`, `attach_script(lang)`, `create_svg_asset`, `create_tileset`, `create_animation`
  - Audio: `compose_song`, `edit_song`, `create_sfx`
  - Config and inspection: `set_project_config`, `get_runtime_report` (errors, logs and screenshot), `finish`
- **Loop**: plan → edit → play-test → auto-repair (up to 3 times) → screenshot critique → save a version. Changes appear as diffs you can **Accept, Revert or Revise**.
- **Context-aware**: the current selection is attached to each request, and "Ask AI…" is available on right-click.

### 3.6 Native builds with export templates (no build servers)
This works the way Godot's export templates do.
- **Templates**: for each engine release, we build one generic **player shell** per platform *once*:
  - A Tauri player for Windows, macOS and Linux
  - A Capacitor/WebView player APK for Android
  - These are produced by a GitHub Actions workflow on the public `bluqen/degamed` repo, which is free, and uploaded to R2/CDN as `templates/<engineVersion>/<platform>`.
- **Export, entirely in the user's browser**: download the template, insert the game bundle (game files, Pyodide if the game uses Python, icon, name), then zip the result.
  - **Windows**: the template `.exe` plus a `game/` folder and an icon/name patch. Delivered as a zip; a single-file installer comes later.
  - **Linux**: a `.tar.gz` (AppImage later).
  - **macOS**: the `.app` bundle, unsigned. Users right-click and choose Open the first time; signing with the user's own Apple account comes later.
  - **Android**: an APK, which is also a zip. Insert the assets, patch the app name, package id and icon in the manifest, then **sign it in the browser** (JS/WASM apksigner) with the user's keystore, which is generated in the browser and kept by the user.
- **Cost**: $0 per build, with no queue and no server time.
- **Later, as a paid add-on**: Play Store `.aab` and iOS builds need real cloud builds (GitHub Actions or a hosted Mac). Add those once there is revenue.

### 3.7 Data model (Supabase, all tables with RLS)

| Area | Tables |
|---|---|
| Users and projects | `profiles`, `projects`, `versions` (metadata plus an R2 manifest key; file contents are stored in R2 under their hash, so the 500 MB free database stays small), `messages` |
| Uploads and builds | `uploads` (R2 key, size, type, owner), `builds` (targets, status, logs URL, artifacts) |
| Community | `published_games`, `likes`, `plays` |
| Billing | `subscriptions` (provider, plan, status, period end), `credit_ledger`, `payments` (provider reference, amount, currency) |
| Marketplace | `marketplace_items`, `purchases` |
| Creator money | `creator_accounts` (payout provider and bank details reference), `earnings`, `payouts` |

---

## 4. Business model (revised for BYOK and Nigeria)
| Plan | Price (example; USD / NGN regional) | Includes |
|---|---|---|
| **Free** | $0 | **Unlimited AI with your own key**; hosted-AI trial (about 30 Haiku messages); web export and Windows export (with a "Made with Degamed" splash); up to 3 private projects; public publishing with a badge; 500 MB uploads |
| **Creator** | about $6/month (₦ regional price) | Hosted AI credits (Sonnet); unlimited private projects; **unlimited native exports with no Degamed splash screen** (Windows, macOS, Linux, Android); no badge; 5 GB uploads; selling on the marketplace; tips |
| **Pro** | about $18/month | More credits, including Opus; custom domain; analytics; 3 team seats; Play Store/iOS cloud builds (later) |
| **Credit packs** | ₦ / $ top-ups | For hosted AI |

**Other revenue**:
- Marketplace commission of about 25% on templates, art packs, song/SFX packs and script packs
- Tips on games, with a platform cut
- Opt-in ads in published games with revenue share (later, once there is traffic)
- School/education plans (later)

---

## 5. UI mockups (wireframes)
- **Visual identity**: dark pro-tool UI
  - Background `#0E0F13`, panels `#16181F`, borders `#262A35`
  - Accent gradient from violet `#7C5CFF` to cyan `#22D3EE`
  - Success `#34D399`, warning `#FBBF24`, error `#F87171`
  - Inter for UI text, JetBrains Mono for code; compact 13px editor text
- Marketing pages use the same palette, but louder: big type, glowing gradients and live game reels.
- **Note**: these are wireframes. **The first implementation step is to build high-fidelity, clickable HTML mockups of every screen and publish them as a private page for you to review** before building the real app.

### 5.1 Landing `/`
```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ◆ degamed          Explore   Marketplace   Docs   Pricing            Log in  [Start ▸]│
├──────────────────────────────────────────────────────────────────────────────────────┤
│                    Make stunning 2D games. Just describe them.                        │
│          AI-powered game engine · JavaScript & Python · Music · Native builds        │
│   ┌──────────────────────────────────────────────────────────────────────────────┐   │
│   │ ✦ A neon cyberpunk platformer where a cat hacks drones…                 [Build ▸]│   │
│   └──────────────────────────────────────────────────────────────────────────────┘   │
│     [Platformer] [Space shooter] [Cozy farming] [Puzzle] [Roguelike] [Runner]        │
│ ┌─────────────────── live game reel (autoplaying, 3 cards scroll) ────────────────┐  │
│ │ ▶ Neon Cat Heist   ▶ Pastel Garden    ▶ Starfall Drift   ▶ Ink Samurai           │  │
│ └──────────────────────────────────────────────────────────────────────────────────┘  │
│  ① Describe   →   ② Refine with AI or by hand   →   ③ Publish to web, PC & Android     │
│ ┌──────── editor screenshot tour (tabs: AI · Scene · Code · Composer · Build) ──────┐ │
│ │ Features: Pro editor · Python & JS `degamed` lib · Composer · AI art · BYOK      │ │
│ └──────────────────────────────────────────────────────────────────────────────────┘ │
│  Pricing teaser (Free / Creator / Pro)      Footer: Docs · Discord · Terms · Privacy   │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Dashboard `/dashboard`
```
┌──────┬───────────────────────────────────────────────────────────────────────────────┐
│ ◆    │ Good evening, Ada             🔍 Search projects        Credits ▓▓▓░ 64   (A) │
│ Home │ ┌──────────────────────── Start something new ─────────────────────────────┐ │
│ Games│ │ ✦ Describe a game…                                          [Create ▸]   │ │
│ Music│ │ [Blank 2D] [Platformer tpl] [Top-down tpl] [Shooter tpl] [From Marketplace]│ │
│ Build│ └──────────────────────────────────────────────────────────────────────────┘ │
│ Market│ Recent projects                                  Sort: Edited ▾   ▦ / ☰     │
│ Learn│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐                  │
│ ──── │ │ ▶ animated │ │ ▶ animated │ │ ▶ animated │ │   + New    │                  │
│ Plan:│ │ Neon Cat   │ │ Slime Farm │ │ Void Run   │ │            │                  │
│ Free │ │ JS · 2h ago│ │ PY · 1d ago│ │ JS · Public│ │            │                  │
│[Upgrade]└────────────┘ └────────────┘ └────────────┘ └────────────┘                  │
│      │ Builds: Void Run ▸ Windows ✓  Android ⟳ 62%      Learn: "Your first Python ▸" │
└──────┴───────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 New project wizard `/new` (four steps, plus a progress rail)
```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ← Back                    New game   ● Idea ─ ● Style ─ ○ Setup ─ ○ Build             │
├──────────────────────────────────────────────────────────────────────────────────────┤
│  Pick an art style                                                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │(live mini│ │          │ │          │ │          │ │          │ │          │        │
│  │ preview) │ │          │ │          │ │          │ │          │ │          │        │
│  │Neon Glow✓│ │Pastel    │ │Paper Cut │ │Flat Geo  │ │Ink Wash  │ │Retro Vec │        │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘        │
│  Palette: ● ● ● ● ●  [Shuffle]        Music mood: [Synthwave ▾]                        │
│  Setup step:  Controls ◉ Keyboard+Touch  ○ Keyboard  ○ Gamepad                         │
│               Script language  ◉ Python  ○ JavaScript     Resolution [1280×720 ▾]      │
│               AI  ◉ My key (Anthropic ••••3f)  ○ Degamed credits (64)                  │
│                                                               [Back]  [Build game ✦] │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.4 Editor, Simple mode `/editor/[id]`
```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ◆ Neon Cat Heist ✎   Saved ✓        [Simple ◉ | Pro ○]      ▶ Play   Share   Build ▾ │
├───────────────────────────────┬──────────────────────────────────────────────────────┤
│ AI Copilot           Sonnet ▾ │                                                      │
│ ─────────────────────────────│                (Live game view)                      │
│ You: make the drones shoot    │            ✦ glowing city, parallax, cat ✦           │
│ AI: Plan                      │                                                      │
│   ✓ Add Bullet prefab         │                                                      │
│   ✓ drone.py: shoot every 2s  │                                                      │
│   ⟳ Play-testing…             │  [⟲ Restart] [⏸] [⛶]   Desktop ▾       60 fps        │
│  ┌ changes: 3 files ─────────┐├──────────────────────────────────────────────────────┤
│  │ +bullet.prefab drone.py…  ││ Quick edit                                            │
│  │ [Accept] [Revert] [Diff]  ││ Player speed  ───●──── 220   Jump ────●── 480         │
│  └───────────────────────────┘│ Difficulty    ○ Easy ◉ Normal ○ Hard                  │
│ [Make it prettier][More juice]│ Colors ● ● ● ●   Music [Synthwave loop ▾] [♪ Edit]     │
│ [Fix bugs][Add a boss]        │ Lives [3]  Enemies [Drones ✓][Turrets ✓][Lasers ○]    │
│ ┌───────────────────────────┐ │                                                      │
│ │ Ask anything…          ➤ │ │                                                      │
│ └───────────────────────────┘ │                                                      │
└───────────────────────────────┴──────────────────────────────────────────────────────┘
```

### 5.5 Editor, Pro mode (dockable)
```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ File Edit Scene Assets Audio Build AI Window Help        ◆ Neon Cat Heist     [Simple|Pro◉]   │
│ [↖][✥][⟳][⤢][▦ tile][✎] Snap▾ Grid▾ │   ▶ ⏸ ⏭   │ Desktop▾ │ ⌘K Search…        Build ▾ Share │
├───────────────┬──────────────────────────────────────────────────────┬───────────────────────┤
│ Hierarchy     │ [Scene] [Game] [player.py ●] [Composer] [Sprite: cat]│ Inspector             │
│ ▾ Main        │ ┌──────────────────────────────────────────────────┐ │ Player   ☑ active     │
│   ▾ World     │ │  grid · gizmos · camera bounds rectangle         │ │ Tags [player][+]      │
│     Tilemap   │ │        ┌──┐  ← selected (move gizmo ↔↕)           │ │ ▾ Transform           │
│     Parallax  │ │        │🐱│                                       │ │  Pos  x 240  y 512    │
│   ▸ Enemies(4)│ │  ▬▬▬▬▬▬▬▬▬▬▬▬     ▬▬▬▬▬▬     drone ◇            │ │  Rot 0°  Scale 1 1    │
│   ● Player    │ │                                                  │ │ ▾ Sprite  cat.svg  ▣  │
│   Camera      │ │                               zoom 100% ⊕ ⊖       │ │ ▾ Body  Arcade ▾      │
│   UI          │ └──────────────────────────────────────────────────┘ │  Gravity ☑  Bounce 0  │
│───────────────│                                                      │ ▾ Script player.py    │
│ Project       │                                                      │  speed    [220]       │
│ ▸ scenes      │                                                      │  jump_force [480]     │
│ ▸ scripts     │                                                      │ [+ Add Component]     │
│ ▸ sprites ▣▣▣ │                                                      ├───────────────────────┤
│ ▸ audio  ♪♪   │                                                      │ AI Copilot  (docked)  │
│ ▸ prefabs     │                                                      │ "Make Player double-  │
│ [+ Import]    │                                                      │  jump"  [Ask ➤]       │
├───────────────┴──────────────────────────────────────────────────────┴───────────────────────┤
│ [Console] [AI log] [History] [Build]   ⚠ 1  ✖ 0      > player.py:14  Player landed            │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.6 Script editor tab (Python)
```
┌ player.py ● ──────────────────────────────────────────────── Python ▾  [▶ Run scene] ┐
│ 1  from degamed import Behaviour, Input, Key, kit                                    │
│ 2                                                                                    │
│ 3  class Player(Behaviour):                                                          │
│ 4      speed: float = 220                                                            │
│ 5      def on_update(self, dt):                                                      │
│ 6          self.body.velocity.x = Input.axis("horizontal") * self.sp│                 │
│                                                       ┌──────────────────────┐       │
│                                                       │ speed      float     │       │
│                                                       │ sprite     Sprite    │       │
│                                                       └──────────────────────┘       │
│ ✦ AI: [Explain] [Fix] [Refactor] [Write tests]  ~ inline ghost suggestions (Tab)     │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.7 Degamed Composer (a tab in the editor, or full screen at `/editor/[id]/music`)
```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ ♪ Synthwave Theme  ▶ ■ ⏺  ⟲ loop   BPM [128]  Key [A] [minor ▾]  Scale lock ☑  Snap 1/16     │
│ ✦ AI: "add a driving bassline"  [Compose] [Variation] [Humanize]   Intensity preview ─●── 0.6 │
├──────────────┬───────────────────────────────────────────────────────────────────────────────┤
│ Tracks       │ Arrangement  | Intro      | Loop A          | Loop B         | Boss    |       │
│ ◉ Lead   M S │ ██████      ░░░░████████████    ████████████                                  │
│ ◉ Bass   M S │ ████████████████████████████████████████████████████████                       │
│ ◉ Pads   M S │       ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                                                   │
│ ◉ Drums  M S │ ▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪   layer: intensity ≥ 0.5               │
│ [+ Track]    │                                                                               │
├──────────────┼───────────────── Piano roll (Lead · Pattern 3) ────────────────────────────────┤
│ C5 ▭         │      ▬▬▬        ▬▬                ▬▬▬▬▬                                        │
│ A4 ▭  (scale │  ▬▬▬       ▬▬▬▬     ▬▬                                                         │
│ E4 ▭  rows   │                         ▬▬▬▬▬▬▬▬                                              │
│ C4 ▭  glow)  │ velocity ▮▮▯▮▮▮▯▮▮▮                     Chords: [Am] [F] [C] [G] ✦             │
├──────────────┴───────────────────────────────────────────────────────────────────────────────┤
│ Instrument: Lead — FM Synth ▾  Osc ◠◡ ratio 2.0  Filter ─●── ADSR ╱‾‾╲  FX: [Delay][Reverb][+]│
│ Mixer: Lead ▮▮▮▯ Bass ▮▮▮▮ Pads ▮▮▯▯ Drums ▮▮▮▮ Master ▮▮▮▯ limiter   [Import MIDI/Audio] [Export]│
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.8 Sprite editor (pixel + AI restyle)
```
┌ Sprite: cat.svg ─── [Pen][Shape ◯▭][Gradient][Outline][Eyedrop]  Frames: [1][2][3][+] onion ☑ ┐
│ Layers      │                 (canvas with checkerboard)                 │ Fill  ▇ #7C5CFF   │
│ ▾ body      │                        /\_/\                               │ Stroke 2px #0E0F13│
│   ear L/R   │                       ( o.o )   ← selected path handles    │ Glow  ─●── 6      │
│   eyes      │                        > ^ <                               │ Rim light ☑       │
│ ▸ tail      │                                                            │ Palette ● ● ● ● ● │
│ ✦ AI: "make it look like a robot cat"  [Restyle] [New frame] [Recolor to palette]            │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.9 Build and export dialog
```
┌ Build "Neon Cat Heist" ──────────────────────────────────────────────────────────┐
│ Targets   ☑ Web (HTML5 zip)  ☑ Windows (.exe)  ☐ macOS (.app zip)                 │
│           ☑ Linux (.tar.gz)  ☑ Android (.apk)  ☐ Play Store .aab / iOS (later)    │
│ App name [Neon Cat Heist]  ID [ng.degamed.neoncat]  Version [1.0.0]  Icon [▣ auto]│
│ Android signing ◉ New key (saved to your device)  ○ Use my keystore               │
│ Packaged in your browser · no queue · Creator: no splash          [Export ▸]     │
│ ─ Export ─ Windows ✓ ⬇   Linux ✓ ⬇   Android ⟳ signing APK… 62%                   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 5.10 Play page `/play/[slug]`
```
┌ ◆ degamed   Explore  Market                                       Log in ─────────┐
│ ┌──────────────────────────────── game ─────────────────────────────┐  Neon Cat   │
│ │                                                                    │  Heist      │
│ │                         (click to play)                            │  by @ada    │
│ │                                                                    │  ▶ 12.4k ♥ 981│
│ └─────────────────────────────────────── [⛶] [🔊] ───────────────────┘  [♥ Like]   │
│ [⑂ Remix] [Share] [</> Embed] [☕ Tip ₦/$]   ⬇ Windows · Android                    │
│ About · Controls · Made with: Python · Composer        More like this ▣ ▣ ▣ ▣      │
└────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.11 Settings → AI & keys `/settings/ai`
```
┌ Settings ─ Account · Editor · AI & Keys ● · Billing · Creator payouts · Danger ──┐
│ AI source   ◉ Use my own keys   ○ Degamed credits (64 left)  [Buy credits]        │
│ Anthropic   [sk-ant-••••••3f]  ✓ verified   Default model [Sonnet ▾]              │
│ Gemini      [AIza••••]          ✓ free tier                                       │
│ OpenAI      [ + add key ]       OpenRouter [ + add key ]                          │
│ 🔒 Keys are stored only in this browser and never sent to Degamed servers.        │
│ Lock with passphrase ☐                                                            │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 5.12 Other screens (same design language)
- **Pricing** `/pricing`: three plan cards with a NGN/USD toggle, a "What does BYOK mean?" explainer, FAQ
- **Checkout**: Paystack inline popup
- **Explore** `/explore`: filters (genre, style, language, platform) and a hover-to-preview grid
- **Marketplace** `/market` and item pages: preview in a sandbox, buy/get, ratings
- **Sell an item** flow
- **Creator dashboard** `/creator`: earnings chart, payouts (Paystack/Flutterwave bank setup), per-game plays and retention
- **Profile** `/u/[name]`
- **Docs** `/docs`: generated from the API spec with a JS/Python toggle on every example
- **Auth and onboarding**: experience level, preferred language, AI key or credits
- **System pages**: 404, error and loading states; on mobile the editor is Simple mode only

---

## 6. Repo layout
```
apps/web/              Vite + React app: marketing, auth, dashboard, new, editor/:id, play/:slug, explore,
                       market, creator, u/:name, settings, pricing, docs (public pages prerendered)
apps/api/              Hono Worker: ai/proxy, payments webhooks, builds, signed uploads, publish, OG images, cron
apps/play/             static sandbox host page for play mode (separate origin)
packages/api-spec/     single API definition → generators (.d.ts, Python pkg, docs, AI reference)
packages/engine/       ECS runtime on Phaser, Art Kit, Pyodide bridge, exporters
packages/py-degamed/   generated + hand-written Python `degamed` package
packages/audio/        Composer engine (synths, sequencer, FX, adaptive music, MIDI/WAV)
packages/editor-core/  project model, commands/undo, selection, versioning, esbuild-wasm bundler
packages/agent/        provider adapters, tools, loop (browser-side)
packages/payments/     PaymentProvider interface + Paystack + Flutterwave
packages/shared/       zod schemas
templates/             Tauri + Capacitor player shells; .github/workflows builds them once per engine release
supabase/migrations/   schema + RLS
examples/              gold-standard projects in JS and Python
```

---

## 7. Milestones
0. **High-fidelity clickable mockups** of all screens, published as a private page for your sign-off
1. **Foundation**: monorepo, design system, Supabase schema/RLS, auth and onboarding, app shell, landing page, deployed to Cloudflare free tier
2. **Engine core**: ECS runtime, scene format, play sandbox, JS `degamed`, Art Kit, web export
3. **API spec and Python**: generators, the Python `degamed` package, Pyodide bridge, Monaco support for both languages
4. **Pro editor**: docking, hierarchy, inspector, scene view and gizmos, undo, script editor, console, sprite editor, tilemap, animation
5. **AI agent**: BYOK adapters running in the browser, tools, diffs, auto-repair; then Simple mode
6. **Composer and SFX**: synths, sequencer, piano roll, drums, mixer, adaptive music, AI compose, uploads and MIDI import
7. **Projects and community**: dashboard, wizard, templates, versions, publish, play page, remix, explore, profile
8. **Monetization**: Paystack plans and credit packs, hosted AI proxy with metering, pricing page, marketplace, tips, creator payouts
9. **Native export**: player-shell templates (Windows, Linux, macOS, Android APK) and in-browser packaging plus APK signing
10. **Docs and polish**: docs site, security hardening, performance, SEO

---

## 8. Verification
- **Unit tests (Vitest)**:
  - Scene schema and the undo system, `edit_file`, the bundler
  - API-spec generators (snapshot tests on the `.d.ts` and `.pyi` output)
  - Composer sequencer timing
  - Credit ledger, plus the Paystack webhook signature check
- **Engine tests (headless Chromium)**: all `examples/` boot, render a non-blank canvas and run for 10 seconds without errors. The JS and Python versions of the same game behave the same after N fixed steps.
- **Audio**: render a song with OfflineAudioContext and check it isn't silent, that its length matches the BPM, and that there's no clipping. Round-trip a MIDI file through import and export.
- **End-to-end (Playwright, LLM mocked)**: sign up → wizard → build → inspector edit → Python edit → compose music → AI edit → accept the diff → publish → logged-out play → remix
- **BYOK**: a test confirms the key never shows up in any request to Degamed's servers (network interception in Playwright).
- **Payments**: Paystack test mode for a subscription, a credit pack, a tip and a marketplace sale, each checked to land in the ledger and earnings.
- **Native export**: templates build in CI. A Playwright test exports the example game to every target in the browser. A CI job launches the Linux build headless and installs the signed APK on an Android emulator to smoke-test it.
- **Security**: play-mode code cannot reach parent cookies, storage or the API; edit mode never runs scripts.
- **AI quality eval (`pnpm eval`)**: about 20 golden prompts × 2 languages, tracking boot rate, errors, FPS and screenshots.

## 9. Setup: your checklist comes first
**The first thing implementation produces is `docs/SETUP.md`**: a numbered, click-by-click checklist of every account, key and setting you need, and which environment variable or secret each value goes into. Nothing that needs a key gets wired up until you've had that list.

What the checklist will cover (all free tiers):
1. **Supabase**:
   - Create a project; copy the Project URL, anon key and service-role key
   - Turn on the Google provider (with "Skip nonce check" off)
2. **Google Cloud**:
   - Create an OAuth Client ID (Web) and set up the consent screen (app name Degamed, logo)
   - Add authorized JavaScript origins: `http://localhost:5173` and `https://degamed.pages.dev`
   - Paste the Client ID into Supabase and our env
3. **Cloudflare**:
   - Create an account
   - Pages project `degamed`, Pages project `degamed-play`, Worker `degamed-api`, R2 bucket `degamed-files` (with CORS rules)
   - Create an API token for deploys
4. **GitHub**: repository secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) so pushes deploy automatically
5. **Resend** (optional until you have a domain): API key
6. **Paystack** (needed only at the monetization milestone): business account, test secret and public keys, webhook URL
7. **Anthropic** (optional; only for selling hosted credits): API key, stored as a Worker secret
8. **Domain**: skipped for now. Everything runs on `*.pages.dev` and `*.workers.dev`, and adding a domain later is a five-minute change.

Every key goes in `.env.local` (template in `.env.example`) or a Cloudflare/GitHub secret. **No key is ever committed to the repo.**
