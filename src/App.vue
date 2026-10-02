<template>
  <div class="flex flex-col min-h-screen">
    <the-header class="shrink-0"></the-header>
    <not-found-page v-if="pageError === 404" class="flex-1" />
    <unavailable-page v-else-if="pageError >= 400" class="flex-1" />
    <router-view v-else class="flex-1"></router-view>
    <run-details-modal />
    <the-footer class="shrink-0"></the-footer>
  </div>
</template>
<script>
import RunDetailsModal from "./components/RunDetailsModal.vue";
import TheHeader from "./components/Layout/TheHeader.vue";
import TheFooter from "./components/Layout/TheFooter.vue";
import NotFoundPage from './pages/NotFoundPage.vue';
import UnavailablePage from './pages/UnavailablePage.vue';
export default {
  data() { return { pageError: this.$bootstrap?.status || 200 }; },
  watch: { '$route.path'() { this.pageError = 200; } },
  components: {
    RunDetailsModal,
    TheHeader,
    TheFooter,
    NotFoundPage,
    UnavailablePage,
  },
};
</script>
