/**
 * BrowserGuard Runtime Privacy Bridge
 *
 * This content script runs in the isolated world. It receives schema-limited
 * events from the MAIN world monitor and forwards validated events to the
 * extension background service worker.
 */

(function () {

    const eventName = "BrowserGuardRuntimePrivacyEvent";
    const allowedEvents = {
        canvas: new Set([
            "toDataURL",
            "toBlob",
            "getImageData"
        ]),
        webgl: new Set([
            "getParameter",
            "getExtension"
        ]),
        audio: new Set([
            "AudioContext",
            "OfflineAudioContext"
        ]),
        navigator: new Set([
            "hardwareConcurrency",
            "deviceMemory",
            "languages",
            "platform",
            "userAgent",
            "maxTouchPoints"
        ]),
        screen: new Set([
            "width",
            "height",
            "availWidth",
            "availHeight",
            "colorDepth",
            "pixelDepth"
        ])
    };

    const allowedDetails = new Set([
        "",
        "getParameter",
        "UNMASKED_VENDOR_WEBGL",
        "UNMASKED_RENDERER_WEBGL",
        "WEBGL_debug_renderer_info"
    ]);

    window.addEventListener(eventName, function (event) {

        const sanitizedEvent = sanitizeRuntimeEvent(event.detail);

        if (!sanitizedEvent) {
            return;
        }

        chrome.runtime.sendMessage({
            type: "RUNTIME_PRIVACY_EVENT",
            event: sanitizedEvent
        }).catch(function () {
            // The tab may be navigating while an event is delivered.
        });

    });

    function sanitizeRuntimeEvent(detail) {

        if (!detail || typeof detail !== "object") {
            return null;
        }

        const category = sanitizeToken(detail.category);
        const api = sanitizeToken(detail.api);
        const eventDetail = sanitizeDetail(detail.detail);

        if (!category || !api || !allowedEvents[category]) {
            return null;
        }

        if (!allowedEvents[category].has(api)) {
            return null;
        }

        if (!allowedDetails.has(eventDetail)) {
            return {
                category: category,
                api: api,
                detail: ""
            };
        }

        return {
            category: category,
            api: api,
            detail: eventDetail
        };

    }

    function sanitizeToken(value) {

        if (typeof value !== "string") {
            return "";
        }

        if (!/^[A-Za-z0-9_]+$/.test(value) || value.length > 40) {
            return "";
        }

        return value;

    }

    function sanitizeDetail(value) {

        if (typeof value !== "string") {
            return "";
        }

        if (!/^[A-Za-z0-9_]+$/.test(value) || value.length > 64) {
            return "";
        }

        return value;

    }

})();
