export default {
  state() {
    return {
      currentTask: {},
      currentTaskLeaderboard: {},
      leaderboardWindows: ["Week", "Month", "Year", "Alltime"],
    };
  },
  getters: {
    currentTask(state) {
      return state.currentTask;
    },
    currentTaskLeaderboard(state) {
      return state.currentTaskLeaderboard;
    },
    leaderboardWindows(state) {
      return state.leaderboardWindows;
    },
  },
  mutations: {
    setCurrentTask(state, payload) {
      state.currentTask = payload;
    },
    setCurrentTaskLeaderboard(state, payload) {
      state.currentTaskLeaderboard = payload;
    },
  },
  actions: {
    setCurrentTask(context, payload) {
      context.commit("setCurrentTask", payload);
    },
    setCurrentTaskLeaderboard(context, payload) {
      context.commit("setCurrentTaskLeaderboard", payload);
    },
  },
};
