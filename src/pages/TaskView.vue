<template>
  <div class="mt-10 px-[8%] mb-10">
    <!-- <div class="relative">
      
    </div> -->
    <div class="flex justify-between">
      <base-card class="max-w-3xl flex flex-col gap-4">
        <div class="flex justify-between">
          <h1 class="text-2xl font-semibold">{{ currentTask.name }}</h1>
          <p>
            Created by:
            {{
              currentTask.author?.username ? currentTask.author.username : ""
            }}
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

      <div class="flex flex-col justify-between relative">
        <button
          class="
            border-2 border-slate-500
            px-6
            py-2
            rounded
            transition
            hover:bg-slate-500
          "
          @click="handleSwitchTask"
        >
          Switch Task
        </button>
        <!-- <dropdown class="" :selected-tab="currentWindow">
          <li
            class="px-4 py-1 hover:bg-slate-600 transition"
            :class="currentWindowIndex == index ? 'bg-slate-700' : ''"
            v-for="(element, index) in leaderboardWindows"
            :key="index"
            @click="handleWindowSelect(index)"
          >
            {{ element }}
          </li>
        </dropdown> -->
      </div>
    </div>

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
          class="
            px-3
            py-2.5
            inline-block
            bg-slate-700
            transition
            hover:bg-slate-600
          "
          @click="switchPage(--currentPage)"
          v-if="currentPage > 0"
        >
          Previous
        </button>
        <div class="flex gap-1">
          <div
            class="py-2 px-4 bg-slate-700 transition flex items-center"
            v-for="page in pageNumbers"
            :key="page"
            :class="{
              'bg-slate-600 pointer-events-none': this.currentPage == page - 1,
              ' hover:bg-slate-600': !!parseInt(page),
            }"
            @click="handlePageSelect($event)"
          >
            <span class="pointer-events-none">{{ page }}</span>
          </div>
        </div>
        <button
          class="
            px-3
            py-2.5
            inline-block
            bg-slate-700
            transition
            hover:bg-slate-600
          "
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
      // currentWindowIndex: 3,
      perPage: 25,
    };
  },
  computed: {
    ...mapGetters([
      "currentTask",
      "currentTaskLeaderboard",
      "leaderboardWindows",
    ]),
    taskLink() {
      return taskDeepLink(this.currentTask.workshop_id);
    },
    currentWindow() {
      return {
        value: this.leaderboardWindows[this.currentWindowIndex].toLowerCase(),
        label: this.leaderboardWindows[this.currentWindowIndex],
      };
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
    // async currentWindowIndex(newWindow) {
    //   let date = new Date();
    //   const window = {
    //     week: `${date.getFullYear()}-${parseInt(
    //       date.getMonth() + 1
    //     )}-${date.getDate()}`,
    //     month: `${date.getFullYear()}-${parseInt(date.getMonth() + 1)}`,
    //     year: `${date.getFullYear()}`,
    //     allTime: "",
    //   };
    //   const period = this.leaderboardWindows[this.newWindow];
    //   const ldb = await APIFetch(GET_TASK_LEADERBOARD, {
    //     leaderboardInput: {
    //       clientId: "aimlab",
    //       limit: this.perPage,
    //       offset: this.currentPage,
    //       taskId: this.currentTask.id,
    //       taskMode: 0,
    //       weaponId: this.currentTask.weapon_id,
    //     },
    //     window: {
    //       period: period,
    //       value: window[period],
    //     },
    //   });
    //   ldb.aimlab.leaderboard.metadata.rows = this.perPage;
    //   this.$store.dispatch("setCurrentTaskLeaderboard", ldb.aimlab.leaderboard);
    // },
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
    handleSwitchTask() {
      sessionStorage.removeItem("currentTask");
      this.$router.push("/tasks");
    },
    handleWindowSelect(index) {
      this.currentWindowIndex = index;
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
      sessionStorage.setItem("currentTask", res.aimlab.task.id);
      this.$store.dispatch("setCurrentTaskLeaderboard", ldb.aimlab.leaderboard);
      console.log(this.currentTaskLeaderboard);
    }
  },
};
</script>