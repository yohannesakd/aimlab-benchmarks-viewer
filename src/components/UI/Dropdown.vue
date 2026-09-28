<template>
  <div class="dropdown" ref="wrapper">
    <button type="button" class="dropdown-trigger" :aria-expanded="isOpen" @click="isOpen = !isOpen">
      <span>{{ selectedTab.label }}</span>
      <chevron-icon class="h-5 w-5" :class="{ 'rotate-180': isOpen }"></chevron-icon>
    </button>
    <ul v-show="isOpen" class="dropdown-list" @click="isOpen = false"><slot></slot></ul>
  </div>
</template>

<script>
export default {
  props: { selectedTab: { type: Object, required: true } },
  data() { return { isOpen: false }; },
  watch: {
    isOpen(open) {
      if (open) document.addEventListener("click", this.handleClickAway);
      else document.removeEventListener("click", this.handleClickAway);
    },
  },
  beforeUnmount() { document.removeEventListener("click", this.handleClickAway); },
  methods: {
    handleClickAway(event) {
      if (!this.$refs.wrapper?.contains(event.target)) this.isOpen = false;
    },
  },
};
</script>

<style scoped>
.dropdown { position: relative; width: 100%; }
.dropdown-trigger { width: 100%; min-height: 45px; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 2px; background: #162436; color: var(--text); text-align: left; }
.dropdown-trigger:hover, .dropdown-trigger[aria-expanded=true] { border-color: var(--accent); }
.dropdown-list { position: absolute; z-index: 20; top: calc(100% + 4px); left: 0; width: 100%; max-height: 250px; overflow-y: auto; border: 1px solid var(--line); border-radius: 2px; background: var(--panel); box-shadow: 0 12px 28px #08111d80; }
.dropdown-list :deep(li) { padding: 9px 12px; cursor: pointer; background: transparent; }
.dropdown-list :deep(li:hover) { background: var(--raised); color: var(--accent); }
</style>
