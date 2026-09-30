import assert from "node:assert/strict";
import test from "node:test";
import { calculateProfile, getTaskLeaderboard, getRunDetails } from "../server/app-data.js";

function response(trainer) {
  return new Response(JSON.stringify({ data: { Trainer: trainer } }));
}

test("the backend returns weighted profile totals and isolated benchmark results", () => {
  const rows = [
    { group_by: { task_id: "sixshot", task_name: "Sixshot", weapon_id: "9mm", task_mode_mod: 0 }, aggregate: { count: 2, avg: { score: 100, accuracy: 50 }, max: { score: 150, accuracy: 75 } } },
    { group_by: { task_id: "sixshot", task_name: "Sixshot", weapon_id: "other", task_mode_mod: 1 }, aggregate: { count: 1, avg: { score: 400, accuracy: 80 }, max: { score: 400, accuracy: 80 } } },
  ];
  const first = calculateProfile({ id: "fixture" }, rows);
  assert.deepEqual(first.totals, { tasksPlayed: 1, totalPlays: 3 });
  assert.equal(first.tasks[0].avgScore, 200);
  assert.equal(first.tasks[0].avgAcc, 60);
  assert.equal(first.tasks[0].weapon, "other");
  assert.equal(first.tasks[0].mode, 1);
  assert.equal(first.benchmarkSets[0].results.VTAdvanced.overallRank, "Unranked");
  first.benchmarkSets[0].results.VTAdvanced.benchmarks[0].maxScore = 999;
  const second = calculateProfile({ id: "other-player" }, []);
  assert.equal(second.benchmarkSets[0].results.VTAdvanced.benchmarks[0].maxScore, 0);
  assert.equal(second.benchmarkSets[0].results.RAEasy.benchmarks.length > 0, true);
});

test("a task with no default weapon still has a current-API leaderboard", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.aimlabs.com/graphql");
    const body = JSON.parse(options.body);
    calls.push(body);
    if (body.query.includes("GetTask(")) return response({ aimlab: { task: { id: "fixture-no-weapon", weapon_id: null } } });
    assert.equal(body.variables.leaderboardInput.weaponId, null);
    return response({ aimlab: { leaderboard: { metadata: { totalRows: 100, offset: 0, rows: 1 }, data: [{ username: "Player", score: 123, accuracy: 85.106, play_id: "run" }] } } });
  };
  try {
    const [first, second] = await Promise.all([getTaskLeaderboard("fixture-no-weapon"), getTaskLeaderboard("fixture-no-weapon")]);
    assert.equal(first.data[0].accuracy, "85.11%");
    assert.equal(first.pagination.pageCount, 3);
    assert.equal(first, second);
    assert.equal(calls.length, 2);
  } finally { globalThis.fetch = originalFetch; }
});

test("exact run lookup validates the player and omits signed and private replay fields", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    const { variables } = JSON.parse(options.body);
    return response({ publishedReplay: { publisher: { username: "FixturePlayer" }, play: {
      id: variables.playId, taskSlug: "fixture-scenario", score: 50, convertedMode: 0, manifest: {
        duration: 60, replayAvailable: true, replayUrl: "signed-secret", country: "private-country",
        performanceData: { shotsTotal: 100, accTotal: 80, privateField: 99 },
      },
    } } });
  };
  try {
    const run = await getRunDetails("fixture-scenario", "FixturePlayer", "fixture-public-run", null, 50);
    assert.deepEqual(run.metrics, { shotsTotal: 100, accTotal: 80 });
    assert.equal(run.detailsSource, "replay");
    assert.equal(JSON.stringify(run).includes("secret"), false);
    assert.equal(JSON.stringify(run).includes("private"), false);
    await assert.rejects(getRunDetails("fixture-scenario", "WrongPlayer", "fixture-public-run", null, 50), error => error.status === 404);
    await assert.rejects(getRunDetails("wrong-scenario", "FixturePlayer", "fixture-public-run", null, 50), error => error.status === 404);
  } finally { globalThis.fetch = originalFetch; }
});

