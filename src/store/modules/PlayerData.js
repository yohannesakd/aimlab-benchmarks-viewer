import { cleanUpUserTasks } from "../../helpers/functions";

export default {
  state() {
    return {
      currentPlayerInfo: {},
      currentPlayerTasks: [],
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
  },
  mutations: {
    updateCurrentPlayerInfo(state, payload) {
      state.currentPlayerInfo = payload;
    },
    updateCurrentPlayerTasks(state, payload) {
      state.currentPlayerTasks = payload;
    },
  },
  actions: {
    updateCurrentPlayerInfo(context, payload) {
      context.commit("updateCurrentPlayerInfo", payload);
    },
    updateCurrentPlayerTasks(context, payload) {
      let plays = cleanUpUserTasks(payload);
      context.commit("updateCurrentPlayerTasks", plays);
    },
  },
};
