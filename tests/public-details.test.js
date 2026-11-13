import assert from "node:assert/strict";
import test from "node:test";
import { getPublicActivity, getPublicProfileDetails, getPublicTaskDetails } from "../server/public-details.js";

test("public profile details preserve zero and absence", async () => {
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
    } } } }), { status: 200 });
  };
  try {
    const details = await getPublicProfileDetails("FixtureProfileDetails");
    assert.equal(details.accountAgeDays, null);
    assert.equal(details.currentStreakDays, 0);
    assert.equal(details.bestDailyStreakDays, 12);
    assert.equal("dailyPick" in details, false);
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
      duration: null, version: 3, weapon_id: "Fixture_Weapon", created_at: "2025-01-01T00:00:00Z",
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

test("public activity counts unique active days across a month boundary", async () => {
  const originalFetch = globalThis.fetch;
  const now = new Date();
  const firstThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const lastMonthDay = new Date(firstThisMonth.getTime() - 86_400_000).toISOString().slice(0, 10);
  const firstDay = firstThisMonth.toISOString().slice(0, 10);
  const olderDay = new Date(Date.UTC(now.getUTCFullYear() - 2, now.getUTCMonth(), now.getUTCDate())).toISOString().slice(0, 10);
  globalThis.fetch = async () => new Response(JSON.stringify({ data: { Trainer: {
    aimlabProfile: {
      username: "FixtureActivity",
      activity: { ranges: [
        { startDate: lastMonthDay, endDate: firstDay },
        { startDate: firstDay, endDate: firstDay },
        { startDate: olderDay, endDate: olderDay },
      ] },
      learningStats: { stars: 3, completedPlans: 1 },
    },
  } } }), { status: 200 });
  try {
    const activity = await getPublicActivity("FixtureActivity");
    assert.equal(activity.activeDays, 3);
    assert.equal(activity.recentActiveDays, 2);
    assert.equal(activity.years.reduce((sum, year) => sum + year.activeDays, 0), 3);
    assert.deepEqual(activity.learning, { stars: 3, completedPlans: 1 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('supplementary profile data does not recover without stable identity', async t => {
  let now = Date.now();
  t.mock.method(Date, 'now', () => now);
  let failing = false;
  let wrongIdentity = false;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    if (failing) throw new DOMException('Timed out', 'TimeoutError');
    const { variables } = JSON.parse(options.body);
    return new Response(JSON.stringify({ data: { Trainer: variables.username
      ? { aimlabProfile: { username: wrongIdentity ? 'OtherPlayer' : variables.username } }
      : { aimlab: { task: { id: variables.taskId } } } } }));
  });
  const details = await getPublicProfileDetails('RecoveryDetails');
  const activity = await getPublicActivity('RecoveryDetails');
  await getPublicTaskDetails('RecoveryTask');
  now += 60_000;
  failing = true;
  await assert.rejects(getPublicProfileDetails('RecoveryDetails'), { name: 'TimeoutError' });
  await assert.rejects(getPublicActivity('RecoveryDetails'), { name: 'TimeoutError' });
  await assert.rejects(getPublicTaskDetails('RecoveryTask'));
  now += 300_000;
  await assert.rejects(getPublicProfileDetails('RecoveryDetails'));
  failing = false;
  wrongIdentity = true;
  await assert.rejects(getPublicProfileDetails('WrongDetails'));
  await assert.rejects(getPublicActivity('WrongDetails'));
});
