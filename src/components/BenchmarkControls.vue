<template>
  <div class="benchmark-controls">
    <label><span class="field-label">Benchmark set</span>
      <select class="text-field" :value="selectedSet" @change="$emit('set-change', $event.target.value)">
        <option v-for="set in sets" :key="set.id" :value="set.id">{{ set.label }}</option>
      </select>
    </label>
    <label><span class="field-label">Difficulty</span>
      <select class="text-field" :value="level" @change="$emit('level-change', $event.target.value)">
        <option v-for="option in levels" :key="option" :value="option.toLowerCase()">{{ option }}</option>
      </select>
    </label>
  </div>
</template>
<script>
export default {
  props: { sets: Array, selectedSet: String, level: String, levels: Array },
  emits: ['set-change', 'level-change'],
};
</script>
<style scoped>
.benchmark-controls { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
label:first-child { flex: 1 1 240px; }
label:last-child { flex: 0 1 220px; }
@media (max-width: 520px) { label:last-child { flex: 1 1 220px; } }
</style>
