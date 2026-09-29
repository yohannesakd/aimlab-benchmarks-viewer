# Aimlabs data inventory

Checked **2026-09-29** against the public `https://api.aimlab.gg/graphql` endpoint. This is a field and behavior inventory for future product work, not a claim that Aimlabs supports these calls as a stable, unauthenticated integration contract. The archived SDL at `/home/sai/code/aimlab-schema-reference/latest-schema.graphql` is a historical reference; live validation takes precedence. [The archived schema map](aimlabs-archived-schema-map.md) and [full field index](aimlabs-archived-schema-fields.tsv) cover its declared paths, including fields not checked live. Probes used small result limits and public profiles or tasks. No private account token was used.

## What the viewer currently uses

| Surface | Current source | Additional useful data |
| --- | --- | --- |
| Player profile | Existing profile/aggregate queries plus public details and yearly activity counts in [`server/public-details.js`](../server/public-details.js) | Comparable score trends, best/worst tasks, session timing |
| Task page | Basic task/leaderboard queries plus style, duration, task and asset versions from the public details API | Verified scoring configuration, asset contents, leaderboard schema |
| Task run page | Bounded cursor pages from [`server/player-runs.js`](../server/player-runs.js), with score identity and allowlisted run metrics | Replay telemetry, comparable-run trends, populated insights if access permits |
| Task search | Name search through `aimlab.tasks` | Creator Studio tasks, asset types, playlists and published versions |
| Leaderboards | Public paged API backed by SQLite | A later backend can normalize profile, task and run data together |

The frontend still calls the older GraphQL endpoint for its base profile, task and task leaderboard data. The VPS API now supplies bounded run pages and optional profile/task details from the current endpoint. These optional panels leave the base pages usable if the current endpoint fails. [`server/index.js`](../server/index.js) and [`server/public-api.js`](../server/public-api.js) share those read-only handlers; a later backend migration can move the remaining direct queries into this boundary.

## Immediate score identity rule

Group a benchmark play by **task ID, normalized task mode, and weapon ID**. Raw `Play.mode=42` corresponds to `Play.convertedMode=0` and aggregate `task_mode_mod=0` in sampled normal Creator Studio runs. Passing raw mode `0` to `latestPlay(filter:{mode:0})` did not return those normal runs. A sampled *non-viewer* VT VALORANT task had normal-mode best **3,119** and alternate-mode best **44,702**; the prior task-only aggregate selected 44,702. This proves the failure mode, not that a preserved 2022–23 benchmark score was affected. A broad old Revosect task aggregate returned HTTP 500, so the affected legacy count is unknown. The app fix selects normalized mode 0 and the exact benchmark weapon for benchmark scores, while its general task overview can still combine modes intentionally. Query shape and selection must remain explicit in any later data API. [Source: app query](../src/helpers/queries.js), [profile consumer](../src/pages/PlayerProfile.vue); live GraphQL probes on 2026-09-29.

`latestPlay`'s public `PlayFilterInput` accepts task ID, **raw** mode, before/after date and app ID. The current official schema also adds `taskIds:[String!]` and `isMultiplayer:Boolean`; a bounded anonymous query with both returned 311 matching solo RA Fourshot runs for one profile. Bounded validation rejected weapon ID, task version, min/max score, replay availability, Gridshield status, season and normalized mode as filter keys. A comparable-run view therefore needs to page by supported filters and then check weapon/version on each returned run; its `totalCount` is not automatically a count of comparable runs. The aggregate `AimlabPlayWhere` supports more fields, but it loses per-run timing and IDs.

## Public data by entity

“Public” means one anonymous probe succeeded. It does not guarantee that every player, task, or old run has the field.

