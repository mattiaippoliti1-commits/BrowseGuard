/**
 * BrowserGuard tracker matching helpers.
 *
 * Matching is local and domain-bound: "example.com" matches "example.com" and
 * "sub.example.com", but not "notexample.com" or "example.com.evil.test".
 */

function createTrackerMatcher(trackerData) {

    const trackersByDomain = new Map();

    (trackerData.trackers || []).forEach(function (tracker) {
        const normalizedDomain = normalizeTrackerHostname(tracker.domain);

        if (!normalizedDomain) {
            return;
        }

        trackersByDomain.set(normalizedDomain, {
            domain: normalizedDomain,
            category: tracker.category || "Other"
        });
    });

    return {
        findTrackerMatch: function (hostname) {
            return findTrackerMatch(hostname, trackersByDomain);
        },
        size: trackersByDomain.size
    };

}

function findTrackerMatch(hostname, trackersByDomain) {

    const normalizedHostname = normalizeTrackerHostname(hostname);

    if (!normalizedHostname) {
        return null;
    }

    const hostnameParts = normalizedHostname.split(".");

    for (let index = 0; index < hostnameParts.length; index++) {
        const suffix = hostnameParts.slice(index).join(".");
        const tracker = trackersByDomain.get(suffix);

        if (tracker) {
            return {
                matchedDomain: tracker.domain,
                category: tracker.category
            };
        }
    }

    return null;

}

function normalizeTrackerHostname(hostname) {

    return String(hostname || "")
        .toLowerCase()
        .replace(/\.$/, "");

}

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        createTrackerMatcher: createTrackerMatcher,
        findTrackerMatch: findTrackerMatch,
        normalizeTrackerHostname: normalizeTrackerHostname
    };
} else {
    globalThis.BrowserGuardTrackerMatcher = {
        createTrackerMatcher: createTrackerMatcher,
        findTrackerMatch: findTrackerMatch,
        normalizeTrackerHostname: normalizeTrackerHostname
    };
}
