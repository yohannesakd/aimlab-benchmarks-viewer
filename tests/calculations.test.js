import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateRevosectBenchmarks,
  caclulateVT,
  organizeLeaderboard,
} from "../src/helpers/functions.js";
import { easyBench, hardBench, mediumBench } from "../src/helpers/revosectData.js";
import {
  advancedBench,
  intermediateBench,
  noviceBench,
} from "../src/helpers/voltaicData.js";

const playsAt = (benchmarks, scoreIndex) =>
  benchmarks.map((bench) => ({
    id: bench.id,
    maxScore: bench.scores[scoreIndex],
    count: 1,
  }));

test("Revosect awards ranks at exact overall thresholds", () => {
  const easy = calculateRevosectBenchmarks(
    { tasks: playsAt(easyBench, 0), id: "easy-player" },
    "easy"
  );
  assert.equal(easy.overallPoints, 200);
  assert.equal(easy.overallRank, "Bronze");

  const hard = calculateRevosectBenchmarks(
    {
      tasks: playsAt(hardBench, 0).map((play, index) =>
        index === 0 ? { ...play, maxScore: hardBench[0].scores[1] } : play
      ),
      id: "hard-player",
    },
    "hard"
  );
  assert.equal(hard.overallPoints, 1825);
  assert.equal(hard.overallRank, "Mythic");
});

test("Revosect leaves scores below the first overall rank unranked", () => {
  const result = calculateRevosectBenchmarks(
    { tasks: playsAt(hardBench, 0), id: "hard-player" },
    "hard"
  );
  assert.equal(result.overallPoints, 1800);
  assert.equal(result.overallRank, "Unranked");
});

test("Revosect overall rank also requires the matching subcategory threshold", () => {
  const tasks = playsAt(easyBench, 3).map((play, index) =>
    easyBench[index].categoryID === 1
      ? { ...play, maxScore: easyBench[index].scores[0] }
      : play
  );
  const result = calculateRevosectBenchmarks({ tasks, id: "uneven-player" }, "easy");
  assert.ok(result.overallPoints >= 475);
  assert.equal(result.subCategoryPoints[0], 40);
  assert.equal(result.overallRank, "Silver");
});

test("Revosect caps easy and medium scenario points at their top sheet values", () => {
  for (const [mode, benchmarks, cap] of [
    ["easy", easyBench, 72],
    ["medium", mediumBench, 145],
  ]) {
    const result = calculateRevosectBenchmarks(
      {
        tasks: benchmarks.map((bench) => ({
          id: bench.id,
          maxScore: bench.scores.at(-1) * 10,
          count: 1,
        })),
      },
      mode
    );
    assert.ok(result.allPoints.every((points) => points === cap));
  }
});

test("Revosect hard rank requires two played tasks in every subcategory", () => {
  const tasks = playsAt(hardBench, 0)
    .filter((_, index) => index !== 0 && index !== 1)
    .map((play) =>
      play.id === hardBench[2].id
        ? { ...play, maxScore: hardBench[2].scores.at(-1) * 2 }
        : play
    );
  const result = calculateRevosectBenchmarks({ tasks }, "hard");
  assert.ok(result.overallPoints >= 1820);
  assert.ok(Math.min(...result.subCategoryPoints) >= 150);
  assert.equal(result.overallRank, "Unranked");
});

test("Voltaic awards each level at its first rank threshold", () => {
  for (const [mode, benchmarks, rank] of [
    ["novice", noviceBench, "Iron Complete"],
    ["intermediate", intermediateBench, "Platinum Complete"],
    ["advanced", advancedBench, "Grandmaster Complete"],
  ]) {
    const result = caclulateVT(playsAt(benchmarks, 1), benchmarks.map((bench) => ({ ...bench })), mode);
    assert.equal(result.overallRank, rank);
  }
});

test("Voltaic intermediate interpolates the full first energy interval", () => {
  const bench = intermediateBench[0];
  const midpoint = (bench.scores[0] + bench.scores[1]) / 2;
  const result = caclulateVT(
    [{ id: bench.id, maxScore: midpoint, count: 1 }],
    intermediateBench.map((item) => ({ ...item })),
    "intermediate"
  );
  assert.equal(result.benchmarks[0].energy, 400);
});

test("leaderboard combines every scenario and keeps each player's best score", () => {
  const playerList = Object.fromEntries(
    easyBench.map((bench) => [
      bench.id,
      [{ user_id: "a", username: "Alice", score: bench.scores[0] }],
    ])
  );
  playerList[easyBench[0].id].push({
    user_id: "a",
    username: "Alice",
    score: easyBench[0].scores[1],
  });

  const result = organizeLeaderboard(playerList, easyBench, "easy");
  assert.equal(result.length, 1);
  assert.equal(result[0].overallRank, "Bronze");
  assert.equal(result[0].benchmarks[0].maxScore, easyBench[0].scores[1]);
  assert.deepEqual(Object.keys(result[0].subCategoryPoints), [
    "Static",
    "Dynamic",
    "Precise",
    "Flick",
  ]);
  assert.equal(result[0].subCategoryPoints.Flick, 40);
  assert.equal(playerList[easyBench[0].id].length, 2);
});

test("leaderboard requires a response for every scenario", () => {
  assert.throws(
    () => organizeLeaderboard({ [easyBench[0].id]: [] }, easyBench, "easy"),
    /Missing leaderboard/
  );
});
