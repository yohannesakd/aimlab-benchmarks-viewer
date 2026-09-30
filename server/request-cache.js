export function createRequestCache({ ttlMs, maxEntries }) {
  const completed = new Map();
  const pending = new Map();
  return function cached(key, load) {
    const entry = completed.get(key);
    if (entry && Date.now() - entry.savedAt < ttlMs) return Promise.resolve(entry.value);
    completed.delete(key);
    if (pending.has(key)) return pending.get(key);
    if (pending.size >= maxEntries) {
      const error = new Error('Aimlabs data is busy. Try again shortly.');
      error.status = 503;
      return Promise.reject(error);
    }
    const request = Promise.resolve().then(load).then(value => {
      if (completed.size >= maxEntries) completed.delete(completed.keys().next().value);
      completed.set(key, { savedAt: Date.now(), value });
      return value;
    }).finally(() => pending.delete(key));
    pending.set(key, request);
    return request;
  };
}
