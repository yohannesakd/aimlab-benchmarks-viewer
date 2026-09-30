import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { benchmarkSets, seasonModes } from '../server/benchmark-registry.js';
import { calculateVoltaicSeason } from '../server/benchmark-seasons.js';
import { refreshDatabase, rescoreDatabase } from '../server/refresh-database.js';
import { collectionIdentityFor, legacyIdentityFor, publicationFor, validatePublication } from '../server/benchmark-publication.js';

const mode = 'vt-aimlabs_s3-novice';

test('publication distinguishes compatible old files, version mismatches and collection identity', () => {
  const old = { identity: legacyIdentityFor(mode), mode };
  assert.equal(validatePublication(mode, old).compatibility, 'unversioned');
  assert.throws(() => validatePublication(mode, old, true), error => error.status === 503);
  const current = { ...old, ...publicationFor(mode), collectionIdentity: collectionIdentityFor(mode) };
  assert.equal(validatePublication(mode, current).compatibility, 'versioned');
  for (const key of ['definitionDigest', 'calculationVersion', 'dataFormatVersion', 'collectionIdentity', 'mode']) {
    assert.throws(() => validatePublication(mode, { ...current, [key]: 'other' }), error => error.status === 503);
  }
});

test('rescoring retains raw scores and collection dates; incompatible rescoring preserves the published file', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'aimlab-rescore-'));
  const file = join(dataDir, `${mode}.sqlite`);
  try {
    await refreshDatabase(mode, { dataDir, getPage: async bench => ({ metadata: { totalRows: 1 }, data: [{ user_id: 'p1', username: 'Player', score: bench.scores[0] }] }) });
    let db = new DatabaseSync(file);
    const before = Object.fromEntries(db.prepare('SELECT key, value FROM metadata').all().map(row => [row.key, row.value]));
    const scores = db.prepare('SELECT * FROM scores ORDER BY scenario').all();
    const players = db.prepare('SELECT * FROM players').all();
    assert.ok(before.collectionStartedAt <= before.collectionFinishedAt);
    db.prepare("UPDATE metadata SET value = 'previous-calculation' WHERE key = 'calculationVersion'").run();
    db.close();
    await rescoreDatabase(mode, { dataDir });
    db = new DatabaseSync(file);
    const after = Object.fromEntries(db.prepare('SELECT key, value FROM metadata').all().map(row => [row.key, row.value]));
    assert.equal(validatePublication(mode, after).compatibility, 'versioned');
    assert.equal(after.collectionStartedAt, before.collectionStartedAt);
    assert.equal(after.collectionFinishedAt, before.collectionFinishedAt);
    assert.deepEqual(db.prepare('SELECT * FROM scores ORDER BY scenario').all(), scores);
    assert.deepEqual(db.prepare('SELECT * FROM players').all(), players);
    db.close();
    const thresholds = benchmarkSets[mode].map(bench => [...bench.scores]);
    try {
      benchmarkSets[mode].forEach(bench => bench.scores.forEach((value, index) => { bench.scores[index] = value * 2; }));
      await rescoreDatabase(mode, { dataDir });
      db = new DatabaseSync(file);
      const changed = db.prepare('SELECT * FROM players').get();
      const rows = scores.map(row => ({ group_by: { task_id: benchmarkSets[mode][row.scenario].id, weapon_id: benchmarkSets[mode][row.scenario].weapon, task_mode_mod: 0 }, aggregate: { count: 1, max: { score: row.score, accuracy: 0 }, avg: { score: row.score, accuracy: 0 } } }));
      const profile = calculateVoltaicSeason(seasonModes[mode].definition, rows, 'novice').results.VTNovice;
      assert.equal(changed.overall, profile.overallEnergy);
      assert.equal(changed.overall_rank, profile.overallRank);
      assert.notEqual(changed.overall, players[0].overall);
      assert.deepEqual(db.prepare('SELECT * FROM scores ORDER BY scenario').all(), scores);
      db.prepare("UPDATE metadata SET value = 'different-population' WHERE key = 'collectionIdentity'").run();
      db.close();
    } finally {
      benchmarkSets[mode].forEach((bench, index) => bench.scores.splice(0, bench.scores.length, ...thresholds[index]));
    }
    const incompatible = await readFile(file);
    await assert.rejects(rescoreDatabase(mode, { dataDir }), /do not cover/);
    assert.deepEqual(await readFile(file), incompatible);
  } finally { await rm(dataDir, { recursive: true, force: true }); }
});


test('an interrupted staging collection cannot switch provider contracts', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'aimlab-provider-resume-'));
  try {
    await assert.rejects(refreshDatabase(mode, { dataDir, getPage: async () => { throw new Error('Interrupted'); } }), /Interrupted/);
    let called = false;
    await assert.rejects(refreshDatabase(mode, { dataDir, collectorProvider: 'trainer', getPage: async () => { called = true; } }), /Collection identity changed/);
    assert.equal(called, false);
    const resumed = await refreshDatabase(mode, { dataDir, getPage: async () => ({ metadata: { totalRows: 0 }, data: [] }) });
    assert.equal(resumed.count, 0);
  } finally { await rm(dataDir, { recursive: true, force: true }); }
});
