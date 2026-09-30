import assert from 'node:assert/strict';
import test from 'node:test';
import { voltaicSeasons, calculateVoltaicSeason, calculateRevosectSeason } from '../server/benchmark-seasons.js';

function play(scenario, score, overrides = {}) {
  return { group_by: { task_id: scenario.task_id || scenario.id, weapon_id: scenario.weapon_id || scenario.weapon, task_mode_mod: 0, ...overrides }, aggregate: { count: 1, avg: { score, accuracy: 80 }, max: { score, accuracy: 80 } } };
}

test('current Voltaic seasons award every exact rank threshold without floating-point demotion', () => {
  for (const definition of voltaicSeasons) {
    for (let threshold = 0; threshold < 4; threshold++) {
      const rows = definition.scenarios.map(scenario => play(scenario, scenario.tiers[0].thresholds[threshold]));
      const results = calculateVoltaicSeason(definition, rows).results;
      for (const tier of definition.tiers) {
        const rank = definition.ranks.filter(rank => rank.tier_id === tier.id)[threshold];
        assert.equal(results[`VT${tier.name}`].overallEnergy, rank.energy_threshold);
        assert.equal(results[`VT${tier.name}`].overallRank, `${rank.name} Complete`);
      }
    }
  }
});

test('Season 3 retains all nine groups and ignores alternate modes, weapons, and archived tasks', () => {
  const definition = voltaicSeasons[0];
  const scenario = definition.scenarios.find(s => s.tiers[0].tier_id === definition.tiers[0].id);
  const rows = [play(scenario, 350), play(scenario, 100000, { weapon_id: 'other' }), play(scenario, 100000, { task_mode_mod: 1 }), play(voltaicSeasons[1].scenarios[0], 100000)];
  const result = calculateVoltaicSeason(definition, rows).results.VTNovice;
  assert.equal(result.categories.length, 9);
  assert.equal(result.benchmarks.length, 18);
  assert.equal(result.benchmarks.find(b => b.id === scenario.task_id).maxScore, 350);
  assert.equal(result.overallEnergy, 0);
  assert.equal(result.overallRank, 'Unranked');
});

test('Voltaic scenario progress measures the full interval before the first rank', () => {
  for (const definition of voltaicSeasons) {
    for (const tier of definition.tiers) {
      const scenario = definition.scenarios.find(item => item.tiers.some(level => level.tier_id === tier.id));
      const firstScore = scenario.tiers.find(level => level.tier_id === tier.id).thresholds[0];
      const firstEnergy = definition.ranks.find(rank => rank.tier_id === tier.id).energy_threshold;
      const below = calculateVoltaicSeason(definition, [play(scenario, firstScore / 2)]).results[`VT${tier.name}`].benchmarks.find(bench => bench.id === scenario.task_id);
      assert.equal(below.rank, 'Unranked');
      assert.deepEqual(below.energyProgress, { value: below.energy, max: firstEnergy });
      assert.ok(below.energy > 0 && below.energy < firstEnergy);
      const ranked = calculateVoltaicSeason(definition, [play(scenario, firstScore)]).results[`VT${tier.name}`].benchmarks.find(bench => bench.id === scenario.task_id);
      assert.deepEqual(ranked.energyProgress, { value: 0, max: 100 });
    }
  }
});

test('Voltaic caps category energy while preserving top-tier extrapolation', () => {
  const definition = voltaicSeasons[0];
  const rows = definition.scenarios.map(scenario => play(scenario, scenario.tiers[0].thresholds.at(-1) * 2));
  const results = calculateVoltaicSeason(definition, rows).results;
  assert.equal(results.VTNovice.categories.every(category => category.energy === 499), true);
  assert.equal(results.VTIntermediate.categories.every(category => category.energy === 899), true);
  assert.equal(results.VTAdvanced.categories.every(category => category.energy === 1200), true);
  assert.equal(results.VTAdvanced.overallEnergy > 1200, true);
  assert.equal(results.VTAdvanced.overallRank, 'Celestial Complete');
});

test('Revosect S4 exposes exact playlist scores without inventing rank thresholds', () => {
  const empty = calculateRevosectSeason([]);
  assert.deepEqual(Object.values(empty.results).map(result => result.benchmarks.length), [10, 18, 18]);
  const scenario = empty.results.RAEasy.benchmarks[0];
  const result = calculateRevosectSeason([play(scenario, 500), play(scenario, 99999, { weapon_id: 'other' })]).results.RAEasy;
  assert.equal(result.benchmarks[0].maxScore, 500);
  assert.equal(result.rankingAvailable, false);
  assert.equal(result.overallRank, undefined);
});
