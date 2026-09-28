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

The private VPS site at [https://vps.snapper-cod.ts.net:5180/](https://vps.snapper-cod.ts.net:5180/) is the supported deployment. It requires access to the owner's tailnet. The older public Vercel site does not have the leaderboard API used by this version.

The Node server serves the built site and cached Revosect leaderboards. The refresh command fetches ten Aimlab leaderboard pages per request, at most two requests per second, and writes separate Hard and Medium snapshots. A failed refresh leaves the previous snapshot in place. Easy profile calculations work, but the Easy leaderboard has no snapshot: its first task alone has about 850,000 qualifying scores.

```sh
npm ci
npm run build
npm run refresh:leaderboards
npm start
```

The server listens on `127.0.0.1:5180` by default. Set `PORT` and `AIMLAB_DATA_DIR` to change the port and snapshot directory. The systemd user units in `deploy/` run from `/home/sai/apps/aimlab-viewer`, store snapshots in `/home/sai/.local/share/aimlab-viewer`, and refresh at 04:00 local time. The VPS exposes port 5180 through its private Tailscale Serve route.

## Analytics

The private [analytics dashboard](https://vps.snapper-cod.ts.net:5181/websites/101682cb-3775-497a-b68a-b59a22ad10a5) runs Umami 3.4.0 and PostgreSQL from `deploy/analytics/compose.yaml`. It records page visits, navigation, referrers, devices, and search outcomes without sending search terms or usernames. The dashboard and tracker are available only on the tailnet. Its database is stored at `/home/sai/.local/share/aimlab-analytics/postgres`; the deployed Compose file and private `.env` are in `/home/sai/apps/aimlab-analytics`. Run `docker compose up -d` there after updating the Compose file. The admin login is stored locally in `/home/sai/apps/aimlab-analytics/admin-credentials` with owner-only permissions. The backup timer in `deploy/analytics/` writes daily database dumps to `/home/sai/.local/share/aimlab-analytics/backups`. Analytics begins with this deployment; historical Vercel analytics are not copied into Umami.

The Revosect calculations use the [Aim Lab progression sheet](https://docs.google.com/spreadsheets/d/1JUTGiKU6u0csCWcmaMTof6Y2LNiZqLyCStH0OzzXYwI/edit?usp=sharing) for the benchmark set included in this repository.
