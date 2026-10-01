import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { gunzipSync } from 'node:zlib';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';

test('telemetry keeps concurrent requests separate, redacts query values, and survives export failure', async t => {
  process.env.POSTHOG_PROJECT_TOKEN = 'phc_fixture';
  process.env.POSTHOG_BROWSER_HOST = 'https://edge.saibot.site';
  process.env.AIMLAB_ENV = 'test';
  const logs = [];
  const exports = [];
  t.mock.method(console, 'error', () => {});
  t.mock.method(console, 'warn', () => {});
  t.mock.method(OTLPLogExporter.prototype, 'export', (records, complete) => {
    logs.push(...records);
    complete({ code: 1, error: new Error('Analytics unavailable') });
  });
  const originalFetch = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (!String(url).startsWith('https://eu.i.posthog.com/')) return originalFetch(url, options);
    const body = options.body;
    exports.push(typeof body === 'string' ? JSON.parse(body) : JSON.parse(gunzipSync(body).toString()));
    throw new Error('Analytics unavailable');
  });
  const { instrumentRequest, logTelemetry, withTelemetrySpan, shutdownTelemetry, handleTelemetryConfig } = await import('../server/telemetry.js');
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  let received = 0;
  const server = createServer(instrumentRequest(async (request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname;
    if (handleTelemetryConfig(request, response, path)) return;
    if (path.endsWith('/run')) return withTelemetrySpan('provider.query', async () => { throw new Error('private-query-value'); });
    received++;
    if (received === 2) release();
    await pending;
    await withTelemetrySpan('provider.query', async () => logTelemetry('provider_completed'));
    response.end('ok');
  }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let stopped = false;
  t.after(async () => { await new Promise(resolve => server.close(resolve)); if (!stopped) await shutdownTelemetry(); });
  const results = await Promise.all(['alice', 'bob'].map(id => fetch(`${origin}/api/profiles/${id}?secret=private-query-value`, {
    headers: { 'X-PostHog-Distinct-ID': id, 'X-PostHog-Session-ID': `session-${id}`, 'X-Request-ID': `request-${id}` },
  })));
  assert.deepEqual(await Promise.all(results.map(response => response.text())), ['ok', 'ok']);
  assert.deepEqual(results.map(response => response.headers.get('x-request-id')), ['request-alice', 'request-bob']);
  const failed = await fetch(`${origin}/api/tasks/sixshot/run?secret=private-query-value`);
  assert.equal(failed.status, 500);
  assert.equal((await failed.json()).error, 'Data is unavailable. Try again.');
  const config = await fetch(`${origin}/api/telemetry/config`);
  assert.equal(config.headers.get('cache-control'), 'no-store');
  const browserConfig = await config.json();
  assert.equal(browserConfig.token, 'phc_fixture');
  assert.equal(browserConfig.host, 'https://edge.saibot.site');
  assert.equal(browserConfig.uiHost, 'https://eu.posthog.com');
  const started = performance.now();
  await shutdownTelemetry();
  stopped = true;
  assert.ok(performance.now() - started < 6500, 'export failure must have a bounded shutdown');
  for (const id of ['alice', 'bob']) {
    const record = logs.find(log => log.body === 'provider_completed' && log.attributes.request_id === `request-${id}`);
    assert.equal(record.attributes.posthogDistinctId, id);
    assert.equal(record.attributes.sessionId, `session-${id}`);
    assert.equal(record.attributes.route, '/api/profiles/:username');
    assert.ok(record.spanContext.traceId);
  }
  assert.equal(logs.filter(log => log.body === 'api_request').length, 3);
  assert.ok(exports.length, 'the real SDK must attempt export');
  assert.ok(!JSON.stringify({ logs, exports }).includes('private-query-value'));
  const spans = exports.flatMap(payload => payload.resourceSpans?.flatMap(resource => resource.scopeSpans.flatMap(scope => scope.spans)) || []);
  assert.ok(spans.some(span => span.name === 'GET /api/profiles/:username'));
  assert.ok(spans.some(span => span.name === 'provider.query' && span.status?.code === 2));
});