| Entity / path | Public fields or payload | Product use | Limits observed |
| --- | --- | --- | --- |
| `AimlabProfile.latestPlay(filter, first, after)` | Cursor pages, total count; each `Play` has ID, task, score, raw and converted mode, weapon, timestamps, `performanceScores`, Gridshield status and manifest | Per-task run history, score trend, personal bests, session comparison | Use bounded pages; `latestPlay` had 744 runs for one sampled profile. Some task joins or version fields are null. |
| `Play.manifest` | Duration, pause duration, input device, task/weapon/mode/app versions, performance data, replay availability, ingest timestamps, optional country/region and `playCosmetics` | Explain each run and filter comparable runs | Sampled `duration` values are seconds while `pauseDuration` matches replay pauses in milliseconds. `performanceData` is untyped JSON; field presence and units vary by task. Two public runs returned arm skin `Glove` and target pack `target_original`, but no character skin. Country/region and settings warrant a privacy review before display. |
| `Play.replay` | Replay ID, creation time, tags and sometimes views/likes/comments | Replay link and optional engagement counts | `replay.stats` succeeded for one sampled player and returned HTTP 500 for another; fetch it separately and treat failure as unavailable. |
| `PlayManifest.replayUrl` plus `avroSchema` | Signed replay file and versioned Avro schema | Score/accuracy timeline, pauses, aim and target analysis when a run is opened | Signed URLs expire; missing replay is normal. Decode on the server with resource limits. Never persist or expose signed URLs in a document or log. |
| `Aimlab.task` / `aimlab.csTask` | ID, name, description, thumbnail, weapon, mode, style, author, workshop ID, task/asset versions and dates | Scenario page, creator attribution, task/version badges | `task.config` was `{}` for a sampled scenario; do not assume it contains scoring rules. Creator text is untrusted content. |
| `AimlabTask.asset` / `TaskAsset` | Asset ID, type, Steam source ID, version, file size, dates, signed package URL | Inspect published task rules and assets | Package data is creator-controlled and may change; cache by asset ID and version, parse under resource limits. |
| `aimlab.searchCsTasks`, `searchTaskAssets`, `searchAimlabAssets` | Name/type/source search; asset connection has cursor and total count | Discover scenarios, playlists, alternate editions | Limit results; do not use fuzzy names as the canonical task identity. |
| `AimlabProfile` | Image/banner, ranking, skill scores, cosmetics, activity ranges/streaks, task stats, training streak, friend count | Player overview and improvement summaries | `lastPlayed` was stale for a profile with 2026 activity; `taskStats.task` can be null; ranks and skill lists can be null/empty for active players. |
| `aimlab.plays_agg` | Count, min/max/avg/sum/stddev and grouping by task/name/normalized mode/weapon | Summary charts and best scores | Server errors occur on some broad queries; aggregation alone loses individual run IDs and timing. Verify each metric's meaning before labeling. |
| `aimlab.leaderboard` | Task-specific columns, page metadata, rows, joined profiles/plays, optional user filter | Rank, score comparison, task-specific stat labels | Cache and database sources disagreed in one sampled large board; a leaderboard row is not a complete run history. |

The archived SDL also exposes `UserSettings`, social identities, Steam IDs, email, IP, and other account fields. Those are outside the public player feature scope; do not query, retain, or publish them merely because the schema names them.

Sampled run `performanceData` included `killTotal`, `hitsTotal`, `shotsTotal`, `missesTotal`, `targetsTotal`, `bodyshots`, `headshots`, `accTotal`, `avgDist`, `damageTotal` and `timePerKill`. The leaderboard row separately exposed score, rank, accuracy, shots, kills, duration, device, and sometimes task-specific `custom` metrics or empty segment arrays. This can support a compact run card showing score, hits, attempts, accuracy, target count and pace, then a task-specific detail panel. Do not force every scenario into the same labels: a tracking sample counted hits differently from `bodyshots`, and `accTotal` is not necessarily comparable across click and tracking tasks. Keep the raw key and unit provenance with each displayed metric.

### Run telemetry: what the Avro payload actually holds

