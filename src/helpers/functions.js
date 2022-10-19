"use strict";
import {
  advancedRanks,
  advancedEnergy,
  intermediateEnergy,
  intermediateRanks,
  noviceEnergy,
  noviceRanks,
} from "./voltaicData";

import {
  hardSubPoints,
  hardPoints,
  hardSubRanks,
  hardRanks,
  mediumPoints,
  mediumRanks,
  mediumSubPoints,
  mediumSubRanks,
  easyPoints,
  easyRanks,
  easySubPoints,
  easySubRanks,
  hardBench,
  mediumBench,
  easyBench,
} from "./revosectData";
import {
  APIFetch,
  GET_TASK_LEADERBOARD,
  GET_TASK_BY_ID,
  GET_USER_PLAYS_AGG,
} from "./queries.js";
import _ from "lodash";

//UTILITY FUNCTIONS

export function taskDeepLink(taskId) {
  return `https://go.aimlab.gg/v1/redirects?link=aimlab://workshop?id=${taskId}&source=EEDCC708991834C0&link=steam://rungameid/714010`;
}
export function replayDeepLink(playId) {
  return `https://go.aimlab.gg/v1/redirects?link=aimlab%3a%2f%2fcompare%3fid%3d${playId}%26source%3d84966503A24BD515&link=steam%3a%2f%2frungameid%2f714010`;
}
export async function findWorkshopId(taskId) {
  const task = await APIFetch(GET_TASK_BY_ID, { slug: taskId });
  return task.aimlab.task.workshop_id;
}
export async function findReplay(playerName, taskId, weapon) {
  let limit = 100;
  let offset = 0;
  let playerFound = false;
  while (!playerFound) {
    let ldb = await APIFetch(GET_TASK_LEADERBOARD, {
      leaderboardInput: {
        clientId: "aimlab",
        limit: limit,
        offset: offset,
        taskId: taskId,
        taskMode: 0,
        weaponId: weapon,
      },
    });

    if (ldb?.aimlab.leaderboard) {
      let located = [...ldb.aimlab.leaderboard.data].filter(
        (entry) => entry.username == playerName
      );
      // console.log(located);
      if (_.isEmpty(located)) {
        console.log("not found on page", offset / limit + 1);
        offset += limit;
        if (offset >= ldb.aimlab.leaderboard.metadata.totalRows) {
          console.log("Score not found");
          return;
        }
        continue;
      } else {
        console.log("found on page", offset / limit + 1);
        playerFound = true;
        return replayDeepLink(located[0].play_id);
      }
    } else continue;
  }
}

export function cleanUpUserTasks(taskList) {
  let data = taskList.map((task) => {
    return {
      name: task.group_by.task_name,
      id: task.group_by.task_id,
      count: task.aggregate.count,
      avgScore: task.aggregate.avg.score,
      avgAcc: task.aggregate.avg.accuracy,
      maxScore: task.aggregate.max.score,
      maxAcc: task.aggregate.max.accuracy,
    };
  });
  data = data
    .filter((task) => {
      if (task.name) return true;
      if (!task.id.includes(".")) return true;
    })
    .map((task) => {
      if (!task.name) {
        task.name = task.id;
      }
      return task;
    });
  data = data.sort((a, b) =>
    a.count > b.count ? -1 : b.count > a.count ? 1 : 0
  );
  return data;
}
//Voltaic Functions
//Take player full task list and the benchmark data
export function caclulateVT(playerTasks, playerBench, mode) {
  playerBench.forEach((bench) => {
    bench.avgAcc = 0;
    bench.count = 0;
    bench.maxScore = 0;
    bench.avgScore = 0;
    bench.energy = 0;
    bench.rank = "Unranked";
  });
  // find the benchmark scenario within the player task list by matching IDs
  for (let i = 0; i < playerTasks.length; i++) {
    for (let j = 0; j < playerBench.length; j++) {
      if (playerTasks[i].id == playerBench[j].id) {
        let rankData = [0, "Unranked"];
        if (playerTasks[i].count > 0) {
          //calculate rank and energy for different modes
          switch (mode) {
            case "advanced":
              rankData = calculateRankAdv(playerBench[j], playerTasks[i]);
              break;
            case "intermediate":
              rankData = calculateRankInt(playerBench[j], playerTasks[i]);
              break;
            case "novice":
              rankData = calculateRankNov(playerBench[j], playerTasks[i]);
              break;
            default:
              rankData = calculateRankAdv(playerBench[j], playerTasks[i]);
              break;
          }
        }
        playerBench[j] = {
          ...playerBench[j],
          ...playerTasks[i],
        };
        playerBench[j].energy = rankData[0] || 0;
        playerBench[j].rank = rankData[1] || "Unranked";
      }
    }
  }
  playerBench.sort((a, b) => a.scenarioID - b.scenarioID);
  // calculating category energy
  const grouped = _.groupBy(playerBench, "categoryID");
  const allEnergyList = playerBench.map((bench) => bench.energy);
  const categoryEnergyList = Object.entries(grouped).map(([_, group]) => {
    return Math.max(...group.map(({ energy }) => energy));
  });
  const harmonicMean = Math.floor(
    6 / categoryEnergyList.reduce((acc, curr) => acc + 1 / curr, 0)
  );
  //Calculating Overall rank
  const floorEnergy = Math.floor(harmonicMean / 100) * 100;
  let overallRank = null;
  switch (mode) {
    case "advanced":
      overallRank = advancedRanks[floorEnergy] || "Unranked";
      break;
    case "intermediate":
      overallRank = intermediateRanks[floorEnergy] || "Unranked";
      break;
    case "novice":
      overallRank = noviceRanks[floorEnergy] || "Unranked";
      break;
    default:
      overallRank = "Unranked";
      break;
  }
  // Check complete rank scenario
  if (checkComplete(overallRank, allEnergyList, mode))
    overallRank += " Complete";

  return {
    overallEnergy: harmonicMean,
    overallRank,
    subCategoryEnergy: categoryEnergyList,
    benchmarks: playerBench,
  };
}
function checkComplete(rank, energyList, mode) {
  let minEnergy = Math.floor(Math.min(...energyList) / 100) * 100;
  let complete =
    energyList.filter((energy) => energy >= minEnergy).length ==
    energyList.length;

  switch (mode) {
    case "intermediate":
      return complete && intermediateRanks[minEnergy] == rank;
    case "advanced":
      return complete && advancedRanks[minEnergy] == rank;
    case "novice":
      return complete && noviceRanks[minEnergy] == rank;
  }
}

