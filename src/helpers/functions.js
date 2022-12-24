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
    categories,
} from "./revosectData";
import {
    APIFetch,
    API_ENDPOINT,
    GET_TASK_LEADERBOARD,
    GET_TASK_BY_ID,
    GET_USER_PLAYS_AGG,
} from "./queries.js";
import _ from "lodash";
import axios from "axios";

//UTILITY FUNCTIONS

export async function findWorkshopId(taskId) {
    const task = await APIFetch(GET_TASK_BY_ID, { slug: taskId });
    return task.aimlab.task.workshop_id;
}
export function taskDeepLink(workshopId) {
    return `https://go.aimlab.gg/v1/redirects?link=aimlab://workshop?id=${workshopId}&source=EEDCC708991834C0&link=steam://rungameid/714010`;
}
export function replayDeepLink(playId) {
    return `https://go.aimlab.gg/v1/redirects?link=aimlab%3a%2f%2fcompare%3fid%3d${playId}%26source%3d84966503A24BD515&link=steam%3a%2f%2frungameid%2f714010`;
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
                // console.log("not found on page", offset / limit + 1);
                offset += limit;
                if (offset >= ldb.aimlab.leaderboard.metadata.totalRows) {
                    // console.log("Score not found");
                    return;
                }
                continue;
            } else {
                // console.log("found on page", offset / limit + 1);
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
                            rankData = calculateRankAdv(
                                playerBench[j],
                                playerTasks[i]
                            );
                            break;
                        case "intermediate":
                            rankData = calculateRankInt(
                                playerBench[j],
                                playerTasks[i]
                            );
                            break;
                        case "novice":
                            rankData = calculateRankNov(
                                playerBench[j],
                                playerTasks[i]
                            );
                            break;
                        default:
                            rankData = calculateRankAdv(
                                playerBench[j],
                                playerTasks[i]
                            );
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
export function calculateRevosectBenchmarks(playerData, mode) {
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

    //Filtering out the benchmark scenarios the player has played from the provided full list of played scenarios
    let playedBenchmarks = playerData.tasks.filter((n) =>
        benchData.some((n2) => n.id == n2.id)
    );

    // console.log(JSON.parse(JSON.stringify(playedBenchmarks)));
    // console.log(JSON.parse(JSON.stringify(benchData)));
    //Computing the scores and ranks for each of the played benchm  ark scenarios
    let playerBenchmarks = getPlayerBenchmarkResults(
        playedBenchmarks,
        benchData,
        mode
    );

    playerBenchmarks.sort((a, b) => a.scenarioID - b.scenarioID);
    const allPointsList = playerBenchmarks.map((bench) => bench.points);
    //Grouping benchmark scenarios by subcategories
    const subCategoryGroupedBenchmarks = _.groupBy(
        playerBenchmarks,
        "categoryID"
    );
    let subCategoryPointsList = Object.entries(
        subCategoryGroupedBenchmarks
    ).map(([_, group]) => {
        return [...group.map(({ points }) => points)];
    });

    let aggregateSubCategoryPoints = null;
    //different point calculation between easy benchmarks and med/hard benchmarks
    if (mode == "easy") {
        aggregateSubCategoryPoints = subCategoryPointsList.map((item) => {
            return item.reduce((acc, curr) => acc + curr);
        });
    } else {
        aggregateSubCategoryPoints = subCategoryPointsList.map((item) => {
            return item.reduce((acc, curr) => acc + curr) - Math.min(...item);
        });
    }
    //calculating overall points
    let overallPoints = aggregateSubCategoryPoints.reduce(
        (acc, curr) => acc + curr
    );

    //Check if player is valour/platinum to add excess points to the total
    if (mode != "hard") {
        let pointNormalizedData = checkExcessPoints(
            playerBenchmarks,
            subCategoryPointsList,
            mode,
            overallPoints,
            aggregateSubCategoryPoints
        );

        playerBenchmarks = pointNormalizedData.playerBench;
        overallPoints = pointNormalizedData.overallPoints;
        aggregateSubCategoryPoints =
            pointNormalizedData.aggregateSubCategoryPoints;
    }
    //finding the player's overall rank
    let benchmarkPointsList = null;
    let benchmarkRankList = null;
    let basePoints = 0;
    switch (mode) {
        case "hard":
            benchmarkPointsList = hardPoints;
            benchmarkRankList = hardRanks;
            break;
        case "medium":
            benchmarkPointsList = mediumPoints;
            benchmarkRankList = mediumRanks;
            break;
        case "easy":
            benchmarkPointsList = easyPoints;
            benchmarkRankList = easyRanks;
            break;
    }
    benchmarkPointsList.forEach((point) => {
        if (overallPoints > point) {
            basePoints = point;
        }
    });

    const hasPlayedAllSubCategories = !aggregateSubCategoryPoints.includes(0);
    let overallRank = "Unranked";
    if (hasPlayedAllSubCategories) {
        overallRank = benchmarkRankList[basePoints];
    }
    //Checking for Divinity
    if (overallRank == "Divine") {
        if (checkDivinity(allPointsList)) {
            overallRank = "Divinity";
        }
    }

    // if (playerData.id == "BF0D92146C9B39A0") {
    //   console.log(
    //     JSON.parse(
    //       JSON.stringify({
    //         overallPoints,
    //         overallRank,
    //         allPoints: allPointsList,
    //         subCategoryPoints: categoryPoints,
    //         benchmarks: playerBenchmarks,
    //         detailsOpen: false,
    //       })
    //     )
    //   );
    // }
    return {
        overallPoints,
        overallRank,
        allPoints: allPointsList,
        subCategoryPoints: aggregateSubCategoryPoints,
        benchmarks: playerBenchmarks,
        detailsOpen: false,
    };
}
//Create a complete object with player scores, rank, points and scenario information
function getPlayerBenchmarkResults(playerTasks, benchData, mode) {
    // let currentPlayer = playerData.id;
    // let playerTasks = playerData;
    //Score Overrides section
    let benchmark = JSON.parse(JSON.stringify(benchData))
    benchmark.forEach((bench) => {
        bench.avgAcc = 0;
        bench.count = 0;
        bench.maxScore = 0;
        bench.avgScore = 0;
        bench.points = 0;
        bench.rank = "Unranked";
    });
    for (let i = 0; i < playerTasks.length; i++) {
        for (let j = 0; j < benchmark.length; j++) {
            if (playerTasks[i].id == benchmark[j].id) {
                let rankData = [0, 0, "Unranked"];
                if (playerTasks[i].count) {
                    //calculate rank and points for different modes
                    switch (mode) {
                        case "hard":
                            rankData = calculateRankRA(
                                benchmark[j],
                                playerTasks[i],
                                hardSubRanks,
                                hardSubPoints
                            );
                            break;
                        case "medium":
                            rankData = calculateRankRA(
                                benchmark[j],
                                playerTasks[i],
                                mediumSubRanks,
                                mediumSubPoints
                            );
                            break;
                        case "easy":
                            rankData = calculateRankRA(
                                benchmark[j],
                                playerTasks[i],
                                easySubRanks,
                                easySubPoints
                            );

                            break;
                    }
                }
                benchmark[j] = {
                    ...JSON.parse(JSON.stringify(benchmark[j])),
                    ...JSON.parse(JSON.stringify(playerTasks[i])),
                };
                benchmark[j].points = rankData[0];
                benchmark[j].progress = rankData[1];
                benchmark[j].rank = rankData[2];
            }
        }
    }

    return benchmark;
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
                i = index;
            }
        });
        points = benchPoints[i];
        rank = benchRanks[points];
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
    aggregateSubCategoryPoints
) {
    // console.log(
    //   playerBench,
    //   categoryPointsList,
    //   mode,
    //   overallPoints,
    //   categoryPoints
    // );
    let pointLimit = 0;
    let rankPoints = 0;
    if (mode == "easy") {
        pointLimit = easySubPoints[3];
        rankPoints = easyPoints[3];
    } else {
        pointLimit = mediumSubPoints[3];
        rankPoints = mediumPoints[3];
    }
    let fixedPointsList = [];
    categoryPointsList.forEach((category) => {
        fixedPointsList.push(
            category.map((point) => {
                if (point > pointLimit) return pointLimit;
                return point;
            })
        );
    });
    let fixedAggregatePoints = null;
    if (mode == "easy") {
        fixedAggregatePoints = fixedPointsList.map((item) => {
            return item.reduce((acc, curr) => acc + curr);
        });
    } else {
        fixedAggregatePoints = fixedPointsList.map((item) => {
            return item.reduce((acc, curr) => acc + curr) - Math.min(...item);
        });
    }
    let totalPoints = fixedAggregatePoints.reduce((acc, curr) => acc + curr);
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
            aggregateSubCategoryPoints: fixedAggregatePoints,
        };
    }
    return { playerBench, overallPoints, aggregateSubCategoryPoints };
}

