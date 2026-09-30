import assert from "node:assert/strict";
import test from "node:test";
import { getPlayerTaskRuns } from "../server/player-runs.js";

test("public run pages retain score identity and omit private manifest fields", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    assert.equal(request.variables.first, 12);
    assert.equal(request.variables.taskId, "fixture-task-1");
    return new Response(JSON.stringify({
      data: {
        Trainer: {
          aimlabProfile: {
            username: "FixturePlayer",
            latestPlay: {
              totalCount: 2,
              pageInfo: { endCursor: "next-cursor", hasNextPage: true },
              edges: [{ node: {
                id: "run-1", score: 1234, startedAt: "2026-01-01T00:00:00Z",
                endedAt: "2026-01-01T00:01:00Z", mode: 42, convertedMode: 0,
                taskVersion: "3", weaponName: "Fixture weapon", gridshieldStatus: "APPROVED", manifest: {
                  taskName: "Fixture task", weaponId: "fixture-weapon", duration: 60,
                  pauseDuration: 0, appVersion: "v1.5", analyticsVersion: "2.0.0",
                  inputDevice: [], replayAvailable: true, replayUrl: "signed-secret",
                  country: "XX", performanceData: { hitsTotal: 42, shotsTotal: 50, missesTotal: 8, unknown: 999 },
                },
              } }],
            },
          },
        },
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const page = await getPlayerTaskRuns("FixturePlayer", "fixture-task-1");
    assert.equal(page.taskName, "Fixture task");
    assert.equal(page.pageInfo.endCursor, "next-cursor");
    assert.deepEqual(page.runs[0].metrics, { hitsTotal: 42, shotsTotal: 50, missesTotal: 8 });
    assert.equal(page.runs[0].score, 1234);
    assert.equal(page.runs[0].convertedMode, 0);
    assert.equal(page.runs[0].weaponId, "fixture-weapon");
    assert.equal(page.runs[0].gridshieldStatus, "APPROVED");
    assert.equal(page.runs[0].analyticsVersion, "2.0.0");
    assert.equal(JSON.stringify(page).includes("signed-secret"), false);
    assert.equal(JSON.stringify(page).includes("XX"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GraphQL errors in HTTP 200 responses do not become empty run histories", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    errors: [{ message: "Authentication required", extensions: { code: "UNAUTHENTICATED" } }],
    data: { Trainer: { aimlabProfile: null } },
  }), { status: 200, headers: { "Content-Type": "application/json" } });
  try {
    await assert.rejects(getPlayerTaskRuns("FixturePlayer", "fixture-task-error"),
      /Aimlabs did not return run history/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("an upstream rate limit stops further public fetches during its cooldown", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response("", { status: 429, headers: { "Retry-After": "20" } });
  };
  try {
    await assert.rejects(getPlayerTaskRuns("FixturePlayer", "fixture-task-limited"),
      (error) => error.status === 503 && error.retryAfter === 20);
    await assert.rejects(getPlayerTaskRuns("FixturePlayer", "fixture-task-other"),
      (error) => error.status === 503 && error.retryAfter > 0);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
