export default {
  state: () => ({ benchmarkSets: [] }),
  getters: { benchmarkSets: state => state.benchmarkSets },
  mutations: { setPlayerBenchmarks(state, payload) { state.benchmarkSets = payload; } },
  actions: { setPlayerBenchmarks(context, payload) { context.commit("setPlayerBenchmarks", payload); } },
};
