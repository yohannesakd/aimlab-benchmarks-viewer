<template>
  <div class="mt-10 px-[8%] mb-10">
    <!-- <div class="relative">
      
    </div> -->
    <base-card v-if="headLoading" class="grid place-items-center max-w-3xl">
      <loading-spinner></loading-spinner>
    </base-card>
    <div v-else class="flex justify-between">
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

    <section
      v-if="isLoading"
      class="bg-slate-900 mt-10 p-3 rounded-lg grid place-items-center"
    >
      <loading-spinner></loading-spinner>
    </section>
    <section v-else class="bg-slate-900 mt-10 p-3 rounded-lg">
      <div class="grid grid-cols-7 bg-slate-800 p-2 text-lg rounded-t">
        <p class="ml-2">Rank</p>
        <p class="ml-2 col-span-2">Name</p>
        <p>Score</p>
        <p>Hits</p>
        <p>Accuracy</p>
      </div>
      <div>
        <div
          class="
            grid grid-cols-7
            px-4
            py-2
            my-2
            rounded-sm
            text-lg
            bg-slate-700
          "
          v-for="(task, index) in currentTaskLeaderboard.data"
          :key="index"
        >
          <p class="ml-2">{{ task.rank }}</p>
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
          @click="--currentPage"
          :class="
            currentPage > 0 ? '' : 'disabled text-slate-500 pointer-events-none'
          "
        >
          <chevron-icon class="h-5 w-5" direction="left"></chevron-icon>
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
          @click="++currentPage"
          :class="
            currentPage < pageCount
              ? ''
              : 'disabled text-slate-500 pointer-events-none'
          "
        >
          <chevron-icon class="h-5 w-5" direction="right"></chevron-icon>
        </button>
        <input
          type="text"
          v-model.number="goToPageInput"
          @keydown.enter="goToPage"
          @blur="goToPage"
          class="
            bg-slate-600
            text-center
            w-10
            py-2
            outline-none
            ml-2
            transition
            focus:ring-2
            ring-inset ring-slate-300
          "
        />
        <button
          class="
            text-center
            bg-slate-600
            w-10
            py-2
            outline-none
            transition
            hover:bg-slate-500
          "
          @click="goToPage"
        >
          Go
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
      isLoading: false,
      headLoading: false,
      currentPage: 0,
      goToPageInput: null,
      currentWindowIndex: 3,
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
      if (this.currentPage < this.pageCount - 4) pages.push("...");
      if (this.currentPage < this.pageCount - 3) pages.push(this.pageCount + 1);
      return pages;
    },
  },
  watch: {
    async currentPage(newPage) {
      this.isLoading = true;
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
      this.isLoading = false;
    },
    async currentWindowIndex(newWindow) {
      let date = new Date();
      const window = {
        week: `${date.getFullYear()}-${parseInt(
          date.getMonth() + 1
        )}-${date.getDate()}`,
        month: `${date.getFullYear()}-${parseInt(date.getMonth() + 1)}`,
        year: `${date.getFullYear()}`,
        allTime: "",
      };
      const period = this.leaderboardWindows[this.newWindow];
      const ldb = await APIFetch(GET_TASK_LEADERBOARD, {
        leaderboardInput: {
          clientId: "aimlab",
          limit: this.perPage,
          offset: this.currentPage,
          taskId: this.currentTask.id,
          taskMode: 0,
          weaponId: this.currentTask.weapon_id,
        },
        window: {
          period: period,
          value: window[period],
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
    handleSwitchTask() {
      sessionStorage.removeItem("currentTask");
      this.$router.push("/tasks");
    },
    handleWindowSelect(index) {
      this.currentWindowIndex = index;
    },
    goToPage() {
      if (this.goToPageInput) {
        if (this.goToPageInput > this.pageCount + 1) {
          this.currentPage = this.pageCount;
        } else if (this.goToPageInput < 1) {
          this.currentPage = 0;
        } else {
          this.currentPage = this.goToPageInput - 1;
        }
      }
      this.goToPageInput = null;
    },
  },
  async mounted() {
    this.isLoading = true;
    this.headLoading = true;
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
      this.headLoading = false;
      this.isLoading = false;
    }
  },
};
</script>