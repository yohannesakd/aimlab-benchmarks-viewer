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

Each task card has **View runs**. The list shows score, accuracy, shot count, and date. Run details open in a modal, with performance statistics, duration, pause time, versions, and a replay link where available. Leaderboard and benchmark scores open the same modal. Solo history can contain different scenario settings; its count is not a count of comparable benchmark attempts.

Profile benchmark pages separate the benchmark set from difficulty. The selected set and difficulty stay in the URL. Voltaic Season 3 and the current Season 2 definitions use the official `energy-calculation` package on the VPS. Archived Season / Series 2 thresholds retain their original calculations and leaderboard identity. Revosect Series 4 shows exact playlist scores and runs; ranks await verified Aimlabs requirements. The home difficulty links open the benchmark catalog. **Save profile** stores one shortcut in this browser; it does not verify account ownership.

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

The VPS site at [https://vps.snapper-cod.ts.net:5180/](https://vps.snapper-cod.ts.net:5180/) is private to the owner's tailnet. The production Vercel site uses the read-only API at `aimlab-api.saibot.site`. The staging Vercel preview uses `aimlab-staging-api.saibot.site` for benchmark leaderboards and all profile/task data. `vercel.json` proxies the `/api/leaderboards`, `/api/profiles`, `/api/tasks`, and `/api/benchmarks` namespaces.

The Node server serves the built site and paged Revosect and Voltaic leaderboards. The refresh command collects Aimlab scores into a resumable SQLite staging database, calculates ranks using the same benchmark functions as player profiles, then atomically publishes one database per benchmark level. It keeps the previous published database if Aimlab fails. Large levels take longer to backfill; until one completes, its API returns 503 and the site shows an error.

The VPS owns Aimlabs requests, profile aggregation, weighted averages, totals, and all benchmark rank, energy, point, and progress calculations. The browser renders the processed results. Read-only routes are:

- `GET /api/benchmarks/:community`: available sets and score requirements for `voltaic` or `revosect`.
- `GET /api/profiles/:username/lookup`: username and Aimlabs ranking.
- `GET /api/profiles/:username`: task summaries, totals, and results grouped by benchmark set.
- `GET /api/tasks/search?name=...` and `GET /api/tasks/:taskId`: search and task metadata.
- `GET /api/tasks/:taskId/leaderboard?page=...`: 25 normalized scores per page.
- `GET /api/tasks/:taskId/run?username=...&playId=...`: exact run details. Benchmark scores omit `playId` and supply `weapon` and `score`; the server checks that the best run matches the displayed score.
- `GET /api/profiles/:username/tasks/:taskId/runs?after=...`: 12 public solo plays per cursor page. Existing `?run=...` history links open the modal.

The API uses `api.aimlabs.com/graphql`, caches successful responses briefly, shares identical in-flight app-data requests, caps upstream concurrency at four and responses at 1 MB, and pauses after provider rate limits. Only selected display fields leave the server; no signed replay files are downloaded. `publishedReplay` can expose a run anonymously by its ID, but many older runs are not published. Those modals use allowlisted leaderboard statistics and explain the missing detail. There is no full-leaderboard scan or unbounded history crawl.

`GET /api/profiles/:username/details` and `GET /api/tasks/:taskId/details` add public activity and scenario metadata from the current Aimlabs API. `GET /api/profiles/:username/activity` supplies yearly and recent active-day counts plus learning-plan totals when the Activity tab opens. These routes return selected display fields and cache them for one minute. The profile and task views load their base data through the VPS as well.

```sh
npm ci
npm run build
npm run refresh:database
npm start
```

The private site listens on `127.0.0.1:5180` and is published through Tailscale Serve. The production and staging read-only APIs listen on `127.0.0.1:5182` and `127.0.0.1:5282` and share a Cloudflare Tunnel; its live configuration and credentials stay under `/home/sai/.cloudflared/`. The staging API service runs from `/home/sai/aimlab-staging` and reads the published leaderboard databases. The production systemd user units in `deploy/` run from `/home/sai/apps/aimlab-viewer`, store databases in `/home/sai/.local/share/aimlab-viewer`, and refresh at 04:00 local time. The enabled `aimlab-easy-backfill.service` resumes the initial Easy crawl after a reboot and skips itself once the first Easy database is published. Set `AIMLAB_DATA_DIR` to use another data directory.

## Analytics

The private [analytics dashboard](https://vps.snapper-cod.ts.net:5181/websites/101682cb-3775-497a-b68a-b59a22ad10a5) runs Umami 3.4.0 and PostgreSQL from `deploy/analytics/compose.yaml`. It records page visits, navigation, referrers, devices, and search outcomes without search terms in custom events. Profile page URLs can contain player names. The public tracker host `aimlab-analytics.saibot.site` exposes only `/script.js` and `/api/send` through the Cloudflare Tunnel; the dashboard remains tailnet-only. Its database is stored at `/home/sai/.local/share/aimlab-analytics/postgres`; the deployed Compose file and private `.env` are in `/home/sai/apps/aimlab-analytics`. Run `docker compose up -d` there after updating the Compose file. The admin login is stored locally in `/home/sai/apps/aimlab-analytics/admin-credentials` with owner-only permissions. The backup timer in `deploy/analytics/` writes daily database dumps to `/home/sai/.local/share/aimlab-analytics/backups`. Vercel's available 30-day aggregate CSV exports are archived in `/home/sai/.local/share/aimlab-analytics/vercel-export-2026-09-28-30d/`; they cannot reconstruct historical Umami sessions.

The Revosect calculations use the [Aim Lab progression sheet](https://docs.google.com/spreadsheets/d/1JUTGiKU6u0csCWcmaMTof6Y2LNiZqLyCStH0OzzXYwI/edit?usp=sharing) for the benchmark set included in this repository.

## Benchmark definitions and account linking

Run `npm run import:benchmarks` on the VPS to refresh definitions. Python 3 reads Voltaic’s public definition API and Revosect’s official playlist links, resolves the Revosect playlist packages through Aimlabs, then fetches every task’s identity, weapon, version, duration, and creator from `api.aimlabs.com/graphql`. It sends at most one GraphQL batch per second, bounds downloads, and stops on an upstream failure before replacing any definition. Signed package URLs are never saved. The committed snapshots record source and retrieval date; restart the server after a reviewed update.

[Voltaic’s energy utility](https://github.com/VoltaicHQ/energy-calculation) supplies interpolation, category caps, and harmonic aggregation. Version 1.0.1 floors some exact harmonic results one point too low (500 → 499 and 1000 → 999 in our threshold fixtures). The adapter corrects only values within floating-point tolerance of an integer. Tests cover every rank threshold, missing groups, capped categories, and top-tier extrapolation. Revosect’s newer KovaaK’s score sheets are not Aimlabs S4 requirements.

[Aimlabs’ OpenID configuration](https://auth.aimlab.gg/oauth/.well-known/openid-configuration) confirms authorization codes, S256 PKCE, and the `openid user.profile` scopes. On 2026-09-30, the signed-in account’s client-registry and client-registration requests returned `UNAUTHORIZED`; the account settings expose no developer-client registration. OAuth remains blocked on Aimlabs issuing a client under the owner’s existing API-access application. No other application’s client credentials are reused.

Registration details: **Aimlab Tracker**, authorization-code grant, code response, `openid user.profile`, S256 PKCE, and exact staging callback `https://vps.snapper-cod.ts.net:5194/api/auth/callback`. The callback is a proposed registration URL, not an implemented endpoint. Once issued, store credentials only in the VPS environment and implement code exchange, state/nonce checks, verified identity, and private server sessions before enabling sign-in. Production and Vercel callbacks need their own exact approved URLs when supported.