function calculateRankAdv(bench, userTask) {
  //lower scorelimit is 800
  let energy = 0;
  if (userTask.maxScore <= bench.scores[0]) {
    energy = Math.floor(
      (userTask.maxScore / bench.scores[0]) * advancedEnergy[0]
    );
  } else if (userTask.maxScore >= bench.scores[4]) {
    energy = advancedEnergy[4];
  } else {
    let i = 0;
    bench.scores.forEach((score, index) => {
      if (userTask.maxScore > score) {
        energy = advancedEnergy[index];
        i = index;
      }
    });
    energy += Math.floor(
      ((userTask.maxScore - bench.scores[i]) * 100) /
        (bench.scores[i + 1] - bench.scores[i])
    );
  }
  let rank = advancedRanks[Math.floor(energy / 100) * 100] || "Unranked";
  return [energy, rank];
}

function calculateRankInt(bench, userTask) {
  //lower score limit is 300
  let energy = 0;
  if (userTask.maxScore <= bench.scores[0]) {
    energy = Math.floor(
      (userTask.maxScore / bench.scores[0]) * intermediateEnergy[0]
    );
  } else if (userTask.maxScore >= bench.scores[4]) {
    let userDiff = userTask.maxScore - bench.scores[4];
    let rankDiff = bench.scores[4] - bench.scores[3];
    let energyGain = Math.floor((userDiff / rankDiff) * 100);
    if (energyGain > 100) {
      energyGain = 100;
    }
    energy = intermediateEnergy[4] + energyGain;
  } else {
    let i = 0;
    bench.scores.forEach((score, index) => {
      if (userTask.maxScore > score) {
        energy = intermediateEnergy[index];
        i = index;
      }
    });
    energy += Math.floor(
      ((userTask.maxScore - bench.scores[i]) * 100) /
        (bench.scores[i + 1] - bench.scores[i])
    );
  }
  let rank = intermediateRanks[Math.floor(energy / 100) * 100] || "Unranked";
  // console.log([energy, rank]);
  if (energy === 900) rank = intermediateRanks[800];
  return [energy, rank];
}

//Calculate Rank and Energy for a Scenario from the Novice Benches
//Check scenarios if score is greater than the upper requirement or lower than the lower requirement and apply energy accordingly

