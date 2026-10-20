const securityHeaders = new Set(['content-security-policy', 'content-security-policy-report-only',
  'strict-transport-security', 'x-content-type-options', 'referrer-policy', 'permissions-policy', 'x-frame-options']);
function selectedHeaders(headers) {
  return Object.fromEntries(Object.entries(headers || {}).map(([k,v]) => [k.toLowerCase(), String(v)])
    .filter(([k]) => securityHeaders.has(k)));
}
async function independentCollector(context, page, maxRequests) {
  const session = await context.newCDPSession(page);
  const data = { source: 'Chrome DevTools Protocol Network events', startedAt: new Date().toISOString(),
    endedAt: null, totalRequests: 0, droppedRequests: 0, requests: [], responses: [], failures: [], errors: [] };
  let lastActivity = Date.now(); const { frameTree } = await session.send('Page.getFrameTree');
  const topFrameId = frameTree.frame.id;
  session.on('Network.requestWillBeSent', e => {
    if (!/^https?:/.test(e.request.url)) return;
    lastActivity = Date.now(); data.totalRequests++;
    if (data.requests.length >= maxRequests) { data.droppedRequests++; return; }
    data.requests.push({ requestId: e.requestId, url: e.request.url, hostname: new URL(e.request.url).hostname,
      type: e.type, frameId: e.frameId, topFrame: e.frameId === topFrameId, timestamp: e.timestamp,
      observedAt: new Date().toISOString(), redirect: Boolean(e.redirectResponse) });
    if (e.redirectResponse && data.responses.length < maxRequests) data.responses.push(response(e.redirectResponse, e, true));
  });
  function response(r, e, redirect = false) {
    return { requestId: e.requestId, url: r.url, status: r.status, type: e.type,
      topFrame: e.frameId === topFrameId, redirect, headers: selectedHeaders(r.headers),
      fromDiskCache: r.fromDiskCache || false, fromServiceWorker: r.fromServiceWorker || false,
      protocol: r.protocol, timestamp: e.timestamp, observedAt: new Date().toISOString() };
  }
  session.on('Network.responseReceived', e => {
    if (data.responses.length < maxRequests) data.responses.push(response(e.response, e));
  });
  session.on('Network.loadingFailed', e => {
    if (data.failures.length < maxRequests) data.failures.push({ requestId: e.requestId, error: e.errorText,
      type: e.type, blockedReason: e.blockedReason || null, canceled: e.canceled || false });
  });
  await session.send('Network.enable');
  return { data, async settle(config) {
    const start = Date.now(); let reason = 'maximum-observation-window';
    while (Date.now() - start < config.maxObserveMs) {
      if (Date.now() - start >= config.minObserveMs && Date.now() - lastActivity >= config.quietMs) { reason = 'quiet-window'; break; }
      await new Promise(r => setTimeout(r, 200));
    }
    data.settle = { reason, durationMs: Date.now() - start, semantics: 'Request-start quiet interval; not guaranteed network idle or complete page coverage.' };
  }, async stop() { data.endedAt = new Date().toISOString(); await session.detach().catch(e => data.errors.push(e.message)); } };
}
// Instrument only the popup: capture the original engine invocation without changing its inputs or output.
function capturePopupAssessment() {
  if (location.protocol !== 'chrome-extension:') return;
  Object.defineProperty(globalThis, 'BrowserGuardAssessmentEngine', {
    configurable: true,
    set(engine) {
      const original = engine.assessBrowserState;
      engine.assessBrowserState = function(snapshot) {
        const startedAt = new Date().toISOString();
        const inputs = JSON.parse(JSON.stringify(snapshot));
        const assessment = original.apply(this, arguments);
        globalThis.__browserguardTestCapture = { startedAt, endedAt: new Date().toISOString(), inputs,
          assessment: JSON.parse(JSON.stringify(assessment)) };
        return assessment;
      };
      Object.defineProperty(globalThis, 'BrowserGuardAssessmentEngine', { configurable: true, writable: true, value: engine });
    }
  });
}
async function extractPopup(context, worker, target, config) {
  const collectionStartedAt = new Date().toISOString();
  const popup = await context.newPage();
  const errors = [];
  popup.on('pageerror', e => errors.push(e.message));
  popup.on('console', e => { if (e.type() === 'error' && errors.length < 50) errors.push(e.text()); });
  try {
    await popup.addInitScript(capturePopupAssessment);
    // Keep the WEBSITE active in this worker's window. Loading the popup in a background
    // tab avoids changing getActiveTab() or mocking Chrome APIs.
    await target.bringToFront();
    const extensionId = new URL(worker.url()).host;
    await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`, { timeout: config.analysisTimeoutMs });
    await popup.waitForFunction(() => document.querySelector('.assessment-panel')?.getAttribute('aria-busy') === 'false',
      { }, { timeout: config.analysisTimeoutMs });
    const extracted = await popup.evaluate(() => ({
      capture: globalThis.__browserguardTestCapture || null,
      renderedAssessment: typeof currentAssessment === 'undefined' ? null : currentAssessment,
      displayed: Object.fromEntries(['security','privacy','network'].map(d => [d, {
        label: document.getElementById('assessment-' + d).textContent,
        state: document.querySelector(`[data-dimension="${d}"]`).dataset.state
      }])),
      activeTabQuery: typeof getActiveTab === 'function' ? null : 'Popup API missing'
    }));
    const tab = await popup.evaluate(async () => {
      const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
      return t ? { id: t.id, url: t.url } : null;
    });
    return { ...extracted.capture, renderedAssessment: extracted.renderedAssessment,
      displayed: extracted.displayed, activeTab: tab, errors,
      collectionWindow: { startedAt: collectionStartedAt, endedAt: new Date().toISOString(),
        note: "Popup loading and sequential snapshot requests; engine timestamps describe the final assessment call only." },
      method: 'Original engine call captured in actual popup; website kept active; no synthetic snapshots.' };
  } finally { await popup.close().catch(() => {}); }
}
module.exports = { selectedHeaders, independentCollector, capturePopupAssessment, extractPopup };
