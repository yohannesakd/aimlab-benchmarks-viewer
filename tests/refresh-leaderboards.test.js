import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { easyBench } from "../src/helpers/revosectData.js";
import {
  collectScenario,
  fetchLeaderboardPage,
  refreshMode,
} from "../server/refresh-leaderboards.js";

test("Aimlab request batches ten consecutive leaderboard pages", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (_, options) => {
      const { variables } = JSON.parse(options.body);
      assert.deepEqual(
        Object.values(variables).map(({ offset }) => offset),
        Array.from({ length: 10 }, (_, index) => 2000 + index * 100)
      );
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            aimlab: Object.fromEntries(
              Array.from({ length: 10 }, (_, index) => [
                `page${index}`,
                {
                  metadata: { totalRows: 5000 },
                  data: Array.from({ length: 100 }, () => ({
                    score: 1000 - index,
                  })),
                },
              ])
            ),
          },
        }),
      };
    };
    const result = await fetchLeaderboardPage(easyBench[0], 2000);
    assert.equal(result.data.length, 1000);
    assert.equal(result.data.at(-1).score, 991);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("refresh reads every qualifying page and stops at the first lower score", async () => {
  const bench = easyBench[0];
  const minimum = bench.scores[0];
  const offsets = [];
  const getPage = async (_, offset) => {
    offsets.push(offset);
    return {
      metadata: { totalRows: 1002 },
      data:
        offset === 0
          ? Array.from({ length: 1000 }, (_, index) => ({
              score: minimum + 2000 - index,
            }))
          : [{ score: minimum + 1000 }, { score: minimum - 1 }],
    };
  };

  const scores = await collectScenario(bench, getPage);
  assert.deepEqual(offsets, [0, 1000]);
  assert.equal(scores.length, 1001);
  assert.equal(scores.at(-1).score, minimum + 1000);
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
