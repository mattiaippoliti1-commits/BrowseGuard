const assert = require("assert");
const fs = require("fs");
const path = require("path");

const projectRoot = path.join(__dirname, "..");
const manifest = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "manifest.json"), "utf8")
);

function assertExtensionPathExists(extensionPath) {
    const absolutePath = path.join(projectRoot, extensionPath);

    assert.ok(
        fs.existsSync(absolutePath),
        "Manifest path does not exist: " + extensionPath
    );
}

assertExtensionPathExists(manifest.action.default_popup);
assertExtensionPathExists(manifest.background.service_worker);

manifest.content_scripts.forEach(function (contentScript) {
    (contentScript.js || []).forEach(assertExtensionPathExists);
    (contentScript.css || []).forEach(assertExtensionPathExists);
});

console.log("Manifest path tests passed");
