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
      let fields = payload.schema.fields.map(({ name }) => name);
      let pagination = {
        ...payload.metadata,
        pageCount:
          Math.ceil(payload.metadata.totalRows / payload.metadata.rows) - 1,
      };
      let data = payload.data.map((data) => {
        return {
          score: data.score,
          accuracy:
            Math.round((data.accuracy + Number.EPSILON) * 100) / 100 + "%",
          shotsHit: data.shots_hit,
          targets: data.targets,
          playId: data.play_id,
          username: data.username,
          userId: data.user_id,
          kills: data.kills,
          date: data.ended_at,
          rank: data.rank,
        };
      });
      context.commit("setCurrentTaskLeaderboard", { fields, pagination, data });
    },
  },
};
