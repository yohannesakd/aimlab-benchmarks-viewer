<template>
  <main class="page-shell">
    <div class="page-intro"><h1 class="page-title">Data temporarily unavailable</h1></div>
    <button class="btn-secondary" type="button" @click="reload">Try again</button>
  </main>
</template>
<script>
export default { methods: { reload() { location.reload(); } } };
</script>
