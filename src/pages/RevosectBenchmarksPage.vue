<template>
  <div class="min-h-max relative">
    <dropdown class="ml-4 absolute top-4" :selected-tab="currentTab">
      <li
        class="px-4 py-1 hover:bg-slate-600 transition"
        v-for="(element, index) in dropdownElements"
        :key="index"
        @click="handleDropdownSelect(index)"
      >
        {{ element }}
      </li>
    </dropdown>
    <div>
      <div class="flex max-h-96 max-w-max mx-auto mt-4 gap-4 font-oswald">
        <div class="grid items-center">
          <img
            class="h-36"
            :src="getImagePath(RABenchmarks.overallRank)"
            alt=""
          />
          <p
            class="uppercase text-center font-bold tracking-widest"
            :class="colorLookup[RABenchmarks.overallRank]"
          >
            {{ RABenchmarks.overallRank }}
          </p>
        </div>
        <div class="text-slate-200 tracking-wide flex items-center">
          <p>
            Total Points :
            <span class="font-bold">{{ RABenchmarks.overallPoints }}</span>
          </p>
          <!-- <p>SubCategories</p> -->
          <!-- <ul class="pl-4">
            <li v-for="(item, index) in mappedEnergy" :key="index">
              {{ item.category }} :
              <span class="font-bold">{{ item.energy }}</span> ({{ item.rank }})
            </li>
          </ul> -->
        </div>
      </div>
      <section class="p-4 relative" id="benchmark-table">
        <header class="grid grid-cols-12 bg-slate-700 pr-4 pl-16 py-2">
          <p class="col-span-4 ml-2">Scenario</p>
          <p>Score</p>
          <p class="col-span-3">Rank</p>
          <p class="col-span-2">Points</p>
        </header>
        <div
          v-for="(bench, index) in RABenchmarks.benchmarks"
          :key="index"
          class="
            bg-slate-800
            text-slate-200
            grid grid-cols-12
            px-4
            py-2
            mt-1
            ml-14
          "
        >
          <p class="col-span-4">{{ bench.name }}</p>
          <p class="tracking-wide font-semibold">{{ bench.maxScore }}</p>
          <p class="flex gap-2 col-span-3" :class="colorLookup[bench.rank]">
            <img
              class="h-5 self-center"
              :src="getImagePath(bench.rank)"
              alt=""
            />
            {{ bench.rank }}
          </p>
          <div class="flex justify-between items-center relative col-span-3">
            <span
              class="
                text-right
                absolute
                left-1/2
                transform
                -translate-x-1/2
                z-10
              "
              >{{ bench.points }}</span
            >
            <progress-bar
              class="bg-slate-600 w-full h-5"
              :value="bench.progress"
              color="bg-blue-500"
            ></progress-bar>
            <!-- colors: bg-grandmaster bg-nova bg-celestial bg-astra bg-iron bg-bronze bg-silver bg-gold bg-platinum bg-diamond bg-jade bg-master -->
          </div>
          <p
            class="col-start-12 ml-4 flex justify-center items-center relative"
          >
            <chevron-icon
              direction="down"
              class="
                h-full
                w-12
                absolute
                transition
                hover:text-slate-400 hover:translate-y-0.5
              "
              :class="bench.detailsOpen ? 'rotate-180' : ''"
              @click="toggleBenchDetails(bench)"
            ></chevron-icon>
          </p>
          <div
            class="
              col-span-12
              text-slate-200
              flex
              gap-10
              mt-2
              py-2
              pl-4
              transition
              border-t-2 border-t-slate-600
            "
            v-if="bench.detailsOpen"
          >
            <div class="flex flex-col gap-2">
              <div class="grid grid-cols-2">
                <p v-if="bench.count">
                  PB Accuracy : {{ Math.floor(bench.maxAcc) }}%
                </p>
                <p>Total Plays : {{ bench.count }}</p>
              </div>
              <div class="grid grid-cols-2">
                <p v-if="bench.count">
                  Avg. Score : {{ Math.floor(bench.avgScore) }}
                </p>
                <p v-if="bench.count">
                  Avg. Accuracy : {{ Math.floor(bench.avgAcc) }}%
                </p>
              </div>
            </div>
            <div class="ml-auto flex text-white items-center gap-10 mr-10">
              <button
                class="flex items-center"
                :class="
                  bench.count == 0
                    ? 'text-slate-500 pointer-events-none disabled'
                    : ''
                "
                @click="replayLink(bench.id, bench.weapon)"
              >
                <span v-if="replayLoading">Loading...</span>
                <span v-else>Watch Replay</span>
              </button>
              <button
                class="
                  cursor-pointer
                  flex
                  items-center
                  gap-1
                  transition
                  hover:text-slate-300
                "
                @click="handlePlayScenario(bench.id)"
              >
                <play-icon class="h-5 w-5 transition"></play-icon>Play
              </button>
              <router-link
                class="transition hover:text-slate-300"
                :to="'/tasks/' + bench.id"
                >View Leaderboard</router-link
              >
            </div>
          </div>
        </div>
        <!-- Categories sidebar -->
        <!-- <div
          class="text-center origin-top-left absolute rotate-90"
          id="category-bar"
        >
          <div class="grid grid-cols-6 gap-1" id="category-item">
            <span
              class="bg-slate-700"
              v-for="item in subCategories"
              :key="item"
              >{{ item }}</span
            >
          </div>
          <div class="grid grid-cols-6 gap-0.5 min-w-full">
            <span
              id="subcategory-item"
              class="col-span-2 bg-slate-800"
              v-for="category in categories"
              :key="category"
              >{{ category }}</span
            >
          </div>
        </div> -->
      </section>
    </div>
  </div>
