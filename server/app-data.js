import { queryAimlabs } from "./aimlabs-graphql.js";
import { GET_USER_INFO, GET_USER_PLAYS_AGG, GET_TASK_BY_ID, GET_TASKS_BY_NAME, GET_TASK_LEADERBOARD } from "./app-queries.js";
import { cleanUpUserTasks, cleanUpBenchmarkTasks, caclulateVT, calculateRevosectBenchmarks } from "../src/helpers/functions.js";
import { advancedBench, intermediateBench, noviceBench, advancedRanks, intermediateRanks, noviceRanks, categories, advancedEnergy, intermediateEnergy, noviceEnergy } from "../src/helpers/voltaicData.js";
import { publicRun, runFields } from "./player-runs.js";

const cache = new Map();
const pending = new Map();
const cacheLifeMs = 60_000;

async function cached(key, load) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.savedAt < cacheLifeMs) return entry.value;
  if (pending.has(key)) return pending.get(key);
  const request = load().then((value) => {
    if (cache.size >= 120) cache.delete(cache.keys().next().value);
    cache.set(key, { savedAt: Date.now(), value });
    return value;
  }).finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}

function notFound(message) {
  const error = new Error(message);
  error.status = 404;
  throw error;
}

export function getProfileLookup(username) {
  return cached(`lookup:${username}`, async () => {
    const { aimlabProfile: profile } = await queryAimlabs(GET_USER_INFO, { username }, "Profile lookup failed");
    if (!profile) return notFound("Player not found");
    return { username: profile.username, id: profile.user.id, rank: profile.ranking?.rank?.displayName || "Unranked", skill: profile.ranking?.skill ?? 0 };
  });
}

export function calculateProfile(playerInfo, rows) {
  const tasks = cleanUpUserTasks(rows);
  const benchmarkTasks = cleanUpBenchmarkTasks(rows);
  const benchmarks = {};
  for (const [key, mode, bench, ranks, energyList] of [
    ["VTAdvanced", "advanced", advancedBench, advancedRanks, advancedEnergy],
    ["VTIntermediate", "intermediate", intermediateBench, intermediateRanks, intermediateEnergy],
    ["VTNovice", "novice", noviceBench, noviceRanks, noviceEnergy],
  ]) {
    const result = caclulateVT(benchmarkTasks, structuredClone(bench), mode);
    result.categories = result.subCategoryEnergy.map((energy, index) => ({
      category: categories[index], energy, rank: ranks[Math.floor(energy / 100) * 100] || "Unranked",
    }));
    for (const scenario of result.benchmarks) {
      const energy = scenario.energy;
      const firstRank = energyList[1];
      scenario.energyProgress = {
        value: energy >= energyList[4] ? 100 : energy < firstRank ? energy : energy % 100,
        max: mode === "novice" || energy >= firstRank ? 100 : firstRank,
      };
    }
    benchmarks[key] = result;
  }
  for (const mode of ["hard", "medium", "easy"]) {
    benchmarks[`RA${mode[0].toUpperCase()}${mode.slice(1)}`] = calculateRevosectBenchmarks({ tasks: benchmarkTasks, id: playerInfo.id }, mode);
  }
  return { playerInfo, tasks, totals: { tasksPlayed: tasks.length, totalPlays: tasks.reduce((sum, task) => sum + task.count, 0) }, benchmarkSets: [{ id: "legacy", label: "Legacy benchmark set", results: benchmarks }] };
}

export function getProfile(username) {
  return cached(`profile:${username}`, async () => {
    const playerInfo = await getProfileLookup(username);
    const trainer = await queryAimlabs(GET_USER_PLAYS_AGG, { where: {
      is_practice: { _eq: false }, score: { _gt: 0 }, user_id: { _eq: playerInfo.id },
    } }, "Player statistics failed");
    if (!Array.isArray(trainer.aimlab?.plays_agg)) throw new Error("Incomplete player statistics");
    return calculateProfile(playerInfo, trainer.aimlab.plays_agg);
  });
}

export function getTask(taskId) {
  return cached(`task:${taskId}`, async () => {
    const trainer = await queryAimlabs(GET_TASK_BY_ID, { slug: taskId }, "Task lookup failed");
    return trainer.aimlab?.task || notFound("Task not found");
  });
}

export function getTaskSearch(name) {
  return cached(`search:${name}`, async () => {
    const trainer = await queryAimlabs(GET_TASKS_BY_NAME, { name }, "Task search failed");
    if (!Array.isArray(trainer.aimlab?.tasks)) throw new Error("Incomplete task search");
    return trainer.aimlab.tasks;
  });
}

async function leaderboard(input) {
  const trainer = await queryAimlabs(GET_TASK_LEADERBOARD, { leaderboardInput: { clientId: "aimlab", taskMode: 0, ...input } }, "Task leaderboard failed");
  const result = trainer.aimlab?.leaderboard;
  if (!Array.isArray(result?.data) || !result.metadata) throw new Error("Incomplete task leaderboard");
  return result;
}

