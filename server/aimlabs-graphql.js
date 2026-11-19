import { logTelemetry, withTelemetrySpan } from './telemetry.js';

const endpoint = 'https://api.aimlab.gg/graphql';
export const providerTimeoutMs = 10_000;
const maxConcurrentRequests = 4;
// Requests that find every slot in use wait in order, briefly, instead of failing at once.
const maxWaitingRequests = 32;
const maxSlotWaitMs = 2_000;
const maxResponseBytes = 1_000_000;

const schemaCooldownMs = 5 * 60_000;
export const providerChangedMessage = "Aimlabs no longer provides this data.";

let activeRequests = 0;
const waitingRequests = [];
let retryUntil = 0;
// Provider operations whose query was last rejected as invalid, with the time until they are tried again.
const schemaFailures = new Map();
const outcomes = { lastSuccessAt: null, lastFailure: null };

export function providerHealth() {
  const unavailable = [...schemaFailures.keys()];
  const { lastSuccessAt, lastFailure } = outcomes;
  const state = unavailable.length ? 'unavailable' : !lastSuccessAt && !lastFailure ? 'unknown'
    : lastFailure && (!lastSuccessAt || lastFailure.at > lastSuccessAt) ? 'degraded' : 'ok';
  return { state, unavailableOperations: unavailable, lastSuccessAt, lastFailure };
}

const identifier = '([A-Za-z_][A-Za-z0-9_]{0,63})';
const missingFieldPatterns = [
  new RegExp(`field '${identifier}' not found in type: '${identifier}'`),
  new RegExp(`Cannot query field "${identifier}" on type "${identifier}"`),
];
const safeCode = code => typeof code === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(code);
const deniedCodes = ['UNAUTHORIZED', 'UNAUTHENTICATED', 'FORBIDDEN', 'access-denied', 'permission-error'];

// Reduces provider errors to fixed classes and schema identifiers, so logs never carry free text.
function classifyErrors(errors) {
  const codes = [...new Set(errors.map(item => item.extensions?.code).filter(safeCode))];
  const missing = errors.flatMap(item => missingFieldPatterns.map(pattern => String(item.message || '').match(pattern))).find(Boolean);
  // Variable errors come from user input and must not block an operation.
  // Query text is fixed in code, so a document validation error means the provider schema changed.
  const schema = missing || errors.some(item => item.extensions?.code === 'GRAPHQL_VALIDATION_FAILED'
    || (item.extensions?.code === 'validation-failed' && String(item.extensions?.path || '').startsWith('$.selectionSet')));
  return {
    codes,
    errorClass: schema ? 'schema' : codes.some(code => deniedCodes.includes(code)) ? 'denied' : 'other',
    missingField: missing ? `${missing[2]}.${missing[1]}` : undefined,
  };
}

function retryDelaySeconds(value) {
  const numeric = value === null ? NaN : Number(value);
  const seconds = Number.isFinite(numeric) ? numeric : (Date.parse(value) - Date.now()) / 1000;
  return Math.min(300, Math.max(15, Math.ceil(seconds) || 30));
}

async function readBoundedJson(response) {
  let size = 0;
  const chunks = [];
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > maxResponseBytes) throw new Error("Aimlabs response exceeded the page limit");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function queryAimlabs(query, variables, missingDataMessage) {
  const operation = query.match(/\bquery\s+([A-Za-z][A-Za-z0-9_]{0,63})\b/)?.[1] || 'unnamed';
  return withTelemetrySpan('aimlabs.query', async span => {
    span?.setAttribute('graphql.operation.name', operation);
    try {
      const result = await executeQuery(operation, query, variables, missingDataMessage, span);
      schemaFailures.delete(operation);
      outcomes.lastSuccessAt = new Date().toISOString();
      return result;
    } catch (error) {
      if (error.name === 'TimeoutError') error.status = 503;
      if (error.providerCooldown) throw error;
      outcomes.lastFailure = { at: new Date().toISOString(), operation, kind: error.providerFailure || error.name, errorClass: error.providerErrorClass };
      logTelemetry('aimlabs_failure', { operation, error_type: error.name, failure_kind: error.providerFailure, provider_status: error.providerStatus, provider_codes: error.providerCodes, provider_error_class: error.providerErrorClass, provider_missing_field: error.providerMissingField, retry_after_seconds: error.retryAfter }, 'WARN');
      throw error;
    }
  });
}

