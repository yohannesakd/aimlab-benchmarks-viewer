import assert from "node:assert/strict";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { benchmarkSets, refreshDatabase, sortColumnsFor } from "../server/refresh-database.js";

test("database refresh scores Easy Flick and Voltaic Novice without publishing partial data", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "aimlab-leaderboards-"));
  const pageFor = async (bench) => {
    const top = { user_id: "player-1", username: "Player", score: bench.scores.at(-1) };
    const data = bench.id === benchmarkSets["ra-easy"][0].id
      ? [{ ...top, score: bench.scores[0] - 1 }, top]
      : [top];
    return { metadata: { totalRows: data.length }, data };
  };
  try {
    for (const mode of ["ra-easy", "vt-novice"]) {
      await refreshDatabase(mode, { dataDir, getPage: pageFor });
      const db = new DatabaseSync(join(dataDir, `${mode}.sqlite`), { readOnly: true });
      const player = db.prepare("SELECT * FROM players").get();
      assert.equal(player.username, "Player");
      assert.ok(player.overall > 0);
      if (mode === "ra-easy") {
        assert.equal(player.c1, 144);
        assert.equal(player.c4, 0);
        assert.ok(player.c5 > 0);
      }
      db.close();
    }

    await copyFile(
      join(dataDir, "vt-novice.sqlite"),
      join(dataDir, "vt-novice.staging.sqlite")
    );
    await refreshDatabase("vt-novice", {
      dataDir,
      getPage: () => { throw new Error("Completed crawl should not repeat"); },
    });

    const old = new DatabaseSync(join(dataDir, "ra-easy.sqlite"), { readOnly: true });
    const oldPoints = old.prepare("SELECT overall FROM players").get().overall;
    old.close();
    await assert.rejects(
      refreshDatabase("ra-easy", {
        dataDir,
        getPage: async (bench) => {
          if (bench.id === benchmarkSets["ra-easy"][1].id) throw new Error("Aimlab unavailable");
          return pageFor(bench);
        },
      }),
      /Aimlab unavailable/
    );
    const published = new DatabaseSync(join(dataDir, "ra-easy.sqlite"), { readOnly: true });
    assert.equal(published.prepare("SELECT overall FROM players").get().overall, oldPoints);
    published.close();

    const resumed = [];
    await refreshDatabase("ra-easy", {
      dataDir,
      getPage: async (bench) => {
        resumed.push(bench.id);
        return pageFor(bench);
      },
    });
    assert.equal(resumed.includes(benchmarkSets["ra-easy"][0].id), false);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("season standings use every group and include scores below the first rank", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "aimlab-seasons-"));
  try {
    for (const season of ["s2", "s3"]) {
      const mode = `vt-aimlabs_${season}-novice`;
      await refreshDatabase(mode, { dataDir, getPage: async bench => ({ metadata: { totalRows: 3 }, data: [
        { user_id: "ranked", username: "Ranked", score: bench.scores[0] },
        { user_id: "below", username: "Below", score: bench.scores[0] / 2 },
        ...(bench.categoryID === benchmarkSets[mode][0].categoryID ? [{ user_id: "incomplete", username: "Incomplete", score: bench.scores.at(-1) }] : [{ user_id: "zero", username: "Zero", score: 0 }]),
      ] }) });
      const db = new DatabaseSync(join(dataDir, `${mode}.sqlite`), { readOnly: true });
      const players = db.prepare("SELECT * FROM players ORDER BY overall DESC").all();
      assert.deepEqual(players.map(row => [row.username, row.overall]), [["Ranked", 100], ["Below", 50]]);
      assert.equal(players[0].overall_rank, "Iron Complete");
      assert.equal(players[1].overall_rank, "Unranked");
      const count = season === "s3" ? 9 : 6;
      assert.equal(sortColumnsFor(mode).clicking, season === "s3" ? "(c1 + c2 + c3)" : "(c1 + c2)");
      assert.equal(sortColumnsFor(mode)[season === "s3" ? "ninth" : "sixth"], `c${count}`);
      assert.equal(Object.keys(players[0]).filter(key => /^c\d$/.test(key)).length, count);
      for (let index = 1; index <= count; index++) assert.equal(players[1][`c${index}`], 50);
      db.close();

      let calls = 0;
      await assert.rejects(refreshDatabase(mode, { dataDir, getPage: async () => {
        if (++calls > 1) throw new Error("Interrupted season refresh");
        return { metadata: { totalRows: 0 }, data: [] };
      } }), /Interrupted/);
      const saved = new DatabaseSync(join(dataDir, `${mode}.sqlite`), { readOnly: true });
      assert.equal(saved.prepare("SELECT count(*) AS n FROM players").get().n, 2);
      saved.close();
      const retried = [];
      await refreshDatabase(mode, { dataDir, getPage: async bench => {
        retried.push(bench.id);
        return { metadata: { totalRows: 0 }, data: [] };
      } });
      assert.equal(retried.includes(benchmarkSets[mode][0].id), false);
    }
  } finally { await rm(dataDir, { recursive: true, force: true }); }
});

test('season API pages and filters cannot mix six- and nine-group standings', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'aimlab-season-api-'));
  const originalDirectory = process.env.AIMLAB_DATA_DIR;
  process.env.AIMLAB_DATA_DIR = dataDir;
  const { getLeaderboardPage, handleLeaderboardRequest } = await import('../server/leaderboard-db.js');
  try {
    for (const season of ['s2', 's3']) {
      const mode = `vt-aimlabs_${season}-novice`;
      await refreshDatabase(mode, { dataDir, getPage: async bench => ({ metadata: { totalRows: 26 }, data: Array.from({ length: 26 }, (_, index) => ({ user_id: `p${index}`, username: `Player${String(index).padStart(2, '0')}`, score: bench.scores[0] })) }) });
      const first = await getLeaderboardPage(mode, 1, 'overall');
      const last = await getLeaderboardPage(mode, 2, season === 's3' ? 'ninth' : 'sixth');
      assert.equal(first.benchmarkSet, `aimlabs_${season}`);
      assert.equal(first.total, 26);
      assert.equal(first.players.length, 25);
      assert.equal(last.players.length, 1);
      assert.equal(last.players[0].username, 'Player25');
      assert.equal(Object.keys(last.players[0].subCategoryPoints).length, season === 's3' ? 9 : 6);
      assert.equal((await getLeaderboardPage(mode, 1, 'clicking')).players[0].selectedPoints, season === 's3' ? 300 : 200);
      await assert.rejects(getLeaderboardPage(mode, 3, 'overall'), /out of range/);
      await assert.rejects(getLeaderboardPage(mode, 1, 'overall; DELETE FROM players'), /Invalid sort/);
    }
    await assert.rejects(getLeaderboardPage('vt-aimlabs_s2-novice', 1, 'ninth'), /Invalid sort/);
    const response = { writeHead(status) { this.status = status; }, end(body) { this.body = JSON.parse(body); } };
    await handleLeaderboardRequest({ method: 'GET' }, response, '/api/leaderboards/vt/novice/page', new URLSearchParams());
    assert.equal(response.status, 200);
    assert.equal(response.body.benchmarkSet, 'aimlabs_s2');
    await handleLeaderboardRequest({ method: 'GET' }, response, '/api/leaderboards/vt/aimlabs_s3/advanced/page', new URLSearchParams());
    assert.equal(response.status, 503);
  } finally {
    if (originalDirectory === undefined) delete process.env.AIMLAB_DATA_DIR;
    else process.env.AIMLAB_DATA_DIR = originalDirectory;
    await rm(dataDir, { recursive: true, force: true });
  }
});
