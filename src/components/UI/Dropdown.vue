<template>
  <div class="dropdown w-40" ref="wrapper">
    <div
      id="selected"
      class="
        w-full
        inline-block
        relative
        border-2 border-slate-500
        py-1
        pr-6
        pl-2
        transition
        hover:bg-slate-600
      "
      @click="isOpen = !isOpen"
    >
      <span class="inline px-2">{{ selectedTab.label }}</span>
      <chevron-down
        class="h-5 w-5 inline absolute right-2 top-1/2 -translate-y-1/2"
      ></chevron-down>
    </div>
    <ul class="absolute z-10 bg-slate-800 w-full" v-show="isOpen">
      <slot></slot>
    </ul>
  </div>
</template>

 <script>
export default {
  props: {
    selectedTab: {
      type: Object,
    },
  },
  data() {
    return {
      isOpen: false,
    };
  },
  watch: {
    isOpen(newValue) {
      if (newValue) {
        document.addEventListener("click", this.handleClickAway);
        return;
      }
      document.removeEventListener("click", this.handleClickAway);
    },
  },
  methods: {
    handleClickAway(event) {
      if (this.$refs.wrapper.contains(event.target)) {
        return;
      }
      this.$emit("close");
    },
  },
};
</script>