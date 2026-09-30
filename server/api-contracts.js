/**
 * @typedef {Object} TaskSummary
 * @property {string} id Exact task slug; distinct from asset ID.
 * @property {string} name
 * @property {string|null} weapon Winning best score's weapon.
 * @property {number} mode Normalized mode (Creator Studio raw 42 is normalized 0).
 * @property {number} count Total plays, including overview populations merged deliberately.
 * @property {number} maxScore
 * @property {number} maxAcc
 * @property {number} avgScore Weighted by play count.
 * @property {number} avgAcc Weighted by play count.
 */

/**
 * @typedef {Object} RankedResult
 * @property {true} rankingAvailable
 * @property {string[]} rankList Ordered scenario rank requirements.
 * @property {Object[]} benchmarks
 * @property {string} overallRank
 *
 * @typedef {Object} ScoresOnlyResult
 * @property {false} rankingAvailable No verified thresholds; never synthesize ranks.
 * @property {Object[]} benchmarks
 * @property {string} playlistWorkshopId
 *
 * @typedef {Object} BenchmarkSet
 * @property {string} id Season identity; unrelated seasons cannot share standings.
 * @property {'voltaic'|'revosect'} community
 * @property {string} label
 * @property {Object<string, RankedResult|ScoresOnlyResult>} results
 */

/**
 * @typedef {Object} ProfileSnapshot
 * @property {{username: string, id: string, rank: string, skill: number}} playerInfo
 * @property {TaskSummary[]} tasks
 * @property {{tasksPlayed: number, totalPlays: number}} totals
 * @property {BenchmarkSet[]} benchmarkSets
 * @property {string} fetchedAt ISO timestamp of backend snapshot calculation, retained on cache hits.
 */

/**
 * @typedef {Object} PublicRun
 * @property {string} id Exact play ID, checked against player/task/score for selection.
 * @property {number} score Authoritative API score; replay curves do not override it.
 * @property {number|undefined} mode Raw provider mode.
 * @property {number|undefined} convertedMode Normalized mode.
 * @property {string|null|undefined} weaponId
 * @property {number|string|null|undefined} taskVersion Not the task asset version.
 * @property {boolean|null|undefined} replayAvailable False means unavailable; null/undefined means unknown.
 * @property {Object<string, number>} metrics Allowlisted finite provider values; zero is retained and absent keys are unknown.
 * @property {number|undefined} duration Seconds.
 * @property {number|undefined} pauseDuration Milliseconds.
 * @property {'replay'|'leaderboard'|undefined} detailsSource
 */

export {};
