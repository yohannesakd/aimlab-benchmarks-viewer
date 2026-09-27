<template>
  <div class="mt-10 px-[8%] mb-10">

    <base-card v-if="headLoading" class="grid place-items-center max-w-3xl">
      <loading-spinner></loading-spinner>
    </base-card>
    <base-card v-else-if="taskError" class="max-w-3xl">
      {{ taskError }}
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
      </div>
    </div>

    <section
      v-if="!taskError && isLoading"
      class="bg-slate-900 mt-10 p-3 rounded-lg grid place-items-center"
    >
      <loading-spinner></loading-spinner>
    </section>
    <section v-else-if="!taskError && leaderboardError" class="bg-slate-900 mt-10 p-3 rounded-lg">
      {{ leaderboardError }}
    </section>
    <section v-else-if="!taskError" class="bg-slate-900 mt-10 p-3 rounded-lg">
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
      taskError: "",
      leaderboardError: "",
      currentPage: 0,
      goToPageInput: null,
      taskRequestVersion: 0,
      leaderboardRequestVersion: 0,
      perPage: 25,
    };
  },
  computed: {
    ...mapGetters([
      "currentTask",
      "currentTaskLeaderboard",
    ]),
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
    taskId: { immediate: true, handler: "loadTask" },
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
    replayLink(playId) {
      return replayDeepLink(playId);
    },
    handleSwitchTask() {
      sessionStorage.removeItem("currentTask");
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
        const response = await APIFetch(GET_TASK_BY_ID, { slug: taskId });
        if (version !== this.taskRequestVersion) return;
        const task = response.aimlab?.task;
        if (!task) {
          this.taskError = "Task not found";
          return;
        }
        this.$store.dispatch("setCurrentTask", task);
        sessionStorage.setItem("currentTask", task.id);
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
        const response = await APIFetch(GET_TASK_LEADERBOARD, {
          leaderboardInput: {
            clientId: "aimlab",
            limit: this.perPage,
            offset: this.currentPage * this.perPage,
            taskId: task.id,
            taskMode: 0,
            weaponId: task.weapon_id,
          },
        });
        const leaderboard = response.aimlab?.leaderboard;
        if (!leaderboard) throw new Error("Missing task leaderboard");
        if (version !== this.leaderboardRequestVersion || task.id !== this.taskId) return;
        leaderboard.metadata.rows = this.perPage;
        this.$store.dispatch("setCurrentTaskLeaderboard", leaderboard);
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
