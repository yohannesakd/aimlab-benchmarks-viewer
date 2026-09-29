# Aimlabs data inventory

Checked **2026-09-29** against the public `https://api.aimlab.gg/graphql` endpoint. This is a field and behavior inventory for future product work, not a claim that Aimlabs supports these calls as a stable, unauthenticated integration contract. The archived SDL at `/home/sai/code/aimlab-schema-reference/latest-schema.graphql` is a historical reference; live validation takes precedence. Probes used small result limits and public profiles or tasks. No private account token was used.

## What the viewer currently uses

| Surface | Current source | Additional useful data |
| --- | --- | --- |
| Player profile | `GET_USER_INFO` and `GET_USER_PLAYS_AGG` in [`src/helpers/queries.js`](../src/helpers/queries.js) | Run history, score trend, activity, best/worst tasks, selected run details |
| Task page | Basic `aimlab.task` metadata and `aimlab.leaderboard` in [`src/pages/TaskView.vue`](../src/pages/TaskView.vue) | Scenario version, creator, scoring configuration, per-run performance, leaderboard schema |
| Task search | Name search through `aimlab.tasks` | Creator Studio tasks, asset types, playlists and published versions |
| Leaderboards | Public paged API backed by SQLite | Existing server can later serve normalized profile/task/run data |

The app has no run detail route. The frontend still calls GraphQL directly for profiles and tasks. The existing [`server/index.js`](../server/index.js), [`server/public-api.js`](../server/public-api.js), and [`server/refresh-database.js`](../server/refresh-database.js) already form a read-only server and refresh boundary for leaderboards. A later backend migration should extend that boundary, not start a second backend.

## Immediate score identity rule

Group a benchmark play by **task ID, normalized task mode, and weapon ID**. Raw `Play.mode=42` corresponds to `Play.convertedMode=0` and aggregate `task_mode_mod=0` in sampled normal Creator Studio runs. Passing raw mode `0` to `latestPlay(filter:{mode:0})` did not return those normal runs. A sampled *non-viewer* VT VALORANT task had normal-mode best **3,119** and alternate-mode best **44,702**; the prior task-only aggregate selected 44,702. This proves the failure mode, not that a preserved 2022–23 benchmark score was affected. A broad old Revosect task aggregate returned HTTP 500, so the affected legacy count is unknown. The app fix selects normalized mode 0 and the exact benchmark weapon for benchmark scores, while its general task overview can still combine modes intentionally. Query shape and selection must remain explicit in any later data API. [Source: app query](../src/helpers/queries.js), [profile consumer](../src/pages/PlayerProfile.vue); live GraphQL probes on 2026-09-29.

## Public data by entity

“Public” means one anonymous probe succeeded. It does not guarantee that every player, task, or old run has the field.

| Entity / path | Public fields or payload | Product use | Limits observed |
| --- | --- | --- | --- |
| `AimlabProfile.latestPlay(filter, first, after)` | Cursor pages, total count; each `Play` has ID, task, score, raw and converted mode, weapon, timestamps, `performanceScores`, Gridshield status and manifest | Per-task run history, score trend, personal bests, session comparison | Use bounded pages; `latestPlay` had 744 runs for one sampled profile. Some task joins or version fields are null. |
| `Play.manifest` | Duration, pause duration, input device, task/weapon/mode/app versions, performance data, replay availability, ingest timestamps, optional country/region | Explain each run and filter comparable runs | `performanceData` is untyped JSON; field presence and units vary by task. Country/region and settings warrant a privacy review before display. |
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

