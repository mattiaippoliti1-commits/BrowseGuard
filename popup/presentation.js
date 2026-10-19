/** Presentation only: consumes engine levels/reasons, never recalculates thresholds. */
(function (root) {
    const dimensions = ['security', 'privacy', 'network'];
    const states = {
        good: { icon: '✓', label: 'Low' },
        attention: { icon: '!', label: 'Moderate' },
        significant: { icon: '!', label: 'High' },
        unknown: { icon: '?', label: '—' }
    };
    const levels = {
        security: { 'no-major-issues': 'good', observations: 'attention', attention: 'significant' },
        privacy: { 'low-activity': 'good', 'moderate-activity': 'attention', 'elevated-activity': 'significant' },
        network: { 'low-third-party-activity': 'good', 'moderate-third-party-activity': 'attention', 'high-third-party-activity': 'significant' }
    };
    const sources = {
        security: ['urlAnalysis', 'pageAnalysis', 'webSecurity'],
        privacy: ['networkActivity', 'runtimePrivacy'],
        network: ['networkActivity']
    };
    const sourceLabels = {
        urlAnalysis: 'page address', pageAnalysis: 'page content', webSecurity: 'security response data',
        networkActivity: 'network activity', runtimePrivacy: 'runtime privacy activity'
    };
    // Shared factual explanations, also used by the contextual glossary.
    const glossary = {
        Tracker: 'A service associated with analytics, advertising, or personalization that may collect information about website interactions. A domain match alone does not prove tracking.',
        HTTPS: 'Encrypts the connection between your browser and the website. It does not establish whether the website is trustworthy.',
        'Content Security Policy': 'A browser security mechanism that lets websites restrict which resources can load or execute.',
        HSTS: 'A policy advertised by a website that tells browsers to use HTTPS for future connections.',
        'Mixed content': 'Resources requested over an unencrypted HTTP connection from an HTTPS page. The browser may block these requests.',
        'Third-party request': 'A request to a different registrable domain. It may belong to the same organization; external and unknown organizations are assessed separately.',
        'Security header': 'Information in a website response that can instruct the browser to apply security protections.',
        'Network activity': 'Requests observed while a page loads or runs. High activity alone does not establish malicious behavior.'
    };
    // Observation, possible implication, proportionate action, glossary reference.
    const explanations = {
        'main-page-http': ['The page uses an unencrypted HTTP connection.', 'Information sent over this connection may be read or changed in transit.', 'Use an HTTPS version if available before entering sensitive information.', 'HTTPS'],
        'mixed-content': ['The HTTPS page requested resources over HTTP.', 'These requests lack connection encryption and may be blocked by the browser.', 'Check browser connection warnings before sharing sensitive information.', 'Mixed content'],
        'insecure-password-forms': ['A password form targets an HTTP address.', 'A submitted password could travel over an unencrypted connection.', 'Avoid submitting a password through this form; check for an HTTPS sign-in page.', 'HTTPS'],
        'external-password-forms': ['A password form targets another website origin.', 'This can be part of a sign-in service, but the destination will receive the submission.', 'Check that the sign-in destination is the service you intended to use.'],
        'csp-missing': ['No enforced Content Security Policy header was observed.', 'This browser protection was not observed in the analyzed response. Its absence alone does not establish a vulnerability.', null, 'Content Security Policy'],
        'csp-report-only': ['The observed Content Security Policy only reports violations.', 'Reporting does not enforce the restrictions in that policy.', null, 'Content Security Policy'],
        'csp-permissive-observations': ['The observed Content Security Policy contains potentially permissive rules.', 'Some rules may allow a wider range of resources or scripts.', null, 'Content Security Policy'],
        'hsts-missing': ['The HTTPS response did not advertise an HSTS policy.', 'Future connections may not be forced to HTTPS by this header. Absence alone does not establish a vulnerability.', null, 'HSTS'],
        'known-trackers': ['Connections to tracking-associated domains were observed.', 'These services may support analytics, advertising, or personalization. A domain match does not prove an individual request tracked you.', 'Review the website privacy choices and your browser tracking protection options.', 'Tracker'],
        'multiple-runtime-privacy-indicators': ['Multiple sensitive API surfaces were observed on this page.', 'Canvas readback, WebGL hardware queries, or offline audio can help distinguish devices. Page-level co-occurrence does not establish a shared script, purpose, or fingerprinting.', 'Review website privacy choices and browser privacy controls.'],
        'runtime-privacy-api-usage': ['Access to browser or device information was observed.', 'Websites may use this information for normal features or to distinguish devices; intent cannot be established from access alone.'],
        'third-party-network-activity': ['The observed request composition was analyzed.', 'These connections may support page features or share request information with other services. Volume alone does not establish harmful behavior.', null, 'Third-party request'],
        'unknown-network-attribution': ['Some cross-origin requests have unresolved entity attribution.', 'These requests are neither confirmed first-party nor confirmed external exposure; the Network level covers confirmed attribution only.'],
        'http-iframe-on-https-page': ['An HTTP embedded page was observed inside an HTTPS page.', 'This embedded connection is unencrypted and may be blocked by the browser.', null, 'Mixed content'],
        'mismatched-link-destinations': ['Some visible link addresses differ from their destinations.', 'Links can redirect legitimately; visible text alone may not identify where you will go.', 'Check the destination shown by your browser before opening an unexpected link.']
    };
    /** Presentation availability only. Never reclassifies a request or changes engine levels.
     * A Low lower-bound assessment is inconclusive when >=5 cross-origin requests
     * are unresolved and they exceed half of observed cross-origin requests.
     * Confirmed Moderate/High findings remain meaningful lower bounds.
     */
    function networkAttribution(assessment, activity) {
        const result = assessment?.network;
        const composition = result?.reasons?.find(reason => reason.id === 'third-party-network-activity')?.evidence;
        const unresolved = result?.reasons?.find(reason => reason.id === 'unknown-network-attribution')?.evidence;
        const data = activity || composition;
        const count = value => Number.isFinite(value) && value >= 0 ? value : null;
        const crossOrigin = count(data?.thirdPartyRequests);
        const external = count(data?.externalThirdPartyRequests);
        const sameEntity = count(data?.sameEntityThirdPartyRequests);
        const unknown = count(data?.unknownThirdPartyRequests) ?? count(unresolved?.unknownThirdPartyRequests) ??
            (crossOrigin === null ? 0 : Math.max(0, crossOrigin - (external || 0) - (sameEntity || 0)));
        const unknownShare = crossOrigin > 0 ? unknown / crossOrigin : unknown > 0 ? 1 : 0;
        const sourceMissing = (activity != null && (!Number.isFinite(activity.totalRequests) || activity.totalRequests < 0)) ||
            activity?.available === false || assessment?.missingSources?.includes('networkActivity') ||
            result?.reasons?.some(reason => reason.id === 'network-data-unavailable');
        const poorCoverage = unknown >= 5 && unknownShare > 0.5;
        const confirmedFinding = ['moderate-third-party-activity', 'high-third-party-activity'].includes(result?.level);
        const insufficient = Boolean(sourceMissing || (poorCoverage && !confirmedFinding));
        const explanation = sourceMissing ? 'Network activity has not been collected for this page.' : poorCoverage ?
            `Ownership could not be determined for ${unknown} of ${crossOrigin ?? unknown} cross-origin requests. ` +
            (confirmedFinding ? 'The level reflects confirmed external exposure; actual exposure may be greater.' :
                'Network exposure could not be assessed reliably from the available ownership data.') :
            unknown > 0 ? `${unknown} cross-origin requests have unresolved ownership. The level covers confirmed external exposure.` : '';
        return { insufficient, poorCoverage, unknown, external, sameEntity, crossOrigin, explanation,
            // A zero lower bound with unknown ownership must never look like confirmed zero exposure.
            externalMetric: sourceMissing || external === null || (external === 0 && unknown > 0) ? '—' : String(external) };
    }
    function present(assessment, activity) {
        const attribution = networkAttribution(assessment, activity);
        const missing = Array.isArray(assessment?.missingSources) ? assessment.missingSources : [];
        const cards = {};
        dimensions.forEach(dimension => {
            const result = assessment?.[dimension];
            const reasons = Array.isArray(result?.reasons) ? result.reasons : [];
            const findings = reasons.filter(reason => !/data-(incomplete|unavailable)$/.test(reason.id));
            const limited = (dimension === 'network' && attribution.insufficient) || !result || sources[dimension].some(source => missing.includes(source)) ||
                reasons.some(reason => /data-(incomplete|unavailable)$/.test(reason.id));
            let state = levels[dimension][result?.level] || 'unknown';
            // Missing evidence cannot become a positive result. Confirmed findings remain visible.
            if (limited && state === 'good') state = 'unknown';
            if (dimension === 'security' && limited && state === 'good') state = 'unknown';
            let description = 'The available information is insufficient to describe this category.';
            if (state !== 'unknown') {
                if (dimension === 'security') description = state === 'good' ?
                    'No major issues were detected in the security signals analyzed.' :
                    'Observed connection, page, or security configuration signals deserve review.';
                if (dimension === 'privacy') description = findings.some(r => r.id === 'known-trackers') ?
                    'Connections to services associated with tracking were observed.' : findings.length ?
                    'Browser or device information access was observed; this alone does not establish tracking.' :
                    'Low privacy-related activity was observed in the available signals.';
                if (dimension === 'network') description = state === 'good' ?
                    'Low exposure to confirmed external organizations was observed.' :
                    (state === 'significant' ? 'High' : 'Moderate') + ' exposure to confirmed external organizations was observed; this alone does not imply harmful activity.';
            }
            if (dimension === 'network' && attribution.explanation) description = attribution.insufficient ?
                attribution.explanation : description + ' ' + attribution.explanation;
            cards[dimension] = { state, ...states[state], description, limited, findings };
        });
        const values = Object.values(cards);
        const confirmed = dimensions.filter(d => ['attention', 'significant'].includes(cards[d].state));
        const incomplete = !assessment || assessment.dataStatus === 'partial' || values.some(c => c.limited || c.state === 'unknown');
        const state = values.some(c => c.state === 'significant') ? 'significant' : confirmed.length ? 'attention' : incomplete ? 'unknown' : 'good';
        const phrases = { security: 'security signals deserve review', privacy: 'privacy-related activity was observed', network: 'confirmed external network exposure deserves review' };
        const unresolved = assessment?.network?.reasons?.find(reason => reason.id === 'unknown-network-attribution');
        const attributionNote = unresolved ? 'Network attribution is unresolved for ' + unresolved.evidence.unknownThirdPartyRequests + ' cross-origin requests. Network levels cover confirmed external exposure.' : '';
        return {
            cards, state, icon: states[state].icon,
            title: state === 'unknown' ? 'Incomplete analysis' : states[state].label,
            description: confirmed.length ? confirmed.map(d => phrases[d]).join('; ') + '.' : incomplete ?
                'Some information could not be collected, so the results are incomplete.' :
                'No major issues were detected in the available technical signals.',
            limitation: [incomplete ? 'Some information is missing. Findings describe only the signals observed.' : '', attributionNote].filter(Boolean).join(' '),
            missing: missing.map(source => sourceLabels[source] || source).join(', ')
        };
    }
    function explain(reason) {
        const entry = explanations[reason.id];
        if (!entry) return { observation: reason.message, implication: null, action: null };
        let observation = entry[0];
        const count = reason.evidence?.trackerDomainCount;
        if (reason.id === 'known-trackers' && Number.isFinite(count) && count > 0) {
            observation = `Connections to ${count} tracking-associated ${count === 1 ? 'domain' : 'domains'} were observed.`;
        }
        return { observation, implication: entry[1], action: entry[2], term: entry[3] };
    }
    const api = { present, explain, glossary, dimensions, networkAttribution };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.BrowserGuardPresentation = api;
})(globalThis);
