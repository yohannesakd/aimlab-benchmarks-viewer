import { organizeLeaderboard } from "../../helpers/functions";
import { easyBench, hardBench, mediumBench } from "../../helpers/revosectData";
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
      let ldb = null;
      let fullBench = null;
      switch (payload) {
        case "hard":
          fullBench = hardBench;
          break;
        case "medium":
          fullBench = mediumBench;
          break;
        case "easy":
          fullBench = easyBench;
          break;
      }
      let playerList = {};
      for (let bench of fullBench) {
        const worker = new Worker("/scripts/leaderboard-worker.js");
        worker.onmessage = (event) => {
          playerList[event.data[1]] = event.data[0];
          if (Object.entries(playerList).length == fullBench.length) {
            ldb = organizeLeaderboard(playerList, fullBench, payload);
            switch (payload) {
              case "hard":
                context.commit("setHardLdb", ldb);
                break;
              case "medium":
                context.commit("setMediumLdb", ldb);
                break;
              case "easy":
                context.commit("setEasyLdb", ldb);
                break;
            }
          }
        };
        worker.postMessage(bench);
      }
    },
  },
};
