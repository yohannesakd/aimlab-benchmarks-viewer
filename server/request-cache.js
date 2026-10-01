import { logTelemetry } from './telemetry.js';

export function createRequestCache({ ttlMs, maxEntries, name = 'request' }) {
  const completed = new Map();
  const pending = new Map();
  return function cached(key, load) {
    const entry = completed.get(key);
    if (entry && Date.now() - entry.savedAt < ttlMs) {
      logTelemetry('cache_read', { cache: name, result: 'hit' });
      return Promise.resolve(entry.value);
    }
    completed.delete(key);
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
      if (completed.size >= maxEntries) completed.delete(completed.keys().next().value);
      completed.set(key, { savedAt: Date.now(), value });
      return value;
    }).finally(() => pending.delete(key));
    pending.set(key, request);
    return request;
  };
}
