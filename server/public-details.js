import { queryAimlabs } from "./aimlabs-graphql.js";

const cacheLifeMs = 60_000;
const maxCacheEntries = 100;

const profileQuery = `
  query PublicPlayerDetails($username: String!) {
    Trainer {
      aimlabProfile(username: $username) {
        username imageUrl
        achievementMetrics(slugs: ["days-since-account-creation", "streak-days"]) { slug value }
        activity(interval: DAILY) {
          latestStreak { endDate streakCount }
          highestStreak { streakCount }
        }
        recommendedTasks(app: AIMLAB, engine: DAILY_PLAYLIST, max: 1) {
          aimlabTask { id name }
        }
      }
    }
  }
`;

const taskQuery = `
  query PublicTaskDetails($taskId: String!) {
    Trainer {
      aimlab {
        task(slug: $taskId) {
          id style duration mode version weapon_id created_at updated_at
          asset { id currentVersion }
        }
      }
    }
  }
`;

const cache = new Map();

function send(response, status, body, headers = {}) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  response.end(JSON.stringify(body));
}

async function requestDetails(key, query, variables, normalize) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.savedAt < cacheLifeMs) return cached.result;
  const trainer = await queryAimlabs(query, variables, "Aimlabs did not return public details");
  const result = normalize(trainer);
  if (!result) {
    const error = new Error("Not found");
    error.status = 404;
    throw error;
  }
  if (cache.size >= maxCacheEntries) cache.delete(cache.keys().next().value);
  cache.set(key, { savedAt: Date.now(), result });
  return result;
}

function achievementValue(metrics, slug) {
  const value = metrics?.find((metric) => metric.slug === slug)?.value;
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function publicProfile(trainer) {
  const profile = trainer.aimlabProfile;
  if (!profile) return null;
  const pick = profile.recommendedTasks?.[0];
  const activity = profile.activity;
  return {
    username: profile.username,
    imageUrl: /^https:\/\//.test(profile.imageUrl || "") ? profile.imageUrl : null,
    accountAgeDays: achievementValue(profile.achievementMetrics, "days-since-account-creation"),
    currentStreakDays: achievementValue(profile.achievementMetrics, "streak-days"),
    bestDailyStreakDays: activity?.highestStreak?.streakCount ?? null,
    latestDailyStreak: activity?.latestStreak ? {
      days: activity.latestStreak.streakCount,
      endedOn: activity.latestStreak.endDate,
    } : null,
    dailyPick: pick?.aimlabTask?.name ? {
      taskId: pick.aimlabTask.id,
      name: pick.aimlabTask.name,
    } : null,
    fetchedAt: new Date().toISOString(),
  };
}

function publicTask(trainer) {
  const task = trainer.aimlab?.task;
  if (!task) return null;
  return {
    id: task.id,
    style: task.style,
    durationSeconds: Number.isFinite(task.duration) ? task.duration : null,
    mode: task.mode,
    taskVersion: task.version,
    weaponId: task.weapon_id,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
    assetVersion: task.asset?.currentVersion || null,
    fetchedAt: new Date().toISOString(),
  };
}

export function getPublicProfileDetails(username) {
  return requestDetails(`profile:${username}`, profileQuery, { username }, publicProfile);
}

export function getPublicTaskDetails(taskId) {
  return requestDetails(`task:${taskId}`, taskQuery, { taskId }, publicTask);
}

export async function handlePublicDetailsRequest(request, response, pathname) {
  const profileMatch = pathname.match(/^\/api\/profiles\/([^/]+)\/details$/);
  const taskMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/details$/);
  if (!profileMatch && !taskMatch) return false;
  if (request.method !== "GET") {
    send(response, 405, { error: "Method not allowed" });
    return true;
  }
  let id;
  try {
    id = decodeURIComponent((profileMatch || taskMatch)[1]);
  } catch {
    send(response, 400, { error: "Invalid path" });
    return true;
  }
  const limit = profileMatch ? 64 : 256;
  if (!id || id.length > limit || /[\x00-\x1f]/.test(id)) {
    send(response, 400, { error: "Invalid public details request" });
    return true;
  }
  try {
    const result = profileMatch ? await getPublicProfileDetails(id) : await getPublicTaskDetails(id);
    send(response, 200, result, { "Cache-Control": "public, max-age=60" });
  } catch (error) {
    const status = error.status || 502;
    if (status === 502) console.error("Public details provider failure", error);
    send(response, status, { error: status === 502 ? "Details are unavailable. Try again." : error.message },
      error.retryAfter ? { "Retry-After": String(error.retryAfter) } : {});
  }
  return true;
}
