import { createStore } from "vuex";
import PlayerData from "./modules/PlayerData";
import Benchmarks from "./modules/Benchmarks";
import TaskData from "./modules/TaskData";

const store = createStore({
  modules: {
    PlayerData,
    Benchmarks,
    TaskData,
  },
  state() {
    return {};
  },
});

export default store;
