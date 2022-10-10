export default {
  state() {
    return {
      currentPlayerInfo: {},
      currentPlayerTasks: [],
    };
  },
  getters: {
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
      let plays = payload.map((task) => {
        return {
          name: task.group_by.task_name,
          id: task.group_by.task_id,
          count: task.aggregate.count,
          avgScore: task.aggregate.avg.score,
          avgAcc: task.aggregate.avg.accuracy,
          maxScore: task.aggregate.max.score,
          maxAcc: task.aggregate.max.accuracy,
        };
      });
      plays = plays
        .filter((task) => {
          if (task.name) return true;
          if (!task.id.includes(".")) return true;
        })
        .map((task) => {
          if (!task.name) {
            task.name = task.id;
          }
          return task;
        });
      plays = plays.sort((a, b) =>
        a.count > b.count ? -1 : b.count > a.count ? 1 : 0
      );
      context.commit("updateCurrentPlayerTasks", plays);
    },
  },
};
