import { mkdir, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { organizeLeaderboard } from "../src/helpers/functions.js";
import { easyBench, hardBench, mediumBench } from "../src/helpers/revosectData.js";

const benchmarks = { easy: easyBench, medium: mediumBench, hard: hardBench };
const dataDir = resolve(process.env.AIMLAB_DATA_DIR || "data");
const pageSize = 100;
const refreshLimitMs = 60 * 60 * 1000;
const query = `
  query getAimlabLeaderboard($leaderboardInput: LeaderboardInput!) {
    aimlab {
      leaderboard(input: $leaderboardInput) {
        metadata { totalRows }
        data
      }
    }
  }
`;

let nextRequestAt = 0;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function pace() {
  await sleep(Math.max(0, nextRequestAt - Date.now()));
  nextRequestAt = Date.now() + 500;
}

export async function fetchLeaderboardPage(bench, offset) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await pace();
    const response = await fetch("https://api.aimlab.gg/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "AimlabBenchmarksViewer/1.0",
      },
      body: JSON.stringify({
        query,
        variables: {
          leaderboardInput: {
            clientId: "aimlab",
            limit: pageSize,
            offset,
            taskId: bench.id,
            taskMode: 0,
            weaponId: bench.weapon,
          },
        },
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 10000);
      continue;
    }
    if (!response.ok) throw new Error(`Aimlab returned HTTP ${response.status} for ${bench.name}`);

    const body = await response.json();
    if (body.errors?.length) {
      throw new Error(body.errors.map((error) => error.message).join("; "));
    }
    const leaderboard = body.data?.aimlab?.leaderboard;
    if (!Array.isArray(leaderboard?.data) || !Number.isInteger(leaderboard.metadata?.totalRows)) {
      throw new Error(`Aimlab returned an invalid leaderboard for ${bench.name}`);
    }
    return leaderboard;
  }
  throw new Error(`Aimlab rate limited ${bench.name}`);
}

export async function collectScenario(bench, getPage = fetchLeaderboardPage, deadline = Date.now() + refreshLimitMs) {
  const qualified = [];
  let offset = 0;
  let previousScore = Infinity;

  while (Date.now() < deadline) {
    const page = await getPage(bench, offset);
    if (!Array.isArray(page.data) || !Number.isInteger(page.metadata?.totalRows)) {
      throw new Error(`Invalid page for ${bench.name}`);
    }
    for (const entry of page.data) {
      if (!Number.isFinite(entry.score) || entry.score > previousScore) {
        throw new Error(`Unsorted scores for ${bench.name}`);
      }
      previousScore = entry.score;
      if (entry.score < bench.scores[0]) return qualified;
      qualified.push(entry);
    }
    if (offset + page.data.length >= page.metadata.totalRows) return qualified;
    if (page.data.length !== pageSize) throw new Error(`Incomplete page for ${bench.name}`);
    offset += page.data.length;
  }
  throw new Error(`Refresh timed out for ${bench.name}`);
}

export async function refreshMode(mode, options = {}) {
  const fullBench = benchmarks[mode];
  if (!fullBench) throw new Error(`Unknown benchmark mode: ${mode}`);

  const playerList = {};
  const deadline = Date.now() + refreshLimitMs;
  for (const bench of fullBench) {
    playerList[bench.id] = await collectScenario(bench, options.getPage || fetchLeaderboardPage, deadline);
    options.onProgress?.(mode, bench.name, playerList[bench.id].length);
  }

  const players = organizeLeaderboard(playerList, fullBench, mode).map((player) => ({
    username: player.username,
    overallPoints: player.overallPoints,
    overallRank: player.overallRank,
    subCategoryPoints: player.subCategoryPoints,
  }));
  const snapshot = { mode, generatedAt: new Date().toISOString(), players };
  const destination = resolve(options.dataDir || dataDir, `${mode}.json`);
  const temporary = `${destination}.${process.pid}.tmp`;
  await mkdir(options.dataDir || dataDir, { recursive: true });
  await writeFile(temporary, JSON.stringify(snapshot));
  await rename(temporary, destination);
  return snapshot;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const modes = process.argv[2] ? [process.argv[2]] : ["hard", "medium", "easy"];
  for (const mode of modes) {
    try {
      const snapshot = await refreshMode(mode, {
        onProgress: (name, bench, count) => console.log(`${name}: ${bench}: ${count} scores`),
      });
      console.log(`${mode}: ${snapshot.players.length} players at ${snapshot.generatedAt}`);
    } catch (error) {
      console.error(`${mode}: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
