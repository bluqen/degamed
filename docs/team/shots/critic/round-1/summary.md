# QA run: round 1

Started 2026-10-12T01:37:51.634Z. Base http://localhost:5173.

**Result: FAIL (7)**, 10 warnings.

- FAIL login/desktop/light: 1 console/page errors, first: You are calling ReactDOMClient.createRoot() on a container that has already been passed to createRoot() before. Instead, call root.render() 
- FAIL settings/phone/dark: 1 console/page errors, first: You are calling ReactDOMClient.createRoot() on a container that has already been passed to createRoot() before. Instead, call root.render() 
- FAIL studio/desktop/dark: 1 console/page errors, first: You are calling ReactDOMClient.createRoot() on a container that has already been passed to createRoot() before. Instead, call root.render() 
- FAIL web initial 299.7 kB > 170.0 kB
- FAIL player JS 424.5 kB > 250.0 kB
- FAIL contract [engine]: @degamed/engine/art is imported by apps/web/src/lib/game/index.ts, apps/web/src/lib/game/preview.ts but packages/engine/package.json has no "exports"["./art"]
- FAIL pnpm typecheck failing in packages/engine
- warn studio/desktop/dark: fps median 10 (headless)
- warn studio/desktop/light: fps median 11 (headless)
- warn studio/phone/dark: fps median 10 (headless)
- warn studio/phone/light: fps median 9 (headless)
- warn advanced/desktop/dark: fps median 6 (headless)
- warn advanced/desktop/light: fps median 7 (headless)
- warn play-demo/desktop/dark: fps median 11 (headless)
- warn play-demo/desktop/light: fps median 7 (headless)
- warn play-demo/phone/dark: fps median 10 (headless)
- warn play-demo/phone/light: fps median 10 (headless)

## Pages