`avroSchemas` anonymously listed Aimlab `1.0.0`, `2.0.0`, and `2.1.0` on the probe date. `avroSchema(clientId:AIMLAB,version:...)` returned the full schema. A 105,980-byte 2025 replay decoded with `2.0.0`: 42 target records, 214 event records, 9 pause intervals, sampled player position/rotation/animation/FOV, and score and accuracy curves. Its 137,004 ms of pauses matched the manifest and the final score curve matched the leaderboard. A 144,361-byte 2026 replay decoded with `2.1.0`: 198 targets and 1,189 events; its `players` and `rsPing` collections were empty in that single-player run. The `2.1.0` schema also declares player scaling, health and first-person state. Version `1.0.0` has a different layout with `shotData.player` time/FOV/pose samples, target on/off-screen intervals and position/size/optimal-heading time series, plus event player/target positions. These are **schema capabilities**; no version `1.0.0` replay was decoded. [Source: live `avroSchemas`/`avroSchema` and sampled `PlayManifest.replayUrl`, 2026-09-29.]

These payloads support timeline visualizations, pause-aware timing, target lifecycle and aim movement analysis. Coverage depends on the run: sampled player position had 412 points in the 2025 replay but only one in the static 2026 replay, while aim rotation had thousands in both. A separate, bounded 199,208-byte tracking replay had 6 targets, 6,335 events and 602 score samples; every target position/rotation/scale/color/health/visibility series still had only one point. The format supports target time series, but moving-target trajectories have **not** been demonstrated in a replay. All targets in the first two sampled replays had `timeToLive=-1`; treat it as a sentinel, not a measured duration. Two targets per replay had a destroy timestamp earlier than spawn and must be excluded from measured durations. Event `customData` was null and numeric event codes have not been mapped to stable meanings.

The 2025 score curve fell from 2,201 to 2,159 in its final ten seconds, so interval score changes do not equal kills or raw scoring pace. A 2026 replay’s final score curve was **1,940**, while the same play, manifest and leaderboard said **1,935**. Use the API play/leaderboard score for rank and best score; label replay curves as telemetry. Do not infer an official scoring formula from a time series alone. Replay availability differed for the *same* play between `latestPlays` and `latestPlay` in one response; prefer a checked `latestPlay`/manifest and test the URL before promising a replay.

### Scenario packages and scoring settings

The signed task asset is a ZIP containing a human-readable Creator Studio `level.es3`, bot settings, images and workshop metadata. The sampled `level.options` included `LevelLength`, `Weapon`, `ScoreHit`, `ScoreMiss`, `ScoreKill`, `ScoreSQRTBonus`, target and movement settings. The sampled old Revosect Sixshot Easy had a 60-second length, kill score 10 and square-root accuracy bonus; five live leaderboard rows matched `floor(10 × kills × sqrt(accuracy / 100))`. Revosect Jumptrack matched `hits + 30 × kills`; Wideflick matched kills. A newer Revosect S4 Fourshot Easy package had kill score 10, miss score -3 and no square-root bonus; three live rows matched `10 × kills − 3 × (shots fired − shots hit)`. Voltaic S3 Angleshot Novice matched the square-root example in three rows. These are **verified examples, not a global formula**. [Source: live `aimlab.csTask.asset.signedUrl` packages and sampled Aimlabs task leaderboards, 2026-09-29.]

Task packages can also yield target scale and movement/respawn configuration, useful for “what this trains” explanations. Sample bot files contained geometry, health, respawn delay and range, and movement modules; the tracking sample had strafe/jump settings, while the Voltaic S3 sample included lifetime despawn settings. Units and in-game interpretation were not independently verified. `level.value.contentMetadata.ancestors[]` listed prior task IDs and dates in all five inspected packages, so it may help connect related scenario editions. It is creator-controlled lineage, not a complete canonical revision history. `AimlabTask.version`, `AimlabCSTask.currentVersion`, `TaskAsset.currentVersion` and package `levelVersion` are separate values; preserve their source rather than merging them into one version. The package should be read as data, not executable content. Keep the package asset ID/version beside parsed facts, omit author platform IDs, and validate derived score rules against representative real scores before showing them as fact.

