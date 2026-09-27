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

The Node server serves the built site and cached Revosect leaderboards. The refresh command fetches ten Aimlab leaderboard pages per request, at most two requests per second, and writes separate Hard and Medium snapshots. A failed refresh leaves the previous snapshot in place. Easy profile calculations work, but the Easy leaderboard has no snapshot: its first task alone has about 850,000 qualifying scores.

```sh
npm ci
npm run build
npm run refresh:leaderboards
npm start
```

The server listens on `127.0.0.1:5180` by default. Set `PORT` and `AIMLAB_DATA_DIR` to change the port and snapshot directory. The systemd user units in `deploy/` run from `/home/sai/apps/aimlab-viewer`, store snapshots in `/home/sai/.local/share/aimlab-viewer`, and refresh at 04:00 local time. The VPS exposes port 5180 through its private Tailscale Serve route.

The Revosect calculations use the [Aim Lab progression sheet](https://docs.google.com/spreadsheets/d/1JUTGiKU6u0csCWcmaMTof6Y2LNiZqLyCStH0OzzXYwI/edit?usp=sharing) for the benchmark set included in this repository.
