# Degamed

**Make stunning 2D games. Just describe them.**

Degamed is an AI-powered 2D game engine that runs in the browser. Describe a game and AI builds it. Then keep refining it with AI, or take over by hand in a professional editor:
- Scripting in **JavaScript or Python** through the `degamed` library
- Vector sprite editor
- **Degamed Composer** for music
- Export to the **web, Windows, macOS, Linux and Android**

## Repository layout

| Path | What it is |
|---|---|
| `apps/web` | The web app (Vite + React + Tailwind), hosted on Cloudflare Pages |
| `apps/api` | Small API (Hono on Cloudflare Workers): auth checks, keep-alive, and later payments and the AI proxy |
| `apps/play` | Sandboxed player that runs games with the engine, on its own origin |
| `packages/engine` | Degamed engine: entity/component runtime on Phaser 4, `degamed` scripting API, starter templates |
| `packages/art` | AI art pipeline: style catalog, image providers, sprite processing (cutout, pixelate, palettes) |
| `packages/shared` | Project format and editor ↔ player protocol (zod schemas) |
| `supabase/migrations` | Database schema with row-level security |
| `docs/SETUP.md` | **Start here**: every account and key you need, step by step |

## Getting started

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local      # fill in public values from docs/SETUP.md
cp apps/api/.dev.vars.example apps/api/.dev.vars  # secrets, never committed
pnpm dev                                          # web :5173 + game player :5174
pnpm dev:api                                      # optional, 2nd terminal: API :8787 (needs `wrangler login`)
```

The app runs without any keys. Sign-in and saving projects show a "setup needed" notice until Supabase is connected.

```bash
pnpm typecheck && pnpm test   # everything CI runs
```

## Deploying

Every push to `main` runs CI. Once the Cloudflare secrets from `docs/SETUP.md` step 4 are in place, it also deploys the web app, the API and the play sandbox to Cloudflare's free tier.

## Roadmap

1. ✅ Foundation: app shell, design system, Google sign-in, database, API, CI/deploy
2. 🚧 Engine core: ✅ entity/component runtime, sandboxed player, JavaScript `degamed` API, starter platformer, editor with live preview; ⏳ web export
   - ✅ AI art pipeline and Art Lab (pixel art and 12 other styles)
3. Python scripting through Pyodide
4. Pro editor: hierarchy, inspector, scene view, script editor
5. AI Copilot (bring your own key, or Degamed credits)
6. Composer and sound effects
7. Publishing, the play page and Explore
8. Paystack payments, the marketplace and creator payouts
9. Native export templates
10. Docs and polish
