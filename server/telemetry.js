import { randomUUID } from 'node:crypto';
import { PostHog } from 'posthog-node';
import { LoggerProvider, BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { context as otelContext, trace } from '@opentelemetry/api';

const key = process.env.POSTHOG_PROJECT_TOKEN;
const host = process.env.POSTHOG_HOST || 'https://eu.i.posthog.com';
const environment = process.env.AIMLAB_ENV || 'development';
const service = process.env.POSTHOG_SERVICE || 'aimlab-api';
const configured = Boolean(key);
if (configured && (!/^phc_[A-Za-z0-9]+$/.test(key) || !['https://eu.i.posthog.com', 'https://us.i.posthog.com'].includes(host))) {
  throw new Error('Use a PostHog project token and its EU or US ingestion host');
}

const client = configured ? new PostHog(key, {
  host, flushAt: 50, flushInterval: 5000, maxQueueSize: 500,
  requestTimeout: 3000, fetchRetryCount: 1, fetchRetryDelay: 1000,
  disableGeoip: true, enableExceptionAutocapture: false,
  traces: { serviceName: service, environment, maxQueueSize: 500, maxExportBatchSize: 50, flushIntervalMs: 5000 },
}) : null;
const logProvider = configured ? new LoggerProvider({
  resource: resourceFromAttributes({ 'service.name': service, 'deployment.environment': environment }),
  logRecordLimits: { attributeCountLimit: 24, attributeValueLengthLimit: 256 },
  processors: [new BatchLogRecordProcessor({
    exporter: new OTLPLogExporter({ url: `${host}/i/v1/logs`, headers: { Authorization: `Bearer ${key}` }, timeoutMillis: 3000 }),
    maxQueueSize: 500, maxExportBatchSize: 50, scheduledDelayMillis: 5000, exportTimeoutMillis: 4000,
  })],
}) : null;
const logger = logProvider?.getLogger('aimlab-tracker');

export function publicTelemetryConfig() {
  return { enabled: configured, ...(configured ? { token: key, host, environment } : {}) };
}

export function handleTelemetryConfig(request, response, pathname) {
  if (pathname !== '/api/telemetry/config') return false;
  if (request.method !== 'GET') response.writeHead(405, { Allow: 'GET' }).end();
  else response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(publicTelemetryConfig()));
  return true;
}

export function requestRoute(pathname) {
  const patterns = [
    [/^\/api\/profiles\/[^/]+\/tasks\/[^/]+\/runs$/, '/api/profiles/:username/tasks/:taskId/runs'],
    [/^\/api\/profiles\/[^/]+\/(lookup|details|activity)$/, '/api/profiles/:username/$1'],
    [/^\/api\/profiles\/[^/]+$/, '/api/profiles/:username'],
    [/^\/api\/tasks\/search$/, '/api/tasks/search'],
    [/^\/api\/tasks\/[^/]+\/(leaderboard|details|run)$/, '/api/tasks/:taskId/$1'],
    [/^\/api\/tasks\/[^/]+$/, '/api/tasks/:taskId'],
    [/^\/api\/benchmarks\/[^/]+$/, '/api/benchmarks/:community'],
    [/^\/api\/leaderboards\/[^/]+(?:\/[^/]+){1,3}$/, '/api/leaderboards/:selection'],
  ];
  for (const [pattern, route] of patterns) if (pattern.test(pathname)) return pathname.replace(pattern, route);
  return '/api/unknown';
}

function safeId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : undefined;
}

export function logTelemetry(event, attributes = {}, severity = 'INFO') {
  if (!logger) return;
  const context = client.getContext();
  const traceparent = client.getActiveSpan()?.traceparent();
  const [, traceId, spanId, flags] = traceparent?.split('-') || [];
  logger.emit({
    body: event, severityText: severity, severityNumber: severity === 'ERROR' ? 17 : severity === 'WARN' ? 13 : 9,
    attributes: { ...context?.properties, ...(context?.distinctId ? { posthogDistinctId: context.distinctId } : {}), ...attributes },
    ...(traceparent ? { context: trace.setSpanContext(otelContext.active(), { traceId, spanId, traceFlags: parseInt(flags, 16) }) } : {}),
  });
}

export function captureTelemetry(event, properties = {}) {
  client?.capture({ distinctId: `service:${service}`, event, properties: { environment, service, $process_person_profile: false, ...properties } });
}

export function withTelemetrySpan(name, work, attributes = {}) {
  if (!client) return work();
  return client.withSpan(name, async span => {
    span.setAttributes(attributes);
    try { return await work(span); }
    catch (error) {
      span.setStatus('error');
      span.setAttribute('error.type', error?.name || 'Error');
      // Provider messages can contain query values; retain failure metadata only.
      span.end();
      throw error;
    }
  });
}

export function instrumentRequest(handler) {
  return async (request, response) => {
    const pathname = (request.url || '').split('?')[0];
    if (!client || !pathname.startsWith('/api/') || pathname === '/api/telemetry/config') return handler(request, response);
    const route = requestRoute(pathname);
    const requestId = safeId(request.headers['x-request-id']) || randomUUID();
    const sessionId = safeId(request.headers['x-posthog-session-id']);
    const distinctId = safeId(request.headers['x-posthog-distinct-id']);
    const started = performance.now();
    const properties = { request_id: requestId, route, environment, ...(sessionId ? { sessionId, $session_id: sessionId } : {}) };
    response.setHeader('X-Request-ID', requestId);
    return client.withContext({ distinctId, sessionId, properties }, () => withTelemetrySpan(`${request.method} ${route}`, async span => {
      try { return await handler(request, response); }
      catch (error) {
        client.captureException(new Error('Unhandled API request failure'), distinctId || `request:${requestId}`, { ...properties, $process_person_profile: false });
        logTelemetry('api_unhandled_error', { error_type: error?.name || 'Error' }, 'ERROR');
        if (!response.headersSent) response.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Data is unavailable. Try again.' }));
        else response.destroy();
      } finally {
        const aborted = !response.writableEnded;
        span.setAttributes({ 'http.response.status_code': response.statusCode, aborted });
        if (response.statusCode >= 500 || aborted) span.setStatus('error');
        logTelemetry('api_request', { method: request.method, status: response.statusCode, duration_ms: Math.round(performance.now() - started), aborted }, response.statusCode >= 500 ? 'ERROR' : 'INFO');
      }
    }, { 'http.route': route, 'http.request.method': request.method, request_id: requestId }));
  };
}

export async function shutdownTelemetry() {
  await Promise.allSettled([client?.shutdown(5000), logProvider?.shutdown()]);
}

export function installTelemetryShutdown(server) {
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => process.exit(0), 10_000);
    server.close(async () => {
      await shutdownTelemetry();
      clearTimeout(deadline);
      process.exit(0);
    });
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
}
