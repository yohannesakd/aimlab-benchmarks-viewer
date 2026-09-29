import { cleanUpBenchmarkTasks, cleanUpUserTasks } from "../../helpers/functions";

export default {
  state() {
    return {
      currentPlayerInfo: {},
      currentPlayerTasks: [],
      currentPlayerBenchmarkTasks: [],
    };
  },
  getters: {
    currentPlayerInfo(state) {
      return state.currentPlayerInfo;
    },
    tasksPlayed(state) {
      return state.currentPlayerTasks.length;
    },
    totalPlays(state) {
      return state.currentPlayerTasks.reduce((accumulator, current) => {
        return accumulator + current.count;
      }, 0);
    },
    currentPlayerTasks(state) {
      return state.currentPlayerTasks;
    },
    currentPlayerBenchmarkTasks(state) {
      return state.currentPlayerBenchmarkTasks;
    },
  },
  mutations: {
    updateCurrentPlayerInfo(state, payload) {
      state.currentPlayerInfo = payload;
    },
    updateCurrentPlayerTasks(state, payload) {
      state.currentPlayerTasks = payload;
    },
    updateCurrentPlayerBenchmarkTasks(state, payload) {
      state.currentPlayerBenchmarkTasks = payload;
    },
  },
  actions: {
    updateCurrentPlayerInfo(context, payload) {
      context.commit("updateCurrentPlayerInfo", payload);
    },
    updateCurrentPlayerTasks(context, payload) {
      context.commit("updateCurrentPlayerTasks", cleanUpUserTasks(payload));
      context.commit("updateCurrentPlayerBenchmarkTasks", cleanUpBenchmarkTasks(payload));
    },
  },
};
