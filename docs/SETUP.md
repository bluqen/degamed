# Degamed: setup checklist

Every account, key and setting Degamed needs, in the order you need them.
Everything here is **free**. Do the steps marked **Now** first; the rest can wait until we reach that milestone.

> **Golden rule for keys**
> - 🟢 **Public** values (URLs, client IDs, publishable keys) are safe to share. You can paste them in chat or into `.env` files.
> - 🔴 **Secret** values (anything labelled *secret*, *service role* or *token*) go **only** into Cloudflare or GitHub secret settings yourself. Never paste them in chat, and never commit them.

| # | Service | Needed for | When |
|---|---|---|---|
| 1 | Supabase | Accounts and database | **Now** |
| 2 | Google Cloud | "Sign in with Google" without the supabase.co address | **Now** |
| 3 | Cloudflare | Hosting the app, API and play sandbox | **Now** |
| 4 | GitHub secrets | Automatic deploys on every push | **Now** (after #3) |
| 5 | Cloudflare R2 | Game files, music and uploads | Milestone 2 |
| 6 | Resend | Nicer sign-up emails | When you buy a domain |
| 7 | Paystack | Subscriptions, credits, tips and payouts | Milestone 8 |
| 8 | Anthropic | Selling hosted AI credits (BYOK works without this) | Milestone 8 |
| 9 | Domain | Professional address | Whenever you like |

---

## 1. Supabase (Now, about 5 minutes)
1. Go to <https://supabase.com> and **Sign up** (GitHub sign-in is easiest).
2. Click **New project**:
   - Name: `degamed`
   - Database password: click **Generate** and **save it somewhere safe** (a password manager).
   - Region: **West EU (London)**, or the closest to Nigeria that's offered (it's the fastest for Lagos).
   - Plan: **Free**.
