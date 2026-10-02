import { defineStore } from 'pinia';

export const usePlayerStore = defineStore('player', {
  state: () => ({ snapshot: null }),
  getters: {
    currentPlayerInfo: state => state.snapshot?.playerInfo || {},
    currentPlayerTasks: state => state.snapshot?.tasks || [],
    tasksPlayed: state => state.snapshot?.totals.tasksPlayed || 0,
    totalPlays: state => state.snapshot?.totals.totalPlays || 0,
    benchmarkSets: state => state.snapshot?.benchmarkSets || [],
    profileFetchedAt: state => state.snapshot?.fetchedAt || null,
  },
  actions: {
    setProfileSnapshot(snapshot) { this.snapshot = snapshot; },
  },
});
