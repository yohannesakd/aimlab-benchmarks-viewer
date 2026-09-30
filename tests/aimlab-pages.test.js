import test from 'node:test';
import assert from 'node:assert/strict';
import { easyBench } from '../server/revosectData.js';
import { fetchLeaderboardPage } from '../server/aimlab-pages.js';

const response = body => new Response(JSON.stringify(body));
const fixture = totalRows => Object.fromEntries(Array.from({ length: 20 }, (_, index) => [
  `page${index}`, { metadata: { totalRows }, data: Array.from({ length: Math.max(0, Math.min(100, totalRows - index * 100)) }, (_, row) => ({ user_id: `p${index * 100 + row}`, username: `Player${index * 100 + row}`, score: 1000 - index })) },
]));

test('Aimlab request batches twenty consecutive leaderboard pages', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://api.aimlab.gg/graphql');
      const { variables } = JSON.parse(options.body);
      assert.deepEqual(Object.values(variables).map(({ offset }) => offset), Array.from({ length: 20 }, (_, index) => 2000 + index * 100));
      return response({ data: { aimlab: fixture(5000) } });
    };
    const result = await fetchLeaderboardPage(easyBench[0], 2000);
    assert.equal(result.data.length, 2000);
    assert.equal(result.data.at(-1).score, 981);
  } finally { globalThis.fetch = originalFetch; }
});

test('legacy and Trainer bulk envelopes retain identical scores and the final partial batch', async () => {
  const originalFetch = globalThis.fetch;
  const payloads = [];
  const metrics = [];
  try {
    globalThis.fetch = async (url, options) => {
      const body = JSON.parse(options.body);
      payloads.push(body.variables);
      assert.ok(Object.values(body.variables).every(input => input.taskMode === 0 && input.weaponId === easyBench[0].weapon));
      if (url === 'https://api.aimlabs.com/graphql') {
        assert.match(body.query, /Trainer_LeaderboardInput!/);
        return response({ data: { Trainer: { aimlab: fixture(135) } } });
      }
      return response({ data: { aimlab: fixture(135) } });
    };
    const legacy = await fetchLeaderboardPage(easyBench[0], 0);
    const trainer = await fetchLeaderboardPage(easyBench[0], 0, { provider: 'trainer', onResponse: info => metrics.push(info) });
    assert.deepEqual(trainer, legacy);
    assert.equal(trainer.data.length, 135);
    assert.equal(trainer.metadata.totalRows, 135);
    assert.deepEqual(payloads[0], payloads[1]);
    assert.equal(metrics.length, 1);
    assert.ok(metrics[0].bytes > 1000);
    globalThis.fetch = async () => response({ data: { Trainer: { aimlab: { page0: { metadata: { totalRows: 135 }, data: [] } } } } });
    await assert.rejects(fetchLeaderboardPage(easyBench[0], 0, { provider: 'trainer' }), /invalid page/);
    globalThis.fetch = async () => new Response(' '.repeat(8_000_001));
    await assert.rejects(fetchLeaderboardPage(easyBench[0], 0, { provider: 'trainer' }), /exceeded 8 MB/);
  } finally { globalThis.fetch = originalFetch; }
});

test('Aimlab rate limit errors retry without publishing partial pages', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => {
      calls++;
      if (calls === 1) return response({ errors: [{ message: 'You are being rate limited. Please wait 0 seconds' }], data: { aimlab: { page0: { metadata: { totalRows: 1 }, data: [] } } } });
      return response({ data: { aimlab: { page0: { metadata: { totalRows: 1 }, data: [{ score: 1000 }] } } } });
    };
    assert.deepEqual((await fetchLeaderboardPage(easyBench[0], 0)).data, [{ score: 1000 }]);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = originalFetch; }
});
