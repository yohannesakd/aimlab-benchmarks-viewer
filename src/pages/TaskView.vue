<template>
  <main class="page-shell">
    <div v-if="headLoading" class="panel status-panel"><loading-spinner></loading-spinner></div>
    <div v-else-if="taskError" class="panel status-panel" role="alert">{{ taskError }}</div>
    <template v-else>
      <div class="page-intro task-intro">
        <div><h1 class="page-title">{{ currentTask.name }}</h1><p v-if="currentTask.author?.username" class="page-subtitle">{{ currentTask.author.username }}</p></div>
        <button type="button" class="btn-secondary" @click="handleSwitchTask">Switch task</button>
      </div>
      <div v-if="currentTask.description || currentTask.workshop_id" class="panel task-summary">
        <div class="task-summary-main">
          <p v-if="currentTask.description" class="muted">{{ currentTask.description }}</p>
          <a v-if="currentTask.workshop_id" :href="taskLink" class="btn-primary" target="_blank" rel="noopener noreferrer"><play-icon class="h-5 w-5"></play-icon>Play task</a>
        </div>
      </div>

      <div v-if="isLoading" class="panel status-panel mt-4"><loading-spinner></loading-spinner></div>
      <div v-else-if="leaderboardError" class="panel status-panel mt-4" role="alert">{{ leaderboardError }}</div>
      <section v-else class="panel task-leaderboard mt-4">
        <h2 class="leaderboard-heading">Task scores</h2>
        <div class="task-score-row task-score-head" aria-hidden="true"><span>Rank</span><span>Player</span><span>Score</span><span>Hits</span><span>Accuracy</span><span>Run</span></div>
        <div v-for="(task, index) in currentTaskLeaderboard.data" :key="index" class="task-score-row">
          <span class="task-score-rank"><span class="sr-only">Rank: </span>{{ task.rank }}</span>
          <router-link class="player-name" :aria-label="`View ${task.username} profile`" :to="'/profile/' + encodeURIComponent(task.username)">{{ task.username }}</router-link>
          <span class="task-score-value"><span class="sr-only">Score: </span>{{ task.score }}</span>
          <span class="task-score-hits"><span class="sr-only">Hits: </span>{{ task.shotsHit }}</span>
          <span class="task-score-accuracy"><span class="sr-only">Accuracy: </span>{{ task.accuracy }}</span>
          <button type="button" class="task-run text-link" :disabled="!task.playId" @click="showRun(task)">View run →</button>
        </div>
        <p v-if="!currentTaskLeaderboard.data?.length" class="status-panel">Aimlabs has no leaderboard scores for this task.</p>
        <div v-if="currentTaskLeaderboard.data?.length" class="pagination">
          <span>Page {{ currentPage + 1 }} of {{ pageCount + 1 }}</span>
          <div class="pagination-controls">
            <button type="button" class="page-button" :disabled="currentPage <= 0" aria-label="Previous page" @click="currentPage--"><chevron-icon direction="left" class="h-4 w-4"></chevron-icon></button>
            <button v-for="(page, index) in pageNumbers" :key="index" type="button" class="page-button page-number" :class="{ active: page === currentPage + 1 }" :disabled="page === '...'" @click="handlePageSelect($event)">{{ page }}</button>
            <button type="button" class="page-button" :disabled="currentPage >= pageCount" aria-label="Next page" @click="currentPage++"><chevron-icon direction="right" class="h-4 w-4"></chevron-icon></button>
            <span class="page-status">Page {{ currentPage + 1 }} / {{ pageCount + 1 }}</span>
            <input class="page-input" type="number" min="1" :max="pageCount + 1" aria-label="Go to page" v-model.number="goToPageInput" @keydown.enter="goToPage" />
            <button type="button" class="page-button" @click="goToPage">Go</button>
          </div>
        </div>
      </section>
    </template>
  </main>
</template>
<style scoped>
.task-intro { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; }
.task-summary-main { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 20px; }
.task-summary p { margin-top: 6px; font-size: .86rem; line-height: 1.6; }
.task-summary .btn-primary { flex: 0 0 auto; }
.task-score-row { display: grid; grid-template-columns: 70px minmax(0, 1.5fr) 95px 80px 95px 100px; align-items: center; gap: 12px; min-height: 50px; padding: 9px 20px; border-bottom: 1px solid var(--line); font-size: .88rem; }
.task-score-head { min-height: 40px; color: var(--muted); font-size: .78rem; }
.task-score-value { font-weight: 600; font-variant-numeric: tabular-nums; }
.task-run { display: inline-flex; align-items: center; gap: 5px; }
.task-score-row .player-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 800px) {
  .task-score-row { grid-template-columns: 42px minmax(0, 1fr) auto; gap: 4px 10px; }
  .task-score-head { display: none; }
  .task-score-rank { grid-column: 1; grid-row: 1 / 3; }
  .task-score-row .player-name { grid-column: 2; grid-row: 1; }
  .task-score-value { grid-column: 3; grid-row: 1; text-align: right; }
  .task-score-hits, .task-score-accuracy { display: none; }
  .task-run { grid-column: 2 / 4; grid-row: 2; font-size: .78rem; }
}
@media (max-width: 620px) { .task-intro, .task-summary-main { align-items: start; flex-direction: column; } .task-score-row { padding: 12px 14px; } }
</style>

