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
      @click="isOpen = !isOpen"
    >
      <span class="inline px-2">{{ selectedItem }}</span>
      <chevron-down
        class="h-5 w-5 inline absolute right-2 top-1/2 -translate-y-1/2"
      ></chevron-down>
    </div>
    <ul class="absolute z-10 bg-slate-800 w-full" v-show="isOpen">
      <li
        class="px-2 py-1 hover:bg-slate-600 transition"
        v-for="value in values"
        :key="value"
        @click="handleDropdownSelect($event)"
      >
        {{ value }}
      </li>
    </ul>
  </div>
</template>

 <script>
export default {
  props: {
    default: {
      type: String,
    },
    values: {
      type: Array,
    },
  },
  data() {
    return {
      selectedItem: this.default,
      isOpen: false,
    };
  },
  methods: {
    handleDropdownSelect(event) {
      this.selectedItem = event.target.textContent;
      this.isOpen = false;
    },
  },
};
</script>