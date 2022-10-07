<template>
  <div class="dropdown w-40">
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
      @click="dropdownIsOpen = !dropdownIsOpen"
    >
      <span class="inline px-2">{{ selectedTab.label }}</span>
      <chevron-down
        class="h-5 w-5 inline absolute right-2 top-1/2 -translate-y-1/2"
      ></chevron-down>
    </div>
    <ul class="absolute z-10 bg-slate-800 w-full" v-show="dropdownIsOpen">
      <slot></slot>
    </ul>
  </div>
</template>

 <script>
export default {
  props: {
    dropdownIsOpen: {
      type: Boolean,
    },
    selectedTab: {
      type: Object,
    },
  },
  data() {
    return {};
  },
  methods: {},
};
</script>