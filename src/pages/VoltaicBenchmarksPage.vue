<template>
  <div class="relative min-h-screen">
    <dropdown
      class="ml-4 absolute top-4"
      :selected-tab="currentTab"
      :dropdownIsOpen="dropdownIsOpen"
    >
      <li
        class="px-4 py-1 hover:bg-slate-600 transition"
        v-for="element in dropdownElements"
        :key="element"
        @click="handleDropdownSelect($event)"
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
        <header class="grid grid-cols-5 bg-slate-700 pr-4 pl-16 py-2">
          <p class="col-span-2 ml-2">Scenario</p>
          <p>Score</p>
          <p>Rank</p>
          <p>Energy</p>
        </header>
        <div
          v-for="(bench, index) in VTBenchmarks.benchmarks"
          :key="index"
          class="
            bg-slate-800
            text-slate-200
            grid grid-cols-5
            px-4
            py-2
            mt-1
            ml-14
          "
        >
          <p class="col-span-2">{{ bench.name }}</p>
          <p class="tracking-wide font-semibold">{{ bench.maxScore }}</p>
          <p class="flex gap-2" :class="colorLookup[bench.rank]">
            <img
              class="h-5 self-center"
              :src="getImagePath(bench.rank, 'badge')"
              alt=""
            />
            {{ bench.rank }}
          </p>
          <div class="flex justify-between items-center relative">
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
              :value="rankProgress(bench.energy)"
              :energy="bench.energy"
              :max="bench.energy < 900 ? 900 : 100"
              color="bg-blue-500"
            ></progress-bar>
            <!-- colors: bg-grandmaster bg-nova bg-celestial bg-astra bg-iron bg-bronze bg-silver bg-gold bg-platinum bg-diamond bg-jade bg-master -->
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
import { advancedRanks, categories } from "../store/modules/voltaicData";

export default {
  data() {
    return {
      dropdownIsOpen: false,
      currentTab: { value: "advanced", label: "Advanced" },
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
    mappedEnergy() {
      return this.VTBenchmarks.subCategoryEnergy.map((energy, index) => {
        return {
          rank:
            energy < 900
              ? "Unranked"
              : advancedRanks[Math.floor(energy / 100) * 100],
          energy,
          category: categories[index],
        };
      });
    },
    colorLookup() {
      return {
        Grandmaster: "text-grandmaster",
        Nova: "text-nova",
        Astra: "text-astra",
        Celestial: "text-celestial",
      };
    },
  },
  methods: {
    getImagePath(rank, option) {
      if (!rank) return "";
      if (option == "badge") {
        return `../../public/rank-img/${rank.toLowerCase()}_badge.png`;
      } else if (option == "medal") {
        return `../../public/rank-img/${rank.toLowerCase()}.png`;
      }
    },
    rankProgress(energy) {
      if (energy == 1200) return 100;
      else if (energy < 900) return energy;
      return energy % 100;
    },
    energyMax(energy) {
      if (energy < 900) return 900;
      return 100;
    },
    handleDropdownSelect(event) {
      this.currentTab = {
        label: event.target.textContent,
        value: event.target.textContent.toLowerCase(),
      };
      this.dropdownIsOpen = false;
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