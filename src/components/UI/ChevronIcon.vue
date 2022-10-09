<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke-width="1.5"
    stroke="currentColor"
    :class="mode"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M19.5 8.25l-7.5 7.5-7.5-7.5"
    />
  </svg>
</template>

<script>
export default {
  props: {
    direction: {
      type: String,
      default: "down",
    },
  },
  computed: {
    mode() {
      switch (this.direction) {
        case "down":
          return "";
        case "up":
          return "rotate-180";
        case "left":
          return "rotate-90";
        case "right":
          return "-rotate-90";
      }
    },
  },
};
</script>