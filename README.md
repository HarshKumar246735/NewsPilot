# NewsPilot

*Navigate the News. Know the World.*

A server-rendered news publication with an admin dashboard and an automatic SEO engine.
Write an article, press **Publish**: the URL slug, title, description, canonical link, Open Graph tags, structured data and sitemap entry are handled for you.

| Part | Where | Stack |
|---|---|---|
| Public website (server-side rendered) | `client/` | React 19, Vite, React Router, plain CSS files |
| Admin dashboard + article editor | `client/src/admin/` | same app, lazy-loaded, `noindex` |
| REST API | `server/` | Node 20+, Express 4, MongoDB Atlas via Mongoose |
| Automatic SEO engine | `server/src/seo/` | dependency-free, unit tested |
| Frontend hosting | `vercel.json`, `api/ssr.mjs` | Vercel (one serverless function renders every page) |
| API hosting | `render.yaml` | Render |
| Images | Cloudinary (signed direct uploads) | secrets stay on the API |

---

## 1. Run it locally

Requires Node.js 20 or newer.

```bash
npm run install:all            # installs server/ and client/ dependencies
```

**Option A: look at the design with fictional demo content (no database, no API)**
```bash
cd client && npm run dev       # http://localhost:5173  (demo banner, noindexed)
```

**Option B: the real thing (API + website + admin)**
```bash
# terminal 1: API on :4000 (uses an in-memory database unless MONGODB_URI is set)
cd server
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='choose-12+-characters' \
CLIENT_ORIGINS=http://localhost:5173 SITE_URL=http://localhost:5173 npm run dev

# terminal 2: website on :5173
cd client
API_URL=http://localhost:4000 npm run dev:api
```
Open http://localhost:5173/admin and sign in. (On Windows PowerShell set the variables with `$env:NAME="value"` first.)
With no `MONGODB_URI` everything is kept in memory and is lost on restart. Local image uploads work in development only; for real use configure Cloudinary.

There are **no default credentials**. The first admin is created from `ADMIN_EMAIL` / `ADMIN_PASSWORD` when the API starts (or with `npm run create-admin`), and the 32 default sections are created on first start.

## 2. Writing and publishing (what happens automatically)

1. **Articles → New article.** Write the headline and body in the editor (headings, lists, links, images, tables, quotes). Pick a category and author.
2. Open the **SEO** tab at any time. It analyses your text and shows: a generated SEO title and meta description, a slug suggestion, canonical URL, a search-result preview, a social-card preview, topic/keyword suggestions, internal-link suggestions (only real published articles), image alt-text prompts, a checklist (needs attention / optional / passed) and the JSON-LD that will be emitted.
3. Anything you type in an SEO field is kept as written; clear it to return to automatic.
4. **Publish now**, or **Schedule** for later (scheduled posts go live even if the server was asleep, and appear in the sitemap only once live).
5. Changing a published article's slug creates a permanent redirect from the old address automatically.

Suggestions are derived from your article's own text. They are **not** search-volume data, and nothing here predicts Google rankings, indexing or traffic.

**Roles:** *admin* (everything), *editor* (publish, homepage, comments, ads, redirects), *author* (own drafts; submit for review).

## 3. Environment variables

**API (`server/.env.example`)**

| Variable | Needed | Meaning |
|---|---|---|
| `MONGODB_URI` | production | Atlas connection string |
| `JWT_SECRET` | production | 32+ random characters |
| `SITE_URL` | production | your https domain |
| `CLIENT_ORIGINS` | production | browser origins allowed by CORS (usually `SITE_URL`) |
| `API_PUBLIC_URL` | recommended | this API's public URL (email links) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | first run | creates the first admin |
| `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` | for uploads | image hosting |
| `RESEND_API_KEY`, `MAIL_FROM` | optional | newsletter confirmation emails |

The API refuses to start in production with a missing/short secret, no database, a non-https `SITE_URL`, or a localhost CORS origin.

**Website (`client/.env.example`)**: `SITE_URL` (required), `API_URL` (the Render URL, no trailing path), `NP_DEMO` (leave empty).

## 4. Deployment

