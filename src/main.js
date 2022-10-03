import { createApp } from "vue";
import "./style.css";
import router from "./router.js";
import store from "./store/index.js";
import App from "./App.vue";

//components
import BaseCard from "./components/UI/BaseCard.vue";

createApp(App)
  .component("base-card", BaseCard)
  .use(router)
  .use(store)
  .mount("#app");
