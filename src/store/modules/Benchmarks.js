import {
  advancedBench,
  intermediateBench,
  noviceBench,
} from "../../helpers/voltaicData";
import { caclulateAll, calculateRA } from "../../helpers/functions";
import _ from "lodash";
import { easyBench, hardBench, mediumBench } from "../../helpers/revosectData";

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
    setRAHard(context) {
      let benchData = calculateRA(
        context.rootGetters.currentPlayerTasks,
        [...hardBench],
        "hard"
      );
      context.commit("setRAHard", benchData);
    },
    setRAMedium(context) {
      let benchData = calculateRA(
        context.rootGetters.currentPlayerTasks,
        [...mediumBench],
        "medium"
      );
      context.commit("setRAMedium", benchData);
    },
    setRAEasy(context) {
      let benchData = calculateRA(
        context.rootGetters.currentPlayerTasks,
        [...easyBench],
        "easy"
      );
      context.commit("setRAEasy", benchData);
    },
  },
};
