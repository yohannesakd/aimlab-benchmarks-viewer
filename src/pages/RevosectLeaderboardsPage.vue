<template>
  <div class="space-y-10">
    <base-card class="flex gap-10 items-center">
      <div>
        <p class="mb-1 ml-1">Benchmark</p>
        <dropdown
          class="relative"
          :selectedTab="{ label: benchmark[selectedBenchmarkIndex] }"
        >
          <li
            class="px-4 py-1 bg-slate-700 hover:bg-slate-500 transition w-full"
            v-for="(element, index) in benchmark"
            :key="index"
            @click="selectedBenchmarkIndex = index"
          >
            {{ element }}
          </li>
        </dropdown>
      </div>
      <div>
        <p class="mb-1 ml-1">Category</p>
        <dropdown
          class="relative"
          :selectedTab="{ label: category[selectedCategoryIndex] }"
        >
          <li
            class="px-4 py-1 bg-slate-700 hover:bg-slate-500 transition w-full"
            v-for="(element, index) in category"
            :key="index"
            @click="selectedCategoryIndex = index"
          >
            {{ element }}
          </li>
        </dropdown>
      </div>
      <div v-if="selectedCategoryIndex != 3">
        <p class="mb-1 ml-1">Sub-Category</p>
        <dropdown
          class="relative"
          :selectedTab="{
            label:
              subCategory[category[selectedCategoryIndex]][
                selectedSubCategoryIndex
              ],
          }"
        >
          <li
            class="px-4 py-1 bg-slate-700 hover:bg-slate-500 transition w-full"
            v-for="(element, index) in subCategory[
              category[selectedCategoryIndex]
            ]"
            :key="index"
            @click="selectedSubCategoryIndex = index"
          >
            {{ element }}
          </li>
        </dropdown>
      </div>
      <!-- <button
        class="border-2 border-slate-500 px-6 py-2 rounded hover:bg-slate-500"
        @click="handleLeaderboardChange"
      >
        Show Leaderboard
      </button> -->
    </base-card>

    <div
      v-if="selectedLeaderboard"
      class="border border-slate-600 bg-slate-900 rounded-sm mb-10"
    >
      <div class="grid grid-cols-5 px-6 py-2 bg-slate-600 mx-2 mt-2">
        <p>#</p>
        <p>Name</p>
        <p>Rank</p>
        <p>Points</p>
      </div>
      <div
        v-for="(player, index) in paginatedPlayerList.data"
        :key="index"
        class="grid grid-cols-5 px-6 py-2 bg-slate-700 mt-1 mx-2"
      >
        <p>{{ paginatedPlayerList.start + index + 1 }}</p>
        <p>{{ player.username }}</p>
        <p>{{ player.overallRank }}</p>
        <p>{{ player.selectedPoints }}</p>
      </div>

      <div class="max-w-max mx-auto flex gap-1 items-center mb-4">
        <button
          type="button"
          class="px-3 py-2.5 h-full inline-block bg-slate-700"
          @click="currentPage--"
          :class="
            currentPage > 0 ? '' : 'disabled text-slate-500 pointer-events-none'
          "
        >
          <chevron-icon
            direction="left"
            class="h-5 w-5 text-center"
          ></chevron-icon>
        </button>

        <!-- Center Buttons -->
        <div class="flex gap-1">
          <p
            class="
              py-2
              px-4
              bg-slate-700
              border border-slate-700
              hover:cursor-pointer
            "
            v-for="page in pageNumbers"
            :key="page"
            :class="{
              'bg-slate-600 pointer-events-none border-slate-400':
                this.currentPage == page - 1,
              ' hover:bg-slate-600': !!parseInt(page),
            }"
            @click="handlePageSelect($event)"
          >
            {{ page }}
          </p>
        </div>
        <!-- Center Buttons -->

        <button
          type="button"
          class="
            px-3
            py-2.5
            inline-block
            bg-slate-700
            transition
            hover:bg-slate-600
          "
          @click="currentPage++"
          :class="
            currentPage < paginatedPlayerList.pageCount
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
    </div>
  </div>
