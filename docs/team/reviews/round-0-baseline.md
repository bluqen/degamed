# Round 0: baseline audit (the product before round 1 lands)

Critic, round 1. Shots: `docs/team/shots/critic/baseline/` (harness data in `report.json` / `summary.md` there; the journey and bundle runs are in `baseline/journey/` and `baseline/journey-and-build/`).

> **Caveat on light-theme shots.** The design agent's new `app.css` (light tokens) landed *while* the baseline was being captured. Shots from `pricing--phone-*` onward pick up those half-applied tokens, which is why some "light" shots show dark-on-dark text. The true baseline has **no light theme at all** (the landing light and dark shots are identical). The light-mode findings below are still valid as a warning: they show exactly what happens if tokens change while screens keep hard-coded hex colours.

## Verdict

The baseline is a competent engineer's editor with a space-themed marketing page in front of it. It fails the three things that matter: **you cannot get from the landing page to your own game at all**, **the game art looks like programmer art**, and **the product promises things that don't exist**. Fortunately the runtime is solid (60 fps, 0 console errors), so the bones are good.

| Bar item | Baseline | Target |
|---|---|---|
| Landing → my own game | **Never.** Dead end at `/new` step 3: "Create game" is disabled ("Saving projects needs Supabase"). 3 clicks spent, 0 games. | ≤ 60 s, ≤ 3 clicks |
| Console errors | 0 on every page | 0 |
| Player fps (headless) | 58–60 median | ≥ 58 |
| Web initial JS | **214 kB gzip** (index chunk 694 kB raw: Supabase + router + landing in one) | ≤ 170 kB |
| Editor chunk | 231 kB gzip | ≤ 400 kB |
| Player JS (play link) | **382 kB gzip / 1.46 MB raw** | ≤ 360 kB (Phaser alone is ~312–344 kB) |
| External hosts | fonts.googleapis.com + fonts.gstatic.com, 45 requests per run | own origin only |
| Light theme | none | full |
| Phone: game playable | **No.** No touch controls; game is a 390×200 strip | touch controls, full width |

## Ranked problems

### Must fix

1. **No path from idea to game.** `journey--desktop-05-step.png` (in `baseline/journey/`). Landing "Build my game" → `/new` wizard (Idea → Style → Setup) → "Create game" disabled behind Supabase. Why it matters: this *is* the product; every visitor bounces here. Fix (design + ai): landing prompt submits straight into generation with free instant mode, no account; saving happens locally (IndexedDB) and sign-in is offered only when sharing.
2. **Game art is programmer art.** `editor-simple--desktop-dark-game.png`. Smooth sine-curve mountains with a 1-px light outline (vector look), stock royal-blue sky with a dither band, purple ground filled with random speckle noise, grey mid layer with the same value as the green near layer (no depth), hero ~12 px tall on a 270-px screen (~4%), coins drawn as thin slivers on some frames, two cotton-ball clouds. No light, no fog, no particles, no foreground layer. Fix (art): see BAR §1; start with one theme (Rain Ruins) done to the bar rather than tweaking this one.
3. **Landing makes promises the product can't keep.** `landing--desktop-dark-full.png`: "Python scripting", "Export to Windows, macOS, Linux and Android", "Degamed Composer", "Gorgeous vector art: Crisp SVG sprites" (the opposite of the art direction), a "Play the demo" panel that is an empty purple glow until clicked, and a fake "AI Copilot" plan card. Fix (design): headline and sections about what's real: describe → play in seconds → change it by talking → share a link. Show a real game frame (autoplaying, muted) as the hero image.
4. **Pricing shows placeholders.** `pricing--desktop-dark-full.png`: "[₦ PRICE]/month" on two of three cards, "Upgrade with Paystack" on a product that has no paid features yet. Fix (design): hide Pricing from nav until there is a price; or show "Free while in beta" with BYOK and hosted-tier limits.
5. **Phone: the game can't be played.** `editor-simple--phone-dark-after-input.png`: a 390×205 strip, no touch controls, and the instruction "click the game to give it the keyboard" (there is no keyboard). Fix (engine): touch controls in the player; (design): full-width game, tap for full screen landscape.
6. **Developer copy shown to users.** `login--phone-dark.png`: "Add your Supabase and Google keys to apps/web/.env.local. The steps are in docs/SETUP.md." Same on `/new` step 3. Fix (design): never show env/setup text outside dev builds (`import.meta.env.DEV`); in production hide sign-in if unconfigured.

