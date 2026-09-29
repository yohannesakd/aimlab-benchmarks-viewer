import assert from "node:assert/strict";
import test from "node:test";
import { getPublicProfileDetails, getPublicTaskDetails } from "../server/public-details.js";

test("public profile details preserve zero, absence, and task identity", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    assert.equal(request.variables.username, "FixtureProfileDetails");
    return new Response(JSON.stringify({ data: { Trainer: { aimlabProfile: {
      username: "FixtureProfileDetails", imageUrl: "https://example.com/avatar.png",
      privateToken: "secret",
      achievementMetrics: [
        { slug: "days-since-account-creation", value: null },
        { slug: "streak-days", value: 0 },
      ],
      activity: {
        latestStreak: { endDate: "2026-09-20", streakCount: 3 },
        highestStreak: { streakCount: 12 },
      },
      recommendedTasks: [{ id: "daily-task", aimlabTask: { id: "daily-task", name: "Daily task" } }],
    } } } }), { status: 200 });
  };
  try {
    const details = await getPublicProfileDetails("FixtureProfileDetails");
    assert.equal(details.accountAgeDays, null);
    assert.equal(details.currentStreakDays, 0);
    assert.equal(details.bestDailyStreakDays, 12);
    assert.deepEqual(details.dailyPick, { taskId: "daily-task", name: "Daily task" });
    assert.equal(JSON.stringify(details).includes("secret"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("public scenario details keep task and asset versions distinct", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    assert.equal(request.variables.taskId, "FixtureTaskDetails");
    return new Response(JSON.stringify({ data: { Trainer: { aimlab: { task: {
      id: "FixtureTaskDetails", name: "Fixture task", style: "Standard",
      duration: null, mode: 0, version: 3, weapon_id: "Fixture_Weapon", created_at: "2025-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z", asset: { id: "asset", currentVersion: "0.02" },
      config: { hidden: "secret" },
    } } } } }), { status: 200 });
  };
  try {
    const details = await getPublicTaskDetails("FixtureTaskDetails");
    assert.equal(details.durationSeconds, null);
    assert.equal(details.taskVersion, 3);
    assert.equal(details.assetVersion, "0.02");
    assert.equal(details.weaponId, "Fixture_Weapon");
    assert.equal(JSON.stringify(details).includes("secret"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
