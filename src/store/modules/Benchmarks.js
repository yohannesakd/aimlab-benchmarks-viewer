import { advancedBench, intermediateBench, noviceBench } from "./voltaicData";
import { caclulateAll } from "../../helpers/functions";
import _ from "lodash";

export default {
  state() {
    return {
      VTAdvanced: {
        overallEnergy: 0,
        overallRank: "Unranked",
        subCategoryEnergy: [],
        benchmarks: [],
      },
      VTIntermediate: {
        overallEnergy: 0,
        overallRank: "Unranked",
        subCategoryEnergy: [],
        benchmarks: [],
      },
      VTNovice: {
        overallEnergy: 0,
        overallRank: "Unranked",
        subCategoryEnergy: [],
        benchmarks: [],
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
    allRanks(state) {
      return [
        state.VTAdvanced.overallRank,
        state.VTIntermediate.overallRank,
        state.VTNovice.overallRank,
      ];
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
  },
  actions: {
    setVTAdvanced(context) {
      let benchData = caclulateAll(
        context.rootGetters.currentPlayerTasks,
        [...advancedBench],
        "advanced"
      );
      context.commit("setVTAdvanced", benchData);
    },
    setVTIntermediate(context) {
      let benchData = caclulateAll(
        context.rootGetters.currentPlayerTasks,
        [...intermediateBench],
        "intermediate"
      );
      context.commit("setVTIntermediate", benchData);
    },
    setVTNovice(context) {
      let benchData = caclulateAll(
        context.rootGetters.currentPlayerTasks,
        [...noviceBench],
        "novice"
      );
      context.commit("setVTNovice", benchData);
    },
  },
};
