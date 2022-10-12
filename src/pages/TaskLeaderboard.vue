<template>
  <h1>{{ taskId }}</h1>
</template>

<script>
import { APIFetch, GET_TASK_BY_ID } from "../helpers/queries.js";
export default {
  props: ["taskId"],

  async mounted() {
    const res = await APIFetch(GET_TASK_BY_ID, { slug: this.taskId });
    console.log(res.aimlab.task);
  },
  computed: {},
};
</script>