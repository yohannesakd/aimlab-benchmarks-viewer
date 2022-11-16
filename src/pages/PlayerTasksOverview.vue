<template>
  <section v-if="isLoading" class="grid items-center py-4">
    <loading-spinner class="mx-auto"></loading-spinner>
  </section>
  <section v-else>
    <div class="grid grid-cols-4 gap-3 p-3 relative">
      <input
        type="text"
        name=""
        id=""
        class="
          w-72
          px-4
          py-1.5
          bg-slate-600
          rounded-t-md
          absolute
          top-0
          -right-[1px]
          -translate-y-full
          z-10
          outline-none
          border-2 border-slate-600
          placeholder-slate-200
        "
        placeholder="Search..."
        v-model.trim="searchQuery"
        @change="handleQuery"
      />
      <router-link
        v-for="(task, index) in paginatedTaskList.data"
        :key="index"
        class="
          bg-slate-800
          border border-slate-800
          min-h-[128px]
          px-4
          py-2
          flex flex-col
          justify-center
          rounded-lg
          shadow-md
          font-semibold
          tracking-wide
          transition
          hover:scale-[101%] hover:shadow-xl hover:border hover:border-slate-500
        "
        :to="'/tasks/' + task.id"
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
      </router-link>
    </div>
    <!-- Paginator -->
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
          class="py-2 px-4 bg-slate-700 hover:cursor-pointer"
          v-for="page in pageNumbers"
          :key="page"
          :class="{
            'bg-slate-600 pointer-events-none': this.currentPage == page - 1,
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
          currentPage < paginatedTaskList.pageCount
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
</template>

<script>
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
        this.currentPage = 0;
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
};
</script>