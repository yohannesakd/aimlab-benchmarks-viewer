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
      { task: { id: 'sixshot', name: 'Sixshot' }, topScore: 123, playCount: 10, playId: 'best' },
      { task: { id: 'gridshot', name: 'Gridshot' }, topScore: 456, playCount: 5, playId: null },
      { task: null, topScore: 12, playCount: 1, playId: 'old-run' },
    ] } });
  });
  const profile = await getProfile('Restricted', { publicSummary: true });
  assert.equal(profile.statisticsStatus, 'restricted');
  assert.equal(profile.playerInfo.id, 'restricted-id');
  assert.equal(profile.totals, null);
  assert.equal(profile.tasks, null);
  assert.equal(profile.benchmarkSets, null);
  assert.deepEqual(profile.publicTaskSummaries, [
    { id: 'sixshot', name: 'Sixshot', maxScore: 123, count: 10, playId: 'best', mode: null, weapon: null },
    { id: 'gridshot', name: 'Gridshot', maxScore: 456, count: 5, playId: null, mode: null, weapon: null },
  ]);
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

test('an UNAUTHORIZED aggregate denial also returns the public summaries', async t => {
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const { query } = JSON.parse(options.body);
    if (query.includes('GetProfile(')) return response({ aimlabProfile: { username: 'Unauthorized', user: { id: 'unauthorized-id' } } });
    if (query.includes('GetProfileAggregates')) return new Response(JSON.stringify({ errors: [{ extensions: { code: 'UNAUTHORIZED' } }] }));
    assert.equal(query.includes('play {'), false);
    return response({ aimlabProfile: { username: 'Unauthorized', taskStats: [{ task: { id: 'sixshot', name: 'Sixshot' }, topScore: 1, playCount: 1, playId: 'run' }] } });
  });
  const profile = await getProfile('Unauthorized', { publicSummary: true });
  assert.equal(profile.statisticsStatus, 'restricted');
  assert.equal(profile.publicTaskSummaries.length, 1);
  await assert.rejects(getProfile('Unauthorized'), error => error.providerCodes?.includes('UNAUTHORIZED'));
});
