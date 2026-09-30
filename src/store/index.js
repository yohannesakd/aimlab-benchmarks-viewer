import { createStore } from "vuex";
import PlayerData from "./modules/PlayerData";
import TaskData from "./modules/TaskData";

const store = createStore({
  modules: {
    PlayerData,
    TaskData,
  },
  state() {
    return {};
  },
});

export default store;
