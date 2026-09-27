"use strict";
import {
    advancedRanks,
    advancedEnergy,
    intermediateEnergy,
    intermediateRanks,
    noviceEnergy,
    noviceRanks,
} from "./voltaicData.js";

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
} from "./revosectData.js";
import {
    APIFetch,
    GET_TASK_LEADERBOARD,
    GET_TASK_BY_ID,
} from "./queries.js";
import _ from "lodash";


export async function findWorkshopId(taskId) {
    const task = await APIFetch(GET_TASK_BY_ID, { slug: taskId });
    if (!task.aimlab?.task?.workshop_id) throw new Error("Task has no workshop ID");
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

        if (ldb.aimlab?.leaderboard) {
            let located = ldb.aimlab.leaderboard.data.filter(
                (entry) => entry.username == playerName
            );
            if (_.isEmpty(located)) {
                offset += limit;
                if (offset >= ldb.aimlab.leaderboard.metadata.totalRows) {
                    return;
                }
                continue;
            } else {
                playerFound = true;
                return replayDeepLink(located[0].play_id);
            }
        } else {
            throw new Error("Missing Aimlab leaderboard");
        }
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
export function caclulateVT(playerTasks, playerBench, mode) {
    playerBench.forEach((bench) => {
        bench.avgAcc = 0;
        bench.count = 0;
        bench.maxScore = 0;
        bench.avgScore = 0;
        bench.energy = 0;
        bench.rank = "Unranked";
    });
    for (let i = 0; i < playerTasks.length; i++) {
        for (let j = 0; j < playerBench.length; j++) {
            if (playerTasks[i].id == playerBench[j].id) {
                let rankData = [0, "Unranked"];
                if (playerTasks[i].count > 0) {
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
    const grouped = _.groupBy(playerBench, "categoryID");
    const allEnergyList = playerBench.map((bench) => bench.energy);
    const categoryEnergyList = Object.entries(grouped).map(([_, group]) => {
        return Math.max(...group.map(({ energy }) => energy));
    });
    let harmonicMean = 0;
    if (!categoryEnergyList.includes(0)) {
        const mean =
            categoryEnergyList.length /
            categoryEnergyList.reduce((sum, energy) => sum + 1 / energy, 0);
        const precision =
            Number.EPSILON * Math.max(...categoryEnergyList) * categoryEnergyList.length;
        harmonicMean = Math.floor(mean + precision);
    }
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
            if (userTask.maxScore >= score) {
                energy = intermediateEnergy[index];
                i = index;
            }
        });
        energy += Math.floor(
            ((userTask.maxScore - bench.scores[i]) *
                (intermediateEnergy[i + 1] - intermediateEnergy[i])) /
            (bench.scores[i + 1] - bench.scores[i])
        );
    }
    let rank = intermediateRanks[Math.floor(energy / 100) * 100] || "Unranked";
    if (energy === 900) rank = intermediateRanks[800];
    return [energy, rank];
}


function calculateRankNov(bench, userTask) {
    let energy = 0;
    if (userTask.maxScore >= bench.scores[4]) {
        let userDiff = userTask.maxScore - bench.scores[4];
        let rankDiff = bench.scores[4] - bench.scores[3];
        let energyGain = Math.floor((userDiff / rankDiff) * 100);
        if (energyGain > 100) {
            energyGain = 100;
        }
        energy = noviceEnergy[4] + energyGain;
    } else {
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
    let rank = noviceRanks[Math.floor(energy / 100) * 100] || "Unranked";
    if (energy === 500) rank = noviceRanks[400];
    return [energy, rank];
}

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

    let playedBenchmarks = playerData.tasks.filter((n) =>
        benchData.some((n2) => n.id == n2.id)
    );

    let playerBenchmarks = getPlayerBenchmarkResults(
        playedBenchmarks,
        benchData,
        mode
    );

    playerBenchmarks.sort((a, b) => a.scenarioID - b.scenarioID);
    const allPointsList = playerBenchmarks.map((bench) => bench.points);
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
    if (mode == "easy") {
        aggregateSubCategoryPoints = subCategoryPointsList.map((item) => {
            return item.reduce((acc, curr) => acc + curr);
        });
    } else {
        aggregateSubCategoryPoints = subCategoryPointsList.map((item) => {
            return item.reduce((acc, curr) => acc + curr) - Math.min(...item);
        });
    }
    let overallPoints = aggregateSubCategoryPoints.reduce(
        (acc, curr) => acc + curr
    );

    let benchmarkPointsList = null;
    let benchmarkRankList = null;
    let benchmarkSubPointsList = null;
    switch (mode) {
        case "hard":
            benchmarkPointsList = hardPoints;
            benchmarkRankList = hardRanks;
            benchmarkSubPointsList = hardSubPoints;
            break;
        case "medium":
            benchmarkPointsList = mediumPoints;
            benchmarkRankList = mediumRanks;
            benchmarkSubPointsList = mediumSubPoints;
            break;
        case "easy":
            benchmarkPointsList = easyPoints;
            benchmarkRankList = easyRanks;
            benchmarkSubPointsList = easySubPoints;
            break;
    }
    const hasRequiredScores =
        mode === "easy" ||
        Object.values(subCategoryGroupedBenchmarks).every(
            (group) => group.filter(({ count }) => count > 0).length >= 2
        );
    let overallRank = "Unranked";
    const lowestSubCategoryPoints = Math.min(...aggregateSubCategoryPoints);
    for (let i = 0; i < benchmarkPointsList.length; i++) {
        if (
            hasRequiredScores &&
            overallPoints >= benchmarkPointsList[i] &&
            lowestSubCategoryPoints >= benchmarkSubPointsList[i]
        ) {
            overallRank = benchmarkRankList[benchmarkPointsList[i]];
        }
    }
    if (overallRank == "Divine") {
        if (checkDivinity(allPointsList)) {
            overallRank = "Divinity";
        }
    }

    return {
        overallPoints,
        overallRank,
        allPoints: allPointsList,
        subCategoryPoints: aggregateSubCategoryPoints,
        benchmarks: playerBenchmarks,
        detailsOpen: false,
    };
}
function getPlayerBenchmarkResults(playerTasks, benchData, mode) {
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
                    switch (mode) {
                        case "hard":
                            rankData = calculateRankRA(
                                benchmark[j],
                                playerTasks[i],
                                hardSubRanks,
                                hardSubPoints,
                                true
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

function calculateRankRA(bench, userTask, benchRanks, benchPoints, extrapolate = false) {
    const arrSize = bench.scores.length - 1;
    let points = 0;
    let progress = 0;
    let rank = "Unranked";

    if (userTask.maxScore < bench.scores[0]) {
        points = 0;
        progress = Math.floor((userTask.maxScore * 100) / bench.scores[0]);
    } else if (userTask.maxScore >= bench.scores[arrSize]) {
        points = benchPoints[arrSize];
        rank = benchRanks[points];
        if (extrapolate) {
            const playerDiff = userTask.maxScore - bench.scores[arrSize];
            const pointDifference = benchPoints[arrSize] - benchPoints[arrSize - 1];
            const scoreDifference = bench.scores[arrSize] - bench.scores[arrSize - 1];
            points += Math.floor((playerDiff * pointDifference) / scoreDifference);
        }
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
        const pointDifference = benchPoints[i + 1] - benchPoints[i];
        const scoreDifference = bench.scores[i + 1] - bench.scores[i];
        points += Math.floor((playerDiff * pointDifference) / scoreDifference);
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

export function organizeLeaderboard(playerList, fullBench, mode) {
    const players = new Map();

    for (const bench of fullBench) {
        const entries = playerList[bench.id];
        if (!entries) throw new Error(`Missing leaderboard for ${bench.name}`);

        for (const entry of entries) {
            if (entry.score < bench.scores[0] || !entry.user_id) continue;

            if (!players.has(entry.user_id)) {
                players.set(entry.user_id, {
                    id: entry.user_id,
                    username: entry.username,
                    scores: new Map(),
                });
            }
            const player = players.get(entry.user_id);
            const previous = player.scores.get(bench.id);
            if (!previous || entry.score > previous.maxScore) {
                player.scores.set(bench.id, {
                    id: bench.id,
                    maxScore: entry.score,
                    count: 1,
                });
            }
        }
    }

    return [...players.values()]
        .map((player) => {
            const result = calculateRevosectBenchmarks(
                { tasks: [...player.scores.values()], id: player.id },
                mode
            );
            return {
                username: player.username,
                ...result,
                subCategoryPoints: Object.fromEntries(
                    result.subCategoryPoints.map((points, index) => [categories[index], points])
                ),
            };
        })
        .filter((player) => player.overallPoints > 0)
        .sort((a, b) => b.overallPoints - a.overallPoints);
}
