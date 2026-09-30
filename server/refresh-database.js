import { mkdir, rename, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { calculateRevosectBenchmarks, caclulateVT } from "../src/helpers/functions.js";
import { categories as raCategories, easyBench, mediumBench, hardBench } from "../src/helpers/revosectData.js";
import { categories as vtCategories, noviceBench, intermediateBench, advancedBench } from "../src/helpers/voltaicData.js";
import { fetchLeaderboardPage } from "./aimlab-pages.js";
import { voltaicSeasons, calculateVoltaicSeason } from "./benchmark-seasons.js";

export const seasonModes = Object.fromEntries(voltaicSeasons.flatMap(definition => definition.tiers.map(tier => {
  const level = tier.name.toLowerCase();
  return [`vt-${definition.id}-${level}`, { definition, level, tier, subcategories: definition.categories.flatMap(category => category.subcategories) }];
})));

export const benchmarkSets = {
  "ra-easy": easyBench,
  "ra-medium": mediumBench,
  "ra-hard": hardBench,
  "vt-novice": noviceBench,
  "vt-intermediate": intermediateBench,
  "vt-advanced": advancedBench,
  ...Object.fromEntries(Object.entries(seasonModes).map(([mode, { definition, tier }]) => [mode, definition.scenarios.filter(scenario => scenario.tiers.some(item => item.tier_id === tier.id)).map(scenario => ({
    id: scenario.task_id, weapon: scenario.weapon_id, name: scenario.name, categoryID: scenario.subcategory_id,
    scores: scenario.tiers.find(item => item.tier_id === tier.id).thresholds, minimumScore: 0,
  }))])),
};

export function sortColumnsFor(mode) {
  const season = seasonModes[mode];
  const columns = { overall: "overall" };
  const ordinals = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth"];
  if (season) {
    for (const category of season.definition.categories) {
      columns[category.name] = `(${category.subcategories.map(subcategory => `c${season.subcategories.findIndex(item => item.id === subcategory.id) + 1}`).join(" + ")})`;
    }
  } else Object.assign(columns, { clicking: "(c1 + c2)", tracking: "(c3 + c4)", switching: "(c5 + c6)" });
  for (let index = 0; index < (season?.subcategories.length || 6); index++) columns[ordinals[index]] = `c${index + 1}`;
  return columns;
}

const dataDir = resolve(process.env.AIMLAB_DATA_DIR || "data");

function openStaging(path, mode, benchmarks) {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS progress (
      scenario INTEGER PRIMARY KEY, offset INTEGER NOT NULL DEFAULT 0,
      complete INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS scores (
      user_id TEXT NOT NULL, scenario INTEGER NOT NULL, username TEXT NOT NULL,
      score REAL NOT NULL, PRIMARY KEY (user_id, scenario)
    );
  `);
  const identity = JSON.stringify(benchmarks.map(({ id, weapon, scores, minimumScore, categoryID }) => seasonModes[mode] ? [id, weapon, scores, minimumScore, categoryID] : [id, weapon, scores[0]]));
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
    const minimumScore = bench.minimumScore ?? bench.scores[0];
    const progress = db.prepare("SELECT offset, complete FROM progress WHERE scenario = ?").get(index);
    if (progress.complete) continue;
    const upsert = db.prepare(`
      INSERT INTO scores (user_id, scenario, username, score) VALUES (?, ?, ?, ?)
      ON CONFLICT (user_id, scenario) DO UPDATE SET
        score = max(scores.score, excluded.score),
        username = CASE WHEN excluded.score >= scores.score THEN excluded.username ELSE scores.username END
    `);
    const update = db.prepare("UPDATE progress SET offset = ?, complete = ? WHERE scenario = ?");
    let offset = progress.offset;
    while (true) {
      const page = await getPage(bench, offset);
      if (!Array.isArray(page.data) || !Number.isInteger(page.metadata?.totalRows)) {
        throw new Error(`Invalid Aimlab page for ${bench.name}`);
      }
      if (!page.data.length && offset < page.metadata.totalRows) throw new Error(`Empty Aimlab page for ${bench.name} at offset ${offset}`);
      let highestScore = -Infinity;
      db.exec("BEGIN");
      try {
        for (const entry of page.data) {
          if (!Number.isFinite(entry.score)) throw new Error(`Invalid Aimlab score for ${bench.name} at offset ${offset}`);
          highestScore = Math.max(highestScore, entry.score);
          if (entry.score >= minimumScore && entry.user_id && entry.username) {
            upsert.run(entry.user_id, index, entry.username, entry.score);
          }
        }
        const done = highestScore < minimumScore || offset + page.data.length >= page.metadata.totalRows;
        if (!done && page.data.length !== 2000) {
          throw new Error(`Incomplete Aimlab page for ${bench.name} at offset ${offset}`);
        }
        offset += page.data.length;
        update.run(offset, done ? 1 : 0, index);
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
  const season = seasonModes[mode];
  const categoryCount = season?.subcategories.length || 6;
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      user_id TEXT PRIMARY KEY, username TEXT NOT NULL, overall INTEGER NOT NULL,
      overall_rank TEXT NOT NULL, ${Array.from({ length: categoryCount }, (_, index) => `c${index + 1} INTEGER NOT NULL`).join(", ")}
    );
    DELETE FROM players;
    CREATE INDEX IF NOT EXISTS scores_by_user ON scores (user_id);
  `);
  const insert = db.prepare(`INSERT INTO players VALUES (${Array(categoryCount + 4).fill("?").join(", ")})`);
  const rows = db.prepare("SELECT user_id, username, scenario, score FROM scores ORDER BY user_id").iterate();
  let currentId = null;
  let username = "";
  let tasks = [];
  let count = 0;
  function flush() {
    if (!currentId) return;
    let overall, rank, values;
    if (season) {
      const rows = tasks.map(task => ({ group_by: { task_id: task.id, weapon_id: task.weapon, task_mode_mod: 0 }, aggregate: { count: 1, max: { score: task.maxScore, accuracy: 0 }, avg: { score: task.maxScore, accuracy: 0 } } }));
      const result = calculateVoltaicSeason(season.definition, rows, season.level).results[`VT${season.tier.name}`];
      overall = result.overallEnergy;
      rank = result.overallRank;
      values = result.categories.map(category => category.energy);
    } else if (mode.startsWith("ra-")) {
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
      tasks.push({ id: benchmarks[row.scenario].id, weapon: benchmarks[row.scenario].weapon, maxScore: row.score, count: 1 });
    }
    flush();
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  for (const [name, column] of Object.entries(sortColumnsFor(mode))) db.exec(`CREATE INDEX IF NOT EXISTS players_${name} ON players (${column} DESC, username)`);
  db.prepare("INSERT OR REPLACE INTO metadata VALUES ('generatedAt', ?)").run(new Date().toISOString());
  db.prepare("INSERT OR REPLACE INTO metadata VALUES ('mode', ?)").run(mode);
  db.prepare("INSERT OR REPLACE INTO metadata VALUES ('categories', ?)").run(JSON.stringify(season ? season.subcategories.map(category => category.name) : mode.startsWith("ra-") ? raCategories : vtCategories));
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
  if (!modes.length) modes.push(...Object.keys(benchmarkSets).filter(mode => mode.startsWith("ra-") || seasonModes[mode]));
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
