import assert from 'node:assert/strict';
import test from 'node:test';
import { queryAimlabs } from '../server/aimlabs-graphql.js';

test('provider timeouts remain retryable and retain their failure identity', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new DOMException('Timed out', 'TimeoutError'); });
  await assert.rejects(queryAimlabs('query GetProfile { Trainer { aimlabProfile { username } } }', {}, 'Unavailable'),
    error => error.name === 'TimeoutError' && error.status === 503);
});

test('provider server failures are retryable without retrying the request', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response('{}', { status: 502 }); });
  await assert.rejects(queryAimlabs('query GetProfile { Trainer { aimlabProfile { username } } }', {}, 'Unavailable'),
    error => error.status === 503 && error.providerStatus === 502);
  assert.equal(calls, 1);
});

test('an explicit provider denial does not become a transient error', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
    errors: [{ message: 'private information', extensions: { code: 'UNAUTHORIZED' } }],
  })));
  await assert.rejects(queryAimlabs('query GetProfile { Trainer { aimlabProfile { username } } }', {}, 'Unavailable'),
    error => error.status !== 503 && error.providerCodes[0] === 'UNAUTHORIZED' && !error.message.includes('private'));
});
