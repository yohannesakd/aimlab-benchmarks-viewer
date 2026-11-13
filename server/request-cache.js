import { logTelemetry } from './telemetry.js';

export function createRequestCache({ ttlMs, maxEntries, name = 'request' }) {
  const completed = new Map();
  const pending = new Map();
  return function cached(key, load, { staleIfErrorMs = 0, canUseStale } = {}) {
    const entry = completed.get(key);
    if (entry && Date.now() - entry.savedAt < ttlMs) {
      logTelemetry('cache_read', { cache: name, result: 'hit' });
      return Promise.resolve(entry.value);
    }
    if (pending.has(key)) {
      logTelemetry('cache_read', { cache: name, result: 'shared' });
      return pending.get(key);
    }
    if (pending.size >= maxEntries) {
      logTelemetry('cache_read', { cache: name, result: 'busy' }, 'WARN');
      const error = new Error('Aimlabs data is busy. Try again shortly.');
      error.status = 503;
      return Promise.reject(error);
    }
    logTelemetry('cache_read', { cache: name, result: 'miss' });
    const request = Promise.resolve().then(load).then(value => {
      if (!completed.has(key) && completed.size >= maxEntries) completed.delete(completed.keys().next().value);
      completed.set(key, { savedAt: Date.now(), value });
      return value;
    }).catch(error => {
      const denied = [401, 403, 404].includes(error.status) || [401, 403, 404].includes(error.providerStatus)
        || error.providerCodes?.some(code => ['UNAUTHORIZED', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND'].includes(code));
      const sameIdentity = !entry || !canUseStale || canUseStale(entry.value);
      if (denied || !sameIdentity) completed.delete(key);
      const transient = error.providerCodes === undefined && !denied && (
        error.name === 'TimeoutError' || [500, 502, 503, 504].includes(error.providerStatus)
        || (error.status === 503 && error.providerStatus === undefined)
      );
      if (entry && sameIdentity && transient && staleIfErrorMs > 0 && Date.now() - entry.savedAt < ttlMs + staleIfErrorMs) {
        logTelemetry('cache_read', { cache: name, result: 'stale', age_ms: Date.now() - entry.savedAt,
          error_type: error.name, provider_status: error.providerStatus, provider_codes: error.providerCodes, status: error.status }, 'WARN');
        return entry.value;
      }
      throw error;
    }).finally(() => pending.delete(key));
    pending.set(key, request);
    return request;
  };
}