export function organizeLeaderboard(playerList, fullBench, mode) {
    for (let task of fullBench) {
        let index = playerList[task.id].length;
        for (let i = 0; i < playerList[task.id].length; i++) {
            if (playerList[task.id][i]?.score < task.scores[0]) {
                index = i;
                break;
            }
            playerList[task.id] = playerList[task.id].slice(0, index);
        }

        let allPlayers = [];
        Object.entries(playerList).forEach((task) => {
            allPlayers.push(...task[1]);
        });

        let uniquePlayers = [
            ...new Map(
                allPlayers.map((item) => [item["user_id"], item])
            ).values(),
        ].map((player) => {
            return {
                id: player.user_id,
                username: player.username,
                scores: [],
            };
        });
        uniquePlayers.forEach((player) => {
            Object.entries(playerList).forEach((task) => {
                let foundPlay = task[1].find(
                    (task) => task.user_id == player.id
                );
                if (foundPlay) {
                    player.scores.push({
                        id: foundPlay.task_id,
                        maxScore: foundPlay.score,
                        count: 1,
                    });
                }
            });
        });
        let leaderboard = [];
        uniquePlayers.forEach((player) => {
            leaderboard.push({
                username: player.username,
                ...calculateRevosectBenchmarks(
                    { tasks: player.scores, id: player.id },
                    mode
                ),
            });
        });
        leaderboard.forEach((player) => {
            let points = {};
            player.subCategoryPoints.forEach((item, index) => {
                points[categories[index]] = item;
            });
            player.subCategoryPoints = points;
        });
        leaderboard = leaderboard.sort(
            (a, b) => b.overallPoints - a.overallPoints
        );
        // localStorage.setItem(mode, JSON.stringify(leaderboard));
        return leaderboard;
    }
}

