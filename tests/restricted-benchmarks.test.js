import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { refreshDatabase } from '../server/refresh-database.js';

const response = data => new Response(JSON.stringify({ data }));

test('a restricted profile takes benchmark results from the collected leaderboards without inventing play statistics', async t => {
  const dataDir = await mkdtemp(join(tmpdir(), 'aimlab-restricted-benchmarks-'));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const mode = 'vt-aimlabs_s3-novice';
  await refreshDatabase(mode, { dataDir, getPage: async bench => ({ metadata: { totalRows: 1 },
    data: [{ user_id: 'collected-id', username: 'Collected', score: bench.scores[2] }] }) });
  const stored = new DatabaseSync(join(dataDir, `${mode}.sqlite`), { readOnly: true }).prepare('SELECT overall, overall_rank FROM players').get();
  process.env.AIMLAB_DATA_DIR = dataDir;
  const { getProfile } = await import('../server/app-data.js');
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const { query } = JSON.parse(options.body);
    if (query.includes('GetProfile(')) return response({ aimlabProfile: { username: 'Collected', user: { id: 'collected-id' } } });
    if (query.includes('GetProfileAggregates')) return new Response(JSON.stringify({ errors: [{ extensions: { code: 'UNAUTHENTICATED' } }] }));
    return response({ aimlabProfile: { username: 'Collected', taskStats: [] } });
  });

  const profile = await getProfile('Collected', { publicSummary: true });
  assert.equal(profile.statisticsStatus, 'restricted');
  assert.equal(profile.totals, null);
  assert.ok(Date.parse(profile.benchmarkScoresCollectedAt));
  // Revosect Series 4 has no collected leaderboard, so it is left out rather than shown empty.
  assert.equal(profile.benchmarkSets.some(set => set.id === 'revosect_s4'), false);
  const novice = profile.benchmarkSets.find(set => set.id === 'aimlabs_s3').results.VTNovice;
  assert.equal(novice.overallEnergy, stored.overall);
  assert.equal(novice.overallRank, stored.overall_rank);
  assert.ok(novice.benchmarks.every(bench => bench.maxScore > 0 && bench.count === null && bench.avgScore === null && bench.maxAcc === null));
});
