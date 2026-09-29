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

export async function queryAimlabs(query, variables, missingDataMessage) {
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
    if (response.status === 429) {
      const seconds = retryDelaySeconds(response.headers.get("Retry-After"));
      retryAfter = Date.now() + seconds * 1000;
      const error = new Error("Aimlabs is rate limiting requests. Try again shortly.");
      error.status = 503;
      error.retryAfter = seconds;
      throw error;
    }
    if (!response.ok) throw new Error(`Aimlabs returned HTTP ${response.status}`);
    const payload = await readBoundedJson(response);
    if (payload.errors?.length || !payload.data?.Trainer) throw new Error(missingDataMessage);
    return payload.data.Trainer;
  } finally {
    activeRequests--;
  }
}