| page | viewport | theme | status | load ms | console errors | page errors | overflow | unnamed controls | tap < 40px | text < 12px | fps median | bg |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| landing | desktop | dark | 200 | 1253 | 0 | 0 | no | 0 | - | 0 |  | rgb(12, 12, 17) |
| landing | desktop | light | 200 | 1246 | 0 | 0 | no | 0 | - | 0 |  | rgb(246, 246, 249) |
| landing | phone | dark | 200 | 1241 | 0 | 0 | no | 0 | 8 | 0 |  | rgb(12, 12, 17) |
| landing | phone | light | 200 | 1195 | 0 | 0 | no | 0 | 8 | 0 |  | rgb(246, 246, 249) |
| create | desktop | dark | 200 | 1163 | 0 | 0 | no | 0 | - | 0 |  | rgb(12, 12, 17) |
| create | desktop | light | 200 | 1184 | 0 | 0 | no | 0 | - | 0 |  | rgb(246, 246, 249) |
| create | phone | dark | 200 | 1027 | 0 | 0 | no | 0 | 5 | 0 |  | rgb(12, 12, 17) |
| create | phone | light | 200 | 997 | 0 | 0 | no | 0 | 5 | 0 |  | rgb(246, 246, 249) |
| pricing | desktop | dark | 200 | 1271 | 0 | 0 | no | 0 | - | 0 |  | rgb(12, 12, 17) |
| pricing | desktop | light | 200 | 1395 | 0 | 0 | no | 0 | - | 0 |  | rgb(246, 246, 249) |
| pricing | phone | dark | 200 | 1216 | 0 | 0 | no | 0 | 5 | 0 |  | rgb(12, 12, 17) |
| pricing | phone | light | 200 | 1152 | 0 | 0 | no | 0 | 5 | 0 |  | rgb(246, 246, 249) |
| login | desktop | dark | 200 | 1166 | 0 | 0 | no | 0 | - | 0 |  | rgb(12, 12, 17) |
| login | desktop | light | 200 | 1174 | 1 | 0 | no | 0 | - | 0 |  | rgb(246, 246, 249) |
| login | phone | dark | 200 | 1339 | 0 | 0 | no | 0 | 1 | 0 |  | rgb(12, 12, 17) |
| login | phone | light | 200 | 1548 | 0 | 0 | no | 0 | 1 | 0 |  | rgb(246, 246, 249) |
| settings | desktop | dark | 200 | 1197 | 0 | 0 | no | 0 | - | 0 |  | rgb(12, 12, 17) |
| settings | desktop | light | 200 | 1341 | 0 | 0 | no | 0 | - | 0 |  | rgb(246, 246, 249) |
| settings | phone | dark | 200 | 1372 | 1 | 0 | no | 0 | 5 | 0 |  | rgb(12, 12, 17) |
| settings | phone | light | 200 | 2004 | 0 | 0 | no | 0 | 5 | 0 |  | rgb(246, 246, 249) |
| explore | desktop | dark | 200 | 1664 | 0 | 0 | no | 0 | - | 0 |  | rgb(12, 12, 17) |
| explore | desktop | light | 200 | 1599 | 0 | 0 | no | 0 | - | 0 |  | rgb(246, 246, 249) |
| explore | phone | dark | 200 | 1357 | 0 | 0 | no | 0 | 5 | 0 |  | rgb(12, 12, 17) |
| explore | phone | light | 200 | 960 | 0 | 0 | no | 0 | 5 | 0 |  | rgb(246, 246, 249) |
| studio | desktop | dark | 200 | 1002 | 1 | 0 | no | 0 | - | 0 | 10 | rgb(12, 12, 17) |
| studio | desktop | light | 200 | 1095 | 0 | 0 | no | 0 | - | 0 | 11 | rgb(246, 246, 249) |
| studio | phone | dark | 200 | 1886 | 0 | 0 | no | 0 | 13 | 0 | 10 | rgb(5, 5, 8) |
| studio | phone | light | 200 | 1390 | 0 | 0 | no | 0 | 13 | 0 | 9 | rgb(12, 12, 17) |
| advanced | desktop | dark | 200 | 2123 | 0 | 0 | no | 0 | - | 27 | 6 | oklab(0.258239 0.0213286 -0.0710209 / 0.7) |
| advanced | desktop | light | 200 | 1637 | 0 | 0 | no | 0 | - | 27 | 7 | oklab(0.948988 0.011499 -0.0245047 / 0.7) |
| advanced | phone | dark | 200 | 1371 | 0 | 0 | no | 0 | 0 | 0 | none | rgb(12, 12, 17) |
| advanced | phone | light | 200 | 2024 | 0 | 0 | no | 0 | 0 | 0 | none | rgb(246, 246, 249) |
| play-demo | desktop | dark | 200 | 1118 | 0 | 0 | no | 0 | - | 0 | 11 | rgb(5, 5, 8) |
| play-demo | desktop | light | 200 | 1250 | 0 | 0 | no | 0 | - | 0 | 7 | rgb(5, 5, 8) |
| play-demo | phone | dark | 200 | 1228 | 0 | 0 | no | 0 | 2 | 0 | 10 | rgb(5, 5, 8) |
| play-demo | phone | light | 200 | 1327 | 0 | 0 | no | 0 | 2 | 0 | 10 | rgb(5, 5, 8) |
| gallery (404) | desktop | dark | 200 | 1537 | 0 | 0 | no | 0 | - | 0 |  | rgb(12, 12, 17) |
| gallery (404) | desktop | light | 200 | 1470 | 0 | 0 | no | 0 | - | 0 |  | rgb(246, 246, 249) |
| gallery (404) | phone | dark | 200 | 1458 | 0 | 0 | no | 0 | 0 | 0 |  | rgb(12, 12, 17) |
| gallery (404) | phone | light | 200 | 1485 | 0 | 0 | no | 0 | 0 | 0 |  | rgb(246, 246, 249) |
| not-found | desktop | dark | 200 | 1360 | 0 | 0 | no | 0 | - | 0 |  | rgb(12, 12, 17) |
| not-found | desktop | light | 200 | 1322 | 0 | 0 | no | 0 | - | 0 |  | rgb(246, 246, 249) |
| not-found | phone | dark | 200 | 1390 | 0 | 0 | no | 0 | 0 | 0 |  | rgb(12, 12, 17) |
| not-found | phone | light | 200 | 1274 | 0 | 0 | no | 0 | 0 | 0 |  | rgb(246, 246, 249) |

