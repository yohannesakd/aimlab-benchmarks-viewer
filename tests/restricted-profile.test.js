import assert from 'node:assert/strict';
import test from 'node:test';
import { getProfile } from '../server/app-data.js';

const response = trainer => new Response(JSON.stringify({ data: { Trainer: trainer } }));

test('a public-summary timeout retries once and returns the validated profile', async t => {
  let summaryCalls = 0;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const { query } = JSON.parse(options.body);
    if (query.includes('GetProfile(')) return response({ aimlabProfile: { username: 'RetrySummary', user: { id: 'retry-id' } } });
    if (query.includes('GetProfileAggregates')) return new Response(JSON.stringify({ errors: [{ extensions: { code: 'UNAUTHENTICATED' } }] }));
    if (++summaryCalls === 1) throw new DOMException('Timed out', 'TimeoutError');
    return response({ aimlabProfile: { username: 'RetrySummary', taskStats: [] } });
  });
  const profile = await getProfile('RetrySummary', { publicSummary: true });
  assert.equal(profile.statisticsStatus, 'restricted');
  assert.equal(profile.playerInfo.id, 'retry-id');
  assert.deepEqual(profile.publicTaskSummaries, []);
  assert.equal(summaryCalls, 2);
});

for (const [name, failure, attempts] of [
  ['TimeoutAgain', () => { throw new DOMException('Timed out', 'TimeoutError'); }, 2],
  ['DeniedSummary', () => new Response(JSON.stringify({ errors: [{ extensions: { code: 'UNAUTHENTICATED' } }] })), 1],
  ['OfflineSummary', () => new Response('{}', { status: 502 }), 1],
]) {
  test(`public-summary recovery stays bounded for ${name}`, async t => {
    let summaryCalls = 0;
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
      const { query } = JSON.parse(options.body);
      if (query.includes('GetProfile(')) return response({ aimlabProfile: { username: name, user: { id: name } } });
      if (query.includes('GetProfileAggregates')) return new Response(JSON.stringify({ errors: [{ extensions: { code: 'UNAUTHENTICATED' } }] }));
      summaryCalls++;
      return failure();
    });
    await assert.rejects(getProfile(name, { publicSummary: true }), error => name === 'TimeoutAgain'
      ? error.name === 'TimeoutError' && error.status === 503
      : name === 'DeniedSummary' ? error.providerCodes?.includes('UNAUTHENTICATED') : error.providerStatus === 502);
    assert.equal(summaryCalls, attempts);
  });
}

test('restricted statistics retain the public profile without inventing totals or benchmark ranks', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const { query, variables } = JSON.parse(options.body);
    calls.push(query);
    if (query.includes('GetProfile(')) return response({ aimlabProfile: { username: 'Restricted', user: { id: 'restricted-id' } } });
    if (query.includes('GetProfileAggregates')) return new Response(JSON.stringify({ errors: [{ extensions: { code: 'UNAUTHENTICATED' } }] }));
    assert.equal(variables.limit, 100);
    assert.equal(variables.username, 'Restricted');
    return response({ aimlabProfile: { username: 'Restricted', taskStats: [
      { task: { id: 'sixshot', name: 'Sixshot' }, topScore: 123, playCount: 10, playId: 'best',
        play: { id: 'best', taskSlug: 'sixshot', score: 123, convertedMode: 0, manifest: { weaponId: '9mm' } } },
      { task: { id: 'gridshot', name: 'Gridshot' }, topScore: 456, playCount: 5, playId: 'different',
        play: { id: 'wrong-run', taskSlug: 'gridshot', score: 999, convertedMode: 0 } },
      { task: null, topScore: 12, playCount: 1, playId: 'old-run',
        play: { id: 'old-run', taskSlug: 'old-task', score: 12, convertedMode: 0, manifest: { taskName: 'Old task', weaponId: '9mm' } } },
    ] } });
  });
  const profile = await getProfile('Restricted', { publicSummary: true });
  assert.equal(profile.statisticsStatus, 'restricted');
  assert.equal(profile.playerInfo.id, 'restricted-id');
  assert.equal(profile.totals, null);
  assert.equal(profile.tasks, null);
  assert.equal(profile.benchmarkSets, null);
  assert.equal(profile.publicTaskSummaries[0].playId, 'best');
  assert.equal(profile.publicTaskSummaries[1].playId, null);
  assert.equal(profile.publicTaskSummaries[1].maxScore, 456);
  assert.equal(profile.publicTaskSummaries[2].id, 'old-task');
  assert.equal(profile.publicTaskSummaries[2].name, 'Old task');
  assert.equal(profile.publicTaskSummaries[2].playId, 'old-run');
  assert.equal(await getProfile('Restricted', { publicSummary: true }), profile);
  assert.equal(calls.length, 3);
  await assert.rejects(getProfile('Restricted'), error => error.providerCodes?.includes('UNAUTHENTICATED'));
  assert.equal(calls.length, 4);
});

test('an unavailable aggregate does not silently become a restricted or empty profile', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    calls++;
    const { query } = JSON.parse(options.body);
    if (query.includes('GetProfile(')) return response({ aimlabProfile: { username: 'OfflineStats', user: { id: 'offline-id' } } });
    return new Response('{}', { status: 502 });
  });
  await assert.rejects(getProfile('OfflineStats', { publicSummary: true }), error => error.providerStatus === 502);
  assert.equal(calls, 2);
});

test('public summaries from another identity cannot replace the requested player', async t => {
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const { query } = JSON.parse(options.body);
    if (query.includes('GetProfile(')) return response({ aimlabProfile: { username: 'IdentityCheck', user: { id: 'identity-id' } } });
    if (query.includes('GetProfileAggregates')) return new Response(JSON.stringify({ errors: [{ extensions: { code: 'UNAUTHENTICATED' } }] }));
    return response({ aimlabProfile: { username: 'SomeoneElse', taskStats: [] } });
  });
  await assert.rejects(getProfile('IdentityCheck', { publicSummary: true }), /Incomplete public profile/);
});
