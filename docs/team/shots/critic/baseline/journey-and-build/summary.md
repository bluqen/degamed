# QA run: round 0

Started 2026-10-12T01:02:57.044Z. Base http://localhost:5173.

**Result: FAIL (2)**, 0 warnings.

- FAIL web initial 213.7 kB > 170.0 kB
- FAIL player JS 381.8 kB > 250.0 kB

## Pages

| page | viewport | theme | status | load ms | console errors | page errors | overflow | unnamed controls | tap < 40px | text < 12px | fps median | bg |
|---|---|---|---|---|---|---|---|---|---|---|---|---|

## Light/dark


## Journey: landing → playing my own game

- **desktop**: playing after 5.4s and 2 clicks (typed prompt: true; ended at /login; API requests 0)
  - 0.0s landing (docs/team/shots/critic/baseline/journey-and-build/journey--desktop-00-landing.png)
  - 3.2s typed prompt (docs/team/shots/critic/baseline/journey-and-build/journey--desktop-01-typed.png)
  - 4.7s clicked "Start creating" → /login (docs/team/shots/critic/baseline/journey-and-build/journey--desktop-03-step.png)
- **phone**: playing after 3s and 2 clicks (typed prompt: true; ended at /login; API requests 0)
  - 0.0s landing (docs/team/shots/critic/baseline/journey-and-build/journey--phone-00-landing.png)
  - 2.0s typed prompt (docs/team/shots/critic/baseline/journey-and-build/journey--phone-01-typed.png)
  - 2.6s clicked "Start creating" → /login (docs/team/shots/critic/baseline/journey-and-build/journey--phone-03-step.png)

## Bundles (gzip)

- **web** (@degamed/web): initial 213.7 kB, all JS 432.8 kB, CSS 11.4 kB, total on disk 1596.2 kB, 12 files, built in 2.7s
  - assets/Editor-Dlqiw7Js.js: 706.3 kB raw, 230.6 kB gzip
  - assets/index-BW9J1nmW.js: 694.0 kB raw, 202.3 kB gzip
  - fonts/bricolage-grotesque-latin-wght-normal.woff2: 40.4 kB raw, 40.4 kB gzip
  - fonts/jetbrains-mono-latin-wght-normal.woff2: 39.5 kB raw, 39.5 kB gzip
  - fonts/plus-jakarta-sans-latin-wght-normal.woff2: 26.7 kB raw, 26.7 kB gzip
  - fonts/plus-jakarta-sans-latin-ext-wght-normal.woff2: 21.2 kB raw, 21.2 kB gzip
  - assets/index-zqtXP9py.css: 53.1 kB raw, 11.4 kB gzip
  - fonts/OFL-plus-jakarta-sans.txt: 4.4 kB raw, 2.0 kB gzip
- **play** (@degamed/play): initial 381.8 kB, all JS 381.8 kB, CSS 0.0 kB, total on disk 1464.8 kB, 3 files, built in 1.4s
  - assets/index-Dgo7i_9C.js: 1463.3 kB raw, 381.8 kB gzip
  - _headers: 0.8 kB raw, 0.8 kB gzip
  - index.html: 0.7 kB raw, 0.5 kB gzip

## Hosts contacted

- localhost:5173: 112

## Versus docs/team/shots/critic/baseline

- console + page errors: 0 → 0
- desktop journey: 2.6s/0 clicks → 5.4s/2 clicks
