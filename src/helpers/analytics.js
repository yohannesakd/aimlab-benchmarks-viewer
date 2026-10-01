let client;

function redactedUrl(value) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch { return null; }
}

function pageProperties(route) {
  return {
    page_route: route.matched.at(-1)?.path || route.path,
    $current_url: `${location.origin}${route.path}`,
    $pathname: route.path,
    ...(route.query.benchmark ? { benchmark: route.query.benchmark } : {}),
    ...(route.query.level ? { difficulty: route.query.level } : {}),
  };
}

export async function initAnalytics(router, app) {
  try {
    const response = await fetch('/api/telemetry/config', { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return;
    const config = await response.json();
    if (!config.enabled) return;
    const { default: posthog } = await import('posthog-js');
    client = posthog.init(config.token, {
      api_host: config.host, defaults: '2026-05-30',
      autocapture: false, capture_pageview: false, capture_pageleave: false,
      capture_exceptions: true, capture_performance: { web_vitals: true },
      person_profiles: 'identified_only',
      session_recording: {
        maskAllInputs: true, recordHeaders: false, recordBody: false,
        maskCapturedNetworkRequestFn(request) {
          const name = redactedUrl(request.name);
          return name ? { ...request, name } : null;
        },
      },
      enable_recording_console_log: false, disable_surveys: true,
      advanced_feature_flags_polling_interval: 0,
      before_send(event) {
        for (const properties of [event?.properties, event?.properties?.$set, event?.properties?.$set_once, event?.$set, event?.$set_once]) {
          if (!properties) continue;
          for (const key of ['$current_url', '$referrer', '$initial_current_url', '$initial_referrer', '$session_entry_url', '$session_entry_referrer']) {
            if (!properties[key]) continue;
            const value = redactedUrl(properties[key]);
            if (value) properties[key] = value;
            else delete properties[key];
          }
        }
        return event;
      },
    });
    client.register({ environment: config.environment });
    const previousErrorHandler = app.config.errorHandler;
    app.config.errorHandler = (error, instance, info) => {
      client.captureException(error, { vue_info: info });
      if (previousErrorHandler) previousErrorHandler(error, instance, info);
      else console.error(error);
    };
    await router.isReady();
    client.capture('$pageview', pageProperties(router.currentRoute.value));
    router.afterEach((to, from, failure) => {
      if (failure) return;
      if (to.path !== from.path) client.capture('$pageview', pageProperties(to));
      if (to.query.benchmark !== from.query.benchmark || to.query.level !== from.query.level) {
        captureEvent('benchmark_selection', pageProperties(to));
      }
      if (to.query.sort !== from.query.sort || to.query.view !== from.query.view || to.query.page !== from.query.page) {
        captureEvent('leaderboard_selection', { ...pageProperties(to), sort: to.query.sort, view: to.query.view, page: to.query.page || 1 });
      }
    });
  } catch (error) {
    console.warn('Analytics could not initialize', error);
  }
}

export function captureEvent(event, properties = {}) {
  client?.capture(event, properties);
}

export function analyticsHeaders() {
  if (!client) return {};
  return { 'X-PostHog-Distinct-ID': client.get_distinct_id(), 'X-PostHog-Session-ID': client.get_session_id() };
}
