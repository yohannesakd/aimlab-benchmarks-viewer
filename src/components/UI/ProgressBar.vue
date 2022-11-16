<template>
  <div class="relative w-full py-3 overflow-hidden">
    <div
      class="absolute left-0 inset-y-0"
      :class="color"
      :style="{ width: progress }"
    ></div>
  </div>
</template>
<script>
export default {
  props: {
    max: {
      type: Number,
      default: 100,
    },
    color: { type: String, default: "bg-blue-700", required: false },
    energy: { type: Number, default: 0, required: false },
    value: { type: Number, default: 0 },
  },
  data() {
    return {
      // progressColors: {
      //   900: "bg-nova",
      //   1000: "bg-astra",
      //   1100: "bg-celestial",
      //   1200: "bg-celestial text-black",
      // },
    };
  },
  computed: {
    progress() {
      return `${(this.value * 100) / this.max}%`;
    },
    progressColor() {
      if (this.energy < 900) return "bg-grandmaster text-black";
      return this.progressColors[Math.floor(this.energy / 100) * 100];
    },
  },
};
</script>