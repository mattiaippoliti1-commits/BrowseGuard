/**
 * BrowserGuard entity relationship resolver.
 *
 * This module is intentionally separate from tracker detection. Entity
 * relationship answers who appears to control a domain; tracker matching
 * answers whether a domain is in the tracker dataset.
 */

function createEntityResolver(entityData, options) {

    const entityByDomain = new Map();
    const getRegistrableDomain =
        options && options.getRegistrableDomain ?
            options.getRegistrableDomain :
            defaultRegistrableDomain;

    (entityData.entityDomains || []).forEach(function (entry) {
        const normalizedEntry = normalizeEntityEntry(entry);
        const domain = normalizeHostname(normalizedEntry.domain);

        if (!domain || !normalizedEntry.entity) {
            return;
        }

        entityByDomain.set(domain, normalizedEntry.entity);
    });

    return {
        resolveRelationship: function (pageHostname, requestHostname) {
            return resolveRelationship(
                pageHostname,
                requestHostname,
                entityByDomain,
                getRegistrableDomain
            );
        },
        getEntityForHostname: function (hostname) {
            return getEntityForHostname(hostname, entityByDomain);
        },
        size: entityByDomain.size
    };

}

function normalizeEntityEntry(entry) {

    if (Array.isArray(entry)) {
        return {
            domain: entry[0],
            entity: entry[1]
        };
    }

    return entry || {};

}

function resolveRelationship(
    pageHostname,
    requestHostname,
    entityByDomain,
    getRegistrableDomain
) {

    const pageSite = getRegistrableDomain(pageHostname);
    const requestSite = getRegistrableDomain(requestHostname);

    if (pageSite && requestSite && pageSite === requestSite) {
        return {
            relationship: "first-party",
            pageEntity: getEntityForHostname(pageHostname, entityByDomain),
            requestEntity: getEntityForHostname(requestHostname, entityByDomain)
        };
    }

    const pageEntity = getEntityForHostname(pageHostname, entityByDomain);
    const requestEntity = getEntityForHostname(requestHostname, entityByDomain);

    if (!pageEntity || !requestEntity) {
        return {
            relationship: "unknown-third-party",
            pageEntity: pageEntity,
            requestEntity: requestEntity
        };
    }

    if (pageEntity === requestEntity) {
        return {
            relationship: "same-entity-third-party",
            pageEntity: pageEntity,
            requestEntity: requestEntity
        };
    }

    return {
        relationship: "external-third-party",
        pageEntity: pageEntity,
        requestEntity: requestEntity
    };

}

function getEntityForHostname(hostname, entityByDomain) {

    const normalizedHostname = normalizeHostname(hostname);

    if (!normalizedHostname) {
        return "";
    }

    const hostnameParts = normalizedHostname.split(".");

    for (let index = 0; index < hostnameParts.length; index++) {
        const suffix = hostnameParts.slice(index).join(".");
        const entity = entityByDomain.get(suffix);

        if (entity) {
            return entity;
        }
    }

    return "";

}

function defaultRegistrableDomain(hostname) {

    const normalizedHostname = normalizeHostname(hostname);

    if (!normalizedHostname) {
        return "";
    }

    const parts = normalizedHostname.split(".");

    if (parts.length <= 2) {
        return normalizedHostname;
    }

    return parts.slice(-2).join(".");

}

function normalizeHostname(hostname) {

    return String(hostname || "")
        .toLowerCase()
        .replace(/\.$/, "");

}

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        createEntityResolver: createEntityResolver,
        resolveRelationship: resolveRelationship,
        getEntityForHostname: getEntityForHostname,
        normalizeEntityEntry: normalizeEntityEntry,
        normalizeHostname: normalizeHostname
    };
} else {
    globalThis.BrowserGuardEntityResolver = {
        createEntityResolver: createEntityResolver,
        resolveRelationship: resolveRelationship,
        getEntityForHostname: getEntityForHostname,
        normalizeEntityEntry: normalizeEntityEntry,
        normalizeHostname: normalizeHostname
    };
}