function providerChangedError(missingDataMessage, details) {
  const error = new Error(missingDataMessage);
  error.permanent = true;
  error.publicMessage = providerChangedMessage;
  error.providerFailure = 'graphql_errors';
  error.providerErrorClass = 'schema';
  Object.assign(error, details);
  return error;
}

async function executeQuery(operation, query, variables, missingDataMessage, span) {
  if (Date.now() < (schemaFailures.get(operation) || 0)) {
    throw providerChangedError(missingDataMessage, { providerCooldown: true });
  }
  rejectDuringRateLimit();
  await acquireSlot();
  try {
    // A rate limit can start while this request waits for a slot.
    rejectDuringRateLimit();
    const response = await fetch(endpoint, {
      method: "POST",
      // The provider rejects requests without an application User-Agent; the collector sends the same one.
      headers: { "Content-Type": "application/json", "User-Agent": "AimlabBenchmarksViewer/1.0" },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(providerTimeoutMs),
    });
    span?.setAttribute('http.response.status_code', response.status);
    if (response.status === 429) {
      const seconds = retryDelaySeconds(response.headers.get("Retry-After"));
      retryUntil = Math.max(retryUntil, Date.now() + seconds * 1000);
      const error = new Error("Aimlabs is rate limiting requests. Try again shortly.");
      error.status = 503;
      error.providerStatus = 429;
      error.retryAfter = seconds;
      throw error;
    }
    const serverFailure = [500, 502, 503, 504].includes(response.status);
    // The provider reports GraphQL errors, including denials, with 4xx statuses.
    // An unreadable 4xx body is still a provider failure; read errors on a 2xx body keep their identity.
    const payload = serverFailure ? null : response.ok ? await readBoundedJson(response) : await readBoundedJson(response).catch(() => null);
    if (!payload || (!response.ok && !payload.errors?.length)) {
      const error = new Error('Aimlabs provider request failed');
      error.providerStatus = response.status;
      if (serverFailure) error.status = 503;
      throw error;
    }
    const data = payload.data;
    if (payload.errors?.length || !data) {
      const { codes, errorClass, missingField } = classifyErrors(payload.errors || []);
      if (errorClass === 'schema') {
        schemaFailures.set(operation, Date.now() + schemaCooldownMs);
        throw providerChangedError(missingDataMessage, { providerCodes: codes, providerMissingField: missingField, providerStatus: response.status });
      }
      const error = new Error(missingDataMessage);
      error.providerFailure = payload.errors?.length ? 'graphql_errors' : 'missing_data';
      error.providerStatus = response.status;
      error.providerCodes = codes;
      error.providerErrorClass = payload.errors?.length ? errorClass : undefined;
      throw error;
    }
    return data;
  } finally {
    releaseSlot();
  }
}

function rejectDuringRateLimit() {
  if (Date.now() < retryUntil) {
    const error = new Error("Aimlabs is rate limiting requests. Try again shortly.");
    error.status = 503;
    error.retryAfter = Math.ceil((retryUntil - Date.now()) / 1000);
    throw error;
  }
}

function busyError() {
  const error = new Error("Aimlabs data is busy. Try again shortly.");
  error.status = 503;
  return error;
}

function acquireSlot() {
  if (activeRequests < maxConcurrentRequests) {
    activeRequests++;
    return Promise.resolve();
  }
  if (waitingRequests.length >= maxWaitingRequests) return Promise.reject(busyError());
  return new Promise((resolve, reject) => {
    const waiter = { resolve, timer: setTimeout(() => {
      waitingRequests.splice(waitingRequests.indexOf(waiter), 1);
      reject(busyError());
    }, maxSlotWaitMs) };
    waitingRequests.push(waiter);
  });
}

// A finished request hands its slot to the oldest waiting request.
function releaseSlot() {
  const next = waitingRequests.shift();
  if (!next) {
    activeRequests--;
    return;
  }
  clearTimeout(next.timer);
  next.resolve();
}
