const pageSize = 100;
const pagesPerRequest = 20;
const pageNames = Array.from(
  { length: pagesPerRequest },
  (_, index) => `page${index}`
);
const query = `query getAimlabLeaderboards(${pageNames
  .map((name) => `$${name}: LeaderboardInput!`)
  .join(", ")}) {
  aimlab {
    ${pageNames
      .map(
        (name) =>
          `${name}: leaderboard(input: $${name}) { metadata { totalRows } data }`
      )
      .join("\n    ")}
  }
}`;

let nextRequestAt = 0;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function pace() {
  await sleep(Math.max(0, nextRequestAt - Date.now()));
  nextRequestAt = Date.now() + 500;
}

export async function fetchLeaderboardPage(bench, offset) {
  for (let attempt = 0; attempt < 6; attempt++) {
    await pace();
    const response = await fetch("https://api.aimlab.gg/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "AimlabBenchmarksViewer/1.0",
      },
      body: JSON.stringify({
        query,
        variables: Object.fromEntries(
          pageNames.map((name, index) => [
            name,
            {
              clientId: "aimlab",
              limit: pageSize,
              offset: offset + index * pageSize,
              taskId: bench.id,
              taskMode: 0,
              weaponId: bench.weapon,
            },
          ])
        ),
      }),
      signal: AbortSignal.timeout(20000),
    });

    let body;
    try {
      body = await response.json();
    } catch (error) {
      if (response.status !== 429) throw error;
      body = {};
    }
    const errors = body.errors?.map((error) => error.message) || [];
    const rateLimited = response.status === 429 || errors.some((message) => /rate limit/i.test(message));
    if (rateLimited && attempt < 5) {
      const retryAfter = Number(response.headers?.get?.("retry-after"));
      const waitMessage = errors.join(" ").match(/wait (\d+) seconds?/i);
      const seconds = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter
        : waitMessage ? Number(waitMessage[1]) : 10;
      await sleep(seconds * 1000 + 250);
      continue;
    }
    if (rateLimited) throw new Error(`Aimlab rate limited ${bench.name} after six attempts`);
    if (!response.ok)
      throw new Error(
        `Aimlab returned HTTP ${response.status} for ${bench.name}`
      );
    if (errors.length) throw new Error(errors.join("; "));
    const first = body.data?.aimlab?.[pageNames[0]];
    if (
      !Array.isArray(first?.data) ||
      !Number.isInteger(first.metadata?.totalRows)
    ) {
      throw new Error(
        `Aimlab returned an invalid leaderboard for ${bench.name}`
      );
    }
    const totalRows = first.metadata.totalRows;
    const data = [];
    for (const [index, name] of pageNames.entries()) {
      if (offset + index * pageSize >= totalRows) break;
      const page = body.data.aimlab[name];
      if (
        !Array.isArray(page?.data) ||
        !Number.isInteger(page.metadata?.totalRows)
      ) {
        throw new Error(`Aimlab returned an invalid page for ${bench.name}`);
      }
      data.push(...page.data);
    }
    return { metadata: { totalRows }, data };
  }
}
