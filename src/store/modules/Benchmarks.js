import { advancedRanks, advancedEnergy, advancedBench } from "./voltaicData";
import { calculateEnergyAdv } from "../../helpers/functions";
import _ from "lodash";

export default {
  state() {
    return {
      playerVTBenchmarks: [],
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
    playerVTBenchmarks(state) {
      return state.playerVTBenchmarks;
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
    setPlayerVTBenchmarks(state, payload) {
      state.playerVTBenchmarks = payload;
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
    setPlayerVTBenchmarks(context, payload) {
      let currentPlayerTasks = context.rootGetters.currentPlayerTasks;
      let playerVTBenchmarks = [...advancedBench];
      playerVTBenchmarks.forEach((bench) => {
        bench.avgAcc = 0;
        bench.count = 0;
        bench.maxScore = 0;
        bench.avgScore = 0;
        bench.energy = 0;
        bench.rank = "Unranked";
      });

      for (let i = 0; i < currentPlayerTasks.length; i++) {
        for (let j = 0; j < playerVTBenchmarks.length; j++) {
          if (currentPlayerTasks[i].id == playerVTBenchmarks[j].id) {
            let rankData = [0, "Unranked"];
            if (currentPlayerTasks[i].count > 0) {
              rankData = calculateEnergyAdv(
                advancedBench[j],
                currentPlayerTasks[i],
                advancedEnergy,
                advancedRanks
              );
            }
            playerVTBenchmarks[j].avgAcc = currentPlayerTasks[i].avgAcc;
            playerVTBenchmarks[j].count = currentPlayerTasks[i].count;
            playerVTBenchmarks[j].maxScore = currentPlayerTasks[i].maxScore;
            playerVTBenchmarks[j].avgScore = currentPlayerTasks[i].avgScore;
            playerVTBenchmarks[j].energy = rankData[0] || 0;
            playerVTBenchmarks[j].rank = rankData[1] || "Unranked";
          }
        }
      }
      playerVTBenchmarks.sort((a, b) => a.scenarioID - b.scenarioID);
      // calculating category energy
      const grouped = _.groupBy(playerVTBenchmarks, "categoryID");
      const energyList = Object.entries(grouped).map(([_, group]) => {
        return Math.max(...group.map(({ energy }) => energy));
      });
      const harmonicMean = Math.floor(
        6 / energyList.reduce((acc, curr) => acc + 1 / curr, 0)
      );
      const floorEnergy = Math.floor(harmonicMean / 100) * 100;
      const overallRank = advancedRanks[floorEnergy] || "Unranked";

      context.commit("setPlayerVTBenchmarks", playerVTBenchmarks);
      context.commit("setSubCategoryEnergy", energyList);
      context.commit("setOverallEnergy", harmonicMean);
      context.commit("setOverallRank", overallRank);
    },
  },
};
