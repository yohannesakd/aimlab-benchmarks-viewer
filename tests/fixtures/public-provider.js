// Offline provider used by the HTTP and browser contract tests.
import sharp from 'sharp';
const avatar = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: '#42cbc3' } }).png().toBuffer();
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  if (String(url).startsWith('http://127.0.0.1:')) return nativeFetch(url, options);
  if (String(url) === 'https://marketplace-api-public-prod.s3.amazonaws.com/avatar_asset/profile_image/fixture.png') {
    return new Response(avatar, { headers: { 'Content-Type': 'application/octet-stream' } });
  }
  if (url !== 'https://api.aimlabs.com/graphql') throw new Error('Unexpected fixture provider');
  const { query, variables } = JSON.parse(options.body);
  let trainer;
  if (query.includes('GetProfileAggregates')) trainer = { aimlab: { plays_agg: [{ group_by: { task_id: 'fixture-task', task_name: 'Fixture task', task_mode_mod: 0, weapon_id: '9mm' }, aggregate: { count: 3, avg: { score: 150, accuracy: 85 }, max: { score: 200, accuracy: 85 } } }] } };
  else if (query.includes('PublicPlayerDetails')) trainer = { aimlabProfile: { username: variables.username, imageUrl: 'https://marketplace-api-public-prod.s3.amazonaws.com/avatar_asset/profile_image/fixture.png', activity: { latestStreak: { streakCount: 3, endDate: '2026-01-01' } } } };
  else if (query.includes('GetProfile(')) trainer = { aimlabProfile: variables.username === 'Missing' ? null : { username: variables.username, user: { id: 'fixture-player' } } };
  else if (query.includes('GetTaskLeaderboard')) trainer = { aimlab: { leaderboard: { metadata: { totalRows: 1, offset: 0, rows: 1 }, data: [{ rank: 1, username: 'Fixture', score: 200, play_id: 'fixture-run', accuracy: 85 }] } } };
  else if (query.includes('GetTask(')) trainer = { aimlab: { task: variables.slug === 'missing-task' ? null : { id: variables.slug, name: 'Fixture task', weapon_id: '9mm' } } };
  else if (query.includes('publishedReplay')) trainer = { publishedReplay: { publisher: { username: 'Fixture' }, play: { id: variables.playId, taskSlug: 'fixture-task', score: 200, convertedMode: 0, manifest: { weaponId: '9mm', performanceData: {} } } } };
  else if (query.includes('PlayerTaskRuns')) trainer = { aimlabProfile: { username: variables.username, latestPlay: { totalCount: 0, edges: [], pageInfo: { endCursor: null, hasNextPage: false } } } };
  else throw new Error('Unexpected fixture query');
  return new Response(JSON.stringify({ data: { Trainer: trainer } }));
};
