import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { easyBench } from "../src/helpers/revosectData.js";
import { collectScenario, refreshMode } from "../server/refresh-leaderboards.js";

test("refresh reads every qualifying page and stops at the first lower score", async () => {
  const bench = easyBench[0];
  const minimum = bench.scores[0];
  const offsets = [];
  const getPage = async (_, offset) => {
    offsets.push(offset);
    return {
      metadata: { totalRows: 102 },
      data:
        offset === 0
          ? Array.from({ length: 100 }, (_, index) => ({ score: minimum + 200 - index }))
          : [{ score: minimum + 100 }, { score: minimum - 1 }],
    };
  };

  const scores = await collectScenario(bench, getPage);
  assert.deepEqual(offsets, [0, 100]);
  assert.equal(scores.length, 101);
  assert.equal(scores.at(-1).score, minimum + 100);
});

test("a failed refresh preserves the previous leaderboard snapshot", async () => {
  const directory = await mkdtemp(join(tmpdir(), "aimlab-refresh-"));
  const destination = join(directory, "easy.json");
  const previous = '{"mode":"easy","players":[{"username":"saved"}]}';
  try {
    await writeFile(destination, previous);
    await assert.rejects(
      refreshMode("easy", {
        dataDir: directory,
        getPage: async () => {
          throw new Error("Aimlab unavailable");
        },
      }),
      /Aimlab unavailable/
    );
    assert.equal(await readFile(destination, "utf8"), previous);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
