<template>
  <div class="relative w-full h-1.5 overflow-hidden">
    <div class="absolute left-0 inset-y-0" :class="color" :style="{ width: progress }"></div>
  </div>
</template>
<script>
export default {
  props: {
    max: { type: Number, default: 100 },
    color: { type: String, default: "bg-blue-700" },
    value: { type: Number, default: 0 },
  },
  computed: {
    progress() { return `${(this.value * 100) / this.max}%`; },
  },
};
</script>