test("benchmark score lookup cannot silently open a different personal best", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    calls++;
    const input = JSON.parse(options.body).variables.leaderboardInput;
    assert.equal(input.username, "FixturePlayer");
    assert.equal(input.weaponId, "fixture-weapon");
    return response({ aimlab: { leaderboard: { metadata: {}, data: [{ username: "FixturePlayer", score: 999, play_id: "different-run" }] } } });
  };
  try {
    await assert.rejects(getRunDetails("fixture-score-task", "FixturePlayer", null, "fixture-weapon", 50), error => error.status === 404);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test("unpublished historical runs retain only available leaderboard statistics", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    const { query } = JSON.parse(options.body);
    if (query.includes("publishedReplay")) return response({ publishedReplay: null });
    return response({ aimlab: { leaderboard: { metadata: {}, data: [{ task_id: "fixture-old-task", username: "FixturePlayer", score: 50, play_id: "fixture-old-run", accuracy: 0, shots_hit: 0, custom: { avgDist: 12, signed: "secret" }, country: "private" }] } } });
  };
  try {
    const run = await getRunDetails("fixture-old-task", "FixturePlayer", "fixture-old-run", null, 50);
    assert.deepEqual(run.metrics, { hitsTotal: 0, accTotal: 0, avgDist: 12 });
    assert.equal(run.detailsSource, "leaderboard");
    assert.equal(run.replayAvailable, null);
    assert.equal(JSON.stringify(run).includes("secret"), false);
  } finally { globalThis.fetch = originalFetch; }
});

test('benchmark leaderboards preserve the selected weapon and isolate cached score populations', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    calls.push(body);
    if (body.query.includes('GetTask(')) return response({ aimlab: { task: { id: 'fixture-weapon-identity', weapon_id: 'default-weapon' } } });
    const weapon = body.variables.leaderboardInput.weaponId;
    assert.equal(body.variables.leaderboardInput.taskMode, 0);
    return response({ aimlab: { leaderboard: { metadata: { totalRows: 1, offset: 0, rows: 1 }, data: [{ username: weapon, score: weapon === 'benchmark-weapon' ? 200 : 100, play_id: weapon }] } } });
  };
  try {
    const selected = await getTaskLeaderboard('fixture-weapon-identity', 0, 'benchmark-weapon');
    const defaultBoard = await getTaskLeaderboard('fixture-weapon-identity');
    const selectedAgain = await getTaskLeaderboard('fixture-weapon-identity', 0, 'benchmark-weapon');
    assert.equal(selected.weaponId, 'benchmark-weapon');
    assert.equal(selected.data[0].score, 200);
    assert.equal(defaultBoard.weaponId, 'default-weapon');
    assert.equal(defaultBoard.data[0].score, 100);
    assert.equal(selectedAgain, selected);
    assert.equal(calls.length, 3);
  } finally { globalThis.fetch = originalFetch; }
});


test('overview best runs preserve the winning mode and reject a different-mode replay', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    const { query, variables } = JSON.parse(options.body);
    if (!query.includes('publishedReplay')) {
      assert.equal(variables.leaderboardInput.taskMode, 1);
      assert.equal(variables.leaderboardInput.weaponId, 'alternate-weapon');
      return response({ aimlab: { leaderboard: { metadata: {}, data: [{ username: 'FixturePlayer', score: 400, play_id: 'overview-alt-run' }] } } });
    }
    return response({ publishedReplay: { publisher: { username: 'FixturePlayer' }, play: {
      id: variables.playId, taskSlug: 'overview-alt-task', score: 400, convertedMode: 1,
      manifest: { weaponId: 'alternate-weapon', performanceData: { accTotal: 80 } },
    } } });
  };
  try {
    const run = await getRunDetails('overview-alt-task', 'FixturePlayer', null, 'alternate-weapon', 400, 1);
    assert.equal(run.score, 400);
    assert.equal(run.convertedMode, 1);
    await assert.rejects(getRunDetails('overview-alt-task', 'FixturePlayer', 'overview-alt-run', 'alternate-weapon', 400, 0), error => error.status === 404);
  } finally { globalThis.fetch = originalFetch; }
});


test('task leaderboards keep alternate-mode scores and caches separate', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body); calls.push(body);
    if (body.query.includes('GetTask(')) return response({ aimlab: { task: { id: 'fixture-mode-board', weapon_id: 'same-weapon' } } });
    const mode = body.variables.leaderboardInput.taskMode;
    return response({ aimlab: { leaderboard: { metadata: { totalRows: 1 }, data: [{ username: 'FixturePlayer', score: mode ? 400 : 100 }] } } });
  };
  try {
    const alternate = await getTaskLeaderboard('fixture-mode-board', 0, 'same-weapon', 1);
    const normal = await getTaskLeaderboard('fixture-mode-board', 0, 'same-weapon');
    assert.equal(alternate.data[0].score, 400);
    assert.equal(alternate.mode, 1);
    assert.equal(normal.data[0].score, 100);
    assert.equal(normal.mode, 0);
    assert.equal(await getTaskLeaderboard('fixture-mode-board', 0, 'same-weapon', 1), alternate);
    assert.equal(calls.length, 3);
  } finally { globalThis.fetch = originalFetch; }
});
