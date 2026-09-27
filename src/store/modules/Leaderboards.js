export default {
  state() {
    return {
      selectedBenchmarkRA: 2,
      selectedCategoryRA: 3,
      selectedSubCategoryRA: 1,
      benchmarksRA: ["Easy", "Medium", "Hard"],
      categoriesRA: ["Clicking", "Tracking", "Switching", "Overall"],
      subCategoriesRA: {
        Clicking: ["Static", "Dynamic", "Overall"],
        Tracking: ["Precise", "Reactive", "Overall"],
        Switching: ["Flick", "Track", "Overall"],
      },
      hardLdb: [],
      mediumLdb: [],
      easyLdb: [],
    };
  },
  getters: {
    hardLdb(state) {
      return state.hardLdb;
    },
    mediumLdb(state) {
      return state.mediumLdb;
    },
    easyLdb(state) {
      return state.easyLdb;
    },
    selectedBenchmarkRA(state) {
      return state.selectedBenchmarkRA;
    },
    selectedCategoryRA(state) {
      return state.selectedCategoryRA;
    },
    selectedSubCategoryRA(state) {
      return state.selectedSubCategoryRA;
    },
    benchmarksRA(state) {
      return state.benchmarksRA;
    },
    categoriesRA(state) {
      return state.categoriesRA;
    },
    subCategoriesRA(state) {
      return state.subCategoriesRA;
    },
  },
  mutations: {
    setHardLdb(state, payload) {
      state.hardLdb = payload;
    },
    setMediumLdb(state, payload) {
      state.mediumLdb = payload;
    },
    setEasyLdb(state, payload) {
      state.easyLdb = payload;
    },
    setSelectedBenchmarkRA(state, payload) {
      state.selectedBenchmarkRA = payload;
    },
    setSelectedCategoryRA(state, payload) {
      state.selectedCategoryRA = payload;
    },
    setSelectedSubCategoryRA(state, payload) {
      state.selectedSubCategoryRA = payload;
    },
  },
  actions: {
    async fetchLeaderboard(context, payload) {
      const response = await fetch(`/api/leaderboards/ra/${payload}`);
      if (!response.ok) throw new Error(`Leaderboard request failed: ${response.status}`);
      const snapshot = await response.json();
      if (snapshot.mode !== payload || !Array.isArray(snapshot.players)) {
        throw new Error("Invalid leaderboard response");
      }
      const mutation = {
        hard: "setHardLdb",
        medium: "setMediumLdb",
        easy: "setEasyLdb",
      }[payload];
      if (!mutation) throw new Error(`Unknown benchmark mode: ${payload}`);
      context.commit(mutation, snapshot.players);
    },
  },
};
