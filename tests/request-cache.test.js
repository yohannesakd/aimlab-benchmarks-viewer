import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequestCache } from '../server/request-cache.js';

const timeout = () => new DOMException('Timed out', 'TimeoutError');
const failure = properties => Object.assign(new Error('Provider failure'), properties);

test('failed refresh retains the original value, age, and shared refresh', async t => {
  t.mock.method(Date, 'now', () => now);
  let now = 0;
  const cached = createRequestCache({ ttlMs: 60, maxEntries: 2 });
  const options = { staleIfErrorMs: 300 };
  const value = { fetchedAt: 'original', username: 'Alice' };
  await cached('Alice', () => value, options);
  now = 60;
  let reject;
  let calls = 0;
  const load = () => { calls++; return new Promise((_, fail) => { reject = fail; }); };
  const first = cached('Alice', load, options);
  const second = cached('Alice', load, options);
  await Promise.resolve();
  reject(timeout());
  assert.equal(await first, value);
  assert.equal(await second, value);
  assert.equal(calls, 1);
  now = 359;
  assert.equal(await cached('Alice', () => { throw timeout(); }, options), value);
  now = 360;
  await assert.rejects(cached('Alice', () => { throw timeout(); }, options), { name: 'TimeoutError' });
});

test('fallback requires opt-in and approved transient evidence', async t => {
  let now = 0;
  t.mock.method(Date, 'now', () => now);
  const allowed = [{ name: 'TimeoutError' }, ...[500, 502, 503, 504].map(providerStatus => ({ providerStatus })), { status: 503 }];
  const denied = [{}, { providerStatus: 429 }, { status: 503, providerCodes: [] }, { providerStatus: 503, providerCodes: ['FORBIDDEN'] }, ...[401, 403, 404].map(status => ({ status, name: 'TimeoutError' })), ...[401, 403, 404].map(providerStatus => ({ providerStatus }))];
  for (const properties of [...allowed, ...denied]) {
    const cached = createRequestCache({ ttlMs: 60, maxEntries: 2 });
    now = 0;
    await cached('key', () => 'valid');
    now = 60;
    const result = cached('key', () => { throw failure(properties); }, { staleIfErrorMs: 300 });
    if (allowed.includes(properties)) assert.equal(await result, 'valid');
    else await assert.rejects(result);
  }
  const cached = createRequestCache({ ttlMs: 60, maxEntries: 2 });
  now = 0;
  await cached('key', () => 'valid');
  now = 60;
  await assert.rejects(cached('key', () => { throw timeout(); }));
});

test('explicit denial prevents a later timeout from resurrecting retained data', async t => {
  let now = 0;
  t.mock.method(Date, 'now', () => now);
  for (const properties of [...[401, 403, 404].map(status => ({ status })),
    ...[401, 403, 404].map(providerStatus => ({ providerStatus })),
    ...['UNAUTHORIZED', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND'].map(code => ({ providerCodes: [code] }))]) {
    const cached = createRequestCache({ ttlMs: 60, maxEntries: 2 });
    const options = { staleIfErrorMs: 300 };
    now = 0;
    await cached('Alice', () => 'deleted', options);
    now = 60;
    await assert.rejects(cached('Alice', () => { throw failure(properties); }, options));
    await assert.rejects(cached('Alice', () => { throw timeout(); }, options));
  }
});

test('retained values and pending work remain bounded and isolated by key', async t => {
  let now = 0;
  t.mock.method(Date, 'now', () => now);
  const cached = createRequestCache({ ttlMs: 60, maxEntries: 1 });
  const options = { staleIfErrorMs: 300 };
  await cached('Alice', () => 'Alice', options);
  await cached('Bob', () => 'Bob', options);
  now = 60;
  await assert.rejects(cached('Alice', () => { throw timeout(); }, options));
  let resolve;
  const pending = cached('Bob', () => new Promise(done => { resolve = done; }), options);
  await Promise.resolve();
  await assert.rejects(cached('Carol', () => 'Carol', options), { status: 503 });
  resolve('new Bob');
  assert.equal(await pending, 'new Bob');
  assert.equal(await cached('Bob', () => 'unexpected'), 'new Bob');
});
