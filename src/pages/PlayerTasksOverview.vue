<template>
  <section v-if="isLoading" class="grid items-center py-4">
    <loading-spinner class="mx-auto"></loading-spinner>
  </section>
  <section v-else>
    <div class="grid grid-cols-4 gap-4 p-4 relative">
      <input
        type="text"
        name=""
        id=""
        class="
          w-72
          px-4
          py-1.5
          bg-slate-500
          absolute
          right-0
          top-0
          -translate-y-full
          z-10
          outline-none
          border-2 border-slate-500
          placeholder-slate-200
        "
        placeholder="Search..."
        v-model.trim="searchQuery"
        @change="handleQuery"
      />
      <div
        v-for="(task, index) in paginatedTaskList.data"
        :key="index"
        class="
          bg-slate-800
          min-h-[128px]
          px-4
          py-2
          flex flex-col
          justify-center
          rounded-sm
          shadow-md
          font-semibold
          tracking-wide
          transition
          hover:scale-105
        "
      >
        <h3 class="text-lg uppercase text-slate-100">
          {{ task.name }}
        </h3>
        <p>
          <span class="text-sm text-blue-100">High Score :</span>
          {{ task.maxScore }}
        </p>
        <p>
          <span class="text-sm text-blue-100">Plays : </span>{{ task.count }}
        </p>
      </div>
    </div>
    <div class="bg-slate-500 max-w-max mx-auto flex items-center mb-4">
      <button
        type="button"
        class="px-3 py-1"
        @click="currentPage--"
        :class="
          currentPage > 0 ? '' : 'disabled text-slate-300 pointer-events-none'
        "
      >
        <chevron-icon
          direction="left"
          class="h-5 w-5 text-center"
        ></chevron-icon>
      </button>

      <!-- Center Buttons -->
      <div class="space-x-0.5">
        <p class="py-2 px-2 inline-block" :value="0" v-if="currentPage > 2">
          1
        </p>
        <p class="py-2 px-2 inline-block" v-if="currentPage > 3">...</p>

        <p
          class="py-2 px-2 inline-block"
          :value="page - 1"
          v-for="page in prevPages"
          :key="page"
        >
          {{ page }}
        </p>
        <p class="bg-slate-700 py-2 px-2 inline-block">{{ currentPage + 1 }}</p>
        <p
          class="py-2 px-2 inline-block"
          :value="page - 1"
          v-for="page in nextPages"
          :key="page"
        >
          {{ page }}
        </p>
        <p
          class="py-2 px-2 inline-block"
          v-if="currentPage < paginatedTaskList.pageCount - 3"
        >
          ...
        </p>
        <p
          class="py-2 px-2 inline-block"
          :value="this.paginatedTaskList.pageCount + 1"
          v-if="currentPage < paginatedTaskList.pageCount - 2"
        >
          {{ paginatedTaskList.pageCount + 1 }}
        </p>
      </div>
      <!-- Center Buttons -->

      <button
        type="button"
        class="px-3 py-1"
        @click="currentPage++"
        :class="
          currentPage < paginatedTaskList.pageCount
            ? ''
            : 'disabled text-slate-300 pointer-events-none'
        "
      >
        <chevron-icon class="h-5 w-5" direction="right"></chevron-icon>
      </button>
    </div>
  </section>
</template>

<script>
export default {
  props: ["isLoading"],
  data() {
    return {
      searchQuery: "",
      currentPage: 0,
    };
  },
  computed: {
    currentPlayerTasks() {
      let taskList = [...this.$store.getters.currentPlayerTasks];
      if (this.searchQuery) {
        this.currentPage = 0;
        return taskList.filter((task) =>
          task.name.toLowerCase().includes(this.searchQuery.toLowerCase())
        );
      }
      return taskList;
    },
    paginatedTaskList() {
      let perPage = 20;
      let pageCount = Math.floor(this.currentPlayerTasks.length / perPage);
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
    prevPages() {
      let pages = [];
      for (let i = this.currentPage; i > this.currentPage - 2 && i > 0; i--) {
        pages.unshift(i);
      }
      return pages;
    },
    nextPages() {
      let pages = [];
      for (
        let i = this.currentPage + 2;
        i < this.currentPage + 4 && i < this.paginatedTaskList.pageCount + 2;
        i++
      ) {
        pages.push(i);
      }
      return pages;
    },
  },
};
</script>