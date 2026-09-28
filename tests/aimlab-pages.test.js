import test from "node:test";
import assert from "node:assert/strict";
import { easyBench } from "../src/helpers/revosectData.js";
import { fetchLeaderboardPage } from "../server/aimlab-pages.js";

test("Aimlab request batches twenty consecutive leaderboard pages", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (_, options) => {
      const { variables } = JSON.parse(options.body);
      assert.deepEqual(
        Object.values(variables).map(({ offset }) => offset),
        Array.from({ length: 20 }, (_, index) => 2000 + index * 100)
      );
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            aimlab: Object.fromEntries(
              Array.from({ length: 20 }, (_, index) => [
                `page${index}`,
                {
                  metadata: { totalRows: 5000 },
                  data: Array.from({ length: 100 }, () => ({ score: 1000 - index })),
                },
              ])
            ),
          },
        }),
      };
    };
    const result = await fetchLeaderboardPage(easyBench[0], 2000);
    assert.equal(result.data.length, 2000);
    assert.equal(result.data.at(-1).score, 981);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Aimlab rate limit errors retry without publishing partial pages", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => {
      calls++;
      if (calls === 1) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ errors: [{ message: "You are being rate limited. Please wait 0 seconds" }], data: { aimlab: { page0: { metadata: { totalRows: 1 }, data: [] } } } }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { aimlab: { page0: { metadata: { totalRows: 1 }, data: [{ score: 1000 }] } } } }),
      };
    };
    const result = await fetchLeaderboardPage(easyBench[0], 0);
    assert.equal(calls, 2);
    assert.deepEqual(result.data, [{ score: 1000 }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
