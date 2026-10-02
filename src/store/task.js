import { defineStore } from 'pinia';

export const useTaskStore = defineStore('task', {
  state: () => ({ currentTask: {}, currentTaskLeaderboard: {} }),
  actions: {
    setCurrentTask(task) { this.currentTask = task; },
    setCurrentTaskLeaderboard(leaderboard) { this.currentTaskLeaderboard = leaderboard; },
  },
});
