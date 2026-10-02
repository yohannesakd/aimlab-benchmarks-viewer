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
  if (!["GET", "HEAD"].includes(request.method)) {
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
    send(response, 400, "Invalid path", "text/plain");
    return;
  }

  if (pathname === "/healthz") {
    send(response, 200, "ok", "text/plain");
    return;
  }
  const publicSite = process.env.AIMLAB_ENV === 'production' && isPublicHost(request.headers.host);
  if (!publicSite || pathname.startsWith('/api/')) response.setHeader('X-Robots-Tag', 'noindex, follow');
  if (pathname === '/robots.txt' && !publicSite) {
    send(response, 200, 'User-agent: *\nDisallow: /\n', 'text/plain; charset=utf-8');
    return;
  }

  if (handleTelemetryConfig(request, response, pathname)) return;

  if (await handleLeaderboardRequest(request, response, pathname, searchParams)) return;
  if (await handlePlayerRunsRequest(request, response, rawPathname, searchParams)) return;
  if (await handlePlayerAvatarRequest(request, response, rawPathname)) return;
  if (await handlePublicDetailsRequest(request, response, rawPathname)) return;
  if (await handleAppDataRequest(request, response, rawPathname, searchParams)) return;

  if (pathname.startsWith("/api/")) {
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
      const result = await renderPage(request.url, { apiOrigin: process.env.AIMLAB_API_ORIGIN || `http://127.0.0.1:${port}`, indexable: publicSite });
      response.writeHead(result.status, result.headers).end(request.method === 'HEAD' ? '' : result.body);
    } catch (error) {
      console.error('Page rendering failed', error.name);
      response.writeHead(503, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store', 'Retry-After': '60' }).end('Page temporarily unavailable.');
    }
    return;
  }
  const file = requested;
  try {
    const body = await readFile(file);
    if (pathname.startsWith('/fonts/')) response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    send(
      response,
      200,
      request.method === 'HEAD' ? '' : body,
      contentTypes[extname(file)] || "application/octet-stream"
    );
  } catch (error) {
    if (error.code !== "ENOENT") console.error(error);
    send(response, 404, "Not found", "text/plain");
  }
}));

installTelemetryShutdown(server);

server.listen(port, "127.0.0.1", () => {
  console.log(`Aimlab viewer listening on 127.0.0.1:${server.address().port}`);
});
