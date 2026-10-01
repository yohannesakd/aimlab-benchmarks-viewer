<template>
  <div class="flex flex-col min-h-screen">
    <Analytics v-if="vercelAnalyticsEnabled" />
    <the-header class="shrink-0"></the-header>
    <router-view class="flex-1"></router-view>
    <run-details-modal />
    <the-footer class="shrink-0"></the-footer>
  </div>
</template>
<script>
import { Analytics } from "@vercel/analytics/vue";
import RunDetailsModal from "./components/RunDetailsModal.vue";
import TheHeader from "./components/Layout/TheHeader.vue";
import TheFooter from "./components/Layout/TheFooter.vue";
export default {
  components: {
    Analytics,
    RunDetailsModal,
    TheHeader,
    TheFooter,
  },
  computed: {
    vercelAnalyticsEnabled() {
      return import.meta.env.VITE_VERCEL_ANALYTICS_ENABLED && this.$route.matched.length > 0;
    },
  },
};
</script>
