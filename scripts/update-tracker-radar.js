#!/usr/bin/env node

const fs = require("fs");
const https = require("https");
const path = require("path");
const { performance } = require("perf_hooks");

const projectRoot = path.join(__dirname, "..");
const outputPath = path.join(projectRoot, "data", "tracker-data.js");
const generatedDir = path.join(projectRoot, "data", "generated");
const metadataPath = path.join(generatedDir, "tracker-radar-metadata.json");

const TRACKER_RADAR_REF = process.env.TRACKER_RADAR_REF || "main";
const SOURCE_BASE =
    "https://raw.githubusercontent.com/duckduckgo/tracker-radar/" +
    TRACKER_RADAR_REF;
const DOMAINS_REGION = process.env.TRACKER_RADAR_REGION || "US";
const DOMAINS_API_URL =
    "https://api.github.com/repos/duckduckgo/tracker-radar/git/trees/" +
    TRACKER_RADAR_REF +
    "?recursive=1";
const DOMAIN_MAP_URL = SOURCE_BASE + "/build-data/generated/domain_map.json";
const ENTITY_MAP_URL = SOURCE_BASE + "/build-data/generated/entity_map.json";
const LICENSE_URL =
    "https://github.com/duckduckgo/tracker-radar/blob/main/LICENSE";

function fetchJson(url) {
    return new Promise(function (resolve, reject) {
        https.get(url, {
            headers: {
                "User-Agent": "BrowserGuard Tracker Radar updater"
            }
        }, function (response) {
            if (
                response.statusCode >= 300 &&
                response.statusCode < 400 &&
                response.headers.location
            ) {
                fetchJson(response.headers.location).then(resolve, reject);
                return;
            }

            if (response.statusCode !== 200) {
                reject(new Error("GET " + url + " failed: " + response.statusCode));
                return;
            }

            let body = "";
            response.setEncoding("utf8");
            response.on("data", function (chunk) {
                body += chunk;
            });
            response.on("end", function () {
                try {
                    resolve(JSON.parse(body));
                } catch (error) {
                    reject(error);
                }
            });
        }).on("error", reject);
    });
}

async function fetchAllDomainFileEntries() {
    const tree = await fetchJson(DOMAINS_API_URL);
    const prefix = "domains/" + DOMAINS_REGION + "/";

    return (tree.tree || [])
        .filter(function (entry) {
            return entry.type === "blob" &&
                entry.path.startsWith(prefix) &&
                entry.path.endsWith(".json");
        })
        .map(function (entry) {
            return {
                path: entry.path,
                download_url: SOURCE_BASE + "/" + encodeURI(entry.path)
            };
        });
}

function normalizeCategory(categories) {
    const values = Array.isArray(categories) ? categories : [];
    const has = function (name) {
        return values.includes(name);
    };

    if (
        has("Advertising") ||
        has("Ad Motivated Tracking") ||
        has("Ad Fraud")
    ) {
        return "Advertising";
    }

    if (
        has("Analytics") ||
        has("Audience Measurement") ||
        has("Action Pixels") ||
        has("Session Replay")
    ) {
        return "Analytics";
    }

    if (
        has("Social Network") ||
        has("Social - Share") ||
        has("Social - Comment") ||
        has("Federated Login") ||
        has("SSO")
    ) {
        return "Social";
    }

    if (has("Embedded Content")) {
        return "Embedded Content";
    }

    if (has("CDN")) {
        return "CDN";
    }

    return "Other";
}

function getOwnerName(value) {
    if (!value) {
        return "";
    }

    if (typeof value === "string") {
        return value;
    }

    return value.name || value.displayName || "";
}

function hasTrackingEvidence(domainData) {
    const categories = domainData.categories || [];
    const category = normalizeCategory(categories);

    if (category === "Other" || category === "CDN" || category === "Embedded Content") {
        return false;
    }

    return true;
}

function createEntityDomainMap(entityMap) {
    const domainsByEntity = new Map();

    Object.entries(entityMap || {}).forEach(function ([entityName, entityData]) {
        const properties = entityData.properties || entityData.Properties || [];
        const displayName =
            entityData.displayName ||
            entityData.name ||
            entityData.Name ||
            entityName;

        properties.forEach(function (domain) {
            const normalizedDomain = normalizeDomain(domain);

            if (!normalizedDomain) {
                return;
            }

            domainsByEntity.set(normalizedDomain, displayName);
        });
    });

    return domainsByEntity;
}

function normalizeDomain(domain) {
    return String(domain || "")
        .trim()
        .toLowerCase()
        .replace(/\.$/, "");
}

async function fetchDomainData(domainFileEntries) {
    const domainData = [];
    const batchSize = 100;

    for (let index = 0; index < domainFileEntries.length; index += batchSize) {
        const batch = domainFileEntries.slice(index, index + batchSize);
        console.log(
            "Downloading domain files " +
            Math.min(index + batch.length, domainFileEntries.length) +
            "/" +
            domainFileEntries.length
        );
        const batchData = await Promise.all(batch.map(function (entry) {
            return fetchJson(entry.download_url).catch(function () {
                return null;
            });
        }));

        batchData.forEach(function (entryData) {
            if (entryData && entryData.domain) {
                domainData.push(entryData);
            }
        });
    }

    return domainData;
}

