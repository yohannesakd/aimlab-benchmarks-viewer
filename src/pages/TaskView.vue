<template>
  <div class="mt-10 px-[10%] mb-10">
    <base-card class="max-w-3xl flex flex-col gap-4">
      <div class="flex justify-between">
        <h1 class="text-2xl font-semibold">{{ currentTask.name }}</h1>
        <p>
          Created by:
          {{ currentTask.author?.username ? currentTask.author.username : "" }}
        </p>
      </div>
      <p>Description: {{ currentTask.description }}</p>
      <!-- <img class="h-20" :src="currentTask.image_url" alt="" /> -->
      <a
        :href="taskLink"
        class="flex items-center gap-2 text-xl self-end"
        target="_blank"
        rel="noopener noreferrer"
      >
        <play-icon class="h-8 w-8"></play-icon> Play Task</a
      >
    </base-card>

    <section class="bg-slate-900 mt-10 p-4">
      <div class="grid grid-cols-7 bg-slate-800 p-2">
        <p>Rank</p>
        <p class="col-span-2">Name</p>
        <p>Score</p>
        <p>Hits</p>
        <p>Accuracy</p>
      </div>
      <div>
        <div
          class="grid grid-cols-7 px-4 py-2 my-2 text-lg bg-slate-700"
          v-for="(task, index) in currentTaskLeaderboard.data"
          :key="index"
        >
          <p>{{ task.rank }}</p>
          <router-link
            :to="'/profile/' + task.username"
            class="col-span-2 hover:text-slate-300"
            >{{ task.username }}</router-link
          >
          <p>{{ task.score }}</p>
          <p>{{ task.shotsHit }}</p>
          <p>{{ task.accuracy }}</p>
          <div class="flex gap-4 items-center">
            <a
              target="_blank"
              rel="noopener noreferrer"
              :href="replayLink(task.playId)"
              class="flex items-center gap-2 transition hover:text-slate-400"
            >
              <play-icon class="h-5 w-5"></play-icon> Replay</a
            >
            <div
              class="
                w-20
                h-full
                flex
                justify-center
                items-center
                transition
                hover:text-slate-400 hover:translate-y-0.5
              "
            ></div>
          </div>
        </div>
      </div>
      <div class="flex max-w-max gap-2 mx-auto mt-4">
        <button
          class="border border-gray-500 px-4 py-1"
          @click="switchPage(--currentPage)"
          v-if="currentPage > 0"
        >
          Previous
        </button>
        <div class="flex gap-1">
          <p
            class="py-2 px-4 bg-slate-700"
            v-for="page in pageNumbers"
            :key="page"
            :class="{
              'bg-slate-500 pointer-events-none': this.currentPage == page - 1,
              ' hover:bg-slate-600': !!parseInt(page),
            }"
            @click="handlePageSelect($event)"
          >
            {{ page }}
          </p>
        </div>
        <button
          class="border border-gray-500 px-4 py-1"
          @click="switchPage(++currentPage)"
          v-if="currentPage < pageCount"
        >
          Next
        </button>
      </div>
    </section>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import {
  APIFetch,
  GET_TASK_BY_ID,
  GET_TASK_LEADERBOARD,
} from "../helpers/queries.js";
import { taskDeepLink, replayDeepLink } from "../helpers/functions.js";
export default {
  props: ["taskId"],
  data() {
    return {
      currentPage: 0,
      perPage: 25,
    };
  },
  computed: {
    ...mapGetters(["currentTask", "currentTaskLeaderboard"]),
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
      if (this.currentPage > 3) pages.push("...");
      for (
        let i = this.currentPage - 2;
        i < this.currentPage + 5 && i < this.pageCount + 2;
        i++
      ) {
        if (i > 0) pages.push(i);
      }
      if (this.currentPage < this.pageCount - 2) pages.push("...");
      if (this.currentPage < this.pageCount - 1) pages.push(this.pageCount + 1);
      return pages;
    },
  },
  watch: {
    async currentPage(newPage) {
      const ldb = await APIFetch(GET_TASK_LEADERBOARD, {
        leaderboardInput: {
          clientId: "aimlab",
          limit: this.perPage,
          offset: newPage * 25,
          taskId: this.currentTask.id,
          taskMode: 0,
          weaponId: this.currentTask.weapon_id,
        },
      });
      ldb.aimlab.leaderboard.metadata.rows = this.perPage;
      this.$store.dispatch("setCurrentTaskLeaderboard", ldb.aimlab.leaderboard);
    },
  },
  methods: {
    handlePageSelect(event) {
      let value = parseInt(event.target.textContent);
      if (value) {
        this.currentPage = value - 1;
      }
    },
    replayLink(playId) {
      return replayDeepLink(playId);
    },
  },
  async mounted() {
    const res = await APIFetch(GET_TASK_BY_ID, { slug: this.taskId });

    if (res.aimlab?.task) {
      const data = res.aimlab.task;
      const ldb = await APIFetch(GET_TASK_LEADERBOARD, {
        leaderboardInput: {
          clientId: "aimlab",
          limit: this.perPage,
          offset: 0,
          taskId: data.id,
          taskMode: 0,
          weaponId: data.weapon_id,
        },
      });
      ldb.aimlab.leaderboard.metadata.rows = this.perPage;

      this.$store.dispatch("setCurrentTask", res.aimlab.task);
      this.$store.dispatch("setCurrentTaskLeaderboard", ldb.aimlab.leaderboard);
    }
  },
};
</script>