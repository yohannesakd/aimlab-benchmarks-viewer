<template>
  <section v-if="isLoading" class="status-panel"><loading-spinner></loading-spinner></section>
  <section v-else class="profile-tasks">
    <div class="panel-header profile-tasks-header">
      <div><h2 class="section-title">Played tasks</h2></div>
      <label class="task-filter"><span class="sr-only">Search played tasks</span><input class="text-field" type="search" placeholder="Search played tasks" v-model.trim="searchQuery" /></label>
    </div>
    <div v-if="paginatedTaskList.data.length" class="task-grid profile-task-grid">
      <div v-for="task in paginatedTaskList.data" :key="task.id" class="task-card player-task-card">
        <button type="button" class="player-task-run" :aria-label="`Open ${task.name} run: ${task.maxScore} points`" @click="showRun(task)"></button>
        <h3><router-link class="player-task-name" :to="'/tasks/' + encodeURIComponent(task.id) + '/leaderboard'">{{ task.name }}</router-link></h3>
        <div class="task-card-meta"><span>Best score: {{ task.maxScore }}</span><span>{{ task.count }} plays</span></div>
      </div>
    </div>
    <p v-else class="status-panel">No played tasks match this search.</p>
    <div v-if="paginatedTaskList.data.length" class="pagination">
      <span>{{ currentPlayerTasks.length.toLocaleString('en-US') }} played tasks</span>
      <div class="pagination-controls">
        <button type="button" class="page-button" :disabled="currentPage <= 0" aria-label="Previous page" @click="currentPage--"><chevron-icon direction="left" class="h-4 w-4"></chevron-icon></button>
        <button v-for="(page, index) in pageNumbers" :key="index" type="button" class="page-button page-number" :class="{ active: page === currentPage + 1 }" :disabled="page === '...'" @click="handlePageSelect($event)">{{ page }}</button>
        <button type="button" class="page-button" :disabled="currentPage >= paginatedTaskList.pageCount" aria-label="Next page" @click="currentPage++"><chevron-icon direction="right" class="h-4 w-4"></chevron-icon></button>
        <span class="page-status">Page {{ currentPage + 1 }} / {{ paginatedTaskList.pageCount + 1 }}</span>
        <input class="page-input" type="number" min="1" :max="paginatedTaskList.pageCount + 1" aria-label="Go to page" v-model.number="goToPageInput" @keydown.enter="goToPage" />
        <button type="button" class="page-button" @click="goToPage">Go</button>
      </div>
    </div>
  </section>
</template>
<style scoped>
.profile-tasks-header { flex-wrap: wrap; }
.task-filter { width: min(100%, 290px); }
.profile-task-grid { padding: 18px; }
.player-task-card { position: relative; }
.player-task-run { position: absolute; inset: 0; width: 100%; }
.player-task-name { position: relative; }
.player-task-name:hover { color: var(--accent); }
</style>

<script>
import { openRunDetails } from '../helpers/runDetails.js';
export default {
  props: ["isLoading"],
  data() {
    return {
      searchQuery: "",
      currentPage: 0,
      goToPageInput: null,
    };
  },
  methods: {
    showRun(task) { openRunDetails({ username: this.$store.getters.currentPlayerInfo.username, taskId: task.id, taskName: task.name, weapon: task.weapon, mode: task.mode, score: task.maxScore }); },
    handlePageSelect(event) {
      let value = parseInt(event.target.textContent);
      if (value) {
        this.currentPage = value - 1;
      }
    },
    goToPage() {
      if (this.goToPageInput) {
        if (this.goToPageInput > this.paginatedTaskList.pageCount + 1) {
          this.currentPage = this.paginatedTaskList.pageCount;
        } else if (this.goToPageInput < 1) {
          this.currentPage = 0;
        } else {
          this.currentPage = this.goToPageInput - 1;
        }
      }
      this.goToPageInput = null;
    },
  },
  computed: {
    currentPlayerTasks() {
      let taskList = [...this.$store.getters.currentPlayerTasks];
      if (this.searchQuery) {
        return taskList.filter((task) =>
          task.name.toLowerCase().includes(this.searchQuery.toLowerCase())
        );
      }
      return taskList;
    },
    paginatedTaskList() {
      let perPage = 24;
      let pageCount = Math.ceil(this.currentPlayerTasks.length / perPage) - 1;
      let start = this.currentPage * perPage;
      let end = this.currentPage * perPage + perPage;
      let taskList = [...this.currentPlayerTasks];
      return {
        data: taskList.slice(start, end),
        start: start,
        end: end,
        perPage: perPage,
        pageCount: pageCount,
      };
    },

    pageNumbers() {
      let pages = [];
      if (this.currentPage > 1) pages.push(1);
      if (this.currentPage > 2) pages.push("...");
      for (
        let i = this.currentPage;
        i < this.currentPage + 3 && i < this.paginatedTaskList.pageCount + 2;
        i++
      ) {
        if (i > 0) pages.push(i);
      }
      if (this.currentPage < this.paginatedTaskList.pageCount - 2)
        pages.push("...");
      if (this.currentPage < this.paginatedTaskList.pageCount - 1)
        pages.push(this.paginatedTaskList.pageCount + 1);
      return pages;
    },
  },
  watch: {
    searchQuery() { this.currentPage = 0; },
    '$store.getters.currentPlayerTasks'() { this.currentPage = 0; },
  },
};
</script>
