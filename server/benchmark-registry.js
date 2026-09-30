import { easyBench, mediumBench, hardBench } from './revosectData.js';
import { noviceBench, intermediateBench, advancedBench } from './voltaicData.js';
import { voltaicSeasons } from './benchmark-seasons.js';

export const seasonModes = Object.fromEntries(voltaicSeasons.flatMap(definition => definition.tiers.map(tier => {
  const level = tier.name.toLowerCase();
  return [`vt-${definition.id}-${level}`, { definition, level, tier, subcategories: definition.categories.flatMap(category => category.subcategories) }];
})));

export const benchmarkSets = {
  "ra-easy": easyBench,
  "ra-medium": mediumBench,
  "ra-hard": hardBench,
  "vt-novice": noviceBench,
  "vt-intermediate": intermediateBench,
  "vt-advanced": advancedBench,
  ...Object.fromEntries(Object.entries(seasonModes).map(([mode, { definition, tier }]) => [mode, definition.scenarios.filter(scenario => scenario.tiers.some(item => item.tier_id === tier.id)).map(scenario => ({
    id: scenario.task_id, weapon: scenario.weapon_id, name: scenario.name, categoryID: scenario.subcategory_id,
    scores: scenario.tiers.find(item => item.tier_id === tier.id).thresholds, minimumScore: 0,
  }))])),
};

export function sortColumnsFor(mode) {
  const season = seasonModes[mode];
  const columns = { overall: "overall" };
  const ordinals = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth"];
  if (season) {
    for (const category of season.definition.categories) {
      columns[category.name] = `(${category.subcategories.map(subcategory => `c${season.subcategories.findIndex(item => item.id === subcategory.id) + 1}`).join(" + ")})`;
    }
  } else Object.assign(columns, { clicking: "(c1 + c2)", tracking: "(c3 + c4)", switching: "(c5 + c6)" });
  for (let index = 0; index < (season?.subcategories.length || 6); index++) columns[ordinals[index]] = `c${index + 1}`;
  return columns;
}

