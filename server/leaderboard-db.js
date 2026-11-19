import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { benchmarkSets, seasonModes, sortColumnsFor } from "./benchmark-registry.js";
import { validatePublication } from './benchmark-publication.js';

const dataDir = resolve(process.env.AIMLAB_DATA_DIR || "data");
const pageSize = 25;
const openDatabases = new Map();

async function databaseFor(mode) {
  const path = resolve(dataDir, `${mode}.sqlite`);
  const file = await stat(path);
  let cached = openDatabases.get(mode);
  if (!cached || cached.modified !== file.mtimeMs) {
    const database = new DatabaseSync(path, { readOnly: true });
    let replacement;
    try {
      const metadata = Object.fromEntries(database.prepare('SELECT key, value FROM metadata').all().map(row => [row.key, row.value]));
      replacement = {
        database,
        modified: file.mtimeMs,
        provenance: validatePublication(mode, metadata, process.env.AIMLAB_REQUIRE_VERSIONED_DATA === '1'),
        total: database.prepare('SELECT count(*) AS total FROM players').get().total,
        generatedAt: metadata.generatedAt,
        categories: JSON.parse(metadata.categories),
        // Databases built before this index existed are skipped by name lookups, because a full scan blocks the server.
        nameLookup: database.prepare("SELECT 1 FROM pragma_index_list('players') WHERE name = 'players_username_nocase'").get()
          ? database.prepare('SELECT username FROM players WHERE username = ? COLLATE NOCASE LIMIT 1') : null,
      };
    } catch (error) { database.close(); throw error; }
    cached?.database.close();
    cached = replacement;
    openDatabases.set(mode, cached);
  }
  return cached;
}

export async function getLeaderboardPage(mode, page, sort) {
  if (!Object.hasOwn(benchmarkSets, mode)) throw new RangeError("Unknown benchmark mode");
  if (!Number.isSafeInteger(page) || page < 1) throw new RangeError("Invalid page");
  const columns = sortColumnsFor(mode);
  if (!Object.hasOwn(columns, sort)) throw new RangeError("Invalid sort");
  const column = columns[sort];
  const { database, total, generatedAt, categories, provenance } = await databaseFor(mode);
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
    provenance,
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
    const status = error instanceof RangeError ? 400 : error.status === 503 || error.code === "ENOENT" ? 503 : 500;
    if (status === 500) console.error(error);
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: status === 503 ? "Leaderboard is being prepared" : status === 400 ? error.message : "Leaderboard request failed" }));
  }
  return true;
}

// Best collected leaderboard score for each benchmark task, across every published database, for one player.
export async function getPlayerLeaderboardScores(userId) {
  const best = new Map();
  let collectedAt = null;
  for (const mode of Object.keys(benchmarkSets)) {
    let opened;
    try { opened = await databaseFor(mode); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    if (!collectedAt || opened.generatedAt < collectedAt) collectedAt = opened.generatedAt;
    for (const row of opened.database.prepare('SELECT scenario, score FROM scores WHERE user_id = ?').all(userId)) {
      const bench = benchmarkSets[mode][row.scenario];
      const key = `${bench.id}\0${bench.weapon}`;
      if (!(best.get(key)?.score >= row.score)) best.set(key, { id: bench.id, name: bench.name, weapon: bench.weapon, score: row.score });
    }
  }
  return { collectedAt, scores: [...best.values()] };
}

// The collected spelling of a username, ignoring letter case, or null when no indexed database lists it.
export async function findCollectedUsername(name) {
  for (const mode of Object.keys(benchmarkSets)) {
    let opened;
    try { opened = await databaseFor(mode); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    const row = opened.nameLookup?.get(name);
    if (row) return row.username;
  }
  return null;
}