function calculateRankNov(bench, userTask) {
  // lower limit is 0
  let energy = 0;
  if (userTask.maxScore >= bench.scores[4]) {
    //calculating additional energy beyond the max requirement
    let userDiff = userTask.maxScore - bench.scores[4];
    let rankDiff = bench.scores[4] - bench.scores[3];
    let energyGain = Math.floor((userDiff / rankDiff) * 100);
    if (energyGain > 100) {
      energyGain = 100;
    }
    energy = noviceEnergy[4] + energyGain;
  } else {
    //calculating for energy between ranks
    let i = 0;
    bench.scores.forEach((score, index) => {
      if (userTask.maxScore > score) {
        energy = noviceEnergy[index];
        i = index;
      }
    });
    energy += Math.floor(
      ((userTask.maxScore - bench.scores[i]) * 100) /
        (bench.scores[i + 1] - bench.scores[i])
    );
  }
  //Finding rank through rounding by 100 and looking up
  let rank = noviceRanks[Math.floor(energy / 100) * 100] || "Unranked";
  //When user has max energy
  if (energy === 500) rank = noviceRanks[400];
  return [energy, rank];
}

//End of Voltaic Section
//Revosect section
//Single function to handle all benchmark levels calculation
export function calculateRA(playerTasks, mode) {
  let benchData = null;
  switch (mode) {
    case "hard":
      benchData = hardBench;
      break;
    case "medium":
      benchData = mediumBench;
      break;
    case "easy":
      benchData = easyBench;
      break;
  }
  let playerBench = getBenchmarkObject(playerTasks, benchData, mode);
  playerBench.sort((a, b) => a.scenarioID - b.scenarioID);
  //calculating category points
  const groupedTasks = _.groupBy(playerBench, "categoryID");
  let categoryPointsList = Object.entries(groupedTasks).map(([_, group]) => {
    return [...group.map(({ points }) => points)];
  });
  const allPointsList = playerBench.map((bench) => bench.points);
  let categoryPoints = null;
  //different point calculation between easy benchmarks and med/hard benchmarks
  if (mode == "easy") {
    categoryPoints = categoryPointsList.map((item) => {
      return item.reduce((acc, curr) => acc + curr);
    });
  } else {
    categoryPoints = categoryPointsList.map((item) => {
      return item.reduce((acc, curr) => acc + curr) - Math.min(...item);
    });
  }
  //calculating overall points
  let overallPoints = categoryPoints.reduce((acc, curr) => acc + curr);

  //Check if player is valour/platinum to add excess points to the total
  if (mode != "hard") {
    let fixedData = checkExcessPoints(
      playerBench,
      categoryPointsList,
      mode,
      overallPoints,
      categoryPoints
    );
    playerBench = fixedData.playerBench;
    overallPoints = fixedData.overallPoints;
    categoryPoints = fixedData.categoryPoints;
  }
  //finding the player's rank
  let pointList = null;
  let rankList = null;
  let floorPoints = 0;
  switch (mode) {
    case "hard":
      pointList = hardPoints;
      rankList = hardRanks;
      break;
    case "medium":
      pointList = mediumPoints;
      rankList = mediumRanks;
      break;
    case "easy":
      pointList = easyPoints;
      rankList = easyRanks;
      break;
  }
  pointList.forEach((point) => {
    if (overallPoints > point) {
      floorPoints = point;
    }
  });
  let overallRank = rankList[floorPoints] || "Unranked";
  //Checking for Divinity
  if (overallRank == "Divine") {
    if (checkDivinity(allPointsList)) {
      overallRank = "Divinity";
    }
  }

  return {
    overallPoints,
    overallRank,
    subCategoryPoints: categoryPoints,
    benchmarks: playerBench,
    detailsOpen: false,
  };
}
//Create a complete object with player scores, rank, points and scenario information
function getBenchmarkObject(playerTasks, benchData, mode) {
  benchData.forEach((bench) => {
    bench.avgAcc = 0;
    bench.count = 0;
    bench.maxScore = 0;
    bench.avgScore = 0;
    bench.points = 0;
    bench.rank = "Unranked";
  });
  for (let i = 0; i < playerTasks.length; i++) {
    for (let j = 0; j < benchData.length; j++) {
      if (playerTasks[i].id == benchData[j].id) {
        let rankData = [0, 0, "Unranked"];
        if (playerTasks[i].count > 0) {
          //calculate rank and points for different modes
          switch (mode) {
            case "hard":
              rankData = calculateRankRA(
                benchData[j],
                playerTasks[i],
                hardSubRanks,
                hardSubPoints
              );
              break;
            case "medium":
              rankData = calculateRankRA(
                benchData[j],
                playerTasks[i],
                mediumSubRanks,
                mediumSubPoints
              );
              break;
            case "easy":
              rankData = calculateRankRA(
                benchData[j],
                playerTasks[i],
                easySubRanks,
                easySubPoints
              );
              break;
          }
        }
        benchData[j] = {
          ...benchData[j],
          ...playerTasks[i],
        };
        benchData[j].points = rankData[0] || 0;
        benchData[j].progress = rankData[1] || 0;
        benchData[j].rank = rankData[2] || "Unranked";
      }
    }
  }
  return benchData;
}

