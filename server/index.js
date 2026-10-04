import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { handleLeaderboardRequest } from "./leaderboard-db.js";
import { handlePlayerRunsRequest } from "./player-runs.js";
import { handleAppDataRequest } from "./app-data.js";
import { handlePublicDetailsRequest } from "./public-details.js";
import { handlePlayerAvatarRequest } from './player-avatar.js';
import { handleTelemetryConfig, instrumentRequest, installTelemetryShutdown } from './telemetry.js';
import { renderPage, isPublicHost } from './page-renderer.js';
import { SITE_ORIGIN } from '../shared/seo.js';

const port = Number(process.env.PORT || 5180);
const distDir = resolve("dist");
const contentTypes = {
  ".css": "text/css",
  ".html": "text/html",
  ".ico": "image/x-icon",
  ".js": "text/javascript",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function send(response, status, body, type) {
  response.writeHead(status, { "Content-Type": type });
  response.end(body);
}

const server = createServer(instrumentRequest(async (request, response) => {
  if ((request.url || '').length > 2048) {
    response.writeHead(414, { 'Cache-Control': 'no-store' }).end();
    return;
  }
  if (!["GET", "HEAD"].includes(request.method)) {
    response.setHeader('Allow', 'GET, HEAD');
    response.setHeader('Cache-Control', 'no-store');
    send(response, 405, "Method not allowed", "text/plain");
    return;
  }

  let pathname;
  let rawPathname;
  let searchParams;
  try {
    const url = new URL(request.url, "http://localhost");
    rawPathname = url.pathname;
    pathname = decodeURIComponent(url.pathname);
    searchParams = url.searchParams;
  } catch {
    response.setHeader('Cache-Control', 'no-store');
    send(response, 400, "Invalid path", "text/plain");
    return;
  }

  if (pathname === "/healthz") {
    send(response, 200, "ok", "text/plain");
    return;
  }
  const publicSite = process.env.AIMLAB_ENV === 'production' && isPublicHost(request.headers.host);
  if (request.headers.host === 'aimlab-tracker.vercel.app' && pathname !== '/googleb46c4e92b2751d24.html') {
    const target = new URL(request.url, SITE_ORIGIN);
    response.writeHead(308, { Location: SITE_ORIGIN + (target.pathname === '/' ? '/home' : target.pathname) + target.search, 'Cache-Control': 'public, max-age=3600' }).end();
    return;
  }
  if (publicSite) response.setHeader('Strict-Transport-Security', 'max-age=31536000');
  if (!publicSite || pathname.startsWith('/api/')) response.setHeader('X-Robots-Tag', 'noindex, follow');
  if (pathname === '/robots.txt') {
    response.setHeader('Cache-Control', publicSite ? 'public, max-age=300' : 'no-store');
    send(response, 200, publicSite ? `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n', 'text/plain; charset=utf-8');
    return;
  }

  if (handleTelemetryConfig(request, response, pathname)) return;

  if (await handleLeaderboardRequest(request, response, pathname, searchParams)) return;
  if (await handlePlayerRunsRequest(request, response, rawPathname, searchParams)) return;
  if (await handlePlayerAvatarRequest(request, response, rawPathname)) return;
  if (await handlePublicDetailsRequest(request, response, rawPathname)) return;
  if (await handleAppDataRequest(request, response, rawPathname, searchParams)) return;

  if (pathname.startsWith("/api/")) {
    response.setHeader('Cache-Control', 'no-store');
    send(response, 404, "Not found", "text/plain");
    return;
  }

  const requested = resolve(distDir, `.${pathname}`);
  if (requested !== distDir && !requested.startsWith(`${distDir}${sep}`)) {
    send(response, 400, "Invalid path", "text/plain");
    return;
  }

  if (!extname(pathname) || pathname === '/index.html' || ['/profile/', '/tasks/'].some(prefix => pathname.startsWith(prefix))) {
    try {
      const result = await renderPage(request.url, { apiOrigin: process.env.AIMLAB_API_ORIGIN || `http://127.0.0.1:${server.address().port}`, indexable: publicSite });
      response.writeHead(result.status, { ...result.headers, 'X-Aimlab-Renderer': 'vps' }).end(request.method === 'HEAD' ? '' : result.body);
    } catch (error) {
      console.error('Page rendering failed', error.name);
      response.writeHead(503, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store', 'Retry-After': '60' }).end('Page temporarily unavailable.');
    }
    return;
  }
  if (!Object.hasOwn(contentTypes, extname(pathname)) || pathname.split('/').some(part => part.startsWith('.'))) {
    response.setHeader('Cache-Control', 'no-store');
    send(response, 404, 'Not found', 'text/plain');
    return;
  }
  const file = requested;
  try {
    const body = await readFile(file);
    response.setHeader('Cache-Control', pathname.startsWith('/fonts/') || pathname.startsWith('/assets/')
      ? 'public, max-age=31536000, immutable' : publicSite ? 'public, max-age=300' : 'no-store');
    send(
      response,
      200,
      request.method === 'HEAD' ? '' : body,
      contentTypes[extname(file)] || "application/octet-stream"
    );
  } catch (error) {
    if (error.code !== "ENOENT") console.error(error);
    response.setHeader('Cache-Control', 'no-store');
    send(response, 404, "Not found", "text/plain");
  }
}));

installTelemetryShutdown(server);
server.headersTimeout = 10000;
server.requestTimeout = 10000;

server.listen(port, "127.0.0.1", () => {
  console.log(`Aimlab viewer listening on 127.0.0.1:${server.address().port}`);
});
