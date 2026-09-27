import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const port = Number(process.env.PORT || 5180);
const dataDir = resolve(process.env.AIMLAB_DATA_DIR || "data");
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
  try {
    pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  } catch {
    send(response, 400, "Invalid path", "text/plain");
    return;
  }

  if (pathname === "/healthz") {
    send(response, 200, "ok", "text/plain");
    return;
  }

  const leaderboardMatch = pathname.match(/^\/api\/leaderboards\/ra\/(hard|medium|easy)$/);
  if (leaderboardMatch) {
    try {
      const body = await readFile(resolve(dataDir, `${leaderboardMatch[1]}.json`), "utf8");
      const snapshot = JSON.parse(body);
      if (snapshot.mode !== leaderboardMatch[1] || !Array.isArray(snapshot.players)) {
        throw new Error("Invalid leaderboard snapshot");
      }
      response.setHeader("Cache-Control", "public, max-age=300");
      send(response, 200, body, "application/json");
    } catch (error) {
      console.error(error);
      send(response, 503, JSON.stringify({ error: "Leaderboard is unavailable" }), "application/json");
    }
    return;
  }
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
    send(response, 200, body, contentTypes[extname(file)] || "application/octet-stream");
  } catch (error) {
    if (error.code !== "ENOENT") console.error(error);
    send(response, 404, "Not found", "text/plain");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Aimlab viewer listening on 127.0.0.1:${port}`);
});
