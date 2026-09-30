import { queryAimlabs } from "./aimlabs-graphql.js";

const pageSize = 12;
const cacheLifeMs = 45_000;
const maxCacheEntries = 120;

export const runFields = `              id score startedAt endedAt mode convertedMode taskVersion weaponName gridshieldStatus
              manifest {
                taskName weaponId taskVersion duration pauseDuration inputDevice
                appVersion analyticsVersion replayAvailable performanceData
              }
`;

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
              ${runFields}
            }
          }
        }
      }
    }
  }
`;

const cache = new Map();

function send(response, status, body, extraHeaders = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders,
  });
  response.end(JSON.stringify(body));
}

function reportedMetrics(data) {
  const keys = [
    "hitsTotal", "shotsTotal", "missesTotal", "killTotal", "targetsTotal",
    "headshots", "bodyshots", "damageTotal", "accTotal", "avgDist", "timePerKill",
  ];
  const metrics = {};
  for (const key of keys) {
    if (typeof data?.[key] === "number" && Number.isFinite(data[key])) metrics[key] = data[key];
  }
  return metrics;
}

export function publicRun(play) {
  return {
    id: play.id,
    score: play.score,
    startedAt: play.startedAt,
    endedAt: play.endedAt,
    mode: play.mode,
    convertedMode: play.convertedMode,
    taskVersion: play.taskVersion ?? play.manifest.taskVersion,
    weaponId: play.manifest.weaponId,
    weaponName: play.weaponName,
    gridshieldStatus: play.gridshieldStatus,
    duration: play.manifest.duration,
    pauseDuration: play.manifest.pauseDuration,
    inputDevice: play.manifest.inputDevice,
    appVersion: play.manifest.appVersion,
    analyticsVersion: play.manifest.analyticsVersion,
    replayAvailable: play.manifest.replayAvailable,
    metrics: reportedMetrics(play.manifest.performanceData),
  };
}

export async function getPlayerTaskRuns(username, taskId, after = null) {
  const key = JSON.stringify([username, taskId, after]);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.savedAt < cacheLifeMs) return cached.result;
  const trainer = await queryAimlabs(query, { username, taskId, after, first: pageSize },
    "Aimlabs did not return run history");
  const profile = trainer.aimlabProfile;
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
