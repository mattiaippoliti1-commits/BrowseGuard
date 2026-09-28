const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const events = [];

function CustomEvent(type, options) {
    this.type = type;
    this.detail = options && options.detail;
}

class HTMLCanvasElement {
    constructor() {
        this.prefix = "canvas";
    }

    toDataURL(suffix) {
        return this.prefix + ":" + suffix;
    }

    toBlob(callback) {
        callback("blob-result");
        return "toBlob-result";
    }
}

class CanvasRenderingContext2D {
    constructor() {
        this.prefix = "context";
    }

    getImageData() {
        return this.prefix + ":image-data";
    }
}

class ThrowingCanvasRenderingContext2D {
    getImageData() {
        throw new TypeError("original exception");
    }
}

class WebGLRenderingContext {
    getParameter(parameter) {
        return "parameter:" + parameter;
    }

    getExtension(name) {
        return {
            name: name
        };
    }
}

class AudioContext {
    constructor() {
        this.created = true;
    }
}

const fakeWindow = {
    HTMLCanvasElement: HTMLCanvasElement,
    CanvasRenderingContext2D: CanvasRenderingContext2D,
    WebGLRenderingContext: WebGLRenderingContext,
    AudioContext: AudioContext,
    Navigator: function Navigator() {},
    Screen: function Screen() {},
    dispatchEvent: function (event) {
        events.push(event.detail);
    }
};

Object.defineProperty(fakeWindow.Navigator.prototype, "hardwareConcurrency", {
    get: function () {
        return 8;
    },
    configurable: true
});

Object.defineProperty(fakeWindow.Screen.prototype, "width", {
    get: function () {
        return 1920;
    },
    configurable: true
});

const context = vm.createContext({
    window: fakeWindow,
    CustomEvent: CustomEvent,
    Object: Object,
    Reflect: Reflect,
    Set: Set,
    String: String
});

vm.runInContext(
    fs.readFileSync(
        path.join(__dirname, "..", "content", "runtime-monitor.js"),
        "utf8"
    ),
    context,
    {
        filename: "content/runtime-monitor.js"
    }
);

const canvas = new HTMLCanvasElement();
assert.strictEqual(canvas.toDataURL("ok"), "canvas:ok");

let blobCallbackValue = "";
assert.strictEqual(
    canvas.toBlob(function (value) {
        blobCallbackValue = value;
    }),
    "toBlob-result"
);
assert.strictEqual(blobCallbackValue, "blob-result");

const renderingContext = new CanvasRenderingContext2D();
assert.strictEqual(renderingContext.getImageData(), "context:image-data");

fakeWindow.CanvasRenderingContext2D.prototype =
    ThrowingCanvasRenderingContext2D.prototype;

const webgl = new WebGLRenderingContext();
assert.strictEqual(webgl.getParameter(0x9246), "parameter:37446");
assert.deepStrictEqual(webgl.getExtension("WEBGL_debug_renderer_info"), {
    name: "WEBGL_debug_renderer_info"
});

const audioContext = new fakeWindow.AudioContext();
assert.strictEqual(audioContext.created, true);

const navigator = new fakeWindow.Navigator();
assert.strictEqual(navigator.hardwareConcurrency, 8);

const screen = new fakeWindow.Screen();
assert.strictEqual(screen.width, 1920);

assert.ok(events.some(function (event) {
    return event.category === "canvas" && event.api === "toDataURL";
}));
assert.ok(events.some(function (event) {
    return event.category === "webgl" &&
        event.detail === "UNMASKED_RENDERER_WEBGL";
}));
assert.ok(events.some(function (event) {
    return event.category === "audio" && event.api === "AudioContext";
}));
assert.ok(events.some(function (event) {
    return event.category === "navigator" &&
        event.api === "hardwareConcurrency";
}));
assert.ok(events.some(function (event) {
    return event.category === "screen" && event.api === "width";
}));

const originalThrowingPrototype = {
    getImageData: function () {
        throw new TypeError("original exception");
    }
};

fakeWindow.CanvasRenderingContext2D = function ReplacementContext() {};
fakeWindow.CanvasRenderingContext2D.prototype = originalThrowingPrototype;

vm.runInContext(
    fs.readFileSync(
        path.join(__dirname, "..", "content", "runtime-monitor.js"),
        "utf8"
    ),
    context,
    {
        filename: "content/runtime-monitor.js"
    }
);

assert.throws(function () {
    new fakeWindow.CanvasRenderingContext2D().getImageData();
}, /original exception/);

console.log("Runtime monitor wrapper tests passed");
