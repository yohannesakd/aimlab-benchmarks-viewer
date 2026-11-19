import assert from 'node:assert/strict';
import test from 'node:test';
import { getPublicProfileDetails } from '../server/public-details.js';
import { queryAimlabs } from '../server/aimlabs-graphql.js';

const response = data => new Response(JSON.stringify({ data }));

test('identical public details share provider reads while distinct identities stay separate', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    calls++;
    const { variables } = JSON.parse(options.body);
    await new Promise(resolve => setTimeout(resolve, 10));
    return response({ aimlabProfile: { username: variables.username } });
  };
  try {
    const details = await Promise.all(Array.from({ length: 5 }, () => getPublicProfileDetails('SharingFixture')));
    assert.equal(calls, 1);
    assert.ok(details.every(value => value === details[0]));
    await getPublicProfileDetails('OtherPlayer');
    assert.equal(calls, 2);
  } finally { globalThis.fetch = originalFetch; }
});

test('failed shared reads clear pending work, preserve safe provider codes, and allow retry', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) return new Response(JSON.stringify({ errors: [{ message: 'private payload', extensions: { code: 'UNAUTHORIZED' } }, { extensions: { code: 'private unsafe text' } }] }));
    return response({ aimlabProfile: { username: 'RetryFixture' } });
  };
  try {
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => getPublicProfileDetails('RetryFixture')));
    assert.equal(calls, 1);
    for (const result of results) {
      assert.equal(result.status, 'rejected');
      assert.deepEqual(result.reason.providerCodes, ['UNAUTHORIZED']);
      assert.equal(result.reason.message.includes('private'), false);
    }
    assert.equal((await getPublicProfileDetails('RetryFixture')).username, 'RetryFixture');
    assert.equal(calls, 2);
  } finally { globalThis.fetch = originalFetch; }
});

test('provider cooldown is enforced even when callers share a failed request', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response('{}', { status: 429, headers: { 'Retry-After': '15' } }); };
  try {
    await assert.rejects(getPublicProfileDetails('CooldownFixture'), error => error.status === 503 && error.retryAfter === 15);
    await assert.rejects(queryAimlabs('query {}', {}, 'Unavailable'), error => error.status === 503);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
});
