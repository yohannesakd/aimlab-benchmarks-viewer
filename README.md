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

![Player Profile](./public/guide/player-profile.png)

## Task

Navigate to the Tasks Page and insert a task name to search

-   You can use **VT Threeshot Advanced** as an example.

![Task Search](./public/guide/task-search.png)

The Task is Presented as such, the option to launch Aimlab and play as well as watch replays of players on the leaderboard is presented aswell.

![Task Search](./public/guide/task-overview.png)

## Running on a VPS

The VPS site at [https://vps.snapper-cod.ts.net:5180/](https://vps.snapper-cod.ts.net:5180/) is private to the owner's tailnet. The public Vercel site uses the same leaderboard data through the read-only API at `aimlab-api.saibot.site`. `vercel.json` proxies only leaderboard requests to that API; other API paths are not exposed.

The Node server serves the built site and paged Revosect and Voltaic leaderboards. The refresh command collects Aimlab scores into a resumable SQLite staging database, calculates ranks using the same benchmark functions as player profiles, then atomically publishes one database per benchmark level. It keeps the previous published database if Aimlab fails. Large levels take longer to backfill; until one completes, its API returns 503 and the site shows an error.

```sh
npm ci
npm run build
npm run refresh:database
npm start
```

The private site listens on `127.0.0.1:5180` and is published through Tailscale Serve. The read-only API listens on `127.0.0.1:5182` and is published through its own Cloudflare Tunnel; its local configuration and credentials stay under `/home/sai/.cloudflared/`. The systemd user units in `deploy/` run from `/home/sai/apps/aimlab-viewer`, store databases in `/home/sai/.local/share/aimlab-viewer`, and refresh at 04:00 local time. The enabled `aimlab-easy-backfill.service` resumes the initial Easy crawl after a reboot and skips itself once the first Easy database is published. Set `AIMLAB_DATA_DIR` to use another data directory.

## Analytics

The private [analytics dashboard](https://vps.snapper-cod.ts.net:5181/websites/101682cb-3775-497a-b68a-b59a22ad10a5) runs Umami 3.4.0 and PostgreSQL from `deploy/analytics/compose.yaml`. It records page visits, navigation, referrers, devices, and search outcomes without search terms in custom events. Profile page URLs can contain player names. The public tracker host `aimlab-analytics.saibot.site` exposes only `/script.js` and `/api/send` through the Cloudflare Tunnel; the dashboard remains tailnet-only. Its database is stored at `/home/sai/.local/share/aimlab-analytics/postgres`; the deployed Compose file and private `.env` are in `/home/sai/apps/aimlab-analytics`. Run `docker compose up -d` there after updating the Compose file. The admin login is stored locally in `/home/sai/apps/aimlab-analytics/admin-credentials` with owner-only permissions. The backup timer in `deploy/analytics/` writes daily database dumps to `/home/sai/.local/share/aimlab-analytics/backups`. Vercel's available 30-day aggregate CSV exports are archived in `/home/sai/.local/share/aimlab-analytics/vercel-export-2026-09-28-30d/`; they cannot reconstruct historical Umami sessions.

The Revosect calculations use the [Aim Lab progression sheet](https://docs.google.com/spreadsheets/d/1JUTGiKU6u0csCWcmaMTof6Y2LNiZqLyCStH0OzzXYwI/edit?usp=sharing) for the benchmark set included in this repository.
