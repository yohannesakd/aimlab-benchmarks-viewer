import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { benchmarkSets, seasonModes, sortColumnsFor } from "./refresh-database.js";

const dataDir = resolve(process.env.AIMLAB_DATA_DIR || "data");
const pageSize = 25;
const openDatabases = new Map();

async function databaseFor(mode) {
  const path = resolve(dataDir, `${mode}.sqlite`);
  const file = await stat(path);
  let cached = openDatabases.get(mode);
  if (!cached || cached.modified !== file.mtimeMs) {
    cached?.database.close();
    const database = new DatabaseSync(path, { readOnly: true });
    cached = {
      database,
      modified: file.mtimeMs,
      total: database.prepare("SELECT count(*) AS total FROM players").get().total,
      generatedAt: database.prepare("SELECT value FROM metadata WHERE key = 'generatedAt'").get().value,
      categories: JSON.parse(database.prepare("SELECT value FROM metadata WHERE key = 'categories'").get().value),
    };
    openDatabases.set(mode, cached);
  }
  return cached;
}

export async function getLeaderboardPage(mode, page, sort) {
  if (!benchmarkSets[mode]) throw new RangeError("Unknown benchmark mode");
  if (!Number.isSafeInteger(page) || page < 1) throw new RangeError("Invalid page");
  const column = sortColumnsFor(mode)[sort];
  if (!column) throw new RangeError("Invalid sort");
  const { database, total, generatedAt, categories } = await databaseFor(mode);
  const pageCount = Math.ceil(total / pageSize);
  if (page > Math.max(1, pageCount)) throw new RangeError("Page is out of range");
  const rows = database.prepare(`
    SELECT username, overall, overall_rank, ${categories.map((_, index) => `c${index + 1}`).join(", ")},
      ${column} AS selected
    FROM players ORDER BY ${column} DESC, username ASC
    LIMIT ? OFFSET ?
  `).all(pageSize, (page - 1) * pageSize);
  return {
    mode,
    benchmarkSet: seasonModes[mode]?.definition.id || "legacy",
    generatedAt,
    total,
    page,
    pageSize,
    pageCount,
    players: rows.map((row) => ({
      username: row.username,
      overallPoints: row.overall,
      overallRank: row.overall_rank,
      selectedPoints: row.selected,
      subCategoryPoints: Object.fromEntries(categories.map((name, index) => [name, row[`c${index + 1}`]])),
    })),
  };
}

export async function handleLeaderboardRequest(request, response, pathname, searchParams) {
  const match = pathname.match(/^\/api\/leaderboards\/(ra|vt)\/(?:(legacy|aimlabs_s2|aimlabs_s3)\/)?(easy|medium|hard|novice|intermediate|advanced)\/page$/);
  if (!match) return false;
  const set = match[1] === 'vt' && (!match[2] || match[2] === 'legacy') ? 'aimlabs_s2' : match[2];
  const mode = `${match[1]}-${set && set !== 'legacy' ? set + '-' : ''}${match[3]}`;
  if (request.method !== "GET" || !benchmarkSets[mode]) {
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "Not found" }));
    return true;
  }
  try {
    const page = Number(searchParams.get("page") || 1);
    const sort = searchParams.get("sort") || "overall";
    const result = await getLeaderboardPage(mode, page, sort);
    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    });
    response.end(JSON.stringify(result));
  } catch (error) {
    const status = error instanceof RangeError ? 400 : error.code === "ENOENT" ? 503 : 500;
    if (status === 500) console.error(error);
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: status === 503 ? "Leaderboard is being prepared" : status === 400 ? error.message : "Leaderboard request failed" }));
  }
  return true;
}
