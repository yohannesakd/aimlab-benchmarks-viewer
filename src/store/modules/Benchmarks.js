import { advancedRanks, advancedEnergy, advancedBench } from "./voltaicData";
import { calculateEnergyAdv } from "../../helpers/functions";
import _ from "lodash";

export default {
  state() {
    return {
      playerVTAdvanced: [],
      overallEnergy: 0,
      overallRank: "Unranked",
      subCategoryEnergy: [],
      playerVTAdvanced: {
        overallEnergy: 0,
        overallRank: "Unranked",
        subCategoryEnergy: [],
        benchmarks: [],
      },
    };
  },
  getters: {
    playerVTAdvanced(state) {
      return state.playerVTAdvanced;
    },
    subCategoryEnergy(state) {
      return state.subCategoryEnergy;
    },
    overallEnergy(state) {
      return state.overallEnergy;
    },
    overallRank(state) {
      return state.overallRank;
    },
  },
  mutations: {
    setPlayerVTAdvanced(state, payload) {
      state.playerVTAdvanced = payload;
    },
    setSubCategoryEnergy(state, payload) {
      state.subCategoryEnergy = payload;
    },
    setOverallEnergy(state, payload) {
      state.overallEnergy = payload;
    },
    setOverallRank(state, payload) {
      state.overallRank = payload;
    },
  },
  actions: {
    setPlayerVTAdvanced(context, payload) {
      let currentPlayerTasks = context.rootGetters.currentPlayerTasks;
      //fetching benchmark data
      let playerVTAdvanced = [...advancedBench].map((bench) => {
        return { ...bench, energy: 0, rank: "Unranked" };
      });
      //filter user played benchmarks
      let userPlayedBenches = currentPlayerTasks.filter((task) => {
        return playerVTAdvanced.some((bench) => task.id == bench.id);
      });
      //group benchmark data and user played benchmarks by id
      let groupById = _.groupBy(
        [...userPlayedBenches, ...playerVTAdvanced],
        "id"
      );
      //merge the created groups
      playerVTAdvanced = Object.entries(groupById).map((task) => {
        if (task[1].length > 1) {
          return { ...task[1][0], ...task[1][1] };
        }
      });
      //
      // calculating category energy
      const grouped = _.groupBy(playerVTAdvanced, "categoryID");
      const energyList = Object.entries(grouped).map(([_, group]) => {
        return Math.max(...group.map(({ energy }) => energy));
      });
      const harmonicMean = Math.floor(
        6 / energyList.reduce((acc, curr) => acc + 1 / curr, 0)
      );
      const floorEnergy = Math.floor(harmonicMean / 100) * 100;
      const overallRank = advancedRanks[floorEnergy] || "Unranked";

      context.commit("setPlayerVTAdvanced", playerVTAdvanced);
      context.commit("setSubCategoryEnergy", energyList);
      context.commit("setOverallEnergy", harmonicMean);
      context.commit("setOverallRank", overallRank);
    },
  },
};
