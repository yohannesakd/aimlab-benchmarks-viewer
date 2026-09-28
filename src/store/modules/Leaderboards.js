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
    };
  },
  getters: {
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
};
