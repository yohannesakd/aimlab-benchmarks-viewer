<template>
  <section v-if="isLoading" class="grid items-center py-4">
    <loading-spinner class="mx-auto"></loading-spinner>
  </section>
  <section v-else class="grid grid-cols-5 gap-4 p-4 relative">
    <div class="bg-blue-500 absolute">
      <button type="button" @click="currentPage--" v-if="currentPage > 0">
        Previous
      </button>
      <button
        type="button"
        @click="currentPage++"
        v-if="currentPage < paginatedTaskList.pageCount"
      >
        Next
      </button>
    </div>
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
      v-model="searchQuery"
      @change="handleQuery"
    />
    <div
      v-for="(task, index) in paginatedTaskList.data"
      :key="index"
      class="
        bg-slate-800
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
      <p><span class="text-sm text-blue-100">Plays : </span>{{ task.count }}</p>
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
        console.log(
          taskList.filter((task) =>
            task.name.toLowerCase().includes(this.searchQuery)
          )
        );
        return taskList.filter((task) =>
          task.name.toLowerCase().includes(this.searchQuery)
        );
      }
      return taskList;
    },
    paginatedTaskList() {
      let size = 20;
      let pageCount = Math.floor(this.currentPlayerTasks.length / size);
      let min = this.currentPage * size;
      let max = this.currentPage * size + size;
      let taskList = [...this.currentPlayerTasks];
      return {
        data: taskList.filter((_, index) => index >= min && index < max),
        min: max,
        max: min,
        size: size,
        pageCount: pageCount,
      };
    },
  },
};
</script>