<script>
import { mapGetters } from "vuex";
import { fetchData } from "../helpers/api.js";
import { openRunDetails } from "../helpers/runDetails.js";
import { taskDeepLink } from "../helpers/taskLinks.js";
export default {
  props: ["taskId"],
  data() {
    return {
      isLoading: false,
      headLoading: false,
      taskError: "",
      leaderboardError: "",
      currentPage: 0,
      goToPageInput: null,
      taskRequestVersion: 0,
      leaderboardRequestVersion: 0,
    };
  },
  computed: {
    ...mapGetters([
      "currentTask",
      "currentTaskLeaderboard",
    ]),
    leaderboardIdentity() { return JSON.stringify([this.taskId, this.$route.query.weapon, this.$route.query.mode]); },
    taskLink() {
      return taskDeepLink(this.currentTask.workshop_id);
    },
    pageCount() {
      if (this.currentTaskLeaderboard?.pagination)
        return this.currentTaskLeaderboard.pagination.pageCount;
      return 0;
    },
    pageNumbers() {
      let pages = [];
      if (this.currentPage > 3) pages.push(1);
      if (this.currentPage > 4) pages.push("...");
      for (
        let i = this.currentPage - 2;
        i < this.currentPage + 5 && i < this.pageCount + 2;
        i++
      ) {
        if (i > 0) pages.push(i);
      }
      if (this.currentPage < this.pageCount - 4) pages.push("...");
      if (this.currentPage < this.pageCount - 3) pages.push(this.pageCount + 1);
      return pages;
    },
  },
  watch: {
    leaderboardIdentity: { immediate: true, handler() {
      this.loadTask(this.taskId);
    } },
    currentPage() {
      if (!this.headLoading && !this.taskError && this.currentTask.id === this.taskId) {
        this.loadLeaderboard(this.currentTask);
      }
    },
  },
  beforeUnmount() {
    this.taskRequestVersion++;
    this.leaderboardRequestVersion++;
  },
  methods: {
    handlePageSelect(event) {
      let value = parseInt(event.target.textContent);
      if (value) {
        this.currentPage = value - 1;
      }
    },
    showRun(task) {
      openRunDetails({ username: task.username, taskId: this.taskId, taskName: this.currentTask.name, weapon: this.currentTaskLeaderboard.weaponId, mode: this.currentTaskLeaderboard.mode, playId: task.playId, score: task.score });
    },
    handleSwitchTask() {
      this.$router.push("/tasks");
    },
    goToPage() {
      if (Number.isInteger(this.goToPageInput)) {
        this.currentPage = Math.min(
          Math.max(this.goToPageInput - 1, 0),
          this.pageCount
        );
      }
      this.goToPageInput = null;
    },
    async loadTask(taskId) {
      const version = ++this.taskRequestVersion;
      this.leaderboardRequestVersion++;
      this.headLoading = true;
      this.isLoading = true;
      this.taskError = "";
      this.leaderboardError = "";
      this.currentPage = 0;

      try {
        const response = await fetchData(`/api/tasks/${encodeURIComponent(taskId)}`);
        if (version !== this.taskRequestVersion) return;
        const task = response;
        if (!task) {
          this.taskError = "Task not found";
          return;
        }
        this.$store.dispatch("setCurrentTask", task);
        this.headLoading = false;
        await this.loadLeaderboard(task);
      } catch (error) {
        if (version === this.taskRequestVersion) {
          console.error(error);
          this.taskError = "Could not load this task. Try again.";
        }
      } finally {
        if (version === this.taskRequestVersion) {
          this.headLoading = false;
          if (this.taskError) this.isLoading = false;
        }
      }
    },
    async loadLeaderboard(task) {
      const version = ++this.leaderboardRequestVersion;
      this.isLoading = true;
      this.leaderboardError = "";
      try {
        const params = new URLSearchParams({ page: this.currentPage });
        if (this.$route.query.weapon) params.set("weapon", this.$route.query.weapon);
        if (this.$route.query.mode !== undefined) params.set("mode", this.$route.query.mode);
        const response = await fetchData(`/api/tasks/${encodeURIComponent(task.id)}/leaderboard?${params}`);
        if (version !== this.leaderboardRequestVersion || task.id !== this.taskId) return;
        this.$store.dispatch("setCurrentTaskLeaderboard", response);
      } catch (error) {
        if (version === this.leaderboardRequestVersion) {
          console.error(error);
          this.leaderboardError = "Could not load the leaderboard. Try again.";
        }
      } finally {
        if (version === this.leaderboardRequestVersion) this.isLoading = false;
      }
    },
  },
};
</script>
