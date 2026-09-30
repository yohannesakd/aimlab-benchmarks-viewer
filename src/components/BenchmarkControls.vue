<template>
  <div class="benchmark-controls">
    <div class="set-control"><span class="field-label">Benchmark set</span>
      <dropdown label="Benchmark set" :options="sets.map(set => ({ value: set.id, label: set.label }))" :model-value="selectedSet" @update:model-value="$emit('set-change', $event)" />
    </div>
    <div class="level-control"><span class="field-label">Difficulty</span>
      <dropdown label="Difficulty" :options="levels.map(label => ({ value: label.toLowerCase(), label }))" :model-value="level" @update:model-value="$emit('level-change', $event)" />
    </div>
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
.set-control { flex: 1 1 240px; }
.level-control { flex: 0 1 220px; }
@media (max-width: 520px) { .level-control { flex: 1 1 220px; } }
</style>