function buildDataset(domainDataEntries, domainMap, entityMap) {
    const entityDomains = createEntityDomainMap(entityMap);
    const trackers = [];
    const entityDomainsOutput = [];
    const categoryCounts = {};

    (domainDataEntries || []).forEach(function (domainData) {
        const normalizedDomain = normalizeDomain(domainData.domain);

        if (!normalizedDomain || !hasTrackingEvidence(domainData || {})) {
            return;
        }

        const sourceCategories = Array.isArray(domainData.categories) ?
            domainData.categories.slice().sort() :
            [];
        const category = normalizeCategory(sourceCategories);
        const owner =
            getOwnerName(domainData.owner) ||
            entityDomains.get(normalizedDomain) ||
            "";

        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        trackers.push({
            domain: normalizedDomain,
            category: category,
            categories: sourceCategories,
            owner: owner || undefined,
            prevalence: typeof domainData.prevalence === "number" ?
                Number(domainData.prevalence.toFixed(6)) :
                undefined
        });
    });

    entityDomains.forEach(function (entityName, domain) {
        entityDomainsOutput.push({
            domain: domain,
            entity: entityName
        });
    });

    trackers.sort(function (left, right) {
        return left.domain.localeCompare(right.domain);
    });
    entityDomainsOutput.sort(function (left, right) {
        return left.domain.localeCompare(right.domain);
    });

    return {
        trackers: trackers.map(function (tracker) {
            return [
                tracker.domain,
                tracker.category,
                tracker.owner || "",
                tracker.prevalence
            ];
        }),
        entityDomains: entityDomainsOutput.map(function (entry) {
            return [
                entry.domain,
                entry.entity
            ];
        }),
        categoryCounts: categoryCounts
    };
}

function serializeDataset(dataset, startedAt, durationMilliseconds) {
    const payload = {
        source: "DuckDuckGo Tracker Radar generated compact dataset",
        sourceUrl: "https://github.com/duckduckgo/tracker-radar",
        sourceRef: TRACKER_RADAR_REF,
        region: DOMAINS_REGION,
        domainsApiUrl: DOMAINS_API_URL,
        domainMapUrl: DOMAIN_MAP_URL,
        entityMapUrl: ENTITY_MAP_URL,
        license: "CC BY-NC-SA 4.0",
        licenseUrl: LICENSE_URL,
        generatedAt: startedAt,
        generatedBy: "scripts/update-tracker-radar.js",
        trackerCount: dataset.trackers.length,
        entityDomainCount: dataset.entityDomains.length,
        categoryCounts: dataset.categoryCounts,
        trackers: dataset.trackers,
        entityDomains: dataset.entityDomains
    };

    return {
        js:
            "/**\n" +
            " * BrowserGuard generated tracker dataset.\n" +
            " * Source: DuckDuckGo Tracker Radar.\n" +
            " * License: CC BY-NC-SA 4.0.\n" +
            " * Generated by scripts/update-tracker-radar.js.\n" +
            " */\n\n" +
            "const BROWSERGUARD_TRACKER_DATA = " +
            JSON.stringify(payload) +
            ";\n\n" +
            "if (typeof module !== \"undefined\" && module.exports) {\n" +
            "    module.exports = BROWSERGUARD_TRACKER_DATA;\n" +
            "} else {\n" +
            "    globalThis.BROWSERGUARD_TRACKER_DATA = BROWSERGUARD_TRACKER_DATA;\n" +
            "}\n",
        metadata: {
            generatedAt: startedAt,
            durationMilliseconds: Math.round(durationMilliseconds),
            trackerCount: dataset.trackers.length,
            entityDomainCount: dataset.entityDomains.length,
            categoryCounts: dataset.categoryCounts,
            sourceRef: TRACKER_RADAR_REF,
            domainMapUrl: DOMAIN_MAP_URL,
            entityMapUrl: ENTITY_MAP_URL
        }
    };
}

(async function main() {
    const startedAt = new Date().toISOString();
    const start = performance.now();

    fs.mkdirSync(generatedDir, {
        recursive: true
    });

    const [domainFileEntries, domainMap, entityMap] = await Promise.all([
        fetchAllDomainFileEntries(),
        fetchJson(DOMAIN_MAP_URL),
        fetchJson(ENTITY_MAP_URL)
    ]);
    const domainDataEntries = await fetchDomainData(domainFileEntries);
    const dataset = buildDataset(domainDataEntries, domainMap, entityMap);
    const serialized = serializeDataset(
        dataset,
        startedAt,
        performance.now() - start
    );

    fs.writeFileSync(outputPath, serialized.js);
    fs.writeFileSync(metadataPath, JSON.stringify(serialized.metadata, null, 4) + "\n");

    console.log(
        "Generated " + dataset.trackers.length +
        " tracker domains and " + dataset.entityDomains.length +
        " entity domains"
    );
})();
