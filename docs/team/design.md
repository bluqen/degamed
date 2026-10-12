# Design log (apps/web)

## Round 1

### Done

**Design system** (`apps/web/src/app.css`, `apps/web/src/ui/`)
- **Tokens:**
  - colour, light and dark, as CSS variables (`--c-*`) exposed to Tailwind as `bg-surface`, `text-ink`, `border-line`, `bg-brand`, `text-brand-ink`, `bg-brand-tint` and so on;
  - elevation (`shadow-1..4`, `shadow-brand`);
  - radius (`xs`–`2xl`);
  - motion (`ease-standard` and `ease-emphasized`, 150/200/250 ms, plus `fade-in`, `rise`, `pop`, `shimmer` and `pulse-soft` animations, and `prefers-reduced-motion` support);
  - a type ramp (`caption` 12, `body-sm` 13, `body` 15, `body-lg` 17, `subtitle` 18, `title` 22, `title-lg` 30, `display` 44);
  - spacing on Tailwind's 4 px grid.
- **Theme:**
  - `index.html` resolves the theme before first paint (saved choice, else the system setting), and `lib/theme.tsx` keeps it in sync.
  - `ThemeToggle` offers Match my device / Light / Dark.
  - `dark:` follows `data-theme`, and `data-theme` can scope a subtree (the Play page is always dark).
- **Brand:** violet primary (`#6342f0` light / `#7457ff` dark, both AA with white text), cyan accent, and cool neutrals. The game stage is always dark so the art pops.
- **Type:** self-hosted variable fonts in `apps/web/public/fonts`, OFL, about 130 kB, so nothing depends on Google Fonts. Plus Jakarta Sans for UI, Bricolage Grotesque for headlines, JetBrains Mono for code. System fallbacks: Segoe UI Variable, system-ui.
- **Primitives:**
  - Button (primary, secondary, subtle, ghost, danger and inverse; sm/md/lg; icon and loading) and ButtonLink;
  - IconButton (with tooltip);
  - Field, Input, Textarea, Select;
  - Switch (role=switch), Slider (filled track, value text), Segmented (radio group);
  - Tabs (arrow keys, tabpanel ids), Card, Badge, Skeleton, EmptyState, Kbd;
  - Dialog (native `<dialog>`: focus trap, Esc, backdrop click);
  - Menu (keyboard, radio items), Tooltip (hover delay, focus-visible, Esc);
  - Toast (aria-live).
- **Advanced editor:** all ad-hoc hex colours in the old editor were mapped to tokens, so it follows both themes.

**Core flow**
- **Create** (`/create`, `pages/Create.tsx`):
  - a big "What do you want to play?" box with Surprise me, the provider in use, and Enter to make it;
  - example prompts;
  - "Your games" (saved on this device, with delete);
  - "Start from a look" theme cards with real art from the art agent's thumbnails;
  - "Kinds of game" from `KITS`.
- **Generating** (`components/Generating.tsx`):
  - driven by `createGame` `Progress` stages: a stepper with checks, a live message and a progress bar over cycling, softly blurred theme art;
  - Cancel (AbortSignal);
  - a friendly error state (Try again / Change my idea);
  - a minimum of 1.6 s so instant mode doesn't flash by.
- **Studio** (`/editor/:id`, `pages/Studio.tsx`, `studio/*`):
  - the game front and centre;
  - Chat with suggestion chips, Undo per change, provider `notice`s, and history kept per game;
  - Tune, generated from `Kit.params`: sliders in words (Very low … Very high), switches, and segmented or select choices, grouped by `group`, with Reset;
  - Look: switch theme with thumbnails;
  - top bar: inline-editable title, Saved state, Undo (also Ctrl+Z), Advanced (quiet), Appearance, Play, and **Share** as the one filled button;
  - phone layout: full-width game at the top, overlay controls, "Play full screen" with a landscape lock, and the panel below.
  - `/editor/demo` is the Studio with the demo game (Sunlit Meadow), built by the real kits.
- **Advanced** (`/editor/:id/advanced`):
  - the old engine editor, restyled and simplified;
  - the menu bar collapsed into one "Menu" button;
  - Hierarchy and Files merged into one tabbed dock ("Objects | Files");
  - the console hidden by default;
  - "← Studio" back link;
  - Simple/Pro mode removed;
  - a "needs a bigger screen" message on phones.
- **Play** (`/play/:id`) and **shared links** (`/p/:code`):
  - a clean always-dark player page with Remix and "Make your own" on shared links;
  - a phone layout with "Play full screen".
- **Share dialog:**
  - a short client-side recipe link (deflate-raw + base64url, about 87 characters for the demo), with old links still decoded;
  - Copy, Open, and `navigator.share` on phones;
  - honest copy when a game can't be shared yet.
