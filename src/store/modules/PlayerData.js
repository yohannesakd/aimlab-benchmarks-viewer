export default {
  state() {
    return {
      currentPlayerInfo: {},
      currentPlayerTasks: [],
      totals: { tasksPlayed: 0, totalPlays: 0 },
    };
  },
  getters: {
    currentPlayerInfo(state) {
      return state.currentPlayerInfo;
    },
    tasksPlayed(state) {
      return state.totals.tasksPlayed;
    },
    totalPlays(state) {
      return state.totals.totalPlays;
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
    updateTotals(state, payload) { state.totals = payload; },
  },
  actions: {
    updateCurrentPlayerInfo(context, payload) {
      context.commit("updateCurrentPlayerInfo", payload);
    },
    updateCurrentPlayerTasks(context, payload) {
      context.commit("updateCurrentPlayerTasks", payload);
    },
    updateTotals(context, payload) { context.commit("updateTotals", payload); },
  },
};