export function getTaskLeaderboard(taskId, page = 0) {
  return cached(`leaderboard:${taskId}:${page}`, async () => {
    const task = await getTask(taskId);
    const result = await leaderboard({ taskId, weaponId: task.weapon_id, limit: 25, offset: page * 25 });
    return {
      pagination: { ...result.metadata, pageCount: Math.max(0, Math.ceil(result.metadata.totalRows / 25) - 1) },
      data: result.data.map((row) => ({ rank: row.rank, username: row.username, score: row.score,
        accuracy: Number.isFinite(row.accuracy) ? `${Math.round(row.accuracy * 100) / 100}%` : "—",
        shotsHit: row.shots_hit ?? "—", playId: row.play_id, date: row.ended_at })),
    };
  });
}

function leaderboardRun(row) {
  const metrics = {};
  for (const [source, key] of Object.entries({ shots_hit: "hitsTotal", shots_fired: "shotsTotal", shots_missed: "missesTotal", kills: "killTotal", targets: "targetsTotal", accuracy: "accTotal", time_per_kill: "timePerKill" })) {
    if (Number.isFinite(row[source])) metrics[key] = row[source];
  }
  for (const key of ["avgDist", "damageTotal"]) if (Number.isFinite(row.custom?.[key])) metrics[key] = row.custom[key];
  return { id: row.play_id, score: row.score, startedAt: row.started_at, endedAt: row.ended_at, duration: row.task_duration,
    pauseDuration: row.pause_duration, inputDevice: row.input_device ? [row.input_device] : [], metrics,
    detailsSource: "leaderboard", replayAvailable: null };
}

export function getRunDetails(taskId, username, playId, weapon, score) {
  return cached(JSON.stringify(["run", taskId, username, playId, weapon, score]), async () => {
    let row;
    if (!playId) {
      const result = await leaderboard({ taskId, username, weaponId: weapon, limit: 1 });
      row = result.data.find((entry) => entry.username === username);
      if (!row || (score !== null && row.score !== score)) return notFound("Aimlabs no longer lists this exact benchmark score. You can still browse this task’s run history.");
      playId = row.play_id;
    }
    const trainer = await queryAimlabs(`query RunDetails($playId: ID!) { Trainer { publishedReplay(replayId: $playId) {
      publisher { username } play { taskSlug ${runFields} }
    } } }`, { playId }, "Run details failed");
    const replay = trainer.publishedReplay;
    if (replay) {
      if (replay.publisher.username !== username || replay.play.taskSlug !== taskId || replay.play.id !== playId || (weapon && replay.play.manifest.weaponId !== weapon) || (score !== null && replay.play.score !== score)) return notFound("This run does not match the selected score or player.");
      return { ...publicRun(replay.play), detailsSource: "replay" };
    }
    if (!row) {
      const result = await leaderboard({ taskId, playId, limit: 1 });
      row = result.data.find((entry) => entry.play_id === playId && entry.username === username);
    }
    if (!row || (row.task_id && row.task_id !== taskId) || (score !== null && row.score !== score)) return notFound("Aimlabs has no public details for this run.");
    return leaderboardRun(row);
  });
}

export async function handleAppDataRequest(request, response, pathname, params) {
  const profile = pathname.match(/^\/api\/profiles\/([^/]+)(\/lookup)?$/);
  const task = pathname.match(/^\/api\/tasks\/([^/]+)(\/leaderboard|\/run)?$/);
  if (!profile && !task) return false;
  let status = 200;
  let body;
  let headers = {};
  try {
    if (request.method !== "GET") { const error = new Error("Method not allowed"); error.status = 405; throw error; }
    const id = decodeURIComponent((profile || task)[1]);
    const invalid = (value, limit) => !value || value.length > limit || /[\x00-\x1f]/.test(value);
    if (invalid(id, profile ? 64 : 256)) throw new URIError("Invalid request");
    if (profile) body = profile[2] ? await getProfileLookup(id) : await getProfile(id);
    else if (id === "search" && !task[2]) {
      const name = params.get("name");
      if (invalid(name, 100)) throw new URIError("Invalid task search");
      body = await getTaskSearch(name);
    } else if (task[2] === "/leaderboard") {
      const page = Number(params.get("page") || 0);
      if (!Number.isInteger(page) || page < 0 || page > 1_000_000) throw new URIError("Invalid page");
      body = await getTaskLeaderboard(id, page);
    } else if (task[2] === "/run") {
      const username = params.get("username");
      const playId = params.get("playId");
      const weapon = params.get("weapon");
      const score = params.has("score") ? Number(params.get("score")) : null;
      if (invalid(username, 64) || (playId !== null && invalid(playId, 128)) || (weapon !== null && invalid(weapon, 128)) || (score !== null && (!Number.isFinite(score) || score < 0))) throw new URIError("Invalid run request");
      body = await getRunDetails(id, username, playId, weapon, score);
    } else body = await getTask(id);
    headers["Cache-Control"] = "public, max-age=30";
  } catch (error) {
    status = error instanceof URIError ? 400 : error.status || 502;
    if (status === 502) console.error("App data provider failure", error);
    body = { error: status === 502 ? "Aimlabs data is unavailable. Try again shortly." : error.message };
    if (error.retryAfter) headers["Retry-After"] = String(error.retryAfter);
  }
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  response.end(JSON.stringify(body));
  return true;
}