- **Landing** (`/`), rebuilt around "Describe it. Play it. Share it.":
  - a prompt that goes straight to generating (`/create?prompt=…&go=1`) and prefetches Create on focus;
  - a live playable demo (the engine and kits load only when Play is pressed) with floating chat/Tune callouts;
  - How it works, a gallery of crafted pixel-art styles, interactive Tune controls, Free to start, and a final CTA;
  - a quiet header CTA so the hero has the one primary action.
- **Other pages:**
  - Pricing is "Free while we're in beta" (no placeholders);
  - Settings, Dashboard and ArtLab use a slim app header instead of the old sidebar;
  - the 404 page offers Make a game;
  - a route error boundary (`pages/RouteError.tsx`) shows "Something went wrong · Reload" in both themes.

**Contracts:**
- `apps/web/src/lib/game/index.ts` is the only adapter. It uses the real `@degamed/ai` (workspace dependency), `@degamed/engine/kits` (`KITS`, `buildGame`, `readSpec`) and `ART_THEMES` from `@degamed/engine/art`.
- `@degamed/engine/art` comes through a Vite alias + tsconfig `paths` bridge until the engine exports `./art`.

**Performance:**
- Every route except Landing and Pricing is lazy.
- Supabase loads after first paint and only when auth is configured.
- The landing page uses static thumbnails and no art or kit code.
- The initial load is about **162 kB gzip** (JS + CSS), down from 300.

**Tests:** 34 in apps/web, covering:
- the adapter and kits integration;
- share links (round trip, short links, old format, junk);
- Tune wording;
- titles;
- `timeAgo`;
- the editor tests, still green.

Screenshots are in `docs/team/shots/design/`, each at 1440×900 (`desktop`) and 390×844 (`mobile`), in `light` and `dark`:

| Screen | Files |
|---|---|
| Landing | `01-landing-*` (`01-landing-full-desktop-*` is the whole page) |
| Create | `02-create-*` |
| Generating | `03-generating-*` |
| Studio | `04-studio-*` |
| Studio, after a chat edit | `05-studio-chat-*` |
| Studio, Tune | `06-studio-tune-*` |
| Studio, Look | `07-studio-look-*` |
| Share dialog | `08-share-*` |
| Advanced | `09-advanced-desktop-*` |
| Demo in the Studio | `10-demo-studio-*` |
| Play page | `11-play-*` |
| A shared link opened in a fresh browser | `12-shared-link-desktop-light.png` |

### Next (round 2)
1. "Fix it" on the stage error banner, using `repairFromErrors` / `checkPlayable`. Also run `checkPlayable` before Share.
2. Wire the `degamed` hosted provider (`authToken` from the lazily loaded Supabase session) and add a provider picker in Settings, styled with the new primitives. Settings itself still needs a proper pass.
3. A first-play coach mark ("← → move, Space jump" fades after the first jump), and an end-of-level card ("Share your time / Remix") once the engine posts stats.
4. Phone controls under the game, once the engine's external touch layout lands.
5. Type-scale consolidation (critic asked for ≤ 6 sizes on the landing), and a design-system reference page (`/design`) for review.
6. Move drafts to IndexedDB (localStorage is about 5 MB, roughly 20–40 games with art).
7. Advanced, second pass:
   - make the scene canvas and code editor follow the light theme;
   - Inspector polish;
   - hide more rarely used tools.
8. Use Worker short links and per-game `og:` cards when the API offers them.

### Needs from others
- **engine:**
  - export `./art`;
  - a touch layout that puts controls outside the game;
  - drop units from param labels, or add `levels` words;
  - fill letterbox bars with the scene background;
  - post `level-end` stats to the host.
- **art:** smaller thumbnails (quantised, or `-small` variants), and a thumbnail for every new theme.
- **ai / api:**
  - `POST /share` + `GET /p/:id` with `og:` tags (KV) for real link previews;
  - guidance on the hosted `authToken` flow.

### Known issues
- The `og:image` is a relative URL; most scrapers need an absolute one (deploy domain), so per-game cards need the Worker.
- In Advanced, the scene canvas, rulers and code editor stay dark in light theme (a deliberate "stage" choice for now, but the rulers look heavy).
- The Play page in phone portrait still has empty space below the controls. It improves when the controls move out of the game.
- Changing Tune or Look rebuilds the game from its spec, so hand edits made in Advanced are replaced. The ai package replays chat code edits (`game.mods.json`), but Advanced edits aren't protected yet. Round 2: warn first.
- Dev only: while other agents edit engine or art files, Vite sometimes reloads pages mid-session, which shows as a `createRoot` warning. Production builds aren't affected.
- With swiftshader (headless), the player can take 5–10 s to show its first frame. Screenshots sometimes catch the "Loading the game…" pill over the poster art.