</template>

<script>
import Dropdown from "../components/UI/Dropdown.vue";
export default {
  components: { Dropdown },
  data() {
    return {
      currentPage: 0,
      goToPageInput: 0,
      benchmark: ["Easy", "Medium", "Hard"],
      category: ["Clicking", "Tracking", "Switching", "Overall"],
      subCategory: {
        Clicking: ["Static", "Dynamic", "Overall"],
        Tracking: ["Precise", "Reactive", "Overall"],
        Switching: ["Flick", "Track", "Overall"],
      },
      selectedBenchmarkIndex: 1,
      selectedCategoryIndex: 0,
      selectedSubCategoryIndex: 1,
    };
  },
  watch: {
    selectedBenchmarkIndex(newIndex) {
      let bench = this.benchmark[newIndex].toLowerCase();
      if (bench == "hard" && this.$store.getters.hardLdb != 0) return;
      if (bench == "medium" && this.$store.getters.mediumLdb != 0) return;
      if (bench == "easy" && this.$store.getters.easyLdb != 0) return;
      this.$store.dispatch("fetchLeaderboard", bench);
    },
  },
  computed: {
    selectedLeaderboard() {
      let ldb = null;
      switch (this.selectedBenchmarkIndex) {
        case 0:
          ldb = this.$store.getters.easyLdb;
          break;
        case 1:
          ldb = this.$store.getters.mediumLdb;
          break;
        case 2:
          ldb = this.$store.getters.hardLdb;
          break;
      }
      ldb.forEach((player) => {
        player.selectedPoints = 0;
        let cat = this.subCategory[this.category[this.selectedCategoryIndex]];
        if (this.selectedCategoryIndex == 3) {
          player.selectedPoints = player.overallPoints;
          return;
        }
        if (this.selectedSubCategoryIndex == 2) {
          player.selectedPoints =
            player.subCategoryPoints[cat[0]] + player.subCategoryPoints[cat[1]];
          return;
        }
        player.selectedPoints =
          player.subCategoryPoints[cat[this.selectedSubCategoryIndex]];
      });
      return ldb.sort((a, b) => b.selectedPoints - a.selectedPoints);
    },
    paginatedPlayerList() {
      let perPage = 25;
      let playerList = [...this.selectedLeaderboard];
      let pageCount = Math.ceil(playerList.length / perPage) - 1;
      let start = this.currentPage * perPage;
      let end = this.currentPage * perPage + perPage;
      console.log(playerList);
      return {
        data: playerList.slice(start, end),
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
        i < this.currentPage + 3 && i < this.paginatedPlayerList.pageCount + 2;
        i++
      ) {
        if (i > 0) pages.push(i);
      }
      if (this.currentPage < this.paginatedPlayerList.pageCount - 2)
        pages.push("...");
      if (this.currentPage < this.paginatedPlayerList.pageCount - 1)
        pages.push(this.paginatedPlayerList.pageCount + 1);
      return pages;
    },
  },
  methods: {
    handlePageSelect(event) {
      let value = parseInt(event.target.textContent);
      if (value) {
        this.currentPage = value - 1;
      }
    },
    goToPage() {
      if (this.goToPageInput) {
        if (this.goToPageInput > this.paginatedPlayerList.pageCount + 1) {
          this.currentPage = this.paginatedPlayerList.pageCount;
        } else if (this.goToPageInput < 1) {
          this.currentPage = 0;
        } else {
          this.currentPage = this.goToPageInput - 1;
        }
      }
      this.goToPageInput = null;
    },
    handleLeaderboardChange() {},
  },

  mounted() {
    let bench = this.benchmark[this.selectedBenchmarkIndex].toLowerCase();
    if (bench == "hard" && this.$store.getters.hardLdb != 0) return;
    if (bench == "medium" && this.$store.getters.mediumLdb != 0) return;
    if (bench == "easy" && this.$store.getters.easyLdb != 0) return;
    this.$store.dispatch("fetchLeaderboard", bench);
  },
};
</script>