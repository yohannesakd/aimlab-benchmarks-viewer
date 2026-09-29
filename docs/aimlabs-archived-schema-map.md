# Archived Aimlabs GraphQL schema map

This is an **offline inventory** of `/home/sai/code/aimlab-schema-reference/latest-schema.graphql` (SHA-256 `33464dfe86d2fdb7331504111568f2dd0ffec1c17ef8b65b3bcadcff75b6b500`). It maps what the older SDL declares; it does not assert that a field still exists, is anonymous, or returns populated data. For current structure see [the 2026-09-29 schema](aimlabs-current-schema-2026-09-29.graphql) and [its structural delta](aimlabs-current-schema-delta.tsv); for live behavior see [the data inventory](aimlabs-data-inventory.md). This older SDL parsed as 267 object types, 163 input types, 44 enums, 7 scalars and 1 directive: 482 definitions total. [The complete field index](aimlabs-archived-schema-fields.tsv) contains all 3,821 object fields, input fields and enum values, plus entries for scalars and the directive, with source line numbers and argument types.

## Every root entry point

The following groups account for all **60 `Query` fields** in the archived SDL. A group name describes the schema area, not public access.

| Area | `Query` fields |
| --- | --- |
| Aimlabs game, player, run and seasons (17) | `aimlab`, `aimlabProfile`, `aimlabProfiles`, `aimlabTasks`, `aimlabTask`, `authors`, `avroSchema`, `avroSchemas`, `play`, `playManifest`, `playsByUserId`, `aimlabUserRank`, `aimlabUserRankSkills`, `seasons`, `season`, `seasonalUserProgress`, `universalSensFinderData` |
| Competition and social (10) | `matchChallenge`, `matchChallenges`, `totalMatchCount`, `notifications`, `match`, `matches`, `listCustomUsers`, `listFriendRequests`, `listFriends`, `posts` |
| Account, rewards and mobile (10) | `battlepass`, `loginStreak`, `loginStreakPage`, `referralCodes`, `verifyReferralCode`, `getMobileData`, `viewer`, `userSettings`, `geoIp`, `agreements` |
| Administration and research (12) | `apiClients`, `brainlabStudies`, `brainlabStudy`, `brainlabUserProfile`, `getProfanityFilterList`, `getProfanityFilterRecord`, `survey`, `surveys`, `surveyConfigurations`, `activeUserSurveys`, `gridshieldReviews`, `gridshieldRules` |
| Valorant (2) | `deaths`, `valorant` |
| AIML coaching (9) | `AIMLConversations`, `resolveAIMLConversationResponse`, `AIMLPromptSchemas`, `AIMLPromptLayers`, `AIMLCommunityQuestions`, `AIMLCommunityQuestion`, `AIMLCommunityQuestionsPaginated`, `AIMLConversationMessages`, `AIMLConversationMessage` |

The nested `Aimlab` object has **18 fields**, all accounted for here:

| Area | `aimlab` fields |
| --- | --- |
| Rank and content catalog (9) | `ranks`, `task`, `tasks`, `csTask`, `csTasks`, `searchCsTasks`, `searchTaskAssets`, `searchAimlabAssets`, `nextTask` |
| Run statistics (3) | `play`, `plays`, `plays_agg` |
| Older benchmark engine (2) | `benchmarks`, `benchmark` |
| Leaderboards (2) | `leaderboard`, `leaderboardProjection` |
| Benchmark writes (2) | `createBenchmark`, `editBenchmark` |

The SDL also declares 91 root `Mutation` fields for game submissions, account and social changes, content editing, admin work and other products. They are write operations, not sources for this read-only viewer. Two benchmark write fields sit under `aimlab` as shown above. No mutation was executed during this inventory.

## Readable Aimlabs data paths

These are the schema paths and complete *data families* worth checking. “Declared only” means the SDL names the path, but the current public behavior is unverified or failed in the [live inventory](aimlabs-data-inventory.md). A public sample does not establish complete coverage.

| Family | SDL path and data it declares | Evidence boundary |
| --- | --- | --- |
| Player identity and appearance | `aimlabProfile`: ID, username, image/banner URLs, cosmetics, roles; `AimlabProfile.profileCosmetics` is a newer live field absent here. | Basic profile and newer cosmetic URLs answered anonymously. Avoid email, IP, Steam ID and linked identities on `User`. |
| Player history | `AimlabProfile.latestPlay(filter,first,after)`: cursor pages of `Play` with task, score, raw/converted mode, weapon, timestamps, app version, performance scores, Gridshield status, task and manifest joins. | Public pages worked. The archived `PlayFilterInput` permits only task ID, raw mode, before/after date and app ID; current validation rejected weapon/version and other candidate filters. |
| Run manifest | `PlayManifest`: score, duration, pause duration, task/weapon/mode/version, source and input device, analytics version, processing timestamps, errors, replay status/URL, season ID, cosmetics, visibility and location. | Some public values worked; typed field presence is not a guarantee of a non-null value. Location, user settings and platform identifiers are outside the public feature scope. |
| Run cosmetics | `PlayManifest.playCosmetics`: character model, arm skin and target pack slugs; separate `weaponSkin`. | Two public runs returned an arm skin and target pack, no character skin. |
| Run status and provenance | `Play.gridshieldStatus` enum (`PENDING_REVIEW`, `DISQUALIFIED`, `APPROVED`); `Play.viewCount`; manifest submitted/received/ingested/processed timestamps, `sourceInput`, `appVersion`, `analyticsVersion`, `isVisible`, `errors`. | Status is part of the public play path. Timestamp, visibility and view-count semantics need representative runtime checks before display. |
| Replay | `PlayManifest.replayUrl`, `avroSchemas`, `avroSchema`; the archived SDL also declares legacy `PlayResultURL` and shot/target/event record types. | Signed replay URLs and Avro 2.0/2.1 files worked on demand. The schema's richer 1.0 shot/target fields remain unverified on a decoded 1.0 run. New `Play.replay` metadata is absent from this SDL. |
| Task metadata | `aimlab.task`, `aimlab.tasks`, `aimlab.csTask`, `aimlab.csTasks`, root `aimlabTask`/`aimlabTasks`: identity, name, description, image, author, mode/weapon, workshop ID, active/UGC flags, created/updated dates and task/asset versions. | Public task and CS task samples worked. Names are search terms; IDs plus mode and weapon identify the actual scenario. |
| Creator Studio assets | `TaskAsset`: type/subtype/source, name/description/image, current version, file size, dates, author and signed ZIP URL. `searchCsTasks`, `searchTaskAssets`, `searchAimlabAssets` expose discovery paths. | Public bounded search and task package reads worked. ZIP settings are creator-controlled; preserve asset ID/version and parse under limits. |
| Other asset types | `AimlabAssetType`: `playlist`, `task`, `weapon_skin`, `recoil`, `weapon`; `searchAimlabAssets` filters type, subtype, name and source IDs with cursor/total count. | Task asset search worked. The other asset types are schema capabilities, not verified catalogs. |
| Creator statistics | `authors` and `Author.tasks`: creator/task IDs, names, descriptions, images, seven-day, thirty-day and lifetime users/plays. | Author basic data was public; `Author.tasks` failed, and sampled rolling counters looked unreliable. |
| Activity and training | `AimlabProfile.activity(interval)` has daily/weekly/monthly ranges and streaks; `training.stats(year)`/`taskStats(year,taskMode,taskId)` return play/kill values and percentiles, plus consecutive day/week/month streaks. | Activity and annual training samples answered anonymously. Task training metrics returned HTTP 500; percentile cohort is undocumented. |
| Skill and rank | `AimlabProfile.ranking(app)`, `skillScores`, `rank(seasonId)`, root `aimlabUserRank`/`aimlabUserRankSkills`; `aimlab.ranks` supplies tier, level and skill thresholds. | The rank catalog returned 37 entries; one profile's reported rank matched its skill range. Per-skill rank history returned an empty list for that sample. |
| Combine | `AimlabProfile.combineRating(combineId)` gives overall, skill and task ratings. | A valid combine ID and public runtime result have not been established. |
| Older benchmark engine | `aimlab.benchmarks`/`benchmark` expose published sets, brand assets/social links, sections, tiers, rank points and per-task score thresholds linked to CS tasks. `User.benchmarkPerformance(benchmarkId)` declares task, section and overall scores/ranks. | Catalog shape was observed for older sets; performance path/access unverified. This is distinct from the newer official `benchmarkSeasons` API absent from the SDL. |
| Leaderboards | `aimlab.leaderboard(input)`: source, page/total, typed dynamic columns, rows with profile and play. `LeaderboardInput` declares task/weapon/version, campaign/season, metric, time window, country, friends, user/nearby, source and standings. | Public task and bounded season boards worked. Alternative metrics and filters are declared, not all validated. Projection runtime was rate-limited. |
| Official seasons | `seasons`/`season`: dates, active flag, ordered task IDs, mode, weapon, category and max score. `seasonalUserProgress` joins task progress to a play manifest. | Season catalog public; anonymous user progress returned HTTP 401. |
| Sensitivity finder | `universalSensFinderData.weekly/yearly/allTime`: paged records with task name/mode, date, best sensitivity, chunk score and JSON run history. | Declared only. Access, meaning, units and whether another player's history is readable are unverified. |
| Matches | `matchChallenges`, `matches` and related types link players, rounds, plays, winners and timestamps. | Declared only. Multiplayer/challenge data has not been probed as a public player feature. |