</template>
<script>
import {
  hardRanks,
  hardSubRanks,
  hardPoints,
  hardSubPoints,
} from "@/helpers/revosectData.js";
import {
  findReplay,
  findWorkshopId,
  taskDeepLink,
} from "@/helpers/functions.js";
export default {
  data() {
    return {
      replayLoading: false,
      currentTabIndex: 2,
      categories: ["Clicking", "Tracking", "Switching"],
      subCategories: [
        "Static",
        "Dynamic",
        "Precise",
        "Reactive",
        "Flick",
        "Track",
      ],
      dropdownElements: ["Easy", "Medium", "Hard"],
    };
  },
  computed: {
    currentPlayerInfo() {
      return this.$store.getters.currentPlayerInfo;
    },
    currentTab() {
      return {
        value: this.dropdownElements[this.currentTabIndex].toLowerCase(),
        label: this.dropdownElements[this.currentTabIndex],
      };
    },
    RABenchmarks() {
      switch (this.currentTab.value) {
        case "hard":
          return this.$store.getters.RAHard;
        case "medium":
          return this.$store.getters.RAMedium;
        case "easy":
          return this.$store.getters.RAEasy;
        default:
          return this.$store.getters.RAHard;
      }
    },

    colorLookup() {
      return {
        Iron: "text-iron",
        Bronze: "text-bronze",
        Silver: "text-silver",
        Gold: "text-gold",
        Platinum: "text-platinum",
        Mythic: "text-mythic",
        Immortal: "text-immortal",
        Archon: "text-archon",
        Ethereal: "text-ethereal",
        Divine: "text-divine",
      };
    },
    mappedEnergy() {
      let pointsList;
      let subPointsList;
      let rankList;
      switch (this.currentTab.value) {
        case "hard":
          pointsList = hardPoints;
          subPointsList = hardSubPoints;
          rankList = hardRanks;
          break;
        case "med":
          break;
        case "easy":
          break;
        default:
          break;
      }
      // this.RABenchmarks.subCategoryPoints.map((point, index) => {
      //   return {
      //     rank:
      //       point < energyList[1]
      //         ? "Unranked"
      //         : rankList[Math.floor(energy / 100) * 100],
      //     energy,
      //     category: categories[index],
      //   };
      // });
    },
  },
  methods: {
    getImagePath(rank) {
      return `../../rank-img/ra/${rank.toLowerCase()}.png`;
    },
    handleDropdownSelect(index) {
      this.currentTabIndex = index;
    },
    toggleBenchDetails(bench) {
      bench.detailsOpen = !bench.detailsOpen;
    },
    collapseBenchDetails() {
      this.VTBenchmarks.forEach((element) => {
        element.detailsOpen = false;
      });
    },
    async handlePlayScenario(taskId) {
      const workshopId = await findWorkshopId(taskId);
      const taskLink = taskDeepLink(workshopId);
      window.open(taskLink, "_blank");
    },
    async replayLink(taskId, weapon) {
      this.replayLoading = true;
      let link = await findReplay(
        this.currentPlayerInfo.username,
        taskId,
        weapon
      );
      if (link) {
        window.open(link, "_blank");
        window.focus();
      }
      this.replayLoading = false;
    },
  },
};
</script>

<style scoped>
#category-bar {
  min-width: 788px;
  left: 64px;
  top: 60px;
}
#category-bar span {
  transform: scale(-1, -1);
}
</style>