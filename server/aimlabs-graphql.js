import { logTelemetry, withTelemetrySpan } from './telemetry.js';

const endpoint = "https://api.aimlabs.com/graphql";
export const providerTimeoutMs = 10_000;
const maxConcurrentRequests = 4;
const maxResponseBytes = 1_000_000;

const schemaCooldownMs = 5 * 60_000;
export const providerChangedMessage = "Aimlabs no longer provides this data.";

let activeRequests = 0;
let retryAfter = 0;
// Operations whose query the provider rejected as invalid; skipped until the time stored here.
const unavailableUntil = new Map();
const outcomes = { lastSuccessAt: null, lastFailure: null };

export function providerHealth(now = Date.now()) {
  const unavailable = [...unavailableUntil].filter(([, until]) => until > now).map(([operation]) => operation);
  const { lastSuccessAt, lastFailure } = outcomes;
  const state = unavailable.length ? 'unavailable' : !lastSuccessAt && !lastFailure ? 'unknown'
    : lastFailure && (!lastSuccessAt || lastFailure.at > lastSuccessAt) ? 'degraded' : 'ok';
  return { state, unavailableOperations: unavailable, lastSuccessAt, lastFailure };
}

const safeCode = code => typeof code === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(code);
const deniedCodes = ['UNAUTHORIZED', 'UNAUTHENTICATED', 'FORBIDDEN', 'access-denied', 'permission-error'];

// Reduces provider errors to fixed classes and schema identifiers, so logs never carry free text.
function classifyErrors(errors) {
  const codes = [...new Set(errors.map(item => item.extensions?.code).filter(safeCode))];
  const missing = errors.map(item => String(item.message || '').match(/field '([A-Za-z_][A-Za-z0-9_]{0,63})' not found in type: '([A-Za-z_][A-Za-z0-9_]{0,63})'/))
    .find(Boolean);
  // Only query-shape errors count; variable errors come from user input and must not block an operation.
  const schema = missing || errors.some(item => item.extensions?.code === 'validation-failed'
    && String(item.extensions?.path || '').startsWith('$.selectionSet'));
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
  if (Date.now() < (unavailableUntil.get(operation) || 0)) {
    throw providerChangedError(missingDataMessage, { providerCooldown: true });
  }
  if (Date.now() < retryAfter) {
    const error = new Error("Aimlabs is rate limiting requests. Try again shortly.");
    error.status = 503;
    error.retryAfter = Math.ceil((retryAfter - Date.now()) / 1000);
    throw error;
  }
  if (activeRequests >= maxConcurrentRequests) {
    const error = new Error("Aimlabs data is busy. Try again shortly.");
    error.status = 503;
    throw error;
  }

  activeRequests++;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(providerTimeoutMs),
    });
    span?.setAttribute('http.response.status_code', response.status);
    if (response.status === 429) {
      const seconds = retryDelaySeconds(response.headers.get("Retry-After"));
      retryAfter = Math.max(retryAfter, Date.now() + seconds * 1000);
      const error = new Error("Aimlabs is rate limiting requests. Try again shortly.");
      error.status = 503;
      error.providerStatus = 429;
      error.retryAfter = seconds;
      throw error;
    }
    if (!response.ok) {
      const error = new Error('Aimlabs provider request failed');
      error.providerStatus = response.status;
      if ([500, 502, 503, 504].includes(response.status)) error.status = 503;
      throw error;
    }
    const payload = await readBoundedJson(response);
    if (payload.errors?.length || !payload.data?.Trainer) {
      const { codes, errorClass, missingField } = classifyErrors(payload.errors || []);
      if (errorClass === 'schema') {
        unavailableUntil.set(operation, Date.now() + schemaCooldownMs);
        throw providerChangedError(missingDataMessage, { providerCodes: codes, providerMissingField: missingField });
      }
      const error = new Error(missingDataMessage);
      error.providerFailure = payload.errors?.length ? 'graphql_errors' : 'missing_data';
      error.providerCodes = codes;
      error.providerErrorClass = payload.errors?.length ? errorClass : undefined;
      throw error;
    }
    return payload.data.Trainer;
  } finally {
    activeRequests--;
  }
}
