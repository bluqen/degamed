# Critic (Producer & QA) log

## Round 1

### Done
- **The bar:** `docs/team/reviews/BAR.md`. It has the five headline numbers, checklists for art, app UX, game feel, AI and running cost, a competitor scan and a "what makes it a hit" section.
- **Baseline audit:** `docs/team/reviews/round-0-baseline.md`.
  - Shots are in `docs/team/shots/critic/baseline/`.
  - The journey is in `baseline/journey/` and the bundles in `baseline/journey-and-build/`.
- **QA harness** in `e2e/`. Run it with `node e2e/run.mjs --round N`; output goes to `docs/team/shots/critic/round-N/`.
  - It covers pages × desktop/phone × dark/light and captures console and page errors.
  - It runs an a11y and layout audit: unnamed controls, overflow, tap targets, tiny text, fonts and backgrounds.
  - It records player fps and runs the landing → playing-my-own-game journey (time and clicks).
  - It measures web and play bundle sizes (built into a temp folder), checks contracts (`e2e/contracts.mjs`) and runs `pnpm typecheck`/`test`.
  - It compares each round against the previous one.
  - Flags: `--no-build`, `--no-journey`, `--only <ids|journey|build>`, `--out <dir>`.
- **Mid-round review:** `docs/team/reviews/round-1.md`, with ranked must-fix, should-fix and nice-to-have lists for art, engine, ai and design, plus contract mismatches (also posted on the BOARD).

### Next
- Round 2: rerun the harness, verify each must-fix with before/after shots, and do a greyscale value check of the themes.
- Add to the harness:
  - CPU ms per frame, once engine sends it;
  - an OG-tag check on play pages;
  - a share → open → remix journey;
  - a contrast check per theme.

### Needs from others
- engine: add `ms` and `quality` to the `{type:'fps'}` message. Post `poster` and `levelComplete` messages.
- coordinator: restart the web dev server if pages render blank (stale `art/tiles.ts` module at the end of round 1).

### Known issues
- Headless fps uses SwiftShader (software GL), so treat it as a relative canary, not phone truth.
- Baseline light-theme shots caught design's in-flight `app.css`. The true baseline had no light theme.
- The journey heuristics click the call to action nearest the prompt box. If the flow changes shape, update `CTA` in `e2e/run.mjs` or the page list in `e2e/pages.mjs`.
