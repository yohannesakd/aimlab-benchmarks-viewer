import assert from "node:assert/strict";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { benchmarkSets, refreshDatabase } from "../server/refresh-database.js";

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
