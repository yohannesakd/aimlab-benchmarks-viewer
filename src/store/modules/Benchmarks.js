import {
  advancedBench,
  intermediateBench,
  noviceBench,
} from "../../helpers/voltaicData";
import {
  caclulateVT,
  calculateRevosectBenchmarks,
} from "../../helpers/functions";
import _ from "lodash";

export default {
  state() {
    return {
      VTAdvanced: {
        overallEnergy: 0,
        overallRank: "Unranked",
        subCategoryEnergy: [],
        benchmarks: [],
        detailsOpen: false,
      },
      VTIntermediate: {
        overallEnergy: 0,
        overallRank: "Unranked",
        subCategoryEnergy: [],
        benchmarks: [],
        detailsOpen: false,
      },
      VTNovice: {
        overallEnergy: 0,
        overallRank: "Unranked",
        subCategoryEnergy: [],
        benchmarks: [],
        detailsOpen: false,
      },
      RAHard: {
        overallPoints: 0,
        overallRank: "Unranked",
        subCategoryPoints: [],
        benchmarks: [],
        detailsOpen: false,
      },
      RAMedium: {
        overallPoints: 0,
        overallRank: "Unranked",
        subCategoryPoints: [],
        benchmarks: [],
        detailsOpen: false,
      },
      RAEasy: {
        overallPoints: 0,
        overallRank: "Unranked",
        subCategoryPoints: [],
        benchmarks: [],
        detailsOpen: false,
      },
    };
  },
  getters: {
    VTAdvanced(state) {
      return state.VTAdvanced;
    },
    VTIntermediate(state) {
      return state.VTIntermediate;
    },
    VTNovice(state) {
      return state.VTNovice;
    },
    allVTRanks(state) {
      return [
        state.VTAdvanced.overallRank,
        state.VTIntermediate.overallRank,
        state.VTNovice.overallRank,
      ];
    },
    RAHard(state) {
      return state.RAHard;
    },
    RAMedium(state) {
      return state.RAMedium;
    },
    RAEasy(state) {
      return state.RAEasy;
    },
  },
  mutations: {
    setVTAdvanced(state, payload) {
      state.VTAdvanced = payload;
    },
    setVTIntermediate(state, payload) {
      state.VTIntermediate = payload;
    },
    setVTNovice(state, payload) {
      state.VTNovice = payload;
    },
    setRAHard(state, payload) {
      state.RAHard = payload;
    },
    setRAMedium(state, payload) {
      state.RAMedium = payload;
    },
    setRAEasy(state, payload) {
      state.RAEasy = payload;
    },
  },
  actions: {
    setVTBenches(context) {
      let VTAdvanced = caclulateVT(
        context.rootGetters.currentPlayerTasks,
        [...advancedBench],
        "advanced"
      );
      let VTIntermediate = caclulateVT(
        context.rootGetters.currentPlayerTasks,
        [...intermediateBench],
        "intermediate"
      );
      let VTNovice = caclulateVT(
        context.rootGetters.currentPlayerTasks,
        [...noviceBench],
        "novice"
      );
      context.commit("setVTNovice", VTNovice);
      context.commit("setVTIntermediate", VTIntermediate);
      context.commit("setVTAdvanced", VTAdvanced);
    },

    setRABenches(context) {
      let RAHard = calculateRevosectBenchmarks(
        {
          tasks: context.rootGetters.currentPlayerTasks,
          id: context.rootGetters.currentPlayerInfo.id,
        },
        "hard"
      );
      let RAMedium = calculateRevosectBenchmarks(
        {
          tasks: context.rootGetters.currentPlayerTasks,
          id: context.rootGetters.currentPlayerInfo.id,
        },
        "medium"
      );
      let RAEasy = calculateRevosectBenchmarks(
        {
          tasks: context.rootGetters.currentPlayerTasks,
          id: context.rootGetters.currentPlayerInfo.id,
        },
        "easy"
      );
      context.commit("setRAEasy", RAEasy);
      context.commit("setRAMedium", RAMedium);
      context.commit("setRAHard", RAHard);
    },
  },
};
