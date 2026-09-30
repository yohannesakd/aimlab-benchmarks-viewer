import { readFileSync } from 'node:fs';
import { harmonicMeanOfSubcategoryEnergies, subcategoryEnergy, uncappedScenarioEnergy } from 'energy-calculation';

export const voltaicSeasons = ['s3', 's2'].map(season => JSON.parse(readFileSync(new URL(`./benchmarks/voltaic-${season}.json`, import.meta.url))));
export const revosectSeason = JSON.parse(readFileSync(new URL('./benchmarks/revosect-s4.json', import.meta.url)));

function taskStatistics(rows, id, weapon, mode = 0) {
  const matching = rows.filter(row => row.group_by.task_id === id && row.group_by.weapon_id === weapon && row.group_by.task_mode_mod === mode);
  const count = matching.reduce((sum, row) => sum + row.aggregate.count, 0);
  return {
    count,
    maxScore: Math.max(0, ...matching.map(row => row.aggregate.max.score)),
    maxAcc: Math.max(0, ...matching.map(row => row.aggregate.max.accuracy)),
    avgScore: count ? matching.reduce((sum, row) => sum + row.aggregate.avg.score * row.aggregate.count, 0) / count : 0,
    avgAcc: count ? matching.reduce((sum, row) => sum + row.aggregate.avg.accuracy * row.aggregate.count, 0) / count : 0,
  };
}

function rankFor(energy, ranks) {
  return ranks.findLast(rank => energy >= rank.energy_threshold)?.name || 'Unranked';
}

function calculateOverallEnergy(energies, tiers) {
  const official = harmonicMeanOfSubcategoryEnergies(energies, tiers);
  const useUncapped = energies.every(energy => energy.capped >= tiers.at(-1).at(-1));
  const values = energies.map(energy => useUncapped ? energy.uncapped : energy.capped);
  if (values.includes(0)) return official;
  const mean = values.length / values.reduce((sum, value) => sum + 1 / value, 0);
  const nearest = Math.round(mean);
  const tolerance = Number.EPSILON * Math.max(...values) * values.length;
  return Math.abs(mean - nearest) <= tolerance ? nearest : official;
}

export function calculateVoltaicSeason(definition, rows, level = null) {
  const tiers = definition.tiers.map(tier => definition.ranks.filter(rank => rank.tier_id === tier.id).map(rank => rank.energy_threshold));
  const results = {};
  definition.tiers.forEach((tier, tierIndex) => {
    if (level && tier.name.toLowerCase() !== level) return;
    const ranks = definition.ranks.filter(rank => rank.tier_id === tier.id);
    const subcategories = definition.categories.flatMap(category => category.subcategories);
    const benchmarks = definition.scenarios.filter(scenario => scenario.tiers.some(item => item.tier_id === tier.id)).map(scenario => {
      const stats = taskStatistics(rows, scenario.task_id, scenario.weapon_id);
      const thresholds = scenario.tiers.find(item => item.tier_id === tier.id).thresholds;
      const calculation = { thresholds, score: stats.maxScore, subcategoryId: scenario.subcategory_id };
      const energy = Math.floor(uncappedScenarioEnergy(calculation, tiers, tierIndex));
      const energyProgress = energy < ranks[0].energy_threshold
        ? { value: energy, max: ranks[0].energy_threshold }
        : { value: energy >= ranks.at(-1).energy_threshold ? 100 : energy % 100, max: 100 };
      return { id: scenario.task_id, weapon: scenario.weapon_id, name: scenario.name, workshopId: scenario.workshop_id, categoryID: scenario.subcategory_id, subCategory: subcategories.find(item => item.id === scenario.subcategory_id).name, ...stats, scores: thresholds, energy, rank: rankFor(energy, ranks), energyProgress, calculation };
    });
    const subcategoryEnergies = subcategories.map(category => subcategoryEnergy(tiers, tierIndex, benchmarks.filter(bench => bench.categoryID === category.id).map(bench => bench.calculation)));
    const categories = subcategories.map((category, index) => {
      const energy = subcategoryEnergies[index].capped;
      return { category: category.name[0].toUpperCase() + category.name.slice(1), energy, rank: rankFor(energy, ranks) };
    });
    const overallEnergy = calculateOverallEnergy(subcategoryEnergies, tiers);
    let overallRank = rankFor(overallEnergy, ranks);
    const completeEnergy = Math.min(...benchmarks.map(bench => bench.energy));
    if (overallRank !== 'Unranked' && rankFor(completeEnergy, ranks) === overallRank) overallRank += ' Complete';
    results[`VT${tier.name}`] = { benchmarks: benchmarks.map(({ calculation, ...bench }) => bench), categories, overallEnergy, overallRank, rankList: ranks.map(rank => rank.name), rankingAvailable: true };
  });
  return { id: definition.id, community: 'voltaic', label: definition.label, source: definition.source, results };
}

export function calculateRevosectSeason(rows) {
  const results = {};
  for (const [level, definition] of Object.entries(revosectSeason.levels)) {
    const benchmarks = definition.scenarios.map(scenario => ({ ...scenario, ...taskStatistics(rows, scenario.id, scenario.weapon, scenario.taskMode) }));
    results[`RA${level[0].toUpperCase()}${level.slice(1)}`] = { benchmarks, rankingAvailable: false, playlistWorkshopId: definition.playlistWorkshopId };
  }
  return { id: revosectSeason.id, community: 'revosect', label: revosectSeason.label, source: revosectSeason.source, results };
}
