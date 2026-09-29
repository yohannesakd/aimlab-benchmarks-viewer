import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { handleLeaderboardRequest } from "./leaderboard-db.js";
import { handlePlayerRunsRequest } from "./player-runs.js";

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
};

function send(response, status, body, type) {
  response.writeHead(status, { "Content-Type": type });
  response.end(body);
}

const server = createServer(async (request, response) => {
  if (request.method !== "GET") {
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

  if (await handleLeaderboardRequest(request, response, pathname, searchParams)) return;
  if (await handlePlayerRunsRequest(request, response, rawPathname, searchParams)) return;

  if (pathname.startsWith("/api/")) {
    send(response, 404, "Not found", "text/plain");
    return;
  }

  const requested = resolve(distDir, `.${pathname}`);
  if (requested !== distDir && !requested.startsWith(`${distDir}${sep}`)) {
    send(response, 400, "Invalid path", "text/plain");
    return;
  }

  const spaRoute =
    pathname === "/" ||
    ["/home", "/profile", "/tasks", "/leaderboards", "/about"].some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    );
  const file = spaRoute ? resolve(distDir, "index.html") : requested;
  try {
    const body = await readFile(file);
    send(
      response,
      200,
      body,
      contentTypes[extname(file)] || "application/octet-stream"
    );
  } catch (error) {
    if (error.code !== "ENOENT") console.error(error);
    send(response, 404, "Not found", "text/plain");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Aimlab viewer listening on 127.0.0.1:${port}`);
});
