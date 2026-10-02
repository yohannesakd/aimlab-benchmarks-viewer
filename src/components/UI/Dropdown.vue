<template>
  <div class="dropdown" ref="wrapper" @focusout="onFocusOut">
    <button ref="trigger" type="button" class="dropdown-trigger" :aria-label="`${label}: ${selectedLabel}`" aria-haspopup="listbox" :aria-expanded="isOpen" :aria-controls="listId" @click="toggle" @keydown="onTriggerKey">
      <span>{{ selectedLabel }}</span>
      <chevron-icon class="h-5 w-5" :class="{ 'rotate-180': isOpen }" />
    </button>
    <ul v-if="isOpen" :id="listId" class="dropdown-list" role="listbox" :aria-label="label" @keydown="onListKey">
      <li v-for="(option, index) in options" :key="option.value" role="presentation">
        <button type="button" role="option" :aria-selected="option.value === modelValue" :tabindex="index === activeIndex ? 0 : -1" @click="choose(option.value)">{{ option.label }}</button>
      </li>
    </ul>
  </div>
</template>
<script>
import { useId } from 'vue';
export default {
  setup() { return { listId: `dropdown-${useId()}` }; },
  props: {
    options: { type: Array, required: true },
    modelValue: { type: [String, Number], required: true },
    label: { type: String, required: true },
  },
  emits: ['update:modelValue'],
  data() { return { isOpen: false, activeIndex: 0 }; },
  computed: { selectedLabel() { return this.options.find(option => option.value === this.modelValue)?.label || 'Select'; } },
  mounted() { document.addEventListener('pointerdown', this.onClickAway); },
  beforeUnmount() { document.removeEventListener('pointerdown', this.onClickAway); },
  methods: {
    toggle() { if (this.isOpen) this.close(); else this.open(); },
    async open(index) {
      this.activeIndex = index ?? Math.max(0, this.options.findIndex(option => option.value === this.modelValue));
      this.isOpen = true;
      await this.$nextTick();
      this.focusOption();
    },
    close() { this.isOpen = false; },
    choose(value) { this.$emit('update:modelValue', value); this.close(); this.$refs.trigger.focus(); },
    focusOption() { this.$refs.wrapper.querySelectorAll('[role=option]')[this.activeIndex]?.focus(); },
    onTriggerKey(event) {
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        this.open(event.key === 'Home' ? 0 : event.key === 'End' ? this.options.length - 1 : undefined);
      }
    },
    onListKey(event) {
      if (event.key === 'Escape') { event.preventDefault(); this.close(); this.$refs.trigger.focus(); return; }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'Home') this.activeIndex = 0;
      else if (event.key === 'End') this.activeIndex = this.options.length - 1;
      else this.activeIndex = (this.activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + this.options.length) % this.options.length;
      this.focusOption();
    },
    onClickAway(event) { if (!this.$refs.wrapper.contains(event.target)) this.close(); },
    onFocusOut(event) { if (!this.$refs.wrapper.contains(event.relatedTarget)) this.close(); },
  },
};
</script>
<style scoped>
.dropdown { position: relative; width: 100%; }
.dropdown-trigger { width: 100%; min-height: 45px; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 2px; background: #162436; color: var(--text); text-align: left; }
.dropdown-trigger:hover, .dropdown-trigger[aria-expanded=true] { border-color: var(--accent); }
.dropdown-list { position: absolute; z-index: 20; top: calc(100% + 4px); left: 0; width: 100%; max-height: 280px; overflow-y: auto; border: 1px solid var(--line); border-radius: 2px; background: var(--panel); box-shadow: 0 12px 28px #08111d80; }
.dropdown-list button { width: 100%; padding: 9px 12px; text-align: left; }
.dropdown-list button:hover, .dropdown-list button:focus, .dropdown-list button[aria-selected=true] { background: var(--raised); color: var(--accent); }
</style>
