import { logTelemetry, withTelemetrySpan } from './telemetry.js';

const endpoint = "https://api.aimlabs.com/graphql";
const maxConcurrentRequests = 4;
const maxResponseBytes = 1_000_000;

let activeRequests = 0;
let retryAfter = 0;

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
  return withTelemetrySpan('aimlabs.query', async span => {
    try { return await executeQuery(query, variables, missingDataMessage, span); }
    catch (error) {
      logTelemetry('aimlabs_failure', { error_type: error.name, provider_status: error.providerStatus, provider_codes: error.providerCodes, retry_after_seconds: error.retryAfter }, 'WARN');
      throw error;
    }
  });
}

async function executeQuery(query, variables, missingDataMessage, span) {
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
      signal: AbortSignal.timeout(10_000),
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
      throw error;
    }
    const payload = await readBoundedJson(response);
    if (payload.errors?.length || !payload.data?.Trainer) {
      const error = new Error(missingDataMessage);
      error.providerCodes = [...new Set((payload.errors || []).map(item => item.extensions?.code)
        .filter(code => typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(code)))];
      throw error;
    }
    return payload.data.Trainer;
  } finally {
    activeRequests--;
  }
}
