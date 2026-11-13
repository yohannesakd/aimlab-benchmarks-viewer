import { defineStore } from 'pinia';

export const usePlayerStore = defineStore('player', {
  state: () => ({ snapshot: null }),
  getters: {
    currentPlayerInfo: state => state.snapshot?.playerInfo || {},
    currentPlayerTasks: state => state.snapshot?.publicTaskSummaries ?? state.snapshot?.tasks ?? [],
    tasksPlayed: state => state.snapshot?.totals?.tasksPlayed ?? null,
    totalPlays: state => state.snapshot?.totals?.totalPlays ?? null,
    statisticsRestricted: state => state.snapshot?.statisticsStatus === 'restricted',
    publicTaskSummaryLimit: state => state.snapshot?.publicTaskSummaryLimit ?? null,
    benchmarkSets: state => state.snapshot?.benchmarkSets || [],
    profileFetchedAt: state => state.snapshot?.fetchedAt || null,
  },
  actions: {
    setProfileSnapshot(snapshot) { this.snapshot = snapshot; },
  },
});
