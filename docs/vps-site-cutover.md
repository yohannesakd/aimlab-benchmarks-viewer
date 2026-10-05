# Serving Aimlab without Vercel

The public request path is:

`https://aimlab-tracker.saibot.site` → Cloudflare HTTPS → existing `aimlab-api` tunnel → `127.0.0.1:5180` → `server/index.js`.

The viewer serves HTML, built JavaScript/CSS, fonts, images, verification files, robots, sitemap and the existing read-only APIs on one origin.
SSR reads the same server over loopback. The canonical site's DNS points directly to the Cloudflare tunnel.
Vercel serves static redirects to the canonical site and retains the Google verification file.
Application previews use the private VPS staging viewer. No new inbound port or credential is needed.

The tunnel template in `deploy/aimlab-api-tunnel.yml` preserves both API hostnames and adds only the canonical site. Its explicit origin host selects canonical production SEO. The same viewer remains noindex on the existing private Tailscale hostname. The private staging viewer at `https://vps.snapper-cod.ts.net:5194` remains the VPS preview; this migration does not expose a new public staging hostname.

## Deployment procedure

The owner authorized repair, migration, and production deployment on October 5, 2026. The following steps apply to this release.

1. Publish the scoped branch to `yohannesakd/aimlab-benchmarks-viewer`. Create a ready PR and merge after verification. The existing Vercel integration can start a deployment.
2. Activate the tested committed release for the existing production viewer and API user services. Keep the existing data directory, telemetry environment, collector services and private Tailscale endpoints.
3. Add `aimlab-tracker.saibot.site` → `127.0.0.1:5180` to the existing tunnel ingress with `httpHostHeader: aimlab-tracker.saibot.site`, then restart the existing tunnel connector. This makes the currently private viewer reachable through the public canonical hostname. No other hostname, wildcard, Access policy or port changes are included. Restarting the shared tunnel may briefly affect both existing public API hostnames.
4. Replace only the canonical site's existing Vercel CNAME with the proxied tunnel target `8657036f-19bd-4e43-b286-536f448c6987.cfargotunnel.com`. This moves production traffic and TLS termination to Cloudflare. Before writing, retrieve and save the full current Cloudflare record, including TTL/proxy settings; public DNS alone does not prove those settings. The verified public CNAME at preparation time was `66cf9b209ca81a78.vercel-dns-017.com`.

Use existing Cloudflare account authorization. The installed `cloudflared tunnel route dns` command supports the existing tunnel and an explicit overwrite flag, but this is a DNS mutation and must not be run as a preflight. No credentials are committed, printed or newly created.

## Release and checks

Build the committed VPS release on Node 24 with its recorded commit identity.
The VPS production build uploads source maps to PostHog through the existing private build environment, then removes them.
Isolated verification builds omit credentials and generate no maps. Vercel skips application builds and needs no PostHog build credentials.
Retain `dist`, `dist-ssr`, server/shared files and dependencies. Verify no source maps are present.
`server/index.js` serves robots according to the live canonical host and production environment.

Use an immutable release directory and atomically replace `runtime/current`. Keep a known-good complete-site release available for rollback. Restart the existing viewer and API only after the candidate passes isolated fixture tests and browser hydration. Do not restart collectors or trigger imports. Existing read-only API clients remain compatible.

Before activation, copy prior hashed assets into the new release's `dist/assets` without replacing current files. Exclude source maps. Preserve assets from the active VPS release and the former Vercel production build. Open browser sessions load route chunks lazily and need those files after deployment. Check an old route chunk through both `/assets/` and `/api/site-assets/` after activation.

Validate the candidate tunnel configuration without activating it:

```sh
cloudflared tunnel --config deploy/aimlab-api-tunnel.yml ingress validate
cloudflared tunnel --config deploy/aimlab-api-tunnel.yml ingress rule https://aimlab-tracker.saibot.site/home
```

After the approved cutover, verify public DNS resolves through Cloudflare and HTTPS has a valid certificate for the canonical hostname. Check the homepage, populated benchmark catalog/leaderboard, representative profile/task routes, redirects and query preservation, genuine 404s, sitemap/robots/verification files, all referenced static assets, same-origin APIs, hydration and console errors. Public HTML must return `X-Aimlab-Renderer: vps`; response and linked-resource URLs must not use Vercel. Confirm the existing API hostnames and private/staging endpoints still work.

Cloudflare's default static-file cache can honor immutable build assets. HTML caching may require a separately approved Cloudflare cache rule; do not assume Vercel's previous HTML cache behavior carries over. Application/API caches and response headers remain in effect. This migration adds no cache rule or bot/Access-policy change.

## Rollback

For a VPS application problem after DNS cutover, switch to the previously tested complete-site release and restart the viewer/API. That rollback retains Cloudflare → VPS routing and avoids Vercel quotas. Before exposing the canonical hostname, test the original viewer build with a canonical Host header for HTML, files, robots and APIs; if its robots file disallows crawling, it needs the tested complete-site server handler before becoming a rollback target.

Before rollback, copy the new release's hashed assets into the rollback release without replacing existing files. Exclude source maps. This preserves browser sessions opened after the deployment.

For a tunnel problem, restore the saved ingress file and restart the connector. Restore the saved canonical Cloudflare DNS record only if returning to Vercel is acceptable; Vercel's already exhausted quotas can make that fallback unavailable. Never claim a guaranteed quota-safe rollback solely because the old Vercel deployment still exists. Keep both application releases and tunnel/DNS snapshots until the cutover is verified.

Old immutable Vercel deployments can still use their original functions or rewrites.
The VPS retains `/api/pages` and `/api/site-assets` for those existing deployments during migration.
New Vercel deployments and legacy aliases redirect to the canonical VPS site.
Moving the canonical hostname does not reset team quotas or migrate unrelated projects.
