<template>
  <div class="relative min-h-screen">
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

    <div id="mode-wrapper">
      <!-- Overall Benchmark Stats -->
      <div class="flex max-h-96 max-w-max mx-auto mt-4 gap-4 font-oswald">
        <div class="grid items-center">
          <img
            class="h-36"
            :src="getImagePath(VTBenchmarks.overallRank, 'medal')"
            alt=""
          />
          <p
            class="uppercase text-center font-bold tracking-widest"
            :class="colorLookup[VTBenchmarks.overallRank]"
          >
            {{ VTBenchmarks.overallRank }}
          </p>
        </div>
        <div class="inline text-slate-200 tracking-wide">
          <p>
            Overall Energy :
            <span class="font-bold">{{ VTBenchmarks.overallEnergy }}</span>
          </p>
          <p>SubCategories</p>
          <ul class="pl-4">
            <li v-for="(item, index) in mappedEnergy" :key="index">
              {{ item.category }} :
              <span class="font-bold">{{ item.energy }}</span> ({{ item.rank }})
            </li>
          </ul>
        </div>
      </div>

      <!-- Benchmarks table -->
      <section class="p-4 relative" id="benchmark-table">
        <header class="grid grid-cols-12 bg-slate-700 pr-4 pl-16 py-2">
          <p class="col-span-4 ml-2">Scenario</p>
          <p>Score</p>
          <p class="col-span-3">Rank</p>
          <p class="col-span-2">Energy</p>
        </header>
        <div
          v-for="(bench, index) in VTBenchmarks.benchmarks"
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
              :src="getImagePath(bench.rank, 'badge')"
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
              >{{ bench.energy }}</span
            >
            <progress-bar
              class="bg-slate-600 w-full h-5"
              :value="energyBar(bench.energy).value"
              :max="energyBar(bench.energy).max"
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
              text-slate-300
              flex
              gap-10
              mt-2
              pt-1
              pl-4
              transition
              border-t-2 border-t-slate-600
            "
            v-if="bench.detailsOpen"
          >
            <p>PB Accuracy : {{ Math.floor(bench.maxAcc) }}%</p>
            <p>Average Score : {{ Math.floor(bench.avgScore) }}</p>

            <p>Average Accuracy : {{ Math.floor(bench.avgAcc) }}%</p>
            <p>Total Plays : {{ bench.count }}</p>
            <div class="ml-auto flex gap-10 mr-10">
              <a class="text-slate-500 pointer-events-none select-none"
                >Watch Replay</a
              >
              <a
                class="
                  hover:text-slate-300
                  cursor-pointer
                  flex
                  items-center
                  gap-1
                "
                :href="scenarioLink(bench)"
              >
                <play-icon class="h-5 w-5"></play-icon> Play</a
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
  advancedRanks,
  intermediateRanks,
  noviceRanks,
  categories,
  advancedEnergy,
  intermediateEnergy,
  noviceEnergy,
} from "../store/modules/voltaicData";

export default {
  data() {
    return {
      dropdownIsOpen: false,
      currentTabIndex: 2,
      categories: ["Clicking", "Tracking", "Switching"],
      subCategories: [
        "Dynamic",
        "Static",
        "Precise",
        "Reactive",
        "Speed",
        "Evasive",
      ],
      dropdownElements: ["Novice", "Intermediate", "Advanced"],
    };
  },
  computed: {
    currentTab() {
      return {
        value: this.dropdownElements[this.currentTabIndex].toLowerCase(),
        label: this.dropdownElements[this.currentTabIndex],
      };
    },
    VTBenchmarks() {
      switch (this.currentTab.value) {
        case "advanced":
          return this.$store.getters.VTAdvanced;
        case "intermediate":
          return this.$store.getters.VTIntermediate;
        case "novice":
          return this.$store.getters.VTNovice;
        default:
          return this.$store.getters.VTAdvanced;
      }
    },

    colorLookup() {
      return {
        Iron: "text-iron",
        Bronze: "text-bronze",
        Silver: "text-silver",
        Gold: "text-gold",
        Platinum: "text-platinum",
        Diamond: "text-diamond",
        Jade: "text-jade",
        Master: "text-master",
        Grandmaster: "text-grandmaster",
        Nova: "text-nova",
        Astra: "text-astra",
        Celestial: "text-celestial",
      };
    },
    mappedEnergy() {
      let energyList;
      let rankList;
      switch (this.currentTab.value) {
        case "advanced":
          energyList = advancedEnergy;
          rankList = advancedRanks;
          break;
        case "intermediate":
          energyList = intermediateEnergy;
          rankList = intermediateRanks;
          break;
        case "novice":
          energyList = noviceEnergy;
          rankList = noviceRanks;
          break;
        default:
          break;
      }
      return this.VTBenchmarks.subCategoryEnergy.map((energy, index) => {
        return {
          rank:
            energy < energyList[1]
              ? "Unranked"
              : rankList[Math.floor(energy / 100) * 100],
          energy,
          category: categories[index],
        };
      });
    },
  },
  methods: {
    getImagePath(rank, option) {
      let rankType = rank.replace(/ /g, "");
      if (!rank) return "";
      if (option == "badge") {
        return `../../rank-img/${rankType.toLowerCase()}_badge.png`;
      } else if (option == "medal") {
        return `../../rank-img/${rankType.toLowerCase()}.png`;
      }
    },
    energyBar(energy) {
      let energyList = null;
      let value = 0;
      let max = 0;
      switch (this.currentTab.value) {
        case "advanced":
          energyList = advancedEnergy;
          max = energy < 900 ? 900 : 100;
          break;
        case "intermediate":
          energyList = intermediateEnergy;
          max = energy < 500 ? 500 : 100;
          break;
        case "novice":
          energyList = noviceEnergy;
          max = 100;
          break;
      }
      if (energy >= energyList[4]) value = 100;
      else if (energy < energyList[1]) value = energy;
      else value = energy % 100;
      return {
        value,
        max,
      };
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
    scenarioLink(bench) {},
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