# Bible site (SvelteKit)

The landing page, privacy and support pages (`src/routes/(site)`), and the web reader at `/read`.

## Private owner setup

Production: **https://marks-private-bible.vercel.app/sign-in**, Vercel project
`dusseaudevs-projects/marks-private-bible`. Sign in with the same owner password configured locally.

This fork's web app requires email/password sign-in as `mark@dusseauand.com`. There is no signup,
email delivery, or password-reset link. Native apps are unchanged. Upstash Redis stores sessions
and request limits; a salted scrypt password hash stays in server configuration.

1. Use Node 22 and run `npm ci` in `site/`.
2. In the gitignored `site/.env.development.local`, set `UPSTASH_REDIS_REST_URL` to your Upstash
   **HTTPS REST** URL and `UPSTASH_REDIS_REST_TOKEN` to its write-capable token. A `redis://` connection
   string is not interchangeable with this REST URL.
3. Run `npm run auth:password` in your own terminal. Enter a password of 15–256 characters twice
   at the hidden prompts. The command saves `AUTH_PASSWORD_HASH` to that file with mode 600.
   Never put a password in shell arguments, chat, or a committed file.
4. Run `npm run dev`, open `/sign-in`, and sign in with the owner email and your password.

For an owned deployment, set the same three environment variables in the hosting secret settings;
transfer the generated hash privately. Use HTTPS, including preview deployments. Do not deploy
this private fork to the upstream project's domain. Missing configuration or a Redis outage denies
access; there is no development auth bypass. The public routes are sign-in/login, privacy, support,
and static assets. All application/API/data routes require a session.

Sessions expire after 12 hours and are revoked on **Settings → Data → Sign out**. Rotating the hash
with `auth:password` and restarting/redeploying invalidates old sessions. Redis stores only hashed
token lookup keys under `bible:auth:v1:session:*`, plus login attempt counters. Login allows five
attempts per address and 30 overall per 15 minutes; wait 15 minutes after a lockout. Do not flush a
shared Redis database to recover access. Password reset requires access to deployment configuration.

The private web reader needs online authentication. It removes the former reader service-worker
cache and disables HTML/CDN caching; its new service worker caches only a public offline notice.
Browser-local notes, imports, and backups remain on the device.
Signing out does not encrypt or delete those files. Export a backup before changing devices or origins.

Rollback: retain the last verified **authenticated** deployment and its environment configuration.
If this is the first private deployment, disable its public URL while repairing it; rolling back to
an older unauthenticated build would reopen access. No existing library data is migrated or deleted.

## Install on iPhone

