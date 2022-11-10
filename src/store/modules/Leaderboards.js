import { organizeLeaderboard } from "../../helpers/functions";
import { easyBench, hardBench, mediumBench } from "../../helpers/revosectData";
export default {
  state() {
    return {
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
        const worker = new Worker("/src/helpers/leaderboard-worker.js");
        worker.onmessage = (event) => {
          playerList[event.data[1]] = event.data[0];
          if (Object.entries(playerList).length == fullBench.length) {
            // console.log(playerList);
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
