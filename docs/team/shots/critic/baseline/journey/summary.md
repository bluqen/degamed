# QA run: round 0

Started 2026-10-12T01:07:10.471Z. Base http://localhost:5173.

**Result: FAIL (2)**, 0 warnings.

- FAIL journey/desktop: never reached a running game
- FAIL journey/phone: never reached a running game

## Pages

| page | viewport | theme | status | load ms | console errors | page errors | overflow | unnamed controls | tap < 40px | text < 12px | fps median | bg |
|---|---|---|---|---|---|---|---|---|---|---|---|---|

## Light/dark


## Journey: landing → playing my own game

- **desktop**: did NOT reach a running game (typed prompt: true; ended at /new?idea=a%20moody%20rain-soaked%20platformer%20where%20a%20little%20robot%20looks%20for%20its%20family; API requests 0)
  - 0.0s landing (docs/team/shots/critic/baseline/journey/journey--desktop-00-landing.png)
  - 3.3s typed prompt (docs/team/shots/critic/baseline/journey/journey--desktop-01-typed.png)
  - 4.9s clicked "Build my game" → /new?idea=a%20moody%20rain-soaked%20platformer%20where%20a%20little%20robot%20looks%20for%20its%20family (docs/team/shots/critic/baseline/journey/journey--desktop-03-step.png)
  - 35.3s clicked "Next" → /new?idea=a%20moody%20rain-soaked%20platformer%20where%20a%20little%20robot%20looks%20for%20its%20family (docs/team/shots/critic/baseline/journey/journey--desktop-04-step.png)
  - 65.8s clicked "Next" → /new?idea=a%20moody%20rain-soaked%20platformer%20where%20a%20little%20robot%20looks%20for%20its%20family (docs/team/shots/critic/baseline/journey/journey--desktop-05-step.png)
- **phone**: did NOT reach a running game (typed prompt: true; ended at /create; API requests 0)
  - 0.0s landing (docs/team/shots/critic/baseline/journey/journey--phone-00-landing.png)
  - 2.0s typed prompt (docs/team/shots/critic/baseline/journey/journey--phone-01-typed.png)
  - 2.6s clicked "Build my game" → /new?idea=a%20moody%20rain-soaked%20platformer%20where%20a%20little%20robot%20looks%20for%20its%20family (docs/team/shots/critic/baseline/journey/journey--phone-03-step.png)
  - 33.0s clicked "Next" → /new?idea=a%20moody%20rain-soaked%20platformer%20where%20a%20little%20robot%20looks%20for%20its%20family (docs/team/shots/critic/baseline/journey/journey--phone-04-step.png)
  - 63.4s clicked "Next" → /create (docs/team/shots/critic/baseline/journey/journey--phone-05-step.png)

## Hosts contacted

- localhost:5173: 256

## Versus docs/team/shots/critic/baseline

- console + page errors: 0 → 0
- desktop journey: 2.6s/0 clicks → not reached