function calculateRankRA(bench, userTask, benchRanks, benchPoints) {
  const arrSize = bench.scores.length - 1;
  let points = 0;
  let progress = 0;
  let rank = "Unranked";

  if (userTask.maxScore < bench.scores[0]) {
    points = 0;
    progress = Math.floor((userTask.maxScore * 100) / bench.scores[0]);
  } else if (userTask.maxScore >= bench.scores[arrSize]) {
    points = benchPoints[arrSize];
    let playerDiff = userTask.maxScore - bench.scores[arrSize];
    let perPoint =
      (benchPoints[arrSize] - benchPoints[arrSize - 1]) /
      (bench.scores[arrSize] - bench.scores[arrSize - 1]);
    rank = benchRanks[points];
    points += Math.floor(playerDiff * perPoint);
    progress = 100;
  } else {
    let i = 0;
    bench.scores.forEach((score, index) => {
      if (userTask.maxScore >= score) {
        points = benchPoints[index];
        rank = benchRanks[points];
        i = index;
      }
    });
    let playerDiff = userTask.maxScore - bench.scores[i];
    let perPoint =
      (benchPoints[i + 1] - benchPoints[i]) /
      (bench.scores[i + 1] - bench.scores[i]);
    points += Math.floor(playerDiff * perPoint);
    progress = Math.floor(
      (playerDiff * 100) / (bench.scores[i + 1] - bench.scores[i])
    );
  }
  return [points, progress, rank];
}

function checkDivinity(pointsList) {
  return (
    pointsList.filter((point) => {
      return point >= hardSubPoints[4];
    }).length == 18
  );
}

function checkExcessPoints(
  playerBench,
  categoryPointsList,
  mode,
  overallPoints,
  categoryPoints
) {
  let pointLimit = 0;
  let rankPoints = 0;
  if (mode == "easy") {
    pointLimit = easySubPoints[3];
    rankPoints = easyPoints[3];
  } else {
    pointLimit = mediumSubPoints[3];
    rankPoints = mediumPoints[3];
  }
  let fixedPoints = [];
  categoryPointsList.forEach((category) => {
    fixedPoints.push(
      category.map((point) => {
        if (point > pointLimit) return pointLimit;
        return point;
      })
    );
  });
  if (mode == "easy") {
    fixedPoints = fixedPoints.map((item) => {
      return item.reduce((acc, curr) => acc + curr);
    });
  } else {
    fixedPoints = fixedPoints.map((item) => {
      return item.reduce((acc, curr) => acc + curr) - Math.min(...item);
    });
  }
  let totalPoints = fixedPoints.reduce((acc, curr) => acc + curr);
  let fixedBench = playerBench.map((bench) => {
    if (bench.points > pointLimit) {
      return {
        ...bench,
        points: pointLimit,
      };
    }
    return bench;
  });
  if (!(totalPoints > rankPoints)) {
    return {
      playerBench: fixedBench,
      overallPoints: totalPoints,
      categoryPoints: fixedPoints,
    };
  }
  return { playerBench, overallPoints, categoryPoints };
}
// async function getLeaderboardPlayers(benchItem) {
//   console.time("ldbTime");
//   const res = await APIFetch(GET_TASK_LEADERBOARD, {
//     leaderboardInput: {
//       clientId: "aimlab",
//       limit: 100,
//       offset: 0,
//       taskId: benchItem.id,
//       taskMode: 0,
//       weaponId: benchItem.weapon,
//     },
//   });
//   console.timeEnd("ldbTime");
//   return [
//     ...res.aimlab.leaderboard.data.map((play) => {
//       return { id: play.user_id, username: play.username };
//     }),
//   ];
// }

// let listitems = await getLeaderboardPlayers(hardBench[1]);

// console.log(myList);

// {
//   data.forEach(async (user) => {
//     const response = await APIFetch(GET_USER_PLAYS_AGG, {
//       where: {
//         is_practice: {
//           _eq: false,
//         },
//         score: {
//           _gt: 0,
//         },
//         user_id: {
//           _eq: user.id,
//         },
//       },
//     });
//     let userTasks = cleanUpUserTasks(response.aimlab.plays_agg);
//     let userBench = calculateRA(userTasks, "hard");
//     playerList.push({
//       name: user.username,
//       data: userBench,
//     });
//   });
//   console.timeEnd("ldbTime");
//   return playerList;
// }
