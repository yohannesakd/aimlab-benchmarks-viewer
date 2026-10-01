import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, rename, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { calculateRevosectBenchmarks, caclulateVT } from "./benchmark-calculations.js";
import { categories as raCategories } from "./revosectData.js";
import { categories as vtCategories } from "./voltaicData.js";
import { fetchLeaderboardPage } from "./aimlab-pages.js";
import { captureTelemetry, logTelemetry, shutdownTelemetry } from './telemetry.js';
import { calculateVoltaicSeason } from "./benchmark-seasons.js";

import { benchmarkSets, seasonModes, sortColumnsFor } from './benchmark-registry.js';
import { collectionIdentityFor, legacyIdentityFor, publicationFor } from './benchmark-publication.js';

const dataDir = resolve(process.env.AIMLAB_DATA_DIR || "data");

function openStaging(path, mode, benchmarks, provider) {
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
  const identity = legacyIdentityFor(mode);
  const saved = Object.fromEntries(db.prepare('SELECT key, value FROM metadata').all().map(row => [row.key, row.value]));
  const incompatible = saved.collectionIdentity
    ? saved.collectionIdentity !== collectionIdentityFor(mode)
    : saved.identity && saved.identity !== identity;
  if (incompatible || (saved.identity && (saved.collectorProvider || 'legacy') !== provider)) {
    db.close();
    throw new Error(`Collection identity changed during ${mode} refresh; retain this staging database and start a separate collection directory`);
  }
  db.prepare("INSERT OR IGNORE INTO metadata (key, value) VALUES ('identity', ?)").run(identity);
  db.prepare("INSERT OR IGNORE INTO metadata VALUES ('collectionIdentity', ?)").run(collectionIdentityFor(mode));
  db.prepare("INSERT OR IGNORE INTO metadata VALUES ('collectorProvider', ?)").run(provider);
  // A resumed old collection has an unknown start time; do not invent one.
  if (!saved.identity) db.prepare("INSERT INTO metadata VALUES ('collectionStartedAt', ?)").run(new Date().toISOString());
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
    DROP TABLE IF EXISTS players;
    CREATE TABLE players (
      user_id TEXT PRIMARY KEY, username TEXT NOT NULL, overall INTEGER NOT NULL,
      overall_rank TEXT NOT NULL, ${Array.from({ length: categoryCount }, (_, index) => `c${index + 1} INTEGER NOT NULL`).join(", ")}
    );
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
  for (const [key, value] of Object.entries(publicationFor(mode))) {
    db.prepare('INSERT OR REPLACE INTO metadata VALUES (?, ?)').run(key, value);
  }
  db.prepare("INSERT OR REPLACE INTO metadata VALUES ('collectionIdentity', ?)").run(collectionIdentityFor(mode));
  db.prepare("INSERT OR REPLACE INTO metadata VALUES ('identity', ?)").run(legacyIdentityFor(mode));
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  return count;
}

export async function refreshDatabase(mode, options = {}) {
  const benchmarks = benchmarkSets[mode];
  if (!Object.hasOwn(benchmarkSets, mode)) throw new Error(`Unknown benchmark mode: ${mode}`);
  const directory = resolve(options.dataDir || dataDir);
  await mkdir(directory, { recursive: true });
  const staging = resolve(directory, `${mode}.staging.sqlite`);
  const destination = resolve(directory, `${mode}.sqlite`);
  const provider = options.collectorProvider || 'legacy';
  if (!['legacy', 'trainer'].includes(provider)) throw new Error('Unknown collector provider');
  const db = openStaging(staging, mode, benchmarks, provider);
  let count;
  try {
    await collectAll(db, benchmarks, options.getPage || ((bench, offset) => fetchLeaderboardPage(bench, offset, { provider })), options.onProgress);
    db.prepare("INSERT OR REPLACE INTO metadata VALUES ('collectionFinishedAt', ?)").run(new Date().toISOString());
    count = scorePlayers(db, mode, benchmarks, options.onProgress);
  } finally { db.close(); }
  await rm(`${staging}-wal`, { force: true });
  await rm(`${staging}-shm`, { force: true });
  await rename(staging, destination);
  return { mode, count, destination };
}

export async function rescoreDatabase(mode, options = {}) {
  if (!Object.hasOwn(benchmarkSets, mode)) throw new Error(`Unknown benchmark mode: ${mode}`);
  const directory = resolve(options.dataDir || dataDir);
  const destination = resolve(directory, `${mode}.sqlite`);
  const temporary = resolve(directory, `${mode}.rescore-${randomUUID()}.sqlite`);
  const source = new DatabaseSync(destination, { readOnly: true });
  try {
    const metadata = Object.fromEntries(source.prepare('SELECT key, value FROM metadata').all().map(row => [row.key, row.value]));
    const compatible = metadata.collectionIdentity
      ? metadata.collectionIdentity === collectionIdentityFor(mode)
      : metadata.identity === legacyIdentityFor(mode);
    if (!compatible) throw new Error('Retained scores do not cover the requested collection identity');
  } finally { source.close(); }
  try {
    await copyFile(destination, temporary);
    const db = new DatabaseSync(temporary);
    let count;
    try { count = scorePlayers(db, mode, benchmarkSets[mode], options.onProgress); }
    finally { db.close(); }
    await rename(temporary, destination);
    return { mode, count, destination };
  } finally {
    await rm(temporary, { force: true });
    await rm(`${temporary}-wal`, { force: true });
    await rm(`${temporary}-shm`, { force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const rescore = process.argv.includes('--rescore');
  const provider = process.argv.find(argument => argument.startsWith('--provider='))?.split('=')[1] || 'legacy';
  const modes = process.argv.slice(2).filter(argument => argument !== '--rescore' && !argument.startsWith('--provider='));
  if (rescore && provider !== 'legacy') throw new Error('--provider applies only to collection');
  if (rescore && !modes.length) throw new Error('Specify a benchmark mode for --rescore');
  if (!modes.length) modes.push(...Object.keys(benchmarkSets).filter(mode => mode.startsWith("ra-") || seasonModes[mode]));
  for (const mode of modes) {
    const started = performance.now();
    captureTelemetry('collection_started', { mode, provider, rescore });
    try {
      const result = await (rescore ? rescoreDatabase : refreshDatabase)(mode, {
        collectorProvider: provider,
        onProgress: (name, offset, total, done) => {
          console.log(`${mode}: ${name}: ${offset}/${total ?? "?"}${done ? " done" : ""}`);
          logTelemetry('collection_progress', { mode, scenario: name, offset, total, done });
        },
      });
      console.log(`${result.mode}: ${result.count} players`);
      captureTelemetry('collection_completed', { mode, provider, rescore, players: result.count, duration_ms: Math.round(performance.now() - started) });
    } catch (error) {
      console.error(`${mode}: ${error.message}`);
      process.exitCode = 1;
      captureTelemetry('collection_failed', { mode, provider, rescore, error_type: error.name, duration_ms: Math.round(performance.now() - started) });
      logTelemetry('collection_failed', { mode, error_type: error.name }, 'ERROR');
    }
  }
  await shutdownTelemetry();
}
