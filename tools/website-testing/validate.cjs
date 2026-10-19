const { isDeepStrictEqual } = require('node:util');
const { assessBrowserState, ASSESSMENT_THRESHOLDS: thresholds } = require('../../modules/assessment/assessment-engine.js');
const { present } = require('../../popup/presentation.js');
const dimensions = ['security', 'privacy', 'network'];
const available = v => v && v.available !== false;
function validate(record) {
  const anomalies = [];
  const add = (code, evidence, priority = 'review') => anomalies.push({ code, priority,
    classification: 'potential-anomaly', evidence,
    investigation: investigations[code] || 'Reproduce in a fresh profile and inspect the saved record before attributing this to BrowserGuard.' });
  if (record.navigation?.error) add('navigation_failure', { error: record.navigation.error }, 'environment');
  if (record.navigation?.blocked) add('access_restriction', record.navigation.blocked, 'environment');
  if (record.collectionError) add('collection_failure', { error: record.collectionError }, 'high');
  if (record.extension?.errors?.length) add('extension_console_errors', { messages: record.extension.errors });
  const inputs = record.extension?.inputs;
  if (!inputs || !record.extension?.assessment) {
    add('missing_analysis', { capturedInputs: Boolean(inputs), capturedAssessment: Boolean(record.extension?.assessment) }, 'high');
    return anomalies;
  }
  const missing = ['urlAnalysis','pageAnalysis','networkActivity','runtimePrivacy','webSecurity'].filter(k => !available(inputs[k]));
  if (missing.length) add('missing_sources', { sources: missing });
  function walk(v, path) {
    if (typeof v === 'number' && (!Number.isFinite(v) || v < 0 || !Number.isInteger(v))) add('invalid_metric', { path, value: v }, 'high');
    else if (v && typeof v === 'object') for (const [k, val] of Object.entries(v)) {
      // Dataset metadata can include prevalence fractions: validate actual snapshot counters only.
      if (!['trackerDataset','headers'].includes(k)) walk(val, path + '.' + k);
    }
  }
  for (const k of ['pageAnalysis','networkActivity','runtimePrivacy','webSecurity']) if (available(inputs[k])) walk(inputs[k], k);
  const n = inputs.networkActivity;
  function equalCount(code, actual, expected, evidence) {
    if (Number.isFinite(actual) && Number.isFinite(expected) && actual !== expected) add(code, { actual, expected, ...evidence }, 'high');
  }
  if (available(n)) {
    for (const key of ['totalRequests','firstPartyRequests','thirdPartyRequests','trackerRequests','trackerDomainCount']) {
      if (!Number.isSafeInteger(n[key]) || n[key] < 0) add('invalid_metric', { path: 'networkActivity.' + key, value: n[key] ?? null }, 'high');
    }
    equalCount('request_partition', n.totalRequests, n.firstPartyRequests + n.thirdPartyRequests, { firstParty: n.firstPartyRequests, crossOrigin: n.thirdPartyRequests });
    equalCount('entity_partition', n.thirdPartyRequests, n.sameEntityThirdPartyRequests + n.externalThirdPartyRequests + n.unknownThirdPartyRequests,
      { sameEntity: n.sameEntityThirdPartyRequests, external: n.externalThirdPartyRequests, unknown: n.unknownThirdPartyRequests });
    const sum = list => list.reduce((s, v) => s + v, 0);
    equalCount('resource_type_sum', n.totalRequests, sum(Object.values(n.resourceTypes || {})), {});
    for (const [list, count, total] of [['thirdPartyDomains','thirdPartyDomainCount','thirdPartyRequests'],
      ['trackerDomains','trackerDomainCount','trackerRequests'], ['sameEntityThirdPartyDomains','sameEntityThirdPartyDomainCount','sameEntityThirdPartyRequests'],
      ['externalThirdPartyDomains','externalThirdPartyDomainCount','externalThirdPartyRequests'], ['unknownThirdPartyDomains','unknownThirdPartyDomainCount','unknownThirdPartyRequests']]) {
      if (!Array.isArray(n[list])) { add('missing_metric_list', { list }); continue; }
      equalCount('domain_count', n[count], n[list].length, { list, count });
      equalCount('domain_request_sum', n[total], sum(n[list].map(d => d.requestCount)), { list, total });
      for (const domain of n[list]) if (domain.types) equalCount('domain_resource_sum', domain.requestCount, sum(Object.values(domain.types)), { hostname: domain.hostname });
    }
    if (n.trackerRequests > n.thirdPartyRequests || n.trackerDomainCount > n.thirdPartyDomainCount)
      add('tracker_subset', { trackerRequests: n.trackerRequests, crossOriginRequests: n.thirdPartyRequests,
        trackerDomains: n.trackerDomainCount, crossOriginDomains: n.thirdPartyDomainCount }, 'high');
    for (const t of n.trackerDomains || []) if (typeof t.hostname !== 'string' || typeof t.matchedDomain !== 'string' ||
      !(t.hostname === t.matchedDomain || t.hostname.endsWith('.' + t.matchedDomain))) add('tracker_domain_boundary', t, 'high');
    for (const d of n.thirdPartyDomains || []) if (!['same-entity-third-party','external-third-party','unknown-third-party'].includes(d.entityRelationship))
      add('unexpected_entity_classification', d, 'high');
  }
  const page = inputs.pageAnalysis;
  if (available(page)) for (const [subset, total] of [['externalForms','formCount'],['externalPasswordForms','externalForms'],
    ['insecurePasswordForms','formCount'],['externalLinks','totalLinks'],['mismatchedLinks','totalLinks'],
    ['suspiciousMismatchedLinks','mismatchedLinks'],['hiddenIframeCount','iframeCount'],['sandboxedIframeCount','iframeCount'],
    ['thirdPartyIframeCount','iframeCount'],['thirdPartyUnsandboxedIframeCount','thirdPartyIframeCount'],['httpsPageHttpIframeCount','iframeCount']]) {
    if (Number.isFinite(page[subset]) && Number.isFinite(page[total]) && page[subset]>page[total])
      add('dom_subset', { subset, value:page[subset], total, totalValue:page[total] }, 'high');
  }
  const runtime = inputs.runtimePrivacy;
  if (available(runtime)) {
    const detected = Object.values(runtime.categories || {}).filter(c=>c.detected).length;
    equalCount('runtime_category_count',runtime.detectedCategoryCount,detected,{});
    for (const [category,value] of Object.entries(runtime.categories || {}))
      if (typeof value.detected==='boolean' && Number.isFinite(value.eventCount) && value.detected !== (value.eventCount>0))
        add('runtime_detected_contract',{category,value},'high');
  }
  const assessment = record.extension.assessment;
  // Exact replay is an integration/determinism check, not an independent oracle for rule correctness.
  const replay = assessBrowserState(structuredClone(inputs));
  if (!isDeepStrictEqual(replay, assessment)) add('engine_replay_mismatch', { captured: assessment, replay }, 'high');
  if (!isDeepStrictEqual(record.extension.renderedAssessment, assessment)) add('rendered_assessment_mismatch',
    { captured: assessment, rendered: record.extension.renderedAssessment }, 'high');
  const view = present(assessment, n);
  for (const d of dimensions) if (record.extension.displayed?.[d]?.label !== view.cards[d].label ||
      record.extension.displayed?.[d]?.state !== view.cards[d].state) add('presentation_mismatch',
      { dimension: d, displayed: record.extension.displayed?.[d], expected: view.cards[d] }, 'high');
  if (!isDeepStrictEqual(missing, assessment.missingSources)) add('missing_source_contract', { expected: missing, actual: assessment.missingSources }, 'high');
  const reasons = assessment.security?.reasons || [];
  const expectedSecurity = reasons.some(r => r.severity === 'high') ? 'attention' : reasons.some(r => r.severity === 'medium') ? 'observations' : 'no-major-issues';
  if (assessment.security?.level !== expectedSecurity) add('security_rule_contract', { expectedSecurity, actual: assessment.security?.level, reasons }, 'high');
  if (available(inputs.urlAnalysis) && inputs.urlAnalysis.usesHTTPS === false && assessment.security?.level !== 'attention')
    add('http_security_rule', { usesHTTPS: false, actual: assessment.security?.level }, 'high');
  // Independent declarative Privacy combination check, using only available raw observations.
  const p = thresholds.privacy, nn = available(n) ? n : {}, rr = available(runtime) ? runtime : {};
  const domains = nn.trackerDomainCount || 0, requests = nn.trackerRequests || 0;
  const elevated = domains>=p.elevatedTrackerDomains || (requests>=p.elevatedTrackerRequests && domains>=p.elevatedTrackerRequestMinimumDomains);
  const moderateTracker = domains>=p.moderateTrackerDomains || requests>=p.moderateTrackerRequests;
  const has = (category, names) => (rr.categories?.[category]?.details || []).some(detail => typeof detail === 'string' && names.some(name => detail.split(':').includes(name)));
  const sensitiveCount = [has('canvas',['toDataURL','toBlob','getImageData']),
    has('webgl',['UNMASKED_RENDERER_WEBGL','UNMASKED_VENDOR_WEBGL']),has('audio',['OfflineAudioContext'])].filter(Boolean).length;
  const correlated = sensitiveCount>=p.correlatedRuntimeSurfaces;
  const privacyExpected = elevated || (moderateTracker && correlated) ? 'elevated-activity' : moderateTracker || correlated ? 'moderate-activity' : 'low-activity';
  if (assessment.privacy?.level!==privacyExpected) add('privacy_rule_contract', { domains, requests, sensitiveCount,
    expected:privacyExpected, actual:assessment.privacy?.level },'high');
  // Declarative Network rule oracle reads the production constants without changing them.
  if (available(n) && n.totalRequests > 0) {
    const t = thresholds.network, count = n.externalThirdPartyRequests || 0, domains = n.externalThirdPartyDomainCount || 0, ratio = count / n.totalRequests;
    const high = (ratio >= t.highThirdPartyRatio && count >= t.highThirdPartyRatioMinimumRequests) ||
      (domains >= t.highThirdPartyDomains && (count >= t.highThirdPartyDomainsMinimumRequests || n.totalRequests >= t.highThirdPartyDomainsMinimumTotalRequests)) ||
      (count >= t.highThirdPartyRequests && ratio >= t.moderateThirdPartyRatio);
    const moderate = (ratio >= t.moderateThirdPartyRatio && count >= t.moderateRatioMinimumRequests) ||
      (domains >= t.moderateThirdPartyDomains && count >= t.moderateRatioMinimumRequests) ||
      (count >= t.moderateThirdPartyRequests && ratio >= t.moderateVolumeMinimumRatio);
    const expected = high ? 'high-third-party-activity' : moderate ? 'moderate-third-party-activity' : 'low-third-party-activity';
    if (assessment.network?.level !== expected) add('network_rule_contract', { count, domains, ratio, expected, actual: assessment.network?.level }, 'high');
  }
  const finalUrl = record.navigation?.finalUrl;
  const workerUrl = n?.pageUrl;
  if (workerUrl && finalUrl && workerUrl.split('#')[0] !== finalUrl.split('#')[0]) add('document_identity_mismatch', { workerUrl, finalUrl });
  if (record.extension.activeTab?.url && finalUrl && record.extension.activeTab.url !== finalUrl) add('active_tab_mismatch', { activeTab: record.extension.activeTab, finalUrl }, 'high');
  const response = [...(record.independent?.responses || [])].reverse().find(r => r.topFrame && r.type === 'Document' && !r.redirect && r.url === finalUrl);
  if (response && available(inputs.webSecurity)) {
    const h = inputs.webSecurity.headers;
    for (const [header, key] of [['content-security-policy','csp'],['strict-transport-security','hsts'],['x-content-type-options','contentTypeOptions'],
      ['referrer-policy','referrerPolicy'],['permissions-policy','permissionsPolicy']]) {
      const expectedPresence = Boolean(response.headers[header]);
      if (h?.[key]?.present !== expectedPresence) add('header_presence_difference', { header,
        url: response.url, cdpPresent: expectedPresence, extension: h?.[key], cdpResponse: response,
        caveat: 'Independent observations; redirects, cache, navigation timing, and sequential snapshot windows can differ.' });
    }
    if (inputs.webSecurity.https?.enabled !== finalUrl.startsWith('https:')) add('https_difference', { finalUrl, extensionHTTPS: inputs.webSecurity.https });
  }
  // Request counts are deliberately not asserted equal across observation windows.
  return anomalies;
}
const investigations = {
  navigation_failure: 'Check DNS/TLS/connectivity and the HTTP status. Do not bypass authentication, CAPTCHAs, or access restrictions.',
  access_restriction: 'Record as blocked; do not solve challenges, log in, retry rate limits, or use stealth tooling.',
  header_presence_difference: 'Compare the final main-document CDP response and worker page URL; inspect redirects/cache before treating this as a detection defect.',
  missing_sources: 'Check content-script timing, the runtime bridge, supported URLs, and the saved popup errors.',
  engine_replay_mismatch: 'Replay the saved input with the exact recorded source fingerprint; distinguish version drift from nondeterminism.',
  request_partition: 'Inspect the single worker snapshot; its first-party and cross-origin counters should partition its total.',
  document_identity_mismatch: 'Inspect redirects and same-document URL changes; worker resets and popup snapshots are asynchronous.'
};
module.exports = { validate, investigations };
