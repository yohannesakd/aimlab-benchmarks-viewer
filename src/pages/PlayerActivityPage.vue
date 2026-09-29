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
        <p v-if="activity.learning.stars !== null || activity.learning.completedPlans !== null">
          Learning: {{ activity.learning.stars ?? '—' }} stars · {{ activity.learning.completedPlans ?? '—' }} plans completed
        </p>
      </div>
      <ul class="activity-chart" aria-label="Active days by year">
        <li v-for="item in activity.years" :key="item.year">
          <span class="activity-year">{{ item.year }}</span>
          <span class="activity-track" aria-hidden="true"><span v-if="item.activeDays" :style="{ width: barWidth(item.activeDays) }"></span></span>
          <strong class="activity-count">{{ item.activeDays }}<span class="sr-only"> active days</span></strong>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.activity-content { padding: 18px 20px; }
.activity-summary { display: flex; flex-wrap: wrap; align-items: baseline; gap: 10px 28px; margin-bottom: 16px; }
.activity-summary p { display: flex; align-items: baseline; gap: 9px; color: var(--muted); font-size: .85rem; }
.activity-summary strong { color: var(--text); font-size: 1.55rem; line-height: 1; }
.activity-chart { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
.activity-chart li { display: grid; grid-template-columns: 46px minmax(0, 1fr) 34px; align-items: center; gap: 12px; min-height: 24px; }
.activity-year { color: var(--muted); font-size: .78rem; }
.activity-track { display: block; width: 100%; height: 10px; background: var(--raised); }
.activity-track span { display: block; min-width: 2px; height: 100%; background: var(--accent); }
.activity-count { font-size: .8rem; text-align: right; font-variant-numeric: tabular-nums; }
@media (max-width: 620px) { .activity-content { padding: 16px; } .activity-chart li { gap: 8px; } }
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
    barWidth(days) {
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
