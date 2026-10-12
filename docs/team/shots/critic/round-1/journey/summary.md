# QA run: round 1

Started 2026-10-12T07:20:54.784Z. Base http://localhost:5173.

**Result: FAIL (1)**, 0 warnings.

- FAIL contract [engine]: @degamed/engine/art is imported by apps/web/src/lib/game/index.ts, apps/web/src/lib/game/preview.ts but packages/engine/package.json has no "exports"["./art"]

## Pages

| page | viewport | theme | status | load ms | console errors | page errors | overflow | unnamed controls | tap < 40px | text < 12px | fps median | bg |
|---|---|---|---|---|---|---|---|---|---|---|---|---|

## Light/dark


## Journey: landing → playing my own game

- **desktop**: playing after 12.1s and 2 clicks (typed prompt: true; ended at /editor/gmv4xb0vjgu0t5h; API requests 0)
  - 0.0s landing (docs/team/shots/critic/round-1/journey/journey--desktop-00-landing.png)
  - 4.7s typed prompt (docs/team/shots/critic/round-1/journey/journey--desktop-01-typed.png)
  - 5.3s clicked "Make my game" → /editor/gmv4xb0vjgu0t5h (docs/team/shots/critic/round-1/journey/journey--desktop-03-step.png)
- **phone**: playing after 7.7s and 2 clicks (typed prompt: true; ended at /editor/gmv4xb8u6ueo4c7; API requests 0)
  - 0.0s landing (docs/team/shots/critic/round-1/journey/journey--phone-00-landing.png)
  - 2.0s typed prompt (docs/team/shots/critic/round-1/journey/journey--phone-01-typed.png)
  - 2.5s clicked "Make my game" → /editor/gmv4xb8u6ueo4c7 (docs/team/shots/critic/round-1/journey/journey--phone-03-step.png)

## Contracts between agents

- ok [art] packages/engine/src/art/index.ts exports ART_THEMES, getTheme, ArtTheme, SpriteSheet, SheetAnim
- ok [engine] packages/engine/src/kits/index.ts exports KITS, buildGame, readSpec, Kit, KitParam, GameSpec
- ok [engine] packages/shared/src/index.ts exports Environment, Light
- ok [ai] packages/ai/src/index.ts exports createGame, editGame, suggestions, availableProviders, ProviderId, AiSettings, Progress, ChatTurn
- ok [engine] @degamed/engine/kits: exported
- **FAIL** [engine] @degamed/engine/art is imported by apps/web/src/lib/game/index.ts, apps/web/src/lib/game/preview.ts but packages/engine/package.json has no "exports"["./art"]
- ok [design] apps/web → @degamed/ai: imported and declared
- ok [ai] packages/ai → @degamed/engine: imported and declared
- ok [engine] apps/play → @degamed/engine: imported and declared

## Hosts contacted

- localhost:5173: 232
- localhost:5174: 100

## Versus docs/team/shots/critic/baseline

- console + page errors: 0 → 0
- desktop journey: not reached → 12.1s/2 clicks