Open [the private app](https://marks-private-bible.vercel.app/sign-in) in Safari. Choose **Share → Add to Home Screen**, leave **Open as Web App** on if shown, and tap **Add**. Launch Bible from that icon and sign in with the existing owner account. Installation help is also on the sign-in screen and under **Settings → Data**.

The installed app opens without browser tabs. It needs a connection to open private content and verify the session; without one it shows a reconnect screen. Backgrounding hides the reader until the session is checked again. Reconnection restores an already-open reader without discarding its editor. App updates offer **Reload to update** rather than refreshing while you are typing.

The reader supports portrait and landscape, safe-area insets, touch controls, and keyboard-aware panels. Browser tests cover Chromium and WebKit with 360×780, 390×844, 430×932, and 844×390 viewports. These emulate iPhone sizes; verify the actual Home Screen installation, software keyboard, notch/home indicator, text selection and touch feel on an iPhone 12 or newer before relying on hardware-specific behavior. Notes and highlights are local to the browser/app installation, not synchronized through Redis. Use **Settings → Data → Export** for backups.

## Landing page

- Download target + version: `src/lib/config.ts` (`DOWNLOAD_URL`, `VERSION`, `SITE_URL`).
- Names: `NAME` ("Bible") is the apps' name, in the headings and links that name them. `SITE_NAME` ("Simply My Bible") is the website's. Every page's title ends with it, and it is `og:site_name` and the WebSite's name in the JSON-LD.
- `/download` returns a 302 to `DOWNLOAD_URL` after authentication. Pages are rendered on request.
- Page metadata (title, canonical, Open Graph, Twitter, JSON-LD) lives in `src/routes/(site)/+page.svelte` and is built from `SITE_URL`. `static/robots.txt` repeats the origin.
- `/sitemap.xml` is a sitemap index of the files under `/sitemaps/` (`src/lib/read/seo/sitemap.ts`): the site's pages with the translations' and books' pages, each translation's chapters, the verse pages (in files of at most 40,000 URLs) and the topics' index and pages. Every entry's `lastmod` is the build's date.
- The demo under the hero is drawn in HTML, not recorded: `src/lib/demo/script.ts` is its timeline (chapters, captions, sound cues), `Scene.svelte` renders one moment of it, `Showcase.svelte` adds the controls and `sound.ts` synthesises the clicks with Web Audio.
- The feature cards are in `src/lib/cards/`, built from the app's UI pieces in `src/lib/app/` and the app's colours in `src/app.css` (`.app`).
- Scripture shown on the site lives in `src/lib/scripture.ts`. Use only public-domain text (KJV, WEB, BSB and the other built-in translations), never the online ones.
- Fonts: system fonts for the UI, and Literata for scripture, self-hosted from `static/fonts` (OFL). The only other origin the site loads from is the GitHub API, for the download count under the hero's button (`src/lib/DownloadCount.svelte`).
- Share image: `static/og.jpg` (1200x630) is rendered from `scripts/og/og.html`. Edit the template, then run `sh scripts/og.sh` (macOS, needs Google Chrome).

## Reader (`/read`)

The Mac app in the browser. [DECISIONS.md](../DECISIONS.md#web-the-core-in-webassembly-the-reader-in-the-dom) explains the design.

- `src/lib/read/wasm/` is bible-core compiled to WebAssembly by `scripts/build-web.sh` (from the repository root): `bible` for the reader and `bible_import` (with the importers) for the import worker. Both are committed; rebuild them after changing `crates/web` or what it uses of `crates/core`.
- Importing: `src/lib/read/imports.ts` picks or takes dropped files, talks to `import.worker.ts` (which runs `bible_import`), and stores imported translations in IndexedDB (`bible-read`) with their list in `localStorage`. `overlays/importer.svelte.ts` is the import sheet's state.
- `/read/onboarding.json` holds the first-visit screen's translation previews behind authentication. The first visit shows it unless the address names a translation.
- `src/lib/read/core.ts` wraps the module: on the server it reads the wasm and `data/translations/*.bbl` from disk (`node.ts`); in the browser it fetches them through authenticated `/translations/<id>.bbl` endpoints.
- Routes: `src/routes/read/+layout.server.ts` typesets the chapter with the default settings on authenticated requests; `/read` restores the saved place and names John 1 as its canonical URL.
- Plain pages have no app and no client-side JavaScript (`csr = false`). Each has its own layout (`+page@.svelte`) and `src/lib/read/seo/Frame.svelte` draws the frame. `/read/[translation]` lists a translation's books, `/read/[translation]/[book]` lists a book's chapters with each one's opening words, and `/read/[translation]/[book]/[chapter]/[verse]` shows a verse with the verses either side and the verse in every translation.
- Verse pages exist for the translations in `VERSE_PAGES` (`src/lib/read/seo/meta.ts`), the KJV, BSB and WEB. All seven would nearly double the build (DECISIONS.md has the numbers). The other translations' verses link to their place in the chapter (`#v16`).
- Titles, descriptions, canonical URLs, Open Graph and Twitter tags and the JSON-LD (a WebPage in the WebSite, with its breadcrumb trail) come from `src/lib/read/seo/` (`meta.ts`, `Meta.svelte`) for every reader page.
- The reader's places are real links, so search engines can follow them and a modified click opens a new tab. The reader handles a plain click itself (`ui/follow.ts`). They are the sidebar's books and chapters, the book picker, the translation menu, and a chapter navigation (`chrome/PageLinks.svelte`) that stays hidden until it has keyboard focus. Every verse of the chapter in the address has an `id` (`v16`).
- `/john/3/16` and `/john/3` redirect (308) to the verse's or the chapter's KJV page (`src/routes/[book=book]/[chapter=number]/[[verse=number]]`, served by a function).
- `/topics` lists the 50 topic pages. `/topics/<slug>` (`src/routes/topics/[slug]`) prints a topic's verses in the KJV and the BSB, each linked to its verse pages, and the related topics. Marketing's content is in `src/lib/topics/`: `build.mjs` turns `topics.src.mjs` into `topics.json`, and `validate.mjs` checks it (see the folder's `README.md`). The file holds references only. The pages take text from the core on authenticated requests. A verse page links to the topics that list its verse.
- `src/lib/read/app.svelte.ts` is the app's state and actions (the Mac's `App`); `Shell.svelte` is the window; `keyboard.ts` the shortcuts; `reader/` the continuous-scroll reader; the rest mirrors the Mac's components (`chrome/`, `sidebar/`, `overlays/`, `pages/`, `settings/`, `onboarding/`), drawn with the controls in `ui/`.
- Settings are the Mac's `Settings` (`settings.ts`), saved in `localStorage` with the study data (the core's JSON export) and up to a few automatic backups.
- Design tokens: `src/lib/read/tokens.css` is generated from `crates/app/assets/design-tokens.json` by `node scripts/tokens.js`. Fonts: `static/fonts/read/` is cut from the Mac app's Literata and Inter by `scripts/fonts.sh` (needs fonttools and brotli). Both outputs are committed.
- `src/service-worker/` registers at `/` in production. Its only Cache Storage entry is `/offline.html`; authenticated HTML, translations, API responses and SvelteKit data are always fetched from the network. An update waits for **Reload to update**, and obsolete public caches are removed on activation. If the browser evicts the offline cache, the worker still returns a minimal reconnect screen. Development mode does not register a worker; test the production build.
- The NLT is read live (`src/lib/read/nlt.ts`, `live.svelte.ts`). The translation menu offers it, and the reader asks `/api/nlt?ref=John+3` (`src/routes/api/nlt`, rules in `src/lib/server/nlt.ts`) for the chapter being read. The function calls Tyndale's API with `NLT_API_KEY`, which lives in Vercel's settings and never reaches the browser. The page keeps that one chapter in memory and shows Tyndale's credit line under it. `/read/nlt/<book>/<chapter>` shows the KJV page for the same chapter (`src/hooks.ts`) and isn't indexed. [TRANSLATIONS.md](../TRANSLATIONS.md) has the rules. In development, `NLT_API_KEY=TEST npm run dev` uses the API's anonymous access.
- Development: `npm run dev`, then <http://localhost:5173/read>. In development the reader takes the Mac's demo steps for screenshots, for example `/read/kjv/john/1?fixture&settings={"theme":"dark"}&demo=jump:jn 3:16;select:jn 3:16` (`src/lib/read/demo.ts`): `fixture` loads sample highlights, notes and bookmarks, `settings` overrides settings, and `demo` runs steps in order. `window.readApp` is the app.

## Passage study MVP

Select words or up to 30 verses in one chapter. The selection toolbar offers **Ask**, **Explain**,
**Define**, highlighting, and notes. The overflow menu adds **Simplify**, **History**, **Related**,
**Research** (Academic), **Testimonials**, and **Sermons** (YouTube), alongside the existing copy,
bookmark, sharing, comparison, and parallel-reading actions. **Go deeper**
opens a side folio (a bottom sheet on phones) with one list and All, History, Related, Academic,
Reflection, Testimonials, and Videos filters. Literary context belongs to Academic; related study
notes are supporting reading, not automatically historical facts. `/api/study`
returns the World English Bible passage and paragraph, passage-linked Aquifer notes, STEPBible
tagged words, a small reviewed historic commentary set, museum-linked historical records,
open-access paper metadata, and YouTube links. History separates documented artifacts from
generated claims; a contextual artifact does not verify every detail of the biblical account.
Academic shows journal articles, reports, preprints, dissertations, and book chapters as linked
publication metadata, not as conclusions ingested by the model. Videos show their duration; discovery searches for
short clips (under four minutes) and full videos (four minutes or longer). Search results are
matched from YouTube metadata, not transcripts. Testimonials are link-only public forum stories,
with exact passage matches before reviewed related themes. `CHEAPERINFERENCE_API_KEY` (preferred)
or `OPENAI_API_KEY` enables cited summaries and follow-up questions in development and deployment.
They remain on the server. The API also accepts a per-request key when no server key is configured;
it is not persisted. AI requests require durable global limits of 60/day and six per minute, shared across server instances.
Missing Redis, timeouts, exhausted limits, or failed budget checks deny inference; no provider call
is made, and local evidence remains available when the study request itself is allowed. Discovery notices distinguish
disabled, limited, failed, partial, and completed searches. Only completed empty searches report no
matches. Reviewed evidence remains visible. Generated claims retain the context/background labels
of their citations, and language study notes belong to Academic even when thematically related.
Displayed source excerpts retain their author, license, and evidence scope. Generated History
claims undergo a second model review that rejects doctrine, literary summaries and unsupported
certainty; the server also requires a verbatim supporting quote from an eligible cited source.
If that review fails, History claims are withheld with a notice while other study content remains.
This is evidence checking, not a guarantee that a source or model is historically infallible.

Optional server environment variables:

| Variable | Purpose |
|---|---|
| `EXA_API_KEY` | Discover additional links from an approved domain list. Search runs only when both Upstash variables below are set; per-reader and global daily limits apply. |
| `YOUTUBE_API_KEY` | Refresh reviewed video metadata and, with Upstash configured, search YouTube for passage-matched short and full videos. Results are cached for seven days. Search has per-reader and global daily limits. |
| `OPENALEX_API_KEY` | With Upstash configured, find open-access scholarly publication metadata through OpenAlex. Results are cached for seven days; no paper body is stored or sent to the AI provider. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Required for owner authentication and durable study/AI/discovery limits; also cache successful searches. Unavailable budget checks deny paid work. |

To rebuild the licensed data shards from pinned revisions, run
`python3 scripts/build-study-data.py` in this directory. See [data provenance](../LICENSES/README.md#web-passage-study-data).

The reviewed video, paper, archaeology, and historic commentary sets are sparse. YouTube and
OpenAlex searches add coverage when configured, but neither supplies a verified interpretation of
the passage. The app does not summarize video audio or claim a transcript exists.

## Objects in 3D (`/ark-of-the-covenant`)

- The Ark of the Covenant, built from its spec in `../objects/ark.json` ([objects/README.md](../objects/README.md)): every size, the verse it comes from, and whether the text gives it or the model chooses it. `node src/lib/objects/check.mjs` checks the spec against the core's KJV and BSB in CI.
- `src/routes/ark-of-the-covenant/` is the page: the answer first, the 3D viewer, the dimensions, every part with its KJV verses, a visible FAQ (also FAQPage JSON-LD), and links to every verse and chapter it cites. `verses.json` there holds the cited verses in every bundled translation, so the viewer's hotspots read in the reader's current translation (`lib/objects/texts.ts`); one imported into this browser is read through the core. `embed` is the viewer alone, for the Mac app.
- `src/lib/objects/Viewer.svelte` is the viewer: "Build from the text", the cubit toggle, See inside, Close-up, numbered hotspots and the parts list, and the rings' two readings. `scene.ts` draws it with three.js from the spec's numbers (`cherub.ts` is the cherubim's figure). It loads after the page paints and only where WebGL works; otherwise the page shows `static/ark-of-the-covenant/ark.jpg`. With reduced motion the build doesn't play by itself and nothing animates.
- three.js stays off every other page: only the viewer imports it.
- The reader puts a cube glyph after the first verse of each of the spec's sources (Exodus 25:10, 37:1) that links to the page (`lib/objects/glyphs.ts`).
- Images: `sh scripts/ark-og.sh` (with `npm run dev` running; macOS, Google Chrome) renders the model into `static/ark-of-the-covenant/ark.jpg` and the share image `og.jpg` (template `scripts/og/ark.html`).
- The Mac app keeps its existing bundled offline viewer. `scripts/app-web.mjs` expects the upstream public/prerendered build and must not be run against this private build.

## Building

- Requires Node >= 22.17 (SvelteKit 3). `.npmrc` sets `engine-strict`, so on a newer Node use `npm install --engine-strict=false`.
- `npm ci && npm run check && npm test && npm run build && npm run check:private-build` checks types, behavior, and the authenticated production output. Protected pages/data are not prerendered.
- `npm run test:e2e` runs desktop/mobile headless Chromium and mobile WebKit against the production build. Install local `redis-server`, `redis-cli`, and `openssl`, then `npx --no-install playwright install chromium webkit` first. The harness uses HTTPS with a disposable localhost certificate, disposable Redis and fixture credentials on ports 55141, 55143, and 56379; it never uses real provider keys. Certificate exceptions are confined to the test browsers. Tests cover real authentication, API denial, local evidence, categories, search notices, logout, PWA installation/update/offline behavior, responsive book navigation and note persistence. Interaction coverage also includes the passage toolbar/menu, collections, reading plans, translation imports/removal, image sharing, Settings and backups, search/comparison, onboarding, command/shortcut panels, public pages, and the Ark viewer. CI installs these prerequisites and retains browser artifacts only on failure.
- QA storage state is gitignored at `playwright/.auth/qa-user.json` (mode 600); browser failure artifacts are under `../.context/playwright-results`. No personal browser profile is used.
- Deploy only to a project owned by this fork's owner. The upstream Vercel configuration builds from `site/`; include files outside the root directory so `../data/translations` is available. Configure owner authentication before enabling the deployment URL. The upstream host-redirect adapter is disabled in this fork.
- For this private deployment, run `vercel pull --yes --environment=production --scope dusseaudevs-projects`, `vercel build --prod --scope dusseaudevs-projects`, and `npm run check:private-build` from `site/`, then deploy the verified artifact with `vercel deploy --prebuilt --prod --scope dusseaudevs-projects`. Keep Node 22 active. Build in an isolated copy if a dev server is running; include sibling `data/translations/` and `objects/`. The private-build check exercises Bible file loading from the actual function bundle root as well as checking for public static bypasses.
- Upstream migration reference (host redirect disabled in this private fork): the old address, bible.rasmic.xyz, brings each reader's library over (`static/move/`). A browser keeps each address's saved data apart, so the highlights, notes, bookmarks, settings and automatic backups a reader saved there (localStorage) stay there. The old address serves `move/out.html` at every path (`serveOldAddress` in `scripts/vercel-routes.js`, by host). It reads the library and opens `simplymybible.com/move/in.html` with it in the URL's fragment, which the browser never sends to a server; a library too big for one URL goes in 60,000-character pieces, the reader bouncing between the two addresses for each. `in.html` checks the pieces against the library's hash and merges it into what simplymybible.com already holds (`mergeStudy` in `move.js`: per verse, the later edit wins, and nothing is deleted). It keeps the study from before the merge as an automatic backup, remembers the hash so the same library never merges twice, and opens the page the reader asked for, where the reader says what came over (`lib/read/moved.ts`). A link to `in.html` that didn't come from the old address asks before merging. Imported translations' files (IndexedDB) stay behind: the reader names them, to import again. `bible.rasmic.xyz/#keep` downloads the old library as a JSON backup, for Settings › Data › Import Backup…. The old address's `/service-worker.js` is `move/sw.js`, which empties the reader's offline copy there and unregisters. All this runs only while the domain is attached to the project without a redirect (Vercel › Settings › Domains); with Vercel's redirect on, readers land on an empty library. `npm test` covers the merge and the whole hand-over between two addresses (`src/lib/move/move.test.ts`).

## Passage study release verification

Before releasing study changes, run the checks in **Building**, including the authenticated browser
suite against the production build. Confirm Mark 6:14–29 has no History rows when AI is disabled,
while its Academic sources remain available with licenses. Confirm a Scripture-only contextualize
guide answer does not appear as History, and related citations retain their background qualifier.

Verify the owned preview with its configured Redis and provider keys: sign in, select a passage,
open Go deeper, follow a History citation, and try Ask. Check source-only behavior when inference
is unavailable. Do not copy personal browser sessions or expose keys in screenshots or logs.
Generation and history review share a single 60-second provider deadline at most; discovery completes before inference, so allow
for both stages when checking host execution limits. Paid requests are bounded by six per minute,
60 study generations per day, and the model output token caps. Each allowed generation makes at
most two model calls (generation plus History review), each capped at 4,000 output tokens for
CheaperInference or 3,000 for OpenAI; the daily request limit is not a currency-denominated cap.

If study responses regress, remove the server AI key to serve local evidence while investigating,
or restore the last verified authenticated deployment as described under **Private owner setup**.
Verify unauthenticated APIs still return 401 after rollback and authenticated source-only study
still loads. Never roll back this private fork to an unauthenticated upstream build. No study data
migration is needed for these changes.

The dependency security regression tests enforce patched lockfile baselines for
[SvelteKit's server-only import guard](https://github.com/sveltejs/kit/security/advisories/GHSA-m9j8-jcmv-hp69),
[Vercel adapter route escaping](https://github.com/sveltejs/kit/security/advisories/GHSA-jf9x-2fg2-hx4w),
[Happy DOM module compilation](https://github.com/capricorn86/happy-dom/security/advisories/GHSA-834v-8h66-3h79),
[glob cancellation](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4), and
[minimatch pattern amplification](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249).
These guards prevent known vulnerable versions from returning; they do not replace future advisory review.
