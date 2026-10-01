import { analyticsHeaders, captureEvent } from './analytics.js';

export async function fetchData(url, options = {}) {
  const requestId = crypto.randomUUID();
  const headers = new Headers(options.headers);
  for (const [name, value] of Object.entries(analyticsHeaders())) headers.set(name, value);
  headers.set('X-Request-ID', requestId);
  let response;
  try { response = await fetch(url, { ...options, headers }); }
  catch (error) {
    if (error.name !== 'AbortError') captureEvent('api_request_failed', { request_id: requestId, reason: 'network' });
    throw error;
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || body === null) {
    if (response.status >= 500 || body === null) captureEvent('api_request_failed', { request_id: requestId, status: response.status, reason: body === null ? 'invalid_response' : 'http' });
    const error = new Error(body?.error || "Aimlabs data is unavailable. Try again.");
    error.status = response.status;
    throw error;
  }
  return body;
}
