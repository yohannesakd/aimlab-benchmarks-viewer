# Aimlab Stats Tracker

This is a simple website I created to track Profiles on [Aimlab](https://aimlab.gg)

In addition to tracking Profiles the website also provides stat tracking for [Voltaic](https://voltaic.gg) and [Revosect](https://revosect.com) Benchmarks

## How to use:

## Player Profile

Navigate to the Profile Page and insert a player's username (_case sensitive_)

-   You can use **VTSaibot** as an example.

![Search Profile](./public/guide/profile-search.png)

The Player's Profile is presented as such:
From here you can navigate to the [Voltaic](https://voltaic.gg) and [Revosect](https://revosect.com) Benchmarks Pages

Task cards open the best run in a modal; task names link to the scenario leaderboard. The modal also links to the player's run history. The history list shows score, accuracy, shot count, and date. Run details include performance statistics, duration, pause time, versions, and a replay link where available. Leaderboard and benchmark scores open the same modal. Solo history can contain different scenario settings; its count is not a count of comparable benchmark attempts.

Profile benchmark pages separate the benchmark set from difficulty. The selected set and difficulty stay in the URL. Voltaic Season 3 and the current Season 2 definitions use the official `energy-calculation` package on the VPS. Revosect Series 2 retains its verified sheet thresholds and calculation. Voltaic’s `legacy` public URL is an alias for official Aimlabs Season 2; it is not a separate set. The old `vt-novice`, `vt-intermediate`, and `vt-advanced` collector modes remain only for existing production archive jobs/artifacts until production promotion. Revosect Series 4 shows exact playlist scores and runs; ranks await verified Aimlabs requirements. The home difficulty links open the benchmark catalog. **Save profile** stores one shortcut in this browser; it does not verify account ownership.

![Player Profile](./public/guide/player-profile.png)

## Task

Navigate to the Tasks Page and insert a task name to search

-   You can use **VT Threeshot Advanced** as an example.

![Task Search](./public/guide/task-search.png)

The Task is Presented as such, the option to launch Aimlab and play as well as watch replays of players on the leaderboard is presented aswell.

![Task Search](./public/guide/task-overview.png)

## Data inventory

[Aimlabs API data inventory](./docs/aimlabs-data-inventory.md) records verified run, scenario, player, and replay fields, access limits, query examples, backend routes, and remaining processing work.

## Running on a VPS

The VPS site at [https://vps.snapper-cod.ts.net:5180/](https://vps.snapper-cod.ts.net:5180/) is private to the owner's tailnet. The production Vercel site uses the read-only API at `aimlab-api.saibot.site`. The staging Vercel preview uses `aimlab-staging-api.saibot.site` for benchmark leaderboards and all profile/task data. `vercel.mjs` selects the production API for `VERCEL_ENV=production` and the staging API otherwise. Set `AIMLAB_API_ORIGIN` to override the target explicitly. It proxies the `/api/leaderboards`, `/api/profiles`, `/api/tasks`, `/api/benchmarks`, and `/api/telemetry` namespaces.

The Node server serves the built site and paged Revosect and Voltaic leaderboards. The refresh command collects Aimlab scores into a resumable SQLite staging database, calculates ranks using the same benchmark functions as player profiles, then atomically publishes one database per benchmark season and level. It keeps the previous published database if Aimlab fails. Large levels take longer to backfill; until one completes, its API returns 503 and the site shows its collection status.

The VPS owns Aimlabs requests, profile aggregation, weighted averages, totals, and all benchmark rank, energy, point, and progress calculations. The browser renders the processed results. Read-only routes are:

- `GET /api/benchmarks/:community`: available sets and score requirements for `voltaic` or `revosect`.
- `GET /api/profiles/:username/lookup`: username and Aimlabs ranking.
- `GET /api/profiles/:username`: task summaries, totals, and results grouped by benchmark set.
- `GET /api/tasks/search?name=...` and `GET /api/tasks/:taskId`: search and task metadata.
- `GET /api/tasks/:taskId/leaderboard?page=...`: 25 scores per page, defaulting to normalized mode 0. Run links preserve `mode`; benchmark links supply `weapon` to preserve the benchmark score population when Aimlabs’ task default differs.
- `GET /api/tasks/:taskId/run?username=...&playId=...`: exact run details. Benchmark scores omit `playId` and supply `weapon` and `score`; overview cards also supply the best score’s normalized `mode`. The server checks that the run matches the displayed score and identity.
- `GET /api/profiles/:username/tasks/:taskId/runs?after=...`: 12 public solo plays per cursor page. Existing `?run=...` history links open the modal.

The API uses `api.aimlabs.com/graphql`, caches successful responses briefly, shares identical in-flight app-data, public-details, and run-history requests, caps upstream concurrency at four and responses at 1 MB, and pauses after provider rate limits. Only selected display fields leave the server; no signed replay files are downloaded. `publishedReplay` can expose a run anonymously by its ID, but many older runs are not published. Those modals use allowlisted leaderboard statistics. There is no full-leaderboard scan or unbounded history crawl.

`GET /api/profiles/:username/details` and `GET /api/tasks/:taskId/details` add public activity and scenario metadata from the current Aimlabs API. `GET /api/profiles/:username/activity` supplies yearly and recent active-day counts plus learning-plan totals when the Activity tab opens. These routes return selected display fields and cache them for one minute. Run history has a 45-second cache. Browser profile reentry makes a new request; tab changes reuse the dated snapshot. Failed refresh keeps the previous snapshot with its retrieval time. The profile and task views load their base data through the VPS as well.

Use Node 24 (also recorded in `.node-version`). Development uses the staging API at `http://127.0.0.1:5282` by default; set `AIMLAB_API_ORIGIN` to select another backend.

```sh
npm ci
npm run build
npm run refresh:database
npm start
```

The private site listens on `127.0.0.1:5180` and is published through Tailscale Serve. The production and staging read-only APIs listen on `127.0.0.1:5182` and `127.0.0.1:5282` and share a Cloudflare Tunnel; its live configuration and credentials stay under `/home/sai/.cloudflared/`. The staging API service runs from `/home/sai/aimlab-staging` and reads the published leaderboard databases. The staging season refresh units in `deploy/` collect Voltaic S3/S2 daily at 12:00, use the same refresh lock, and publish only complete difficulty tables. Production keeps its existing archive datasets until its own release. The production systemd user units in `deploy/` run from `/home/sai/apps/aimlab-viewer`, store databases in `/home/sai/.local/share/aimlab-viewer`, and refresh at 04:00 local time. The enabled `aimlab-easy-backfill.service` resumes the initial Easy crawl after a reboot and skips itself once the first Easy database is published. Set `AIMLAB_DATA_DIR` to use another data directory.

## Analytics

[PostHog EU](https://eu.posthog.com/project/289968) is the active analytics service for Vercel and the VPS. The personal project is **Aimlab Tracker**, on the free plan. Its [production dashboard](https://eu.posthog.com/project/289968/dashboard/987787) shares the same project as web analytics, errors, session replay, logs, and traces. Staging events carry `environment=staging`; production events carry `environment=production`.

Store `POSTHOG_PROJECT_TOKEN=phc_...` and `POSTHOG_HOST=https://eu.i.posthog.com` in the owner-only `/home/sai/.config/aimlab-viewer/posthog.env`. The systemd units read it. `/api/telemetry/config` supplies the public project token to the browser at runtime; personal API keys and OAuth credentials are never sent to the client. Without this file, analytics is disabled. Restart the relevant web/API services after changing configuration. Active collectors keep their existing configuration until their next run.

Captured data:

- One pageview per successful route change, referrers, devices, and web vitals.
- Search outcomes, benchmark/difficulty/sort changes, run opens/loads/failures, replay and task launch clicks, and saved-profile changes.
- API route templates, response status, processing duration, cache results, Aimlabs provider failures and rate limits, and request traces. Request and anonymous session IDs link browser failures to VPS logs.
- Collector batch sizes, rate-limit waits, checkpoint progress, completion, and failure. Scores, raw GraphQL queries, variables, provider response bodies, and replay manifests are excluded.

Query strings are removed from analytics URLs. Search terms and input values are excluded; inputs are masked in session replay. Public player names can appear in visited profile URLs and page content. Replay samples 20% of sessions. SDK queues, batches, request timeouts, and shutdown waits are bounded; analytics delivery never delays an API response. `posthog-node` is pinned because its tracing API is experimental. Delivery is best effort, not an audit trail. PostHog free retention differs by product; historical VPS archives remain separate.

The previous [Umami dashboard](https://vps.snapper-cod.ts.net:5181/websites/101682cb-3775-497a-b68a-b59a22ad10a5) remains an archive. Its frontend script and the Vercel Analytics SDK have been removed. Umami 3.4.0/PostgreSQL run from `deploy/analytics/compose.yaml`; live configuration and owner-only credentials are in `/home/sai/apps/aimlab-analytics`. The database is at `/home/sai/.local/share/aimlab-analytics/postgres`, and daily dumps remain indefinitely at `/home/sai/.local/share/aimlab-analytics/backups`. Existing Vercel aggregate CSV exports remain at `/home/sai/.local/share/aimlab-analytics/vercel-export-2026-09-28-30d/`. They cannot reconstruct sessions or be imported as new PostHog event history.

The Revosect calculations use the [Aim Lab progression sheet](https://docs.google.com/spreadsheets/d/1JUTGiKU6u0csCWcmaMTof6Y2LNiZqLyCStH0OzzXYwI/edit?usp=sharing) for the benchmark set included in this repository.

## Verification and publication

Run `npm test`, `npm run test:import`, and `npm run build`. Install the test browser with `npx playwright install chromium`, then run `npm run test:browser`. Browser tests serve the built site on loopback port 5294 and substitute only external data; they do not crawl Aimlabs or attach live databases. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` when using an existing Chromium installation.

[API contracts](server/api-contracts.js) document profile snapshots, ranked/scores-only sets and public runs. Calculations and legacy definitions live in `server/benchmark-calculations.js`, `server/benchmark-seasons.js`, and `server/benchmark-registry.js`; browser helpers contain presentation and links.

New publications record definition digest, calculation/data-format versions, collection identity/provider and collection start/finish times. Readers reject mismatched versioned publications with 503. Existing unversioned files remain readable when their recorded identity matches; their missing times/versions stay unknown. Enable `AIMLAB_REQUIRE_VERSIONED_DATA=1` only after all served datasets have versioned metadata. Legacy identity cannot establish every historical threshold or algorithm version.

To rescore retained data without an upstream crawl, use `node server/refresh-database.js --rescore <mode>` under the shared refresh lock. Start in a copied private data directory with `AIMLAB_DATA_DIR`; inspect it before publishing. Rescoring requires the same task order, normalized mode, weapon and collection cutoff. It preserves collection dates and raw scores, computes a separate file, and replaces the published file only on success. Keep a matching definition/database/artifact backup for rollback. Do not erase an incompatible active staging file; start a separate collection directory.

Bulk collection defaults to the existing legacy endpoint. The opt-in `--provider=trainer` adapter retains twenty 100-row pages, pacing, retry and score identity with a separate 8 MB response cap. A resumed collection cannot switch providers. Before changing jobs, finish the active backfill and run `flock -n /home/sai/.local/share/aimlab-viewer/refresh.lock node scripts/check-collector-parity.js <mode> [scenario-index]`. It compares one sequential batch per provider and reports payload sizes without persisting scores. A matching sample is necessary evidence, not proof of every full crawl. Use a separate data directory for the first Trainer collection; leave live jobs on legacy until reviewed.

Offset-based collection has no provider snapshot token. Collection start/finish times describe its observation window; local completion and atomic publication do not establish an exact point-in-time upstream population. Monitor this window and generation age before claiming exhaustive live standings.

## Analytics recovery

`deploy/analytics/restore-check.py <dump> --credentials <owner-only-file>` restores into disposable PostgreSQL 15 and Umami 3.4 containers on an internal network. It mounts no live volume, publishes no ports, copies existing app encryption keys privately, checks schema/heartbeat/admin login/authenticated websites, then removes its containers and temporary keys. The credentials file contains username and password on separate lines. The September 30 backup passed this rehearsal on 2026-09-30; this does not prove off-VPS recovery or every dashboard feature.

Daily backups remain on this VPS indefinitely; the script does not prune or transfer them. The owner selected this policy on 2026-09-30. Keep the private Compose `.env` and admin credentials available for restoration; a database dump cannot recreate those files. Required database/app/two-factor settings now fail Compose configuration if missing.

## Benchmark definitions and account linking

Run `npm run import:benchmarks` on the VPS to refresh definitions. Python 3 reads Voltaic’s public definition API and Revosect’s official playlist links, resolves the Revosect playlist packages through Aimlabs, then fetches every task’s identity, weapon, version, duration, and creator from `api.aimlabs.com/graphql`. It sends at most one GraphQL batch per second, bounds downloads, and stops on an upstream failure before replacing any definition. Signed package URLs are never saved. The committed snapshots record source and retrieval date; restart the server after a reviewed update.

[Voltaic’s energy utility](https://github.com/VoltaicHQ/energy-calculation) supplies interpolation, category caps, and harmonic aggregation. Version 1.0.1 floors some exact harmonic results one point too low (500 → 499 and 1000 → 999 in our threshold fixtures). The adapter corrects only values within floating-point tolerance of an integer. Tests cover every rank threshold, missing groups, capped categories, and top-tier extrapolation. Revosect’s newer KovaaK’s score sheets are not Aimlabs S4 requirements.

[Aimlabs’ OpenID configuration](https://auth.aimlab.gg/oauth/.well-known/openid-configuration) confirms authorization codes, S256 PKCE, and the `openid user.profile` scopes. On 2026-09-30, the signed-in account’s client-registry and client-registration requests returned `UNAUTHORIZED`; the account settings expose no developer-client registration. OAuth remains blocked on Aimlabs issuing a client under the owner’s existing API-access application. No other application’s client credentials are reused.

Registration details: **Aimlab Tracker**, authorization-code grant, code response, `openid user.profile`, S256 PKCE, and exact staging callback `https://vps.snapper-cod.ts.net:5194/api/auth/callback`. The callback is a proposed registration URL, not an implemented endpoint. Once issued, store credentials only in the VPS environment and implement code exchange, state/nonce checks, verified identity, and private server sessions before enabling sign-in. Production and Vercel callbacks need their own exact approved URLs when supported.
