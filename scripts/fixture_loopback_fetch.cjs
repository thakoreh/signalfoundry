// Node preload for isolated, loopback-only integration fixtures.
// Next's development updater must use its intended offline/unknown fallback,
// rather than delaying real proxy assertions on an unbounded registry request.
// This is loaded only by the test child, never by the app launcher or build.
const originalFetch = globalThis.fetch;
globalThis.fetch = function offlineFixtureFetch(input, options) {
  let url;
  try {
    url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  } catch {
    return Promise.reject(new Error('Offline integration fixture permits loopback HTTP fetch only.'));
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    return Promise.reject(new Error('Offline integration fixture permits loopback HTTP fetch only.'));
  }
  return originalFetch.call(this, input, options);
};
