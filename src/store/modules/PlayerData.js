export default {
  state() {
    return {
      currentUserInfo: {},
      currentUserTasks: [],
    };
  },
  getters: {
    tasksPlayed(state) {
      return state.currentUserTasks.length;
    },
    totalPlays(state) {
      return state.currentUserTasks.reduce((accumulator, current) => {
        return accumulator + current.count;
      }, 0);
    },
  },
  mutations: {
    updateCurrentUserInfo(state, payload) {
      state.currentUserInfo = payload;
    },
    updateCurrentUserTasks(state, payload) {
      state.currentUserTasks = payload;
    },
  },
  actions: {
    updateCurrentUserInfo(context, payload) {
      context.commit("updateCurrentUserInfo", payload);
    },
    updateCurrentUserTasks(context, payload) {
      const plays = payload.map((task) => {
        return {
          name: task.group_by.task_name,
          id: task.group_by.task_id,
          count: task.aggregate.count,
          avgScore: task.aggregate.avg.score,
          avgAcc: task.aggregate.avg.accuracy,
          maxScore: task.aggregate.max.score,
        };
      });
      context.commit("updateCurrentUserTasks", plays);
    },
  },
};