### Should fix

7. **Two competing primary buttons on the landing.** "Start creating" (header, filled brand) and "Build my game" (hero, filled brand) go to different places (`/login` vs `/new`). One primary action per screen. Fix: header becomes a quiet "Sign in"; the prompt box is the only primary.
8. **The `/new` wizard asks beginners to choose a script language** (Python/JavaScript radio) and an "art style" from 10 **palette swatches** (`journey--desktop-04-step.png`) that don't correspond to any real art. Fix: delete step 3; replace style swatches with 2–4 real theme screenshots, or drop the step and let the AI pick (with a "Try another look" chip afterwards).
9. **Phone header wraps to three rows** (`landing--phone-light.png`): logo; Explore/Pricing/Docs; Log in + Start creating. The prompt placeholder truncates to "A neon cyberpu". Fix: logo + menu button + one action; stack the prompt field over a full-width button on phone.
10. **Simple mode is still a panel wall** (`editor-simple--desktop-dark.png`): AI Copilot card that says the feature "arrives in the next update", Quick edit, Animations (knight/slime/coin file list, meaningless to a beginner), "Want full control?" upsell. Game area is letterboxed with ~110 px black bars top and bottom. Fix: game fills the stage; chat box under it; tweaks in a collapsible drawer; Advanced behind a single quiet button.
11. **Game starts with "Waiting for a game…" in monospace for ~1.5 s** (`editor-simple--desktop-dark.png`). Fix: show the theme's background art / a poster frame while booting.
12. **Pro mode** (`editor-pro--desktop-dark-after-input.png`) is a dense Godot-like layout (hierarchy of 46 "Cloud/Ground/Dirt" rows, properties with `assets/ba…` truncated selects, 22 text nodes under 12 px). Fine for Advanced, but it must be behind a door and restyled to the design system.
13. **Hard-coded hex colours everywhere** (`#121419`, `#1C1F28`, `#6B4EFF`… 58 in `editor/ui.tsx`, 52 in `PropertiesDock.tsx`, 30 in `EditorPage.tsx`). This is why any light theme breaks the editor. Fix (design): replace with tokens before turning light mode on for those screens.
14. **Google Fonts dependency** (45 requests/run, blocked offline, privacy and first paint). Fix: self-host 1–2 woff2 families (design has started this: `apps/web/public/fonts/`).
15. **Player bundle 382 kB gzip.** The play link must be light on phones. Fix (engine): check what's pulled into `apps/play` (Python runtime? code-editor libs? all templates?), lazy-load anything not needed to run a spec.

### Nice to have

16. A stray tiny blue glyph sits on the landing's left edge at y≈330 (`landing--desktop-dark-full.png`, x≈0). Probably a backdrop sprite clipped by the viewport.
17. The "fps" readout and "Running · click the game…" status bar are developer chrome in Simple mode; keep fps for Advanced only.
18. 404 page and Explore are reachable but empty; give 404 a "Make a game" button and hide Explore until the gallery exists.

## What's good (keep it)

- 0 console errors across 44 page loads; the player is stable at 58–60 fps headless.
- The landing hero composition (big type, prompt box, example chips) is the right idea; it just needs to submit somewhere real.
- Simple/Pro split already exists; it only needs the Studio treatment.
- Pixel-perfect integer scaling in the player; HUD font is a crisp bitmap font.