### a) MongoDB Atlas
1. Create a free cluster, a database user, and under *Network Access* allow Render's outbound IPs (or `0.0.0.0/0` while you test).
2. Copy the connection string into Render as `MONGODB_URI` (add a database name, e.g. `...mongodb.net/newspilot`).

### b) Cloudinary
Create a free account, then copy *Cloud name*, *API key* and *API secret* into Render. The browser uploads straight to Cloudinary using a signature minted by the API; the secret never reaches the browser.

### c) Render (API)
1. *New → Blueprint*, select this repository (`render.yaml` configures a Node web service in `server/`, health check `/health`).
2. Fill the `sync:false` variables. `JWT_SECRET` is generated for you.
3. After the first deploy, open `https://<your-api>.onrender.com/health`: it should say `"status":"ok","database":"mongo"`.
4. Remove `ADMIN_PASSWORD` from the environment once your admin exists.
Free instances sleep after inactivity; the first request after a nap is slow. Public pages are cached at Vercel's edge (`s-maxage=60, stale-while-revalidate=300`), and a 503 (not a broken page) is returned while the API wakes.

### d) Vercel (website)
1. *Add New → Project*, import the repository **root** (not `client/`). `vercel.json` sets the build command, output directory and the rewrite that sends every page to the SSR function.
2. Environment variables: `SITE_URL=https://www.yourdomain.com`, `API_URL=https://<your-api>.onrender.com`.
3. Deploy. Visit `/`, an article, `/sitemap.xml`, `/robots.txt` and `/admin`.
4. Then set `CLIENT_ORIGINS` on Render to the same `https://www.yourdomain.com` and redeploy the API.

### e) Custom domain, HTTPS, canonical domain
Buy the domain (GoDaddy or any registrar). In Vercel *Settings → Domains* add `www.yourdomain.com` and the apex, and follow the DNS records it shows (usually an A record for the apex and a CNAME for `www`). Vercel issues HTTPS certificates automatically. Make one host primary and redirect the other to it (Vercel does this when you mark one as the redirect target), and put that exact origin in `SITE_URL`: every canonical URL, sitemap entry and structured-data URL is built from it, never from the request host.

### f) Google Search Console and the sitemap
1. Add your site in Search Console. For the *HTML tag* method copy only the token from `content="…"` into **Admin → Settings → Search Console verification token**, save, then press Verify.
2. *Sitemaps → Add* `sitemap.xml`. Submitting a sitemap helps discovery; it does not guarantee indexing.
3. Check *Pages* and *Core Web Vitals* in Search Console after a few weeks of real traffic.

### g) AdSense, affiliate and sponsored content
- Apply for AdSense separately. Approval depends on Google's review; nothing here guarantees it.
- After approval: **Settings → Advertising**, enable AdSense and enter `ca-pub-…`, paste the `ads.txt` line (served at `/ads.txt`), then **Advertising** to create placements. Every placement is labelled *Advertisement* or *Sponsored* and reserves its space to avoid layout shift. Direct banners are plain `rel="sponsored"` links.
- AdSense and Google Analytics load **only after the visitor accepts** the cookie banner. For visitors in the EEA/UK/Switzerland Google requires a Google-certified consent management platform for AdSense; add one before serving ads there.
- Articles can be marked *Sponsored by…* or *Contains affiliate links*; readers see a disclosure.

### h) Newsletter email (optional)
Without a mail provider, signups are stored with a consent record and confirmed immediately. To require confirmation by email: verify a sending domain at resend.com, set `RESEND_API_KEY` and `MAIL_FROM`, and enable *Require email confirmation* in Settings.

## 5. Testing

