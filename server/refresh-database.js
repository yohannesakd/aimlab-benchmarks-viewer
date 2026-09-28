import { mkdir, rename, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { calculateRevosectBenchmarks, caclulateVT } from "../src/helpers/functions.js";
import { categories as raCategories, easyBench, mediumBench, hardBench } from "../src/helpers/revosectData.js";
import { categories as vtCategories, noviceBench, intermediateBench, advancedBench } from "../src/helpers/voltaicData.js";
import { fetchLeaderboardPage } from "./refresh-leaderboards.js";

export const benchmarkSets = {
  "ra-easy": easyBench,
  "ra-medium": mediumBench,
  "ra-hard": hardBench,
  "vt-novice": noviceBench,
  "vt-intermediate": intermediateBench,
  "vt-advanced": advancedBench,
};

const dataDir = resolve(process.env.AIMLAB_DATA_DIR || "data");

function openStaging(path, mode, benchmarks) {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS progress (
      scenario INTEGER PRIMARY KEY, offset INTEGER NOT NULL DEFAULT 0,
      previous_score REAL, complete INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS scores (
      user_id TEXT NOT NULL, scenario INTEGER NOT NULL, username TEXT NOT NULL,
      score REAL NOT NULL, PRIMARY KEY (user_id, scenario)
    );
  `);
  const identity = JSON.stringify(benchmarks.map(({ id, weapon, scores }) => [id, weapon, scores[0]]));
  const saved = db.prepare("SELECT value FROM metadata WHERE key = 'identity'").get();
  if (saved && saved.value !== identity) {
    db.close();
    throw new Error(`Benchmark definitions changed during ${mode} refresh; remove its staging database to restart`);
  }
  db.prepare("INSERT OR IGNORE INTO metadata (key, value) VALUES ('identity', ?)").run(identity);
  for (let i = 0; i < benchmarks.length; i++) {
    db.prepare("INSERT OR IGNORE INTO progress (scenario) VALUES (?)").run(i);
  }
  return db;
}

async function collectAll(db, benchmarks, getPage, onProgress) {
  for (let index = 0; index < benchmarks.length; index++) {
    const bench = benchmarks[index];
    const progress = db.prepare("SELECT offset, previous_score, complete FROM progress WHERE scenario = ?").get(index);
    if (progress.complete) continue;
    const upsert = db.prepare(`
      INSERT INTO scores (user_id, scenario, username, score) VALUES (?, ?, ?, ?)
      ON CONFLICT (user_id, scenario) DO UPDATE SET
        score = max(scores.score, excluded.score),
        username = CASE WHEN excluded.score >= scores.score THEN excluded.username ELSE scores.username END
    `);
    const update = db.prepare("UPDATE progress SET offset = ?, previous_score = ?, complete = ? WHERE scenario = ?");
    let offset = progress.offset;
    let previousScore = progress.previous_score ?? Infinity;
    while (true) {
      const page = await getPage(bench, offset);
      if (!Array.isArray(page.data) || !Number.isInteger(page.metadata?.totalRows)) {
        throw new Error(`Invalid Aimlab page for ${bench.name}`);
      }
      let reachedCutoff = false;
      db.exec("BEGIN");
      try {
        for (const entry of page.data) {
          if (!Number.isFinite(entry.score) || entry.score > previousScore) {
            throw new Error(`Unsorted Aimlab scores for ${bench.name} at offset ${offset}`);
          }
          previousScore = entry.score;
          if (entry.score < bench.scores[0]) {
            reachedCutoff = true;
            break;
          }
          if (entry.user_id && entry.username) {
            upsert.run(entry.user_id, index, entry.username, entry.score);
          }
        }
        const done = reachedCutoff || offset + page.data.length >= page.metadata.totalRows;
        if (!done && page.data.length !== 1000) {
          throw new Error(`Incomplete Aimlab page for ${bench.name} at offset ${offset}`);
        }
        offset += page.data.length;
        update.run(offset, Number.isFinite(previousScore) ? previousScore : null, done ? 1 : 0, index);
        db.exec("COMMIT");
        onProgress?.(bench.name, offset, page.metadata.totalRows, done);
        if (done) break;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    }
  }
}

function scorePlayers(db, mode, benchmarks, onProgress) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      user_id TEXT PRIMARY KEY, username TEXT NOT NULL, overall INTEGER NOT NULL,
      overall_rank TEXT NOT NULL, c1 INTEGER NOT NULL, c2 INTEGER NOT NULL,
      c3 INTEGER NOT NULL, c4 INTEGER NOT NULL, c5 INTEGER NOT NULL, c6 INTEGER NOT NULL
    );
    DELETE FROM players;
    CREATE INDEX IF NOT EXISTS scores_by_user ON scores (user_id);
  `);
  const insert = db.prepare("INSERT INTO players VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const rows = db.prepare("SELECT user_id, username, scenario, score FROM scores ORDER BY user_id").iterate();
  let currentId = null;
  let username = "";
  let tasks = [];
  let count = 0;
  function flush() {
    if (!currentId) return;
    let overall, rank, values;
    if (mode.startsWith("ra-")) {
      const result = calculateRevosectBenchmarks({ tasks }, mode.slice(3));
      overall = result.overallPoints;
      rank = result.overallRank;
      values = result.subCategoryPoints;
    } else {
      const result = caclulateVT(tasks, benchmarks.map((bench) => ({ ...bench })), mode.slice(3));
      overall = result.overallEnergy;
      rank = result.overallRank;
      values = result.subCategoryEnergy;
    }
    if (overall > 0) {
      const categoryValues = mode === "ra-easy"
        ? [values[0], values[1], values[2], 0, values[3], 0]
        : values;
      insert.run(currentId, username, overall, rank, ...categoryValues);
      count++;
    }
    if (count && count % 10000 === 0) onProgress?.("scoring", count);
  }
  db.exec("BEGIN");
  try {
    for (const row of rows) {
      if (row.user_id !== currentId) {
        flush();
        currentId = row.user_id;
        username = row.username;
        tasks = [];
      }
      tasks.push({ id: benchmarks[row.scenario].id, maxScore: row.score, count: 1 });
    }
    flush();
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  db.exec(`
    CREATE INDEX IF NOT EXISTS players_overall ON players (overall DESC, username);
    CREATE INDEX IF NOT EXISTS players_clicking ON players ((c1 + c2) DESC, username);
    CREATE INDEX IF NOT EXISTS players_tracking ON players ((c3 + c4) DESC, username);
    CREATE INDEX IF NOT EXISTS players_switching ON players ((c5 + c6) DESC, username);
    CREATE INDEX IF NOT EXISTS players_c1 ON players (c1 DESC, username);
    CREATE INDEX IF NOT EXISTS players_c2 ON players (c2 DESC, username);
    CREATE INDEX IF NOT EXISTS players_c3 ON players (c3 DESC, username);
    CREATE INDEX IF NOT EXISTS players_c4 ON players (c4 DESC, username);
    CREATE INDEX IF NOT EXISTS players_c5 ON players (c5 DESC, username);
    CREATE INDEX IF NOT EXISTS players_c6 ON players (c6 DESC, username);
    DROP TABLE scores;
    DROP TABLE progress;
  `);
  db.prepare("INSERT OR REPLACE INTO metadata VALUES ('generatedAt', ?)").run(new Date().toISOString());
  db.prepare("INSERT OR REPLACE INTO metadata VALUES ('mode', ?)").run(mode);
  db.prepare("INSERT OR REPLACE INTO metadata VALUES ('categories', ?)").run(JSON.stringify(mode.startsWith("ra-") ? raCategories : vtCategories));
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  return count;
}

export async function refreshDatabase(mode, options = {}) {
  const benchmarks = benchmarkSets[mode];
  if (!benchmarks) throw new Error(`Unknown benchmark mode: ${mode}`);
  const directory = resolve(options.dataDir || dataDir);
  await mkdir(directory, { recursive: true });
  const staging = resolve(directory, `${mode}.staging.sqlite`);
  const destination = resolve(directory, `${mode}.sqlite`);
  const db = openStaging(staging, mode, benchmarks);
  try {
    await collectAll(db, benchmarks, options.getPage || fetchLeaderboardPage, options.onProgress);
    const count = scorePlayers(db, mode, benchmarks, options.onProgress);
    db.close();
    await rm(`${staging}-wal`, { force: true });
    await rm(`${staging}-shm`, { force: true });
    await rename(staging, destination);
    return { mode, count, destination };
  } catch (error) {
    db.close();
    throw error;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const modes = process.argv.slice(2);
  if (!modes.length) modes.push(...Object.keys(benchmarkSets));
  for (const mode of modes) {
    try {
      const result = await refreshDatabase(mode, {
        onProgress: (name, offset, total, done) =>
          console.log(`${mode}: ${name}: ${offset}/${total ?? "?"}${done ? " done" : ""}`),
      });
      console.log(`${result.mode}: ${result.count} players`);
    } catch (error) {
      console.error(`${mode}: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