### Statistics and filters, without overclaiming

The archived `AimlabPlayStatistics` type names targets, kills, shots fired/hit/missed, head/body hits, accuracy, reaction time, shots per kill, kills per second, time on/off target and ratio, FOV, practice status, and advanced crosshair placement, movement accuracy and peeking score. `aimlab.play`/`plays` are direct raw-statistics paths, while `plays_agg` can calculate count, average, minimum, maximum, standard deviation, sum and unique values; `group_by.ended_at` supports day/week/month/year. The aggregate filter can constrain user, task, raw or normalized mode, weapon, score, end time, practice and UGC flags. This **does not** prove that every statistic is populated or has comparable semantics across tasks. Direct play/statistics reads failed in public probes; selected aggregates worked.

`AimlabProfile.metrics` declares accuracy, head/body shot percentage, shots, score, hits, misses, crosshair placement, movement accuracy and peeking score, grouped by day/week/month/year and a date range. Anonymous access returned HTTP 401. `AimlabPlayUserSkills` and `AimlabPlayResult` are **input types** used for submissions; they do not prove that historic skill vectors can be read.

`LeaderboardMetric` declares `max_score`, `sum_kills` and `count_plays`; `LeaderboardPeriod` declares `week`, `month`, `year` and `latest`; data source is `cache` or `database`. The source is an input choice, not a promise the sources agree. An observed large board differed between them. `leaderboardProjection` declares projected and best ranks, but its result was not verified after a rate-limit response.

### Rank systems are separate

| System | SDL path | What it represents |
| --- | --- | --- |
| General Aimlabs rank | `AimlabProfile.ranking(app)` and `aimlab.ranks` | Profile skill and a rank threshold catalog. |
| Seasonal rank | `AimlabProfile.rank(seasonId)`, `aimlabUserRank`, `aimlabUserRankSkills` | Season-linked score/skill and, where available, per-skill high and recent scores. |
| Combine rating | `AimlabProfile.combineRating(combineId)` | Combine, skill and task ratings for a specific combine ID. |
| Older benchmark rank | `BenchmarkPerformance` and `BenchmarkRank` | Task/section/overall rank points and thresholds of a published benchmark. |
| New official benchmarks | `benchmarkSeasons`, `AimlabProfile.benchmarkPerformance(input)` | A later API family absent from this archived SDL; see the live inventory. |

## Other schema families and the stopping boundary

The remaining root families are enumerated above so they are not silently treated as missing: AIML conversations and prompts, Valorant match data, multiplayer matches, Brainlab research studies, mobile rewards, surveys, social graph, account/store data, moderation and administration. Some could support separate products, but their presence in the SDL is not evidence of anonymous access or permission to publish another player's data. No private identity, settings, account, study or moderation fields were queried for this viewer.

This pass exhausts the **named root paths** and the Aimlabs player/run/task/catalog/statistics/leaderboard/benchmark branches in the archived file. The newer endpoint now exposes [a full current SDL](aimlabs-current-schema-2026-09-29.graphql); use that snapshot for current field names. Field semantics still require small, rate-conscious runtime samples: a declared field alone cannot answer whether it is populated, stable or public.
