// Offline provider used only by the spawned HTTP contract test.
globalThis.fetch = async (url, options) => {
  if (url !== 'https://api.aimlabs.com/graphql') throw new Error('Unexpected fixture provider');
  const { query, variables } = JSON.parse(options.body);
  let trainer;
  if (query.includes('GetProfileAggregates')) trainer = { aimlab: { plays_agg: [] } };
  else if (query.includes('GetProfile(')) trainer = { aimlabProfile: { username: variables.username, user: { id: 'fixture-player' } } };
  else if (query.includes('GetTaskLeaderboard')) trainer = { aimlab: { leaderboard: { metadata: { totalRows: 1, offset: 0, rows: 1 }, data: [{ rank: 1, username: 'Fixture', score: 200, play_id: 'fixture-run', accuracy: 85 }] } } };
  else if (query.includes('GetTask(')) trainer = { aimlab: { task: { id: variables.slug, name: 'Fixture task', weapon_id: '9mm' } } };
  else if (query.includes('publishedReplay')) trainer = { publishedReplay: { publisher: { username: 'Fixture' }, play: { id: variables.playId, taskSlug: 'fixture-task', score: 200, convertedMode: 0, manifest: { weaponId: '9mm', performanceData: {} } } } };
  else if (query.includes('PlayerTaskRuns')) trainer = { aimlabProfile: { username: variables.username, latestPlay: { totalCount: 0, edges: [], pageInfo: { endCursor: null, hasNextPage: false } } } };
  else throw new Error('Unexpected fixture query');
  return new Response(JSON.stringify({ data: { Trainer: trainer } }));
};
