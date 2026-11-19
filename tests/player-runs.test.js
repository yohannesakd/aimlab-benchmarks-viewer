import assert from "node:assert/strict";
import test from "node:test";
import { publicRun } from "../server/player-runs.js";

test("public runs retain score identity and omit private manifest fields", () => {
  const run = publicRun({
    id: "run-1", score: 1234, startedAt: "2026-01-01T00:00:00Z",
    endedAt: "2026-01-01T00:01:00Z", mode: 42, convertedMode: 0,
    taskVersion: "3", weaponName: "Fixture weapon", gridshieldStatus: "APPROVED", manifest: {
      taskName: "Fixture task", weaponId: "fixture-weapon", duration: 60,
      pauseDuration: 0, appVersion: "v1.5", analyticsVersion: "2.0.0",
      inputDevice: [], replayAvailable: true, replayUrl: "signed-secret",
      country: "XX", performanceData: { hitsTotal: 42, shotsTotal: 50, missesTotal: 8, unknown: 999 },
    },
  });
  assert.deepEqual(run.metrics, { hitsTotal: 42, shotsTotal: 50, missesTotal: 8 });
  assert.equal(run.score, 1234);
  assert.equal(run.convertedMode, 0);
  assert.equal(run.weaponId, "fixture-weapon");
  assert.equal(run.gridshieldStatus, "APPROVED");
  assert.equal(run.analyticsVersion, "2.0.0");
  assert.equal(JSON.stringify(run).includes("signed-secret"), false);
  assert.equal(JSON.stringify(run).includes("XX"), false);
});