// function fetchAimlabLeaderboard(variables) {
//     const query = `
//       query getAimlabLeaderboard($leaderboardInput: LeaderboardInput!) {
//         aimlab {
//           leaderboard(input: $leaderboardInput) {
//             id
//             source
//             metadata {
//               offset
//               rows
//               totalRows
//             }
//             schema {
//               id
//               fields
//             }
//             data
//           }
//         }
//       }
//     `;

//     // wrap the variables object in another object with a property named
//     // after the variable in the query (in this case, "leaderboardInput")
//     const body = JSON.stringify({
//         query,
//         variables: {
//             leaderboardInput: variables,
//         },
//     });

//     return axios.post("https://api.aimlab.gg/graphql", body, {
//         headers: {
//             "Content-Type": "application/json",
//         },
//     });
// }

// const leaderboardData = [];

// hardBench.forEach((benchmark) => {
//     const benchmarkData = [];
//     let offset = 0;
//     // initialize a variable to store the last score
//     let lastScore = null;
//     // create a function to make an API request and update the lastScore variable
//     const fetchLeaderboardData = async () => {
//         const variables = {
//             clientId: "aimlab",
//             limit: 100,
//             offset,
//             taskId: benchmark.id,
//             taskMode: 0,
//             weaponId: benchmark.weapon,
//         };
//         const response = await fetchAimlabLeaderboard(variables);
//         // save the response data in the leaderboardData array
//         benchmarkData.push(response.data);
//         console.log(response.data.data.aimlab.leaderboard);
//         // update the lastScore variable with the score of the last item in the response data
//         lastScore =
//             response.data.data.aimlab.leaderboard.data[
//                 response.data.data.aimlab.leaderboard.data.length - 1
//             ].score;
//     };
//     // make the initial API request to get the first batch of data
//     fetchLeaderboardData().then(() => {
//         // while the last score is greater than or equal to the first entry in the scores array
//         // and the last score is not null (this is to prevent infinite looping)
//         while (lastScore >= benchmark.scores[0] && lastScore !== null) {
//             // increment the offset and make another API request
//             offset += 100;
//             fetchLeaderboardData();
//         }
//     });
//     console.log(benchmarkData);
//     leaderboardData.push(benchmarkData);
// });
