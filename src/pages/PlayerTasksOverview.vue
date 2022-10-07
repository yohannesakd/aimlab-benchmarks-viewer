<template>
  <section v-if="isLoading" class="grid items-center py-4">
    <loading-spinner class="mx-auto"></loading-spinner>
  </section>
  <section v-else class="grid grid-cols-5 gap-4 p-4">
    <div
      v-for="(task, index) in currentPlayerTasks"
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
  computed: {
    currentPlayerTasks() {
      return this.$store.getters.currentPlayerTasks;
    },
  },
  mounted() {
    // this.$store.commit("setPlayerBenchmarks");
    // console.log(this.$store.getters.currentPlayerTasks);
  },
};
</script>