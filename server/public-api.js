import { createServer } from "node:http";
import { handleLeaderboardRequest } from "./leaderboard-db.js";

const port = Number(process.env.PUBLIC_API_PORT || 5182);
const server = createServer(async (request, response) => {
  if ((request.url || "").length > 2048) {
    response.writeHead(414).end();
    return;
  }
  let url;
  try {
    url = new URL(request.url, "http://localhost");
  } catch {
    response.writeHead(400).end();
    return;
  }
  if (request.method === "GET" && url.pathname === "/healthz") {
    response.writeHead(200, { "Content-Type": "text/plain" }).end("ok");
    return;
  }
  if (await handleLeaderboardRequest(request, response, url.pathname, url.searchParams)) return;
  response.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
});
server.headersTimeout = 10000;
server.requestTimeout = 10000;
server.listen(port, "0.0.0.0", () => console.log(`Public Aimlab leaderboard API listening on ${port}`));