`avroSchemas` anonymously listed Aimlab `1.0.0`, `2.0.0`, and `2.1.0` on the probe date. `avroSchema(clientId:AIMLAB,version:...)` returned the full schema. A 105,980-byte 2025 replay decoded with `2.0.0`: 42 target records, 214 event records, 9 pause intervals, sampled player position/rotation/animation/FOV, and score and accuracy curves. Its 137,004 ms of pauses matched the manifest and the final score curve matched the leaderboard. A 144,361-byte 2026 replay decoded with `2.1.0`: 198 targets and 1,189 events; its new `players` and `rsPing` collections were empty in that single-player run. Version `1.0.0` has a different `shotData`/`targetData`/`eventData` layout. [Source: live `avroSchemas`/`avroSchema` and sampled `PlayManifest.replayUrl`, 2026-09-29.]

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
| `benchmarkSeasons` and profile `benchmarkPerformance` | Public; newer than the archived SDL | Official Aimlabs Entry/Intermediate/Elite task and progression data. Keep separate from Revosect/Voltaic sets. [Aimlabs describes the system](https://aimlabs.com/articles/aimlabs/the-aimlabs-official-benchmarks-first-season-is-now-live/). |
| `aimlab.benchmarks` | Public in an earlier bounded probe; published benchmark structure includes tiers, sections, tasks and thresholds | Potential catalog source, but returned older sets in the sample; version before import. |
| `authors`, `AuthorTask` | Author identity and summary metrics public; `authors.tasks` returned HTTP 500 in this probe | Creator pages later. `d7`, `d30` and lifetime counters sometimes had identical implausibly large values; do not display as rolling counts yet. |
| `avroSchemas` | Public; version list and schema definitions | Select decoder by `manifest.analyticsVersion`; do not assume one replay shape. |
| `eventpasses` | HTTP 401 anonymously | Only with explicit authenticated integration and user consent. |
| Profile `plays`, `metrics` | HTTP 401 anonymously | Public `latestPlay` and `plays_agg` are the tested alternatives, with their own limits. |
| Root `play` / `playManifest`, `aimlab.play` | HTTP 401 or HTTP 500 in sampled calls | Do not build a public run route on direct lookup until access is resolved. A run can be reached through public profile history or leaderboard join. |
| `Play.statistics`, some replay stats/training task stats | HTTP 500 in sampled calls | Use `manifest.performanceData` or leaderboard data only after validating semantics. |
| `xboxProfile`, `psProfile` | Fields validated, both null for the sampled profile | Possible platform-specific player information; unverified on an actual console profile. |
| Plans, missions, Valorant, mobile, account/shop and social APIs | Present in old SDL or found by targeted validation; not functionally probed | Broader product areas. Several concern authenticated/private account state and do not currently justify a viewer feature. |

## New since archived SDL

This section lists **field names absent from** the archived `latest-schema.graphql`, found by small candidate batches through [Clairvoyance](https://github.com/nikitastupin/clairvoyance) and direct GraphQL validation on 2026-09-29. A valid field name alone says nothing about public access or useful data. Existing fields such as `avroSchema`, `avroSchemas`, `PlayManifest.replayUrl`, `AimlabProfile.activity` and `taskStats` remain valuable but are not new names. The new profile `benchmarkPerformance(input:{seasonId,difficulty})` differs from the old `User.benchmarkPerformance(benchmarkId)`.

| New field / type | Validation and bounded runtime result | Meaning and next check |
| --- | --- | --- |
| `Play.athenaMetrics: [AthenaMetricSample!]` | The sample type accepts `id`, `metricId`, `metricValue`, `aimCategory`, `createdAt`, `extraData`. It returned `null` without errors on one 2025 run and two 2026 official-task runs. | Potential per-run Aimlabs metric samples. Coverage, units, metric IDs and calculation are **unknown**; do not show a chart or infer a zero value from `null`. |
| `AimlabProfile.athenaMetricInsight(range:AthenaMetricTimeframeRange!)` | Returns `AthenaUserMetricInsight!`; its `insights` items accept `insightId`, `title`, `description`, `playCount`. Runtime access is **unverified**. `__type` introspection returned HTTP 403, and a bounded set of likely range enum values failed validation. | Could provide Aimlabs-generated player insights. Obtain the actual enum and a permitted sample through official access before using the text or claiming it is public. |
| `AimlabProfile.learningStats: UserLearningStats!` | `stars` and `completedPlans` answered anonymously with `0` and `0` for one sampled profile. | Training-plan progress may be visible. One zero sample cannot establish completeness, update frequency or the meaning of “stars.” |
| `AimlabProfile.plans(input:UserPlansInput!)` | Field and required input validated; `plans(input:{})` returned HTTP 401 for a public profile. | User-specific learning plans require authenticated access; exclude from the anonymous viewer. |
| `AimlabProfile.profileCosmetics: AimlabProfileCosmetics!` | `avatar`, `profileBanner`, `profileIcon`, `title` are nullable `AimlabProfileCosmetic` objects with `slug` and `url`. Banner, icon and title were non-null in one public profile; avatar was null. The title had no URL. | Existing `cosmetics` exposes slugs, while this field can provide the corresponding public image URLs. Handle empty slots and URLs by type. |
| `Play.replay: AimlabReplay!` | Public sampled replay had ID, play ID, creation time, tags and description. Additional valid fields: `title`, `thumbnailId`, `thumbnail`, `comments`, `stats`. Title and thumbnail ID were null on two 2026 runs; `stats` worked for one sampled player but returned HTTP 500 for another. `thumbnail` and `comments` are object/connection fields, not yet executed. | Show a replay link only after availability is checked. Description may be task-sourced; do not call it a user annotation. Treat comments and engagement as separate optional requests. |
| `Play.playInsights: PlayInsights` | Valid `playId`, `events { key startSeconds endSeconds metrics { key data } }`, and `globalMetrics { key data }`. It returned `null` without errors for two sampled 2026 official-task runs. | Potential event-window and whole-run metrics; coverage, `data` shape, units and interpretation remain unknown. Do not treat null as an empty report. |
| `AimlabTask.style`, `duration` | `style` was `Standard` for sampled tasks. `duration` was `null` for an older Revosect task and `60` for a 2026 official task. | Public task duration can save package decoding for some tasks, but older tasks require another source. Unit is plausibly seconds, not established by this field alone. |
| `AimlabProfile.latestPlays(app:App!)` | Public, returned three recent plays in one sample. It disagreed with `latestPlay` on `replayAvailable` for the same play. | Convenient preview only; use cursor-paged `latestPlay` for history and validate replay separately. |
| `benchmarkSeasons` and profile `benchmarkPerformance(input:BenchmarkPerformanceInput!)` | Public in bounded probes; season task configurations and a sampled player progression returned. | Official Aimlabs benchmark data. Keep its identity separate from archived Revosect and Voltaic sets. |
| Profile `eventpass`, `xboxProfile`, `psProfile`; root `eventpasses`, `plan`, `plans` | Names and object types validated. `eventpasses` returned HTTP 401; console profiles were null for the sampled account. Plan catalog and per-user event progress were not executed. | Other platform and event data are possible, but public coverage remains unverified. |

The scan was targeted, not an exhaustive reconstruction of the current schema. In particular, public GraphQL introspection is blocked and candidate validation can miss fields whose names were not tried. The new Athena names are discovery leads; the two nullable metric responses and unresolved insight range are insufficient evidence for a user feature.

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

Send a JSON body `{"query":"...","variables":{...}}` as `POST` with `Content-Type: application/json` to `https://api.aimlab.gg/graphql`. Small pages and a delay between requests were used during this inventory; one prior unpaced request received a rate-limit response asking for a seven-second wait. Keep signed URLs and raw responses out of committed fixtures.

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
