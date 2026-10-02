import { createStore } from "vuex";
import PlayerData from "./modules/PlayerData";
import TaskData from "./modules/TaskData";

export function createAppStore() {
  return createStore({
  modules: {
    PlayerData,
    TaskData,
  },
  state() {
    return {};
  },
});
}
