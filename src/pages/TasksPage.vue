<template>
  <section class="mb-20">
    <base-card class="mt-10 mx-auto max-w-2xl">
      <form @submit.prevent="searchTask" class="flex flex-col items-center">
        <div class="flex w-full gap-3 justify-center py-2">
          <input
            class="
              border-2
              block
              rounded
              py-1
              px-2
              w-3/5
              text-black
              focus:ring-2 focus:ring-blue-500
            "
            type="text"
            id="taskname"
            autocomplete="off"
            v-model.trim="taskNameInput"
          />
          <button
            type="submit"
            class="
              border border-slate-300
              px-4
              py-1
              rounded
              transition
              hover:bg-slate-500
            "
          >
            Search
          </button>
        </div>
        <label class="block" for="taskname"
          >Search for a Task/Scenario (<span class="italic">Be Specific</span
          >)</label
        >
      </form>
    </base-card>
    <base-card class="mx-auto mt-4 max-w-2xl">
      <div
        class="
          flex
          items-center
          justify-between
          py-1
          px-4
          my-2
          bg-slate-600
          rounded
          transition
          hover:bg-slate-500
        "
        v-for="(task, index) in taskList"
        :key="index"
      >
        <p>{{ task.name }}</p>
        <div class="flex items-center gap-4">
          <p>{{ task.author.username }}</p>
          <img
            class="w-10 h-10 text-[8px] text-center bg-slate-700 p-1"
            :src="task.image_url"
            :alt="task.name"
          />
        </div>
      </div>
    </base-card>
  </section>
</template>

<script>
import { APIFetch, GET_TASKS_BY_NAME } from "../helpers/queries";
export default {
  data() {
    return {
      taskNameInput: "",
      taskList: [],
    };
  },
  methods: {
    async searchTask() {
      this.taskList = [];
      const searchedTasks = await APIFetch(GET_TASKS_BY_NAME, {
        name: this.taskNameInput,
      });
      if (searchedTasks.aimlab.tasks.length) {
        this.taskList = searchedTasks.aimlab.tasks;
        console.log(this.taskList);
      } else {
        console.log("task not found");
      }
    },
  },
};
</script>