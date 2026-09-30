import { createHash } from 'node:crypto';
import { benchmarkSets, seasonModes } from './benchmark-registry.js';
import * as ra from './revosectData.js';
import * as vt from './voltaicData.js';

export const dataFormatVersion = '1';

export function legacyIdentityFor(mode) {
  return JSON.stringify(benchmarkSets[mode].map(({ id, weapon, scores, minimumScore, categoryID }) =>
    seasonModes[mode] ? [id, weapon, scores, minimumScore, categoryID] : [id, weapon, scores[0]]));
}

export function collectionIdentityFor(mode) {
  return JSON.stringify(benchmarkSets[mode].map(bench => [bench.id, bench.weapon, 0, bench.minimumScore ?? bench.scores[0]]));
}

export function publicationFor(mode) {
  const season = seasonModes[mode];
  const level = mode.slice(3);
  const definition = season ? {
    tiers: season.definition.tiers, ranks: season.definition.ranks, categories: season.definition.categories,
  } : mode.startsWith('ra-') ? {
    points: ra[`${level}Points`], ranks: ra[`${level}Ranks`],
    subPoints: ra[`${level}SubPoints`], subRanks: ra[`${level}SubRanks`], categories: ra.categories,
  } : { ranks: vt[`${level}Ranks`], energy: vt[`${level}Energy`], categories: vt.categories };
  const serialized = JSON.stringify({ mode, definition, benchmarks: benchmarkSets[mode] }, (_, value) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value);
  const digest = createHash('sha256').update(serialized).digest('hex');
  return {
    definitionDigest: digest,
    calculationVersion: season ? 'voltaic-1.0.1-precision-v1' : mode.startsWith('ra-') ? 'revosect-s2-v1' : 'voltaic-archive-v1',
    dataFormatVersion,
  };
}

export function validatePublication(mode, metadata, requireVersioned = false) {
  const expected = publicationFor(mode);
  const keys = Object.keys(expected);
  const versioned = keys.some(key => metadata[key] !== undefined);
  const compatible = versioned
    ? keys.every(key => metadata[key] === expected[key]) && metadata.collectionIdentity === collectionIdentityFor(mode)
    : !requireVersioned && metadata.identity === legacyIdentityFor(mode);
  if (!compatible || metadata.mode !== mode) {
    const error = new Error('Leaderboard definitions changed; standings are being prepared.');
    error.status = 503;
    throw error;
  }
  return {
    ...Object.fromEntries(keys.map(key => [key, metadata[key] ?? null])),
    compatibility: versioned ? 'versioned' : 'unversioned',
    collectionStartedAt: metadata.collectionStartedAt ?? null,
    collectionFinishedAt: metadata.collectionFinishedAt ?? null,
    collectorProvider: metadata.collectorProvider ?? 'legacy',
  };
}
