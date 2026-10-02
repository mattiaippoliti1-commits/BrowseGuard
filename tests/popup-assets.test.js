const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const popupDir = path.join(repoRoot, "popup");
const popupHtmlPath = path.join(popupDir, "popup.html");

const popupHtml = fs.readFileSync(popupHtmlPath, "utf8");
const localAssets = [];
const assetPattern = /<(script|link)\b[^>]*(?:src|href)=["']([^"']+)["'][^>]*>/gi;

let match;
while ((match = assetPattern.exec(popupHtml)) !== null) {
    const assetPath = match[2].trim();

    if (isExternalAsset(assetPath)) {
        continue;
    }

    localAssets.push({
        tagName: match[1],
        assetPath: assetPath,
        resolvedPath: path.resolve(popupDir, assetPath)
    });
}

assert.ok(localAssets.length > 0, "Expected popup.html to reference local assets");

for (const asset of localAssets) {
    assert.ok(
        fs.existsSync(asset.resolvedPath),
        `${asset.tagName} asset ${asset.assetPath} does not exist`
    );
}

console.log("Popup asset tests passed");

function isExternalAsset(assetPath) {
    return assetPath === "" ||
        assetPath.startsWith("#") ||
        assetPath.startsWith("data:") ||
        assetPath.startsWith("http://") ||
        assetPath.startsWith("https://") ||
        assetPath.startsWith("//");
}
