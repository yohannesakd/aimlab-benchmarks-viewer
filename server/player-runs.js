const endpoint = "https://api.aimlabs.com/graphql";
const pageSize = 12;
const cacheLifeMs = 45_000;
const maxCacheEntries = 120;
const maxConcurrentRequests = 4;
const maxResponseBytes = 1_000_000;

const query = `
  query PlayerTaskRuns($username: String, $taskId: String!, $after: String, $first: Int!) {
    Trainer {
      aimlabProfile(username: $username) {
        username
        latestPlay(first: $first, after: $after, filter: { taskId: $taskId, appId: AIMLAB, isMultiplayer: false }) {
          totalCount
          pageInfo { endCursor hasNextPage }
          edges {
            node {
              id score startedAt endedAt mode convertedMode taskVersion
              manifest {
                taskName weaponId duration inputDevice replayAvailable performanceData
              }
            }
          }
        }
      }
    }
  }
`;

const cache = new Map();
let activeRequests = 0;
let retryAfter = 0;

function send(response, status, body, extraHeaders = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders,
  });
  response.end(JSON.stringify(body));
}

function reportedMetrics(data) {
  const keys = ["hitsTotal", "shotsTotal", "killTotal", "targetsTotal", "accTotal"];
  const metrics = {};
  for (const key of keys) {
    if (typeof data?.[key] === "number" && Number.isFinite(data[key])) metrics[key] = data[key];
  }
  return metrics;
}

function publicRun(play) {
  return {
    id: play.id,
    score: play.score,
    startedAt: play.startedAt,
    endedAt: play.endedAt,
    mode: play.mode,
    convertedMode: play.convertedMode,
    taskVersion: play.taskVersion,
    weaponId: play.manifest.weaponId,
    duration: play.manifest.duration,
    inputDevice: play.manifest.inputDevice,
    replayAvailable: play.manifest.replayAvailable,
    metrics: reportedMetrics(play.manifest.performanceData),
  };
}

async function readBoundedJson(response) {
  let size = 0;
  const chunks = [];
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > maxResponseBytes) {
      throw new Error("Aimlabs response exceeded the page limit");
    }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function getPlayerTaskRuns(username, taskId, after = null) {
  const key = JSON.stringify([username, taskId, after]);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.savedAt < cacheLifeMs) return cached.result;
  if (Date.now() < retryAfter) {
    const error = new Error("Aimlabs is rate limiting requests. Try again shortly.");
    error.status = 503;
    error.retryAfter = Math.ceil((retryAfter - Date.now()) / 1000);
    throw error;
  }
  if (activeRequests >= maxConcurrentRequests) {
    const error = new Error("Run history is busy. Try again shortly.");
    error.status = 503;
    throw error;
  }

  activeRequests++;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { username, taskId, after, first: pageSize } }),
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 429) {
      const seconds = Math.min(300, Math.max(15, Number(response.headers.get("retry-after")) || 30));
      retryAfter = Date.now() + seconds * 1000;
      const error = new Error("Aimlabs is rate limiting requests. Try again shortly.");
      error.status = 503;
      error.retryAfter = seconds;
      throw error;
    }
    if (!response.ok) throw new Error(`Aimlabs returned HTTP ${response.status}`);
    const payload = await readBoundedJson(response);
    if (payload.errors?.length || !payload.data?.Trainer) throw new Error("Aimlabs did not return run history");
    const profile = payload.data.Trainer.aimlabProfile;
    if (!profile) {
      const error = new Error("Player not found");
      error.status = 404;
      throw error;
    }
    const history = profile.latestPlay;
    if (!history?.pageInfo || !Array.isArray(history.edges)) throw new Error("Aimlabs returned an incomplete run page");
    const plays = history.edges.filter((edge) => edge?.node).map((edge) => edge.node);
    const result = {
      username: profile.username,
      taskId,
      taskName: plays[0]?.manifest.taskName || taskId,
      totalCount: history.totalCount,
      pageInfo: history.pageInfo,
      runs: plays.map(publicRun),
      fetchedAt: new Date().toISOString(),
    };
    if (cache.size >= maxCacheEntries) cache.delete(cache.keys().next().value);
    cache.set(key, { savedAt: Date.now(), result });
    return result;
  } finally {
    activeRequests--;
  }
}

export async function handlePlayerRunsRequest(request, response, pathname, searchParams) {
  const match = pathname.match(/^\/api\/profiles\/([^/]+)\/tasks\/([^/]+)\/runs$/);
  if (!match) return false;
  if (request.method !== "GET") {
    send(response, 405, { error: "Method not allowed" });
    return true;
  }
  let username;
  let taskId;
  try {
    username = decodeURIComponent(match[1]);
    taskId = decodeURIComponent(match[2]);
  } catch {
    send(response, 400, { error: "Invalid path" });
    return true;
  }
  const after = searchParams.get("after");
  if (!username || username.length > 64 || !taskId || taskId.length > 256 ||
      (after !== null && (after.length > 512 || /[\x00-\x1f]/.test(after)))) {
    send(response, 400, { error: "Invalid run history request" });
    return true;
  }
  try {
    const result = await getPlayerTaskRuns(username, taskId, after);
    send(response, 200, result, { "Cache-Control": "public, max-age=30" });
  } catch (error) {
    const status = error.status || 502;
    if (status === 502) console.error("Run history provider failure", error);
    send(response, status, { error: status === 502 ? "Run history is unavailable. Try again." : error.message },
      error.retryAfter ? { "Retry-After": String(error.retryAfter) } : {});
  }
  return true;
}
