<template>
  <section>
    <div class="panel-header">
      <div>
        <h2 class="section-title">Training activity</h2>
        <p class="result-meta">Days played each year.</p>
      </div>
    </div>
    <div v-if="isLoading" class="status-panel"><loading-spinner /></div>
    <div v-else-if="loadError" class="status-panel" role="alert">{{ loadError }}</div>
    <div v-else-if="activity" class="activity-content">
      <div class="activity-summary">
        <p><strong>{{ activity.activeDays.toLocaleString() }}</strong><span>active days in total</span></p>
        <p><strong>{{ activity.recentActiveDays.toLocaleString() }}</strong><span>active days in the last 12 months</span></p>
      </div>
      <div class="activity-chart" role="img" :aria-label="activity.years.map(item => item.year + ': ' + item.activeDays + ' active days').join(', ')">
        <div v-for="item in activity.years" :key="item.year" class="activity-year" :title="`${item.activeDays} active days in ${item.year}`">
          <strong>{{ item.activeDays }}</strong>
          <div class="activity-track"><span v-if="item.activeDays" :style="{ height: barHeight(item.activeDays) }"></span></div>
          <span>{{ item.year }}</span>
        </div>
      </div>
      <p v-if="activity.learning.stars !== null || activity.learning.completedPlans !== null" class="result-meta learning-summary">
        Learning: {{ activity.learning.stars ?? '—' }} stars · {{ activity.learning.completedPlans ?? '—' }} plans completed
      </p>
    </div>
  </section>
</template>

<style scoped>
.activity-content { padding: 20px; }
.activity-summary { display: flex; flex-wrap: wrap; gap: 16px 32px; margin-bottom: 22px; }
.activity-summary p { display: flex; align-items: baseline; gap: 9px; color: var(--muted); font-size: .85rem; }
.activity-summary strong { color: var(--text); font-size: 1.55rem; line-height: 1; }
.activity-chart { display: flex; gap: 12px; min-height: 150px; }
.activity-year { display: flex; flex: 1 1 0; max-width: 120px; flex-direction: column; align-items: center; gap: 5px; color: var(--muted); font-size: .72rem; }
.activity-year strong { color: var(--text); font-size: .8rem; }
.activity-track { display: flex; align-items: flex-end; width: 100%; height: 96px; background: var(--raised); }
.activity-track span { display: block; width: 100%; min-height: 2px; background: var(--accent); }
.learning-summary { margin-top: 20px; padding-top: 14px; border-top: 1px solid var(--line); }
@media (max-width: 620px) { .activity-content { padding: 16px; } .activity-chart { gap: 5px; overflow-x: auto; } .activity-year { flex: 0 0 50px; font-size: .62rem; } .activity-track { height: 72px; } }
</style>

<script>
export default {
  props: { username: String },
  data() {
    return { activity: null, isLoading: false, loadError: "", requestVersion: 0 };
  },
  computed: {
    maxDays() {
      return Math.max(1, ...(this.activity?.years || []).map((year) => year.activeDays));
    },
  },
  watch: {
    username: { immediate: true, handler: "loadActivity" },
  },
  beforeUnmount() {
    this.requestVersion++;
  },
  methods: {
    barHeight(days) {
      return `${Math.round(days / this.maxDays * 100)}%`;
    },
    async loadActivity(username) {
      const version = ++this.requestVersion;
      this.activity = null;
      this.isLoading = true;
      this.loadError = "";
      try {
        const response = await fetch(`/api/profiles/${encodeURIComponent(username)}/activity`);
        const body = await response.json().catch(() => null);
        if (!response.ok || !body) throw new Error("Training activity is unavailable. Try again.");
        if (version === this.requestVersion) this.activity = body;
      } catch (error) {
        if (version === this.requestVersion) this.loadError = error.message;
      } finally {
        if (version === this.requestVersion) this.isLoading = false;
      }
    },
  },
};
</script>
