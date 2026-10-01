import { createRequestCache } from "./request-cache.js";
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
      }
    }
  }
`;

const taskQuery = `
  query PublicTaskDetails($taskId: String!) {
    Trainer {
      aimlab {
        task(slug: $taskId) {
          id style duration version weapon_id created_at updated_at
          asset { id currentVersion }
        }
      }
    }
  }
`;

const activityQuery = `
  query PublicPlayerActivity($username: String!) {
    Trainer {
      aimlabProfile(username: $username) {
        username
        activity(interval: DAILY) { ranges { startDate endDate } }
        learningStats { stars completedPlans }
      }
    }
  }
`;

const cached = createRequestCache({ ttlMs: cacheLifeMs, maxEntries: maxCacheEntries, name: 'details' });

function send(response, status, body, headers = {}) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  response.end(JSON.stringify(body));
}

async function requestDetails(key, query, variables, normalize) {
  return cached(key, async () => {
    const trainer = await queryAimlabs(query, variables, "Aimlabs did not return public details");
    const result = normalize(trainer);
    if (!result) {
      const error = new Error("Not found");
      error.status = 404;
      throw error;
    }
    return result;
  });
}

function achievementValue(metrics, slug) {
  const value = metrics?.find((metric) => metric.slug === slug)?.value;
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function publicProfile(trainer) {
  const profile = trainer.aimlabProfile;
  if (!profile) return null;
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
    taskVersion: task.version,
    weaponId: task.weapon_id,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
    assetVersion: task.asset?.currentVersion || null,
    fetchedAt: new Date().toISOString(),
  };
}

function publicActivity(trainer) {
  const profile = trainer.aimlabProfile;
  if (!profile) return null;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const recentStart = Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate());
  const dayMs = 86_400_000;
  const intervals = [];
  for (const range of profile.activity?.ranges || []) {
    const start = Date.parse(`${range.startDate}T00:00:00Z`);
    const end = Date.parse(`${range.endDate}T00:00:00Z`);
    if (Number.isFinite(start) && Number.isFinite(end) && start <= end && start <= today) {
      intervals.push([start, Math.min(end, today)]);
    }
  }
  intervals.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [start, end] of intervals) {
    const last = merged.at(-1);
    if (last && start <= last[1] + dayMs) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  let activeDays = 0;
  let recentActiveDays = 0;
  const daysByYear = new Map();
  for (const [start, end] of merged) {
    activeDays += Math.round((end - start) / dayMs) + 1;
    if (end >= recentStart) recentActiveDays += Math.round((end - Math.max(start, recentStart)) / dayMs) + 1;
    for (let cursor = start; cursor <= end;) {
      const year = new Date(cursor).getUTCFullYear();
      const nextYear = Date.UTC(year + 1, 0, 1);
      const yearEnd = Math.min(end, nextYear - dayMs);
      daysByYear.set(year, (daysByYear.get(year) || 0) + Math.round((yearEnd - cursor) / dayMs) + 1);
      cursor = nextYear;
    }
  }
  const firstYear = merged.length ? new Date(merged[0][0]).getUTCFullYear() : now.getUTCFullYear();
  const years = Array.from({ length: now.getUTCFullYear() - firstYear + 1 }, (_, index) => ({
    year: firstYear + index,
    activeDays: daysByYear.get(firstYear + index) || 0,
  }));
  return {
    username: profile.username,
    years,
    activeDays,
    recentActiveDays,
    learning: {
      stars: profile.learningStats?.stars ?? null,
      completedPlans: profile.learningStats?.completedPlans ?? null,
    },
    fetchedAt: new Date().toISOString(),
  };
}

export function getPublicProfileDetails(username) {
  return requestDetails(`profile:${username}`, profileQuery, { username }, publicProfile);
}

export function getPublicTaskDetails(taskId) {
  return requestDetails(`task:${taskId}`, taskQuery, { taskId }, publicTask);
}

export function getPublicActivity(username) {
  return requestDetails(`activity:${username}`, activityQuery, { username }, publicActivity);
}

export async function handlePublicDetailsRequest(request, response, pathname) {
  const profileMatch = pathname.match(/^\/api\/profiles\/([^/]+)\/details$/);
  const activityMatch = pathname.match(/^\/api\/profiles\/([^/]+)\/activity$/);
  const taskMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/details$/);
  if (!profileMatch && !activityMatch && !taskMatch) return false;
  if (request.method !== "GET") {
    send(response, 405, { error: "Method not allowed" });
    return true;
  }
  let id;
  try {
    id = decodeURIComponent((profileMatch || activityMatch || taskMatch)[1]);
  } catch {
    send(response, 400, { error: "Invalid path" });
    return true;
  }
  const limit = taskMatch ? 256 : 64;
  if (!id || id.length > limit || /[\x00-\x1f]/.test(id)) {
    send(response, 400, { error: "Invalid public details request" });
    return true;
  }
  try {
    const result = profileMatch ? await getPublicProfileDetails(id)
      : activityMatch ? await getPublicActivity(id) : await getPublicTaskDetails(id);
    send(response, 200, result, { "Cache-Control": "public, max-age=60" });
  } catch (error) {
    const status = error.status || 502;
    if (status === 502) console.error("Public details provider failure", error);
    send(response, status, { error: status === 502 ? "Details are unavailable. Try again." : error.message },
      error.retryAfter ? { "Retry-After": String(error.retryAfter) } : {});
  }
  return true;
}