## Light/dark

- landing/desktop: themes differ
- landing/phone: themes differ
- create/desktop: themes differ
- create/phone: themes differ
- pricing/desktop: themes differ
- pricing/phone: themes differ
- login/desktop: themes differ
- login/phone: themes differ
- settings/desktop: themes differ
- settings/phone: themes differ
- explore/desktop: themes differ
- explore/phone: themes differ
- studio/desktop: themes differ
- studio/phone: themes differ
- advanced/desktop: themes differ
- advanced/phone: themes differ
- gallery/desktop: themes differ
- gallery/phone: themes differ
- not-found/desktop: themes differ
- not-found/phone: themes differ

## Journey: landing → playing my own game

- **desktop**: playing after 12.1s and 2 clicks (typed prompt: true; ended at /editor/gmv4xb0vjgu0t5h; API requests 0)
  - 0.0s landing (docs/team/shots/critic/round-1/journey/journey--desktop-00-landing.png)
  - 4.7s typed prompt (docs/team/shots/critic/round-1/journey/journey--desktop-01-typed.png)
  - 5.3s clicked "Make my game" → /editor/gmv4xb0vjgu0t5h (docs/team/shots/critic/round-1/journey/journey--desktop-03-step.png)
- **phone**: playing after 7.7s and 2 clicks (typed prompt: true; ended at /editor/gmv4xb8u6ueo4c7; API requests 0)
  - 0.0s landing (docs/team/shots/critic/round-1/journey/journey--phone-00-landing.png)
  - 2.0s typed prompt (docs/team/shots/critic/round-1/journey/journey--phone-01-typed.png)
  - 2.5s clicked "Make my game" → /editor/gmv4xb8u6ueo4c7 (docs/team/shots/critic/round-1/journey/journey--phone-03-step.png)

(Re-measured after a harness fix; first pass clicked "Play" before the studio game had started.)

## Bundles (gzip)

- **web** (@degamed/web): initial 299.7 kB, all JS 515.6 kB, CSS 12.7 kB, total on disk 2363.8 kB, 16 files, built in 3.0s
  - assets/index-ClgMw9Kf.js: 957.1 kB raw, 287.0 kB gzip
  - assets/Editor-OJHZSN7r.js: 699.0 kB raw, 228.6 kB gzip
  - art/themes/rain-ruins.png: 152.4 kB raw, 152.4 kB gzip
  - art/themes/hollow-caverns.png: 142.6 kB raw, 142.6 kB gzip
  - art/themes/sunlit-meadow.png: 107.0 kB raw, 107.0 kB gzip
  - art/themes/ember-forge.png: 96.9 kB raw, 96.9 kB gzip
  - fonts/bricolage-grotesque-latin-wght-normal.woff2: 40.4 kB raw, 40.4 kB gzip
  - fonts/jetbrains-mono-latin-wght-normal.woff2: 39.5 kB raw, 39.5 kB gzip
- **play** (@degamed/play): initial 424.5 kB, all JS 424.5 kB, CSS 0.0 kB, total on disk 1588.2 kB, 3 files, built in 1.9s
  - assets/index-vZkSOf_q.js: 1586.7 kB raw, 424.5 kB gzip
  - _headers: 0.8 kB raw, 0.8 kB gzip
  - index.html: 0.7 kB raw, 0.5 kB gzip

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
- pnpm typecheck: **FAIL** packages/engine
- pnpm test: ok

## Hosts contacted

- localhost:5173: 6681
- localhost:5174: 767

## Versus docs/team/shots/critic/baseline

- console + page errors: 0 → 3
- desktop journey: 2.6s/0 clicks → 12s/3 clicks
