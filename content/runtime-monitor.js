/**
 * BrowserGuard Runtime Privacy Monitor
 *
 * This script runs in the page MAIN world so it can observe selected API calls
 * made by page scripts. It reports only API/property names, never values.
 */

(function () {

    const eventName = "BrowserGuardRuntimePrivacyEvent";
    const reportedKeys = new Set();
    const maxReportsPerPage = 128;
    let reportCount = 0;

    function report(category, api, detail) {

        if (!category || !api || reportCount >= maxReportsPerPage) {
            return;
        }

        const key = category + ":" + api + ":" + (detail || "");

        if (reportedKeys.has(key)) {
            return;
        }

        reportedKeys.add(key);
        reportCount++;

        window.dispatchEvent(new CustomEvent(eventName, {
            detail: {
                category: category,
                api: api,
                detail: detail || ""
            }
        }));

    }

    function wrapMethod(prototype, methodName, category, api, detailProvider) {

        if (!prototype || typeof prototype[methodName] !== "function") {
            return;
        }

        const original = prototype[methodName];

        if (original.browserGuardWrapped) {
            return;
        }

        const wrapped = function (...args) {
            const detail = typeof detailProvider === "function" ?
                detailProvider.call(this, args) :
                "";

            report(category, api, detail);

            return original.apply(this, args);
        };

        try {
            Object.defineProperty(wrapped, "browserGuardWrapped", {
                value: true
            });

            Object.defineProperty(prototype, methodName, {
                value: wrapped,
                writable: true,
                configurable: true
            });
        } catch (error) {
            // Some environments may expose non-configurable APIs.
        }

    }

    function wrapConstructor(globalName, category, api) {

        const OriginalConstructor = window[globalName];

        if (typeof OriginalConstructor !== "function") {
            return;
        }

        const WrappedConstructor = function (...args) {
            report(category, api, "");
            return Reflect.construct(
                OriginalConstructor,
                args,
                new.target || WrappedConstructor
            );
        };

        try {
            Object.setPrototypeOf(WrappedConstructor, OriginalConstructor);
            WrappedConstructor.prototype = OriginalConstructor.prototype;

            Object.defineProperty(window, globalName, {
                value: WrappedConstructor,
                writable: true,
                configurable: true
            });
        } catch (error) {
            // Leave the native constructor untouched when it cannot be wrapped.
        }

    }

    function wrapPrototypeGetter(prototype, propertyName, category) {

        if (!prototype) {
            return;
        }

        const descriptor = findPropertyDescriptor(prototype, propertyName);

        if (!descriptor || typeof descriptor.get !== "function") {
            return;
        }

        if (descriptor.get.browserGuardWrapped || descriptor.configurable === false) {
            return;
        }

        const originalGetter = descriptor.get;

        const wrappedGetter = function () {
            report(category, propertyName, "");
            return originalGetter.call(this);
        };

        try {
            Object.defineProperty(wrappedGetter, "browserGuardWrapped", {
                value: true
            });

            Object.defineProperty(descriptor.owner, propertyName, {
                get: wrappedGetter,
                set: descriptor.set,
                enumerable: descriptor.enumerable,
                configurable: descriptor.configurable
            });
        } catch (error) {
            // Some browser properties are intentionally not configurable.
        }

    }

    function findPropertyDescriptor(prototype, propertyName) {

        let current = prototype;

        while (current) {
            const descriptor =
                Object.getOwnPropertyDescriptor(current, propertyName);

            if (descriptor) {
                return {
                    ...descriptor,
                    owner: current
                };
            }

            current = Object.getPrototypeOf(current);
        }

        return null;

    }

    function getWebGLParameterName(args) {

        const parameter = args[0];
        const unmaskedVendorWebGL = 0x9245;
        const unmaskedRendererWebGL = 0x9246;

        if (
            parameter === unmaskedVendorWebGL ||
            parameter === unmaskedRendererWebGL
        ) {
            return parameter === unmaskedVendorWebGL ?
                "UNMASKED_VENDOR_WEBGL" :
                "UNMASKED_RENDERER_WEBGL";
        }

        return "getParameter";

    }

    function getExtensionName(args) {
        return String(args[0] || "");
    }

    wrapMethod(
        window.HTMLCanvasElement && window.HTMLCanvasElement.prototype,
        "toDataURL",
        "canvas",
        "toDataURL"
    );
    wrapMethod(
        window.HTMLCanvasElement && window.HTMLCanvasElement.prototype,
        "toBlob",
        "canvas",
        "toBlob"
    );
    wrapMethod(
        window.CanvasRenderingContext2D &&
            window.CanvasRenderingContext2D.prototype,
        "getImageData",
        "canvas",
        "getImageData"
    );

    wrapMethod(
        window.WebGLRenderingContext && window.WebGLRenderingContext.prototype,
        "getParameter",
        "webgl",
        "getParameter",
        getWebGLParameterName
    );
    wrapMethod(
        window.WebGL2RenderingContext && window.WebGL2RenderingContext.prototype,
        "getParameter",
        "webgl",
        "getParameter",
        getWebGLParameterName
    );
    wrapMethod(
        window.WebGLRenderingContext && window.WebGLRenderingContext.prototype,
        "getExtension",
        "webgl",
        "getExtension",
        getExtensionName
    );
    wrapMethod(
        window.WebGL2RenderingContext && window.WebGL2RenderingContext.prototype,
        "getExtension",
        "webgl",
        "getExtension",
        getExtensionName
    );

    wrapConstructor("AudioContext", "audio", "AudioContext");
    wrapConstructor("webkitAudioContext", "audio", "AudioContext");
    wrapConstructor("OfflineAudioContext", "audio", "OfflineAudioContext");
    wrapConstructor(
        "webkitOfflineAudioContext",
        "audio",
        "OfflineAudioContext"
    );

    [
        "hardwareConcurrency",
        "deviceMemory",
        "languages",
        "platform",
        "userAgent",
        "maxTouchPoints"
    ].forEach(function (propertyName) {
        wrapPrototypeGetter(window.Navigator && window.Navigator.prototype,
            propertyName,
            "navigator");
    });

    [
        "width",
        "height",
        "availWidth",
        "availHeight",
        "colorDepth",
        "pixelDepth"
    ].forEach(function (propertyName) {
        wrapPrototypeGetter(window.Screen && window.Screen.prototype,
            propertyName,
            "screen");
    });

})();
