import { benchmarkSets } from '../server/benchmark-registry.js';
import { fetchLeaderboardPage } from '../server/aimlab-pages.js';

const [mode, indexText = '0'] = process.argv.slice(2);
const index = Number(indexText);
if (!Object.hasOwn(benchmarkSets, mode) || !Number.isInteger(index) || !benchmarkSets[mode][index]) {
  throw new Error('Specify a benchmark mode and optional scenario index');
}
const bench = benchmarkSets[mode][index];
const measurements = [];
const results = [];
// One batch per provider, sequentially; run under the shared refresh lock.
for (const provider of ['legacy', 'trainer']) {
  results.push(await fetchLeaderboardPage(bench, 0, { provider, onResponse: info => measurements.push(info) }));
}
const identity = page => JSON.stringify({ total: page.metadata.totalRows,
  scores: page.data.map(row => [row.user_id, row.username, row.score, row.play_id, row.weapon_id, row.task_id, row.task_mode_mod]) });
const match = identity(results[0]) === identity(results[1]);
console.log(JSON.stringify({ mode, scenario: index, match, measurements, rows: results.map(result => result.data.length) }));
if (!match) process.exitCode = 1;
