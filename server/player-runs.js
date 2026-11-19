export const runFields = `              id score startedAt endedAt mode convertedMode taskVersion weaponName gridshieldStatus
              manifest {
                taskName weaponId taskVersion duration pauseDuration inputDevice
                appVersion analyticsVersion replayAvailable performanceData
              }
`;

function reportedMetrics(data) {
  const keys = [
    "hitsTotal", "shotsTotal", "missesTotal", "killTotal", "targetsTotal",
    "headshots", "bodyshots", "damageTotal", "accTotal", "avgDist", "timePerKill",
  ];
  const metrics = {};
  for (const key of keys) {
    if (typeof data?.[key] === "number" && Number.isFinite(data[key])) metrics[key] = data[key];
  }
  return metrics;
}

/** @returns {import('./api-contracts.js').PublicRun} */
export function publicRun(play) {
  return {
    id: play.id,
    score: play.score,
    startedAt: play.startedAt,
    endedAt: play.endedAt,
    mode: play.mode,
    convertedMode: play.convertedMode,
    taskVersion: play.taskVersion ?? play.manifest.taskVersion,
    weaponId: play.manifest.weaponId,
    weaponName: play.weaponName,
    gridshieldStatus: play.gridshieldStatus,
    duration: play.manifest.duration,
    pauseDuration: play.manifest.pauseDuration,
    inputDevice: play.manifest.inputDevice,
    appVersion: play.manifest.appVersion,
    analyticsVersion: play.manifest.analyticsVersion,
    replayAvailable: play.manifest.replayAvailable,
    metrics: reportedMetrics(play.manifest.performanceData),
  };
}

export const runHistoryUnavailableMessage = "Aimlabs no longer provides public run history.";

// Aimlabs removed anonymous per-task run history, so the endpoint answers without a provider read.
export function handlePlayerRunsRequest(_request, response, pathname) {
  if (!/^\/api\/profiles\/[^/]+\/tasks\/[^/]+\/runs$/.test(pathname)) return false;
  response.writeHead(410, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=3600" });
  response.end(JSON.stringify({ error: runHistoryUnavailableMessage }));
  return true;
}
