<template>
  <div
    class="shadow-lg rounded-md p-4 bg-slate-700 text-white"
    :class="maxSize"
  >
    <slot></slot>
  </div>
</template>
<script>
export default {
  props: {
    size: {
      type: String,
      default: "md",
    },
  },
  computed: {
    maxSize() {
      return `max-w-${this.size}`;
    },
  },
};
</script>