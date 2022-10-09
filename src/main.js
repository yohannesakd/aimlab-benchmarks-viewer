import { createApp } from "vue";
import "./style.css";
import router from "./router.js";
import store from "./store/index.js";
import App from "./App.vue";

//components
import BaseCard from "./components/UI/BaseCard.vue";
import ProgressBar from "./components/UI/ProgressBar.vue";
import ChevronIcon from "./components/UI/ChevronIcon.vue";
import Dropdown from "./components/UI/Dropdown.vue";
import LoadingSpinner from "./components/LoadingSpinner.vue";

createApp(App)
  .component("base-card", BaseCard)
  .component("loading-spinner", LoadingSpinner)
  .component("progress-bar", ProgressBar)
  .component("dropdown", Dropdown)
  .component("chevron-icon", ChevronIcon)
  .use(router)
  .use(store)
  .mount("#app");
