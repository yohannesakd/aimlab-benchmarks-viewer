import { SITE_ORIGIN } from '../../shared/seo.js';

let client;

function redactedUrl(value) {
  try {
    const url = new URL(value);
    const path = url.pathname.replace(/^(\/api\/profiles\/)[^/]+(?=\/|$)/, '$1:username');
    return `${url.origin}${path}`;
  } catch { return null; }
}

function redactedLogText(value) {
  let text = String(value)
    .replace(/https?:\/\/[^\s"'<>]+/g, url => redactedUrl(url) || '[redacted URL]')
    .replace(/\b(?:ph[acpx]_)[A-Za-z0-9_-]+\b/g, '[redacted token]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted email]')
    .replace(/((?:password|secret|token|authorization|cookie|api[_-]?key)["']?\s*[:=]\s*)[^\s,;}]+/gi, '$1[redacted]');
  for (const input of document.querySelectorAll('input, textarea, [contenteditable="true"]')) {
    const value = input.value || input.textContent;
    if (value) text = text.split(value).join('[redacted input]');
  }
  return text;
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
    if (!config.enabled || config.environment !== 'production'
      || location.origin !== SITE_ORIGIN || navigator.webdriver) return;
    const { default: posthog } = await import('posthog-js');
    client = posthog.init(config.token, {
      api_host: config.host, ui_host: config.uiHost, defaults: '2026-05-30',
      autocapture: {
        element_attribute_ignorelist: ['value', 'href'],
        css_selector_ignorelist: ['input', 'textarea', '[contenteditable="true"]', '.ph-no-autocapture', '[data-ph-no-autocapture]'],
      },
      capture_pageview: false, capture_pageleave: true,
      capture_heatmaps: true, capture_dead_clicks: true, rageclick: true,
      capture_exceptions: true, capture_performance: { web_vitals: true },
      person_profiles: 'identified_only',
      logs: {
        captureConsoleLogs: true, serviceName: 'aimlab-web', environment: config.environment,
        maxBufferSize: 100, maxLogsPerInterval: 100, flushIntervalMs: 3000,
        beforeSend(record) {
          return {
            ...record, body: redactedLogText(record.body),
            attributes: Object.fromEntries(Object.entries(record.attributes || {}).map(([key, value]) => [
              key, /password|secret|token|authorization|cookie|api[_-]?key/i.test(key)
                ? '[redacted]' : typeof value === 'string' ? redactedLogText(value) : value,
            ])),
          };
        },
      },
      session_recording: {
        maskAllInputs: true, recordHeaders: false, recordBody: false,
        maskCapturedNetworkRequestFn(request) {
          const name = redactedUrl(request.name);
          return name ? { ...request, name } : null;
        },
      },
      enable_recording_console_log: false, disable_surveys: false,
      before_send(event) {
        const heatmap = event?.properties?.$heatmap_data;
        if (heatmap) {
          const pages = {};
          for (const [url, points] of Object.entries(heatmap)) {
            const page = redactedUrl(url);
            if (page) (pages[page] ||= []).push(...points);
          }
          event.properties.$heatmap_data = pages;
        }
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
      if (to.path !== from.path) {
        client.capture('$pageleave', pageProperties(from));
        client.capture('$pageview', pageProperties(to));
      }
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
