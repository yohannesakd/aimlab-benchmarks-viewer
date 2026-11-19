import assert from 'node:assert/strict';
import test from 'node:test';
import { providerChangedMessage, providerHealth, queryAimlabs } from '../server/aimlabs-graphql.js';

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

const schemaFailure = () => new Response(JSON.stringify({ errors: [{
  message: "field 'Trainer' not found in type: 'query_root'",
  extensions: { code: 'validation-failed', path: '$.selectionSet.Trainer' },
}] }));

test('a provider schema change is permanent, logged by class, and pauses only that operation', async t => {
  let now = 1_000_000;
  t.mock.method(Date, 'now', () => now);
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return schemaFailure(); });
  const query = 'query SchemaProbe { Trainer { aimlabProfile { username } } }';
  await assert.rejects(queryAimlabs(query, {}, 'Unavailable'), error => error.permanent
    && error.publicMessage === providerChangedMessage && error.status === undefined
    && error.providerCodes[0] === 'validation-failed' && error.providerMissingField === 'query_root.Trainer'
    && error.providerErrorClass === 'schema' && !error.providerCooldown);
  await assert.rejects(queryAimlabs(query, {}, 'Unavailable'), error => error.permanent && error.providerCooldown);
  assert.equal(calls, 1);
  assert.deepEqual(providerHealth(now).unavailableOperations, ['SchemaProbe']);
  assert.equal(providerHealth(now).state, 'unavailable');
  await assert.rejects(queryAimlabs('query OtherProbe { Trainer { x } }', {}, 'Unavailable'));
  assert.equal(calls, 2);
  now += 5 * 60_000 + 1;
  await assert.rejects(queryAimlabs(query, {}, 'Unavailable'), error => !error.providerCooldown);
  assert.equal(calls, 3);
});

test('an invalid variable from user input does not pause the operation', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response(JSON.stringify({ errors: [{
    message: 'expected a string', extensions: { code: 'validation-failed', path: '$.variableValues.username' },
  }] })); });
  const query = 'query VariableProbe($username: String) { Trainer { aimlabProfile(username: $username) { username } } }';
  for (let i = 0; i < 2; i++) {
    await assert.rejects(queryAimlabs(query, { username: 1 }, 'Unavailable'), error => !error.permanent
      && error.providerCodes[0] === 'validation-failed' && error.providerErrorClass === 'other');
  }
  assert.equal(calls, 2);
});

test('profile API reports a provider change without asking users to retry', async t => {
  t.mock.method(globalThis, 'fetch', async () => schemaFailure());
  t.mock.method(console, 'error', () => {});
  const { handleAppDataRequest } = await import('../server/app-data.js');
  const result = {};
  const response = { writeHead(status, headers) { result.status = status; result.headers = headers; }, end(body) { result.body = JSON.parse(body); } };
  await handleAppDataRequest({ method: 'GET' }, response, '/api/profiles/SchemaUser/lookup', new URLSearchParams());
  assert.equal(result.status, 502);
  assert.equal(result.body.error, providerChangedMessage);
});

test('legacy GraphQL errors sent with 4xx statuses keep their codes and classes', async t => {
  t.mock.method(globalThis, 'fetch', async (_url, options) => JSON.parse(options.body).query.includes('Denied')
    ? new Response(JSON.stringify({ errors: [{ message: 'Client is not authorized', extensions: { code: 'UNAUTHORIZED' } }] }), { status: 403 })
    : new Response(JSON.stringify({ errors: [{ message: 'Cannot query field "latestPlay" on type "AimlabProfile".', extensions: { code: 'GRAPHQL_VALIDATION_FAILED' } }] }), { status: 400 }));
  await assert.rejects(queryAimlabs('query DeniedProbe { aimlab { plays_agg { count } } }', {}, 'Unavailable'),
    error => !error.permanent && error.status === undefined && error.providerStatus === 403
      && error.providerCodes[0] === 'UNAUTHORIZED' && error.providerErrorClass === 'denied');
  await assert.rejects(queryAimlabs('query RemovedProbe { aimlabProfile { latestPlay } }', {}, 'Unavailable'),
    error => error.permanent && error.providerMissingField === 'AimlabProfile.latestPlay');
});

test('a timeout while reading a 200 body stays a retryable timeout', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({
    pull() { throw new DOMException('Timed out', 'TimeoutError'); },
  })));
  await assert.rejects(queryAimlabs('query SlowBody { aimlabProfile { username } }', {}, 'Unavailable'),
    error => error.name === 'TimeoutError' && error.status === 503);
});
