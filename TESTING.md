# Try Degamed on your computer

## 1. Install the tools (once)
- **Node.js 22 or newer**: download the LTS version from <https://nodejs.org> and install it.
- **pnpm**: in a terminal (PowerShell on Windows, Terminal on Mac), run:
  ```bash
  npm install -g pnpm
  ```

## 2. Start Degamed
In a terminal, inside the unzipped `degamed` folder, run:
```bash
pnpm install
pnpm dev
```
Then open **http://localhost:5173** in Chrome or Edge.

Leave the terminal open while you test. Press `Ctrl+C` in it to stop.

## 3. What to try

| Where | What to do |
|---|---|
| **Home page** `/` | Watch the space backdrop (move your mouse for parallax). Scroll down and press **Play the demo**. |
| **Demo editor** `/editor/demo` | Click the game first, then use the arrows or WASD to move and Space to jump. Collect coins, stomp slimes, reach the flag. |
| ↳ **Simple mode** | Drag **Run speed** and **Jump power**; the game reloads with the new values. |
| ↳ **Pro mode** | Edit `scripts/player.js` (try changing `jump: 330` to `jump: 600`) and press **Ctrl+S**. Break the code on purpose to see the error in the console. |
| **Pricing** `/pricing` | Toggle ₦ / $. |
| **New game** `/new` | Walk through the style picker. Saving projects needs Supabase (docs/SETUP.md). |
| **Art Lab** `/art` | Needs an image generator. See step 4. |

## 4. Free AI art (optional)
Gemini keys can't make images for free. Cloudflare Workers AI can:
1. Make a free account at <https://dash.cloudflare.com/sign-up>.
2. In a **second** terminal in the same folder, run:
   ```bash
   cp apps/api/.dev.vars.example apps/api/.dev.vars
   pnpm --filter @degamed/api exec wrangler login
   pnpm dev:api
   ```
   On Windows PowerShell, use `copy` instead of `cp`.
3. In Art Lab, choose **Cloudflare Workers AI (local dev, free)**, pick a style (try **16-bit Pixel Art**) and press **Generate**.

## Something wrong?
Copy the error from the terminal, or from the browser console (F12, then the Console tab), and send it to me.