```bash
npm test                # server (48) + client (36) tests, no network needed
```
| Suite | Covers |
|---|---|
| `server/test/seo.test.js` | the original 12 SEO-engine tests, unchanged |
| `server/test/seo-links.test.js`, `lib.test.js` | internal-link suggestions; password hashing, JWT, sanitiser vs. 26 XSS payloads, validator, limiter, image sniffing |
| `server/test/api.test.js` | auth, lockout, roles, input hardening, article lifecycle, scheduling, redirects, public API, sitemap data, uploads, newsletter, comments, ads, settings, audit |
| `client/test/logic.test.js` | routing, redirects, status codes, pagination SEO, head/canonical/JSON-LD, formatting |
| `client/test/ssr.test.js` | every route server-rendered with real React: one `<h1>`, no warnings, no dead links, escaping |
| `client/test/integration.test.js` | the real frontend renderer against the real API code: publish → crawler-visible HTML, sitemap, redirects, ads/consent, 503 when the API is down |
| `client/test/e2e/e2e.mjs` | **optional**, needs Playwright: 18 real-Chromium steps (hydration, navigation, search, mobile drawer, newsletter, admin login, writing/publishing an article, SEO panel, media upload, categories, settings, comments). Run `node test/e2e/e2e.mjs` (set `NP_GLOBAL_NODE_MODULES` to a `node_modules` folder that contains `playwright`, `sharp` and `typescript`) |

**Not covered by automated tests** (needs your accounts or tooling I did not have): real `npm install` / `vite build`, real Express and Mongoose against Atlas (tests use an Express-compatible harness and an in-memory store that share the same store interface), real Cloudinary and Resend calls, the Vercel and Render deployments, Lighthouse/Core Web Vitals, screen-reader testing. Run these once after deploying: view-source on an article (content and JSON-LD present), the Rich Results/Schema validator, PageSpeed Insights, and a keyboard-only pass.

## 6. SEO checklist you can verify yourself
- **View source** of any article: headline, byline, body, breadcrumbs, `<title>`, description, canonical, Open Graph and JSON-LD are all in the first HTML response.
- `/robots.txt` allows articles, blocks `/admin`, `/api/` and `/search`, and points to the sitemap. `/sitemap.xml` lists only published, indexable URLs (it becomes a sitemap index above 45,000 URLs).
- Unknown URLs return a real 404; renamed articles return a 301; `?page=1`, trailing slashes and upper-case paths 301 to the one canonical form; search results and the admin are `noindex`.
- If the API is unreachable the site answers 503 with `Retry-After`, which search engines treat as temporary.

## 7. Security notes
Passwords: scrypt. Sessions: signed JWT (8 h) re-checked against the user record on every request (deactivating a user or changing a password signs them out immediately). Login: per-IP and per-account rate limits, generic error messages. Every `/admin` endpoint is authorised on the server by role. Article HTML is sanitised on the server with a default-deny allowlist (no scripts, event handlers, `javascript:` URLs or arbitrary iframes). Request bodies are validated field by field and `$`-operator keys are rejected. CORS is an allow-list. Uploads are identified by magic bytes, renamed, and size-limited; Cloudinary uploads are signed with a format allow-list. CSV exports neutralise spreadsheet formulas. Secrets live only in environment variables.

## 8. Known limitations
- **Not implemented:** browser push notifications (needs a service worker and push provider; deliberately not faked), article revision history, a news sitemap (only worth adding if you qualify for Google News).
- No lockfiles are included (no package registry was reachable when this was built): run `npm install` once in `server/` and `client/` and commit the generated `package-lock.json` files.
- The rich-text editor uses the browser's `contentEditable` commands; the server sanitises its output. Rate limits and the scheduler's "last ran" state are per instance (fine for one Render instance).
- Search uses an escaped regular-expression scan. For tens of thousands of articles move it to Atlas Search.
- Fonts load from Google Fonts; self-host them for fewer third-party requests.
- Policy pages are general drafts. Have them reviewed (privacy, terms and cookies especially) before launch.

## 9. Troubleshooting
| Symptom | Likely cause |
|---|---|
| Website shows "temporarily unavailable" (503) | `API_URL` wrong, or the Render service is waking or down: check `/health` |
| Website shows "SITE_URL is not configured" / "API_URL is empty" (500) | missing Vercel environment variable |
| Admin login works but every call fails with CORS errors | `CLIENT_ORIGINS` on Render must equal the website origin exactly (scheme + host, no trailing slash) |
| "Refusing to start" on Render | the message lists exactly which variable is missing |
| Uploads disabled | Cloudinary variables not set on the API |
| Scheduled article not live | check the time zone of the scheduled time; it goes live on the next page view or timer tick after that moment |