[Aimlabs' March 2026 Creator Studio update](https://aimlabs.com/articles/aimlabs/we-have-updated-the-aimlabs-creators-studio/) describes acceleration and velocity controls, movement transitions, fakeouts, spawn behavior, conditional movement, wall avoidance, gravity, FOV limits and cosmetic restrictions. Those controls are promising scenario descriptors, but their serialized fields were **not** verified in the five inspected packages. Inspect a newer published asset before adding them to a parser or comparison view.

### Derived analytics that are defensible

| Analysis | Inputs and boundary |
| --- | --- |
| Personal-best progression and run-to-run consistency | Compare runs only within the same task ID, normalized mode, weapon and version; show sample count and date range. Do not infer a fixed improvement threshold from one score. |
| Activity calendar | Use public `AimlabProfile.activity` ranges as reported. Its activity disagreed with sampled `lastPlayed`, so do not use `lastPlayed` as the calendar source. |
| Replay timelines | Plot sampled score and accuracy against replay time; show the API score separately as canonical. Score can fall during a run, and replay curves may end at a different value. |
| Scenario comparison | Compare package options, bot settings and `ancestors[]` with asset/version provenance. Label creator settings and lineage as descriptive data, not a verified skill measure or exhaustive revision record. |

Target spawn-to-destroy time is not validated reaction time. Numeric event codes are not verified hit or miss labels. Neither should be presented as a player metric until its semantics are mapped against independent evidence.

## Other API families worth tracking

| Family | Status on 2026-09-29 | Relevance |
| --- | --- | --- |
| `seasons(activeOnly:true)` | Public; returned five active campaigns with task, weapon, raw mode, category and max score | Discover official ranked/event campaigns; distinct from third-party benchmarks. |
| `aimlab.ranks` | Public; returned 37 rank entries with ID, display name, tier, level, and minimum/maximum skill. A sampled profile's skill of 661 matched the catalog's Emerald 2 range of 660–690 and its reported rank. | Rank threshold and progress display. Use the profile's reported rank as canonical, and re-fetch thresholds because the catalog can change. |
| Season `aimlab.leaderboard(input)` | A saved bounded public query with `seasonId:"2026-logitech-fall"`, `combined:true`, task/mode/weapon and `limit:2` returned a cached board with 76,098 total rows, average score and one column per season task. `seasonId` and `scoreToProjectRank` were already in the archived `LeaderboardInput`. | Show public event-season standings with dynamic columns; do not fetch the whole board. A later projection attempt received HTTP 429, so projected-rank behavior remains unverified. |
| `benchmarkSeasons` and profile `benchmarkPerformance` | Public; newer than the archived SDL | Official Aimlabs Entry/Intermediate/Elite task and progression data. Keep separate from Revosect/Voltaic sets. [Aimlabs describes the system](https://aimlabs.com/articles/aimlabs/the-aimlabs-official-benchmarks-first-season-is-now-live/). |
| `aimlab.benchmarks` | Public in an earlier bounded probe; published benchmark structure includes tiers, sections, tasks and thresholds | Potential catalog source, but returned older sets in the sample; version before import. |
| `authors`, `AuthorTask` | Author identity and summary metrics public; `authors.tasks` returned HTTP 500 in this probe | Creator pages later. `d7`, `d30` and lifetime counters sometimes had identical implausibly large values; do not display as rolling counts yet. |
| `avroSchemas` | Public; version list and schema definitions | Select decoder by `manifest.analyticsVersion`; do not assume one replay shape. |
| `eventpasses` | HTTP 401 anonymously | Only with explicit authenticated integration and user consent. |
| Profile `plays`, `metrics` | HTTP 401 anonymously | Public `latestPlay` and `plays_agg` are the tested alternatives, with their own limits. |
| Root `play` / `playManifest`, `aimlab.play` | HTTP 401 or HTTP 500 in sampled calls | Do not build a public run route on direct lookup until access is resolved. A run can be reached through public profile history or leaderboard join. |
| `Play.statistics`, some replay stats/training task stats | HTTP 500 in sampled calls | Use `manifest.performanceData` or leaderboard data only after validating semantics. |
| `AimlabProfile.training` | Public `stats(year:2025)` on one profile returned play and kill values plus percentiles; consecutive week/month streak fields returned values. `taskStats(year,taskMode,taskId)` returned HTTP 500 for both sampled metrics. | Year-level training summary may be useful; task-level training stats are not dependable in this sample. Percentile meaning and cohort are undocumented. |
| `aimlab.nextTask(prevSlug,prevMode)` | Public query returned an empty list for one older Revosect task. | Task suggestions are not demonstrated by this sample. |
| `seasonalUserProgress`, `aimlabUserRankSkills` | Anonymous seasonal progress returned HTTP 401; a bounded rank-skill query returned `[]` for one public profile. | Do not equate the empty rank-skill list with low skill, or the authentication failure with no seasonal play. |
| `xboxProfile`, `psProfile` | Fields validated, both null for the sampled profile | Possible platform-specific player information; unverified on an actual console profile. |
| Plans, missions, Valorant, mobile, account/shop and social APIs | Present in old SDL or found by targeted validation; not functionally probed | Broader product areas. Several concern authenticated/private account state and do not currently justify a viewer feature. |

## New since archived SDL

This section lists **field names absent from** the archived `latest-schema.graphql`, found by small candidate batches through [Clairvoyance](https://github.com/nikitastupin/clairvoyance) and direct GraphQL validation on 2026-09-29. A valid field name alone says nothing about public access or useful data. Existing fields such as `avroSchema`, `avroSchemas`, `PlayManifest.replayUrl`, `AimlabProfile.activity` and `taskStats` remain valuable but are not new names. The new profile `benchmarkPerformance(input:{seasonId,difficulty})` differs from the old `User.benchmarkPerformance(benchmarkId)`.

| New field / type | Validation and bounded runtime result | Meaning and next check |
| --- | --- | --- |
| `Play.athenaMetrics: [AthenaMetricSample!]` | The sample type accepts `id`, `metricId`, `metricValue`, `aimCategory`, `createdAt`, `extraData`. It returned `null` without errors on one 2025 run and two 2026 official-task runs. | Potential per-run Aimlabs metric samples. Coverage, units, metric IDs and calculation are **unknown**; do not show a chart or infer a zero value from `null`. |
| `AimlabProfile.athenaMetricInsight(range:AthenaMetricTimeframeRange!)` | The official current SDL resolves range to `DAYS_7`, `DAYS_30`, `DAYS_90` and describes ranked strengths/weaknesses. An anonymous `DAYS_30` query returned GraphQL `UNAUTHENTICATED` (401). | This is not available to the public viewer. Do not treat the old endpoint's blocked introspection or its earlier unknown enum as a data-availability result. |
| `AimlabProfile.learningStats: UserLearningStats!` | `stars`, `completedPlans`, `aggregatedScore` and `timeSpentSeconds` answered anonymously with `0` for one sampled profile. | Training-plan progress may be visible. One zero sample cannot establish completeness, update frequency or the meaning of any score. |
| `AimlabProfile.plans(input:UserPlansInput!)` | Field and required input validated; `plans(input:{})` returned HTTP 401 for a public profile. | User-specific learning plans require authenticated access; exclude from the anonymous viewer. |
| `AimlabProfile.profileCosmetics: AimlabProfileCosmetics!` | `avatar`, `profileBanner`, `profileIcon`, `title` are nullable `AimlabProfileCosmetic` objects with `slug` and `url`. Current SDL also declares up to three ordered `achievementBanners`. Banner, icon and title were non-null in one public profile; avatar was null. The title had no URL. Achievement banners were not sampled. | Existing `cosmetics` exposes slugs, while this field can provide the corresponding public image URLs. Handle empty slots and URLs by type. |
| `Play.replay: AimlabReplay!` | Public sampled replay had ID, play ID, creation time, tags and description. Additional valid fields: `title`, `thumbnailId`, `thumbnail`, `comments`, `stats`. Title and thumbnail ID were null on two 2026 runs; `stats` worked for one sampled player but returned HTTP 500 for another. `thumbnail` and `comments` are object/connection fields, not yet executed. | Show a replay link only after availability is checked. Description may be task-sourced; do not call it a user annotation. Treat comments and engagement as separate optional requests. |
| `Play.playInsights: PlayInsights` | Valid `playId`, `events { key startSeconds endSeconds metrics { key data } }`, and `globalMetrics { key data }`. It returned `null` without errors for two sampled 2026 official-task runs. | Potential event-window and whole-run metrics; coverage, `data` shape, units and interpretation remain unknown. Do not treat null as an empty report. |
| `AimlabTask.style`, `duration` | `style` was `Standard` for sampled tasks; current SDL declares `PVP`, `Rhythm`, `Standard`. `duration` was `null` for an older Revosect task and `60` for a 2026 official task; SDL describes seconds. | Public task duration can save package decoding for some tasks, but older tasks require another source. Only `Standard` was sampled at runtime. |
| `AimlabProfile.latestPlays(app:App!)` | Public, returned three recent plays in one sample. It disagreed with `latestPlay` on `replayAvailable` for the same play. | Convenient preview only; use cursor-paged `latestPlay` for history and validate replay separately. |
| `benchmarkSeasons` and profile `benchmarkPerformance(input:BenchmarkPerformanceInput!)` | Public in bounded probes; season task configurations and a sampled player progression returned. | Official Aimlabs benchmark data. Keep its identity separate from archived Revosect and Voltaic sets. |
| Profile `eventpass`, `xboxProfile`, `psProfile`; root `eventpasses`, `plan`, `plans` | Names and object types validated. `eventpasses` returned HTTP 401; console profiles were null for the sampled account. Plan catalog and per-user event progress were not executed. | Other platform and event data are possible, but public coverage remains unverified. |

The earlier scan of `api.aimlab.gg` was targeted: introspection there returned HTTP 403, and a later bounded projection probe received HTTP 429. The official web client's **different** endpoint, `api.aimlabs.com`, allowed full introspection on 2026-09-29. The new Athena run fields remain discovery leads: sampled values were null, and profile insights require authentication. See the current-schema findings below.

### Current official endpoint: full schema and public checks

The [current Aimlabs web client](https://aimlabs.com/_next/static/chunks/pages/_app-236ef93a88d9fbfd.js) names `https://api.aimlabs.com/graphql` as its API and sends queries under `Trainer { ... }`. `get-graphql-schema https://api.aimlabs.com/graphql` succeeded anonymously on 2026-09-29. Its 15,191-line, 409,544-byte SDL is [saved in this repository](aimlabs-current-schema-2026-09-29.graphql) and mirrored at `/home/sai/code/aimlab-schema-reference/current-api-2026-09-29.graphql` (SHA-256 `93a9570fb03f572137196de33a01aeaaa10b45fb47ffc2218e9fc5fb02c5ad15`). This is a full structural schema, **not** evidence that every field can be read anonymously. The archived SDL remains useful for identifying newly added names. [Source: official web client and dated direct introspection.]

| Current field or family | Anonymous result and limit |
| --- | --- |
| `Trainer.aimlab.leaderboard` | The exact official client query returned HTTP 200 with no errors for a one-row RA Sixshot Easy request. Response included data, one profile, paging metadata and a task-specific `schema.fields` list with labels, formatting and precision for score, targets, hits and accuracy. The request used an empty weapon ID, so its `totalRows:1` does not represent the canonical board. |
| `AimlabProfile.taskStats(limit).playId` and `.play` | Public for one RA Fourshot profile summary. `playId` matched `play.id`, and `topScore:1310` matched `play.score`. `play` exposed task ID, weapon and run fields; `taskVersion` was null. This can link a task summary to its actual best run. Root `Trainer.play(playId:...,view:false)` instead returned GraphQL `UNAUTHENTICATED`; use the public profile path only where permitted. |
| `AimlabProfile.recommendedTasks(app,engine,max)` | Public with `engine:DAILY_PLAYLIST,max:1`; two different sampled profiles received the same RA Headswitch task. It can show the daily recommendation, but the sample does not support calling it personalized. `RANDOM_DAILY_PLAYLIST` is the other declared engine; it was not executed. |
| `AimlabProfile.achievementMetrics(slugs)` | Public; one profile returned account-age days, subscription-age days as null, and streak days. The SDL explicitly distinguishes inapplicable null from zero. These are computed on read, so cache them with a freshness label. |
| `AimlabProfile.metrics(groupBy,metrics,range)`, `athenaMetricInsight(range)`, `athenaMetricTimeseries(metricId,range)` | Each returned GraphQL `UNAUTHENTICATED` for a sampled public profile. The SDL defines score, accuracy, hits, misses, shots, movement/crosshair/peeking and head/body-shot metrics; Athena timeseries defines daily play/sample counts, averages, severity and coverage. These typed analytics need an authorized access path before a public feature can use them. `athenaMetricDefinitions` catalog was also `UNAUTHENTICATED`. |
| `Play.adaptiveDifficulty`, `athenaMetricPlayInsights`; new manifest fields | Public `taskStats.play` returned null for both run fields on one RA Fourshot best run. `playDuration`, `academyStepId`, `missionsResolvedAt` and `multiplayerSessionId` were also null. The SDL defines adaptive-difficulty points in milliseconds since task start and Athena insight titles/types, but this sample establishes no coverage. `AimlabProfile.taskAdaptiveDifficulty` returned `UNAUTHENTICATED`. |
| `Trainer.publishedReplay(replayId)` | Public for one known replay ID, with title null, comments enabled, 56 views, zero likes and zero comments. This root can supply replay engagement, but one sample is insufficient to promise stats for every replay; the older endpoint previously returned HTTP 500 for another replay's stats. |
| `Trainer.benchmarkRankDistribution(seasonId)` | An existing public event-season ID returned HTTP 200 and 60 rank/tier entries, all with zero counts and `totalCount:0`; do not interpret that as a real player distribution without checking a compatible official benchmark season. `Trainer.yearReview(userId)` returned `UNAUTHENTICATED`. |
| `Trainer.season(id)` | A known public event season returned `visible:true` and `active:true`. Asking for `leaderboardPaused` returned `UNAUTHENTICATED`; keep this operational field out of anonymous views. |
| `Trainer.latestUniversalSensFinderDataByTask`, `multiplayerModes(appId)` | Both returned `UNAUTHENTICATED` in bounded anonymous requests (`first:1` for sensitivity data). The SDL describes sensitivity and multiplayer catalog data, but the public viewer cannot read these paths. A workshop-playlist list was left untested because it has no pagination bound. |

The current SDL also describes `BenchmarkUserPerformance.progression` as personal-best improvements only, oldest first; weak plays do not add points. `seasonPlayCount` includes all plays of season tasks inside the season window, including unscored modes. `PlayInsights.metadata` can label event and metric keys if a populated insight is found. `TaskStyle` declares `PVP`, `Rhythm` and `Standard`. These are schema contracts; no populated public insight or alternate task style was sampled.

Minimal current-endpoint reads, each sent as a JSON `query` in a POST to `https://api.aimlabs.com/graphql`:

```graphql
query PublicTaskSummary {
  Trainer {
    aimlabProfile(username: "VTSaibot") {
      taskStats(limit: 1) {
        topScore playId
        play { id score taskSlug manifest { weaponId } }
      }
      recommendedTasks(app: AIMLAB, engine: DAILY_PLAYLIST, max: 1) {
        id mode version aimlabTask { name }
      }
    }
  }
}
```

Keep `max`, run pages and leaderboard `limit` small. The official endpoint was probed sequentially with pauses between requests and produced no HTTP 429 in this pass. Before full introspection became available, a small [Clairvoyance](https://github.com/nikitastupin/clairvoyance) pass on `api.aimlab.gg` rejected guessed heatmap, movement, trend, shot and engagement fields on Profile, Play and Replay. It also rejected `plays_agg.aggregate.uniq.days/weeks` from an older third-party client. A first Clairvoyance request to `api.aimlabs.com` incorrectly reported the intentionally invalid sentinel field as found despite one GraphQL error; its candidate list was discarded. Direct query errors and the full SDL are the evidence for this section. Do not place signed replay URLs, private account fields or full raw response bodies in committed examples.

```graphql
query NewPublicFields($username: String!) {
  aimlabProfile(username: $username) {
    learningStats { stars completedPlans }
    profileCosmetics {
      profileBanner { slug url }
      profileIcon { slug url }
      title { slug url }
    }
    latestPlay(first: 1) {
      edges { node {
        id taskSlug startedAt
        athenaMetrics { metricId metricValue aimCategory createdAt extraData }
        playInsights {
          playId
          events { key startSeconds endSeconds metrics { key data } }
          globalMetrics { key data }
        }
        replay { id title description thumbnailId }
      } }
    }
  }
}
```

This query returned HTTP 200 without GraphQL errors for a sampled public profile; `athenaMetrics` and `playInsights` were `null`. It deliberately excludes `replay.stats`, which failed on another sampled run.

## Reproduce the key reads

Send a JSON body `{"query":"...","variables":{...}}` as `POST` with `Content-Type: application/json` to `https://api.aimlab.gg/graphql`. Small pages and a delay between requests were used during this inventory. A subsequent projection probe received HTTP 429 with a three-second wait message; live requests stopped at that point. Treat rate limiting as a stop signal, honor the stated delay before any later session, and keep signed URLs and raw responses out of committed fixtures.

```graphql
query PlayerRuns($username: String!, $task: String!, $after: String) {
  aimlabProfile(username: $username) {
    latestPlay(filter: {taskId: $task, appId: AIMLAB}, first: 10, after: $after) {
      totalCount
      pageInfo { endCursor hasNextPage }
      edges { node {
        id score mode convertedMode taskSlug weaponName startedAt endedAt
        gridshieldStatus
        manifest { duration pauseDuration inputDevice replayAvailable analyticsVersion performanceData }
      } }
    }
  }
}
```

```graphql
query TaskDetail($task: String!) {
  aimlab {
    task(slug: $task) {
      id name mode version style duration description image_url weapon_id workshop_id
      author { id username }
      asset { id currentVersion fileSize modifiedAt }
    }
    csTask(id: $task) { id name currentVersion weaponId asset { id currentVersion } }
  }
}
```

```graphql
query PlayerTaskSummary($userId: String!, $task: String!) {
  aimlab {
    plays_agg(where: {user_id: {_eq: $userId}, task_id: {_eq: $task}, score: {_gt: 0}}) {
      group_by { task_id task_name task_mode_mod weapon_id }
      aggregate { count avg { score accuracy } max { score created_at } }
    }
  }
}
```

The last query is illustrative. For a production profile, constrain scope and validate payload size before asking for all grouped tasks. For replay decoding, query `avroSchema(clientId:AIMLAB,version:"2.0.0") { schema }` for the manifest’s `analyticsVersion`, obtain `replayUrl` only on demand, and fetch it immediately. Do not store the signed URL.

## Later backend processing, scoped to the existing server

1. Add read-only profile, task and run endpoints beside the current paged leaderboard routes. The public Vercel proxy currently forwards only leaderboard paths, so these routes will need an explicit proxy change. Preserve task ID, normalized mode, weapon ID, task/asset version, source and fetch time in each response; make “unavailable” distinct from an empty history.
2. Cache metadata and bounded public aggregates with explicit freshness. Fetch run pages on demand. Keep large replay files out of routine page loads and use bounded decoding jobs only when a user opens run detail.
3. Normalize metric names and units by task/version. Store canonical score separately from derived charts. Validate score rules per scenario against real runs; avoid using package settings as an authority for historical server scoring without this check.
4. Define data retention and access before persisting replay traces, location, account settings or social fields. Strip signed URLs and raw account identifiers from logs. An Aimlabs API grant may change both available fields and permissible use; recheck its terms before a production data pipeline.

Near-term product order: **run history with canonical scores → richer task page → player trends → optional replay detail**. Each step uses fields already demonstrated publicly, while leaving benchmarks and a full processing migration for separate work.
