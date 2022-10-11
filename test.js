import _ from "lodash";

import { GET_TASKS_BY_NAME, APIFetch } from "./src/helpers/queries.js";

let taskQuery = "vt threeshot";

const searchTask = async function () {
  let taskList = null;
  let taskSearch = await APIFetch(GET_TASKS_BY_NAME, {
    name: taskQuery,
  });
  // Assigning the fetched data to our component
  console.info(taskSearch);
};

searchTask();
