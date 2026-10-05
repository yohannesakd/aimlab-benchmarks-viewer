import { logTelemetry } from './telemetry.js';

const pageSize = 100;
const pagesPerRequest = 20;
const pageNames = Array.from(
  { length: pagesPerRequest },
  (_, index) => `page${index}`
);
const providers = {
  legacy: { endpoint: 'https://api.aimlab.gg/graphql', input: 'LeaderboardInput', scope: 'aimlab' },
  trainer: { endpoint: 'https://api.aimlabs.com/graphql', input: 'Trainer_LeaderboardInput', scope: 'Trainer { aimlab' },
};
function queryFor(provider) {
  return `query getAimlabLeaderboards(${pageNames.map(name => `$${name}: ${provider.input}!`).join(', ')}) {
    ${provider.scope} {
      ${pageNames.map(name => `${name}: leaderboard(input: $${name}) { metadata { totalRows } data }`).join('\n')}
    } ${provider.input === 'Trainer_LeaderboardInput' ? '}' : ''}
  }`;
}

// Bulk pages have a separate budget from 1 MB interactive reads.
async function readBulkJson(response) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > 8_000_000) throw new Error('Aimlabs bulk response exceeded 8 MB');
    chunks.push(chunk);
  }
  return { body: JSON.parse(Buffer.concat(chunks).toString('utf8')), bytes };
}

let nextRequestAt = 0;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function pace() {
  await sleep(Math.max(0, nextRequestAt - Date.now()));
  nextRequestAt = Date.now() + 500;
}

export async function fetchLeaderboardPage(bench, offset, { provider = 'legacy', onResponse } = {}) {
  if (!Object.hasOwn(providers, provider)) throw new Error('Unknown collector provider');
  const configuration = providers[provider];
  for (let attempt = 0; attempt < 6; attempt++) {
    await pace();
    const signal = AbortSignal.timeout(20000);
    let response;
    let body;
    try {
      response = await fetch(configuration.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "AimlabBenchmarksViewer/1.0",
        },
        body: JSON.stringify({
          query: queryFor(configuration),
          variables: Object.fromEntries(
            pageNames.map((name, index) => [
              name,
              {
                clientId: "aimlab",
                limit: pageSize,
                offset: offset + index * pageSize,
                taskId: bench.id,
                taskMode: bench.mode ?? 0,
                weaponId: bench.weapon,
              },
            ])
          ),
        }),
        signal,
      });
      if ([500, 502, 503, 504].includes(response.status)) {
        await response.body?.cancel();
        throw new Error(`Aimlab returned HTTP ${response.status} for ${bench.name}`);
      }
      const result = await readBulkJson(response);
      body = result.body;
      onResponse?.({ provider, bytes: result.bytes, status: response.status });
      logTelemetry('collector_batch', { provider, bytes: result.bytes, status: response.status, offset, attempt: attempt + 1 });
    } catch (error) {
      const transient = [500, 502, 503, 504].includes(response?.status) || error.name === 'TimeoutError' || signal.reason?.name === 'TimeoutError';
      if (transient && attempt < 5) {
        const seconds = 2 ** attempt;
        logTelemetry('collector_retry', { provider, offset, attempt: attempt + 1, status: response?.status, error_type: error.name, retry_after_seconds: seconds }, 'WARN');
        await sleep(seconds * 1000);
        continue;
      }
      if (response?.status !== 429) throw error;
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
      logTelemetry('collector_rate_limit', { provider, offset, attempt: attempt + 1, retry_after_seconds: seconds }, 'WARN');
      await sleep(seconds * 1000 + 250);
      continue;
    }
    if (rateLimited) throw new Error(`Aimlab rate limited ${bench.name} after six attempts`);
    if (!response.ok)
      throw new Error(
        `Aimlab returned HTTP ${response.status} for ${bench.name}`
      );
    if (errors.length) throw new Error(errors.join("; "));
    const aimlab = provider === 'trainer' ? body.data?.Trainer?.aimlab : body.data?.aimlab;
    const first = aimlab?.[pageNames[0]];
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
      const page = aimlab[name];
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