3. When it finishes, open **Project Settings → API Keys**.
   - 🟢 Copy the **Project URL** (`https://xxxx.supabase.co`). It goes into `VITE_SUPABASE_URL`.
   - 🟢 Copy the **Publishable key** (`sb_publishable_…`; on older projects it's the **anon** key). It goes into `VITE_SUPABASE_PUBLISHABLE_KEY`.
   - 🔴 **Secret key** (`sb_secret_…`, or **service_role** on older projects). Don't copy it anywhere yet; step 3.6 puts it into Cloudflare.
4. Open **Authentication → URL Configuration**:
   - Site URL: `https://degamed.pages.dev`
   - Redirect URLs: add `http://localhost:5173/**` and `https://degamed.pages.dev/**`
5. Leave **Authentication → Providers → Google** for now; you finish it in step 2.6.

## 2. Google Cloud: Sign in with Google (Now, about 10 minutes)
This is the Kavedi trick. Degamed shows Google's own popup with **your** app name, then hands the result to Supabase (`signInWithIdToken`). Users never see `supabase.co`.

1. Go to <https://console.cloud.google.com> and sign in with the Google account that should own Degamed.
2. Use the project picker at the top: **New project**, name it `Degamed`, then **Create** and select it.
3. Go to **APIs & Services → OAuth consent screen** (also called **Google Auth Platform**) and click **Get started**:
   - **App name**: `Degamed`
   - **User support email**: your email
   - **Audience**: **External**
   - **Contact email**: your email, then **Create**
   - Under **Branding**, upload a logo (optional; you can add it later) and add **Authorized domain** `pages.dev` (later, your own domain).
4. Go to **Clients → Create client**:
   - Application type: **Web application**
   - Name: `Degamed web`
   - **Authorized JavaScript origins**: `http://localhost:5173`, `http://localhost`, `https://degamed.pages.dev`
   - **Authorized redirect URIs**: leave empty (the popup flow doesn't need one).
   - Click **Create**.
5. 🟢 Copy the **Client ID** (`…apps.googleusercontent.com`). It goes into `VITE_GOOGLE_CLIENT_ID`.
   🔴 You can ignore the client secret; it isn't used by this flow.
6. Back in **Supabase → Authentication → Providers → Google**:
   - Turn on **Enable Sign in with Google**.
   - **Client IDs**: paste the Client ID from step 5.
   - **Skip nonce checks**: leave this **off**. Degamed sends a proper nonce.
   - Click **Save**.
7. While the app is in **Testing**, only test users you add can sign in. When you're ready for the public, go to **Audience → Publish app**. (Basic sign-in scopes such as email and profile don't need Google's verification review.)

## 3. Cloudflare: hosting (Now, about 10 minutes)
1. Sign up at <https://dash.cloudflare.com/sign-up> (free plan).
2. 🟢 **Account ID**: open **Workers & Pages**; the Account ID is shown in the right sidebar (it's also in the dashboard URL). Copy it.
3. **API token for deploys**: go to **My Profile → API Tokens → Create Token → "Edit Cloudflare Workers"** template, then:
   - Add permission: **Account → Cloudflare Pages → Edit**
   - Account Resources: your account; Zone Resources: **All zones**
   - **Continue → Create Token**
   - 🔴 The token is shown once. It goes straight into GitHub in step 4.
4. You **don't** need to create the Pages projects or Worker by hand. The first deploy creates `degamed` (the app), `degamed-play` (the game sandbox) and `degamed-api` (the API).
5. After the first deploy, your URLs will be:
   - App: `https://degamed.pages.dev`
   - Play sandbox: `https://degamed-play.pages.dev`
   - API: `https://degamed-api.<your-subdomain>.workers.dev`

   If the name `degamed` is taken on Pages, we'll pick another one and you'll update the Google origins from step 2.4.
6. **Worker secrets** (after the first deploy): go to **Workers & Pages → degamed-api → Settings → Variables and Secrets → Add**, choose type **Secret**, and add:
   - 🔴 `SUPABASE_SECRET_KEY`: from step 1.3
   - 🟢 `SUPABASE_URL`: from step 1.3 (type *Text*)

## 4. GitHub secrets: automatic deploys (Now, about 2 minutes)
1. Open <https://github.com/bluqen/degamed>, then **Settings → Secrets and variables → Actions**.
2. Under **Secrets**, add:
   - 🔴 `CLOUDFLARE_API_TOKEN`: from step 3.3
   - 🔴 `CLOUDFLARE_ACCOUNT_ID`: from step 3.2
3. Under the **Variables** tab, add these. They are public, but CI needs them to build the app:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_GOOGLE_CLIENT_ID`
   - `VITE_API_URL`: the Worker URL from step 3.5 (add it after the first deploy)

## 5. Cloudflare R2: file storage (Milestone 2)
1. Go to **Cloudflare dashboard → R2 Object Storage**, then **Purchase R2 / Enable**. The free tier is 10 GB with free downloads.
   - ⚠️ Cloudflare **asks for a payment card** to enable R2, even though you won't be charged inside the free tier. If your card won't go through (some Naira cards are blocked for USD charges), tell me. Degamed can start on **Supabase Storage** (1 GB free) instead; the code uses one storage interface, so switching later is painless.
2. Create the bucket `degamed-files`. In **Settings → CORS policy**, allow `GET` and `PUT` from `https://degamed.pages.dev` and `http://localhost:5173`.
3. Nothing else to copy: the Worker reaches the bucket through a binding in `apps/api/wrangler.toml`.

## 6. Resend: email (when you have a domain)
Until then, Supabase's built-in email sends sign-up confirmations, with low limits. Google sign-in needs no email at all.
1. Sign up at <https://resend.com>, go to **Domains → Add domain**, and add the DNS records it shows (in Cloudflare DNS).
2. 🔴 Create an **API key**.
3. In **Supabase → Authentication → Emails → SMTP Settings**, enter:
   - Host `smtp.resend.com`, port `465`, user `resend`, password = the API key
   - Sender `hello@yourdomain`

## 7. Paystack: payments (Milestone 8)
1. Sign up at <https://dashboard.paystack.com/#/signup>, choose a **Registered business** or **Starter business** (an individual can start as Starter), and complete the compliance steps.
2. Go to **Settings → API Keys & Webhooks** (stay in **Test mode** at first):
   - 🟢 **Test Public Key** (`pk_test_…`) goes into `VITE_PAYSTACK_PUBLIC_KEY`
   - 🔴 **Test Secret Key** (`sk_test_…`) goes into a Worker secret named `PAYSTACK_SECRET_KEY`
   - **Webhook URL**: `https://degamed-api.<your-subdomain>.workers.dev/webhooks/paystack`
3. To accept dollar cards from outside Nigeria, ask Paystack support to **enable international payments**. Also confirm which currencies you can settle in (NGN, and USD if offered).
4. Go live: switch to **Live mode** and replace both keys with the `pk_live_…` / `sk_live_…` versions.

## 8. Anthropic: hosted AI credits (Milestone 8, optional)
BYOK users bring their own key, so this is only for selling Degamed credits.
1. Go to <https://console.anthropic.com>, then **Settings → API keys → Create key**.
2. 🔴 Add it as the Worker secret `ANTHROPIC_API_KEY`.
3. Set a **monthly spend limit** in **Settings → Limits** so a bug can't run up a bill.

## Bonus: a free Gemini key (recommended, 2 minutes)
This lets you try AI art straight away, without any server setup.
1. Go to <https://aistudio.google.com/apikey>, then **Create API key**.
2. In Degamed, open **Settings**, paste it next to **Google Gemini** and click **Save**. The key stays in your browser.
3. Open **Art Lab** and generate a sprite.

Hosted image generation (the "Degamed" option, for users without a key) runs on **Cloudflare Workers AI**. It needs no extra setup beyond step 3: `apps/api/wrangler.toml` already binds it, and the free tier covers about 10,000 neurons a day. Each user gets `ART_DAILY_LIMIT` (25) free images a day.

## 9. Domain (whenever you like)
1. Buy one, for example on **Cloudflare Registrar** (sold at cost, no markup) or Namecheap.
2. In **Workers & Pages → degamed → Custom domains**, add `degamed.yourdomain`. Do the same for `play.` and `api.`.
3. Add the new origins in Google (step 2.4) and Supabase (step 1.4).

---

## Local development files
| File | Holds | Committed? |
|---|---|---|
| `apps/web/.env.local` | 🟢 `VITE_*` public values | No (gitignored). Copy from `apps/web/.env.example` |
| `apps/api/.dev.vars` | 🔴 secrets for the local Worker | No (gitignored). Copy from `apps/api/.dev.vars.example` |

### What to send me
Only the 🟢 public values:
- Supabase Project URL
- Supabase publishable key
- Google Client ID
- Your Worker URL after the first deploy

I'll wire them up. All 🔴 secrets you enter yourself in Cloudflare and GitHub.
