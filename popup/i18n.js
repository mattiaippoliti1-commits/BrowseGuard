const BrowserGuardI18n = (function () {

    const translations = {
        en: {
            appSubtitle: "Web Security Monitor",
            switchToLightMode: "Switch to light mode",
            switchToDarkMode: "Switch to dark mode",
            switchToItalian: "Switch to Italian",
            switchToEnglish: "Switch to English",
            loading: "Loading...",
            unavailable: "Unavailable",
            yes: "Yes",
            no: "No",
            detected: "Detected",
            assessment: "Assessment",
            security: "Security",
            privacy: "Privacy",
            network: "Network",
            keyFindings: "Key Findings",
            positiveSignals: "Positive Signals",
            requests: "Requests",
            trackingDomains: "Tracking domains",
            externalRequests: "External requests",
            sameEntity: "Same-entity",
            technicalDetails: "Technical Details",
            urlPage: "URL & Page",
            protocol: "Protocol",
            hostname: "Hostname",
            urlLength: "URL length",
            subdomains: "Subdomains",
            forms: "Forms",
            passwordFields: "Password fields",
            externalForms: "External forms",
            externalPasswordForms: "External password forms",
            insecurePasswordForms: "Insecure password forms",
            totalLinks: "Total links",
            externalLinks: "External links",
            mismatchedLinks: "Mismatched links",
            iframes: "Iframes",
            hiddenIframes: "Hidden iframes",
            externalScripts: "External scripts",
            urlIndicators: "URL indicators",
            longUrl: "Long URL",
            manySubdomains: "Many subdomains",
            containsAt: "Contains @",
            urlEncoding: "URL encoding",
            ipAddress: "IP address",
            punycode: "Punycode",
            webSecurity: "Web Security",
            https: "HTTPS",
            csp: "CSP",
            hsts: "HSTS",
            cspTooltip: "CSP observations are shown as secondary details when available.",
            xContentTypeOptions: "X-Content-Type-Options",
            referrerPolicy: "Referrer-Policy",
            permissionsPolicy: "Permissions-Policy",
            antiFraming: "Anti-framing",
            mixedContent: "Mixed Content",
            iframeSecurity: "Iframe Security",
            privacySignals: "Privacy Signals",
            runtimePrivacyTooltip: "Runtime privacy reports privacy-sensitive API activity and fingerprinting-related indicators without collecting fingerprint values.",
            multipleRuntimeIndicators: "Multiple fingerprinting-related indicators observed.",
            trackingAssociatedDomains: "Tracking-associated Domains",
            trackingAssociatedTooltip: "Domain associated with tracking-related categories in the local Tracker Radar-derived dataset. This does not prove that the individual request performs tracking.",
            networkActivity: "Network Activity",
            totalRequests: "Total requests",
            firstParty: "First-party",
            thirdParty: "Third-party",
            thirdPartyDomains: "Third-party domains",
            sameEntityThirdParty: "Same-entity third-party",
            sameEntityTooltip: "Third-party domain associated with the same organization as the current site.",
            externalThirdParty: "External third-party",
            unknownThirdParty: "Unknown third-party",
            unknownThirdPartyTooltip: "Third-party domain that could not be associated with the site owner using local entity metadata.",
            thirdPartyBreakdown: "Third-party breakdown",
            resourceTypes: "Resource Types",
            topThirdPartyDomains: "Top Third-party Domains",
            showMore: "Show more",
            showLess: "Show less",
            showAllFindings: "Show all findings",
            showFewerFindings: "Show fewer findings",
            more: "more",
            noAssessmentFindings: "No assessment findings available yet.",
            noSpecificAssessmentFindings: "No specific assessment findings to display.",
            whyThisAssessment: "Why this assessment?",
            viewSecurityDetails: "View security details",
            viewPrivacyDetails: "View privacy details",
            viewNetworkDetails: "View network details",
            analysisIncomplete: "Analysis incomplete.",
            analysisIncompleteWithSources: "Analysis incomplete: {sources}",
            noThirdPartyDomains: "No third-party domains observed yet.",
            noTrackingAssociatedDomains: "No tracking-associated domains detected.",
            runtimePrivacyUnavailable: "Runtime privacy data unavailable.",
            notObserved: "Not observed",
            enabled: "Enabled",
            missing: "Missing",
            present: "Present",
            notExplicitlySet: "Not explicitly set",
            features: "features",
            noneObserved: "None observed",
            observedWithCount: "Observed · {count} {requests}",
            eventSingular: "1 event",
            eventPlural: "{count} events",
            requestSingular: "request",
            requestPlural: "requests",
            observed: "observed",
            document: "document",
            scripts: "scripts",
            stylesheets: "stylesheets",
            images: "images",
            fonts: "fonts",
            xhrFetch: "XHR/fetch",
            media: "media",
            other: "other",
            otherCategory: "Other",
            noMajorIssues: "No major issues",
            observations: "Observations",
            attention: "Attention",
            low: "Low",
            moderate: "Moderate",
            elevated: "Elevated",
            high: "High",
            advertisingRelated: "Advertising-related",
            analyticsRelated: "Analytics-related",
            socialRelated: "Social-related",
            noMixedContent: "No mixed content",
            xctoNosniff: "XCTO nosniff",
            antiFramingShort: "Anti-framing"
        },
        it: {
            appSubtitle: "Monitor di sicurezza web",
            switchToLightMode: "Passa alla modalità chiara",
            switchToDarkMode: "Passa alla modalità scura",
            switchToItalian: "Passa all'italiano",
            switchToEnglish: "Passa all'inglese",
            loading: "Caricamento...",
            unavailable: "Non disponibile",
            yes: "Sì",
            no: "No",
            detected: "Rilevato",
            assessment: "Valutazione",
            security: "Sicurezza",
            privacy: "Privacy",
            network: "Rete",
            keyFindings: "Evidenze principali",
            positiveSignals: "Segnali positivi",
            requests: "Richieste",
            trackingDomains: "Domini di tracking",
            externalRequests: "Richieste esterne",
            sameEntity: "Stessa entità",
            technicalDetails: "Dettagli tecnici",
            urlPage: "URL e pagina",
            protocol: "Protocollo",
            hostname: "Hostname",
            urlLength: "Lunghezza URL",
            subdomains: "Sottodomini",
            forms: "Form",
            passwordFields: "Campi password",
            externalForms: "Form esterni",
            externalPasswordForms: "Form password esterni",
            insecurePasswordForms: "Form password non sicuri",
            totalLinks: "Link totali",
            externalLinks: "Link esterni",
            mismatchedLinks: "Link non coerenti",
            iframes: "Iframe",
            hiddenIframes: "Iframe nascosti",
            externalScripts: "Script esterni",
            urlIndicators: "Indicatori URL",
            longUrl: "URL lungo",
            manySubdomains: "Molti sottodomini",
            containsAt: "Contiene @",
            urlEncoding: "Codifica URL",
            ipAddress: "Indirizzo IP",
            punycode: "Punycode",
            webSecurity: "Sicurezza web",
            https: "HTTPS",
            csp: "CSP",
            hsts: "HSTS",
            cspTooltip: "Le osservazioni CSP sono mostrate come dettagli secondari quando disponibili.",
            xContentTypeOptions: "X-Content-Type-Options",
            referrerPolicy: "Referrer-Policy",
            permissionsPolicy: "Permissions-Policy",
            antiFraming: "Anti-framing",
            mixedContent: "Contenuto misto",
            iframeSecurity: "Sicurezza iframe",
            privacySignals: "Segnali privacy",
            runtimePrivacyTooltip: "Runtime Privacy segnala l'uso di API rilevanti per la privacy e indicatori legati al fingerprinting senza raccogliere valori di fingerprint.",
            multipleRuntimeIndicators: "Rilevati più indicatori legati al fingerprinting.",
            trackingAssociatedDomains: "Domini associati al tracciamento",
            trackingAssociatedTooltip: "Dominio associato a categorie legate al tracciamento nel dataset locale derivato da Tracker Radar. Questo non prova che la singola richiesta effettui tracciamento.",
            networkActivity: "Attività di rete",
            totalRequests: "Richieste totali",
            firstParty: "First-party",
            thirdParty: "Third-party",
            thirdPartyDomains: "Domini third-party",
            sameEntityThirdParty: "Third-party stessa entità",
            sameEntityTooltip: "Dominio third-party associato alla stessa organizzazione del sito corrente.",
            externalThirdParty: "Third-party esterni",
            unknownThirdParty: "Third-party sconosciuti",
            unknownThirdPartyTooltip: "Dominio third-party che non è stato possibile associare al proprietario del sito usando i metadati locali sulle entità.",
            thirdPartyBreakdown: "Composizione third-party",
            resourceTypes: "Tipi di risorsa",
            topThirdPartyDomains: "Principali domini third-party",
            showMore: "Mostra altro",
            showLess: "Mostra meno",
            showAllFindings: "Mostra tutte le evidenze",
            showFewerFindings: "Mostra meno evidenze",
            more: "altre",
            noAssessmentFindings: "Nessuna evidenza di valutazione disponibile.",
            noSpecificAssessmentFindings: "Nessuna evidenza specifica da mostrare per questa valutazione.",
            whyThisAssessment: "Perché questa valutazione?",
            viewSecurityDetails: "Vedi dettagli di sicurezza",
            viewPrivacyDetails: "Vedi dettagli privacy",
            viewNetworkDetails: "Vedi dettagli di rete",
            analysisIncomplete: "Analisi incompleta.",
            analysisIncompleteWithSources: "Analisi incompleta: {sources}",
            noThirdPartyDomains: "Nessun dominio third-party osservato finora.",
            noTrackingAssociatedDomains: "Nessun dominio associato al tracciamento rilevato.",
            runtimePrivacyUnavailable: "Dati Runtime Privacy non disponibili.",
            notObserved: "Non osservato",
            enabled: "Attivo",
            missing: "Mancante",
            present: "Presente",
            notExplicitlySet: "Non impostata esplicitamente",
            features: "funzionalità",
            noneObserved: "Nessuno osservato",
            observedWithCount: "Osservato · {count} {requests}",
            eventSingular: "1 evento",
            eventPlural: "{count} eventi",
            requestSingular: "richiesta",
            requestPlural: "richieste",
            observed: "osservato",
            document: "documento",
            scripts: "script",
            stylesheets: "fogli di stile",
            images: "immagini",
            fonts: "font",
            xhrFetch: "XHR/fetch",
            media: "media",
            other: "altro",
            otherCategory: "Altro",
            noMajorIssues: "Nessun problema rilevante",
            observations: "Osservazioni",
            attention: "Attenzione",
            low: "Bassa",
            moderate: "Moderata",
            elevated: "Elevata",
            high: "Alta",
            advertisingRelated: "Legato alla pubblicità",
            analyticsRelated: "Legato ad analytics",
            socialRelated: "Legato ai social",
            noMixedContent: "Nessun contenuto misto",
            xctoNosniff: "XCTO nosniff",
            antiFramingShort: "Anti-framing"
        }
    };

    const reasonTranslations = {
        "main-page-http": {
            it: "La pagina principale non usa HTTPS"
        },
        "mixed-content": {
            it: "Sono state osservate richieste di contenuto misto"
        },
        "insecure-password-forms": {
            it: "È stato osservato l'invio di un form password tramite HTTP"
        },
        "external-password-forms": {
            it: "La destinazione del form password è esterna"
        },
        "csp-report-only": {
            it: "La CSP è presente solo in modalità report-only"
        },
        "csp-missing": {
            it: "Non è stato rilevato un header CSP applicato"
        },
        "csp-permissive-observations": {
            it: "La CSP contiene direttive potenzialmente permissive"
        },
        "hsts-missing": {
            it: "Non è stato rilevato un header HSTS su una pagina HTTPS"
        },
        "hsts-observations": {
            it: "Sono state trovate osservazioni sulla configurazione HSTS"
        },
        "content-type-options-not-nosniff": {
            it: "Non è stato rilevato X-Content-Type-Options nosniff"
        },
        "anti-framing-missing": {
            it: "Non è stata rilevata una policy anti-framing esplicita"
        },
        "http-iframe-on-https-page": {
            it: "È stato osservato un iframe HTTP su una pagina HTTPS"
        },
        "hidden-iframes": {
            it: "Sono stati osservati iframe nascosti"
        },
        "third-party-unsandboxed-iframes": {
            it: "Sono stati osservati iframe third-party senza sandbox"
        },
        "url-heuristics": {
            it: "Sono state trovate osservazioni euristiche sull'URL"
        },
        "security-data-incomplete": {
            it: "Alcuni input di sicurezza non sono disponibili o sono incompleti"
        },
        "known-trackers": {
            it: "È stata rilevata attività proveniente da domini associati al tracciamento"
        },
        "multiple-runtime-privacy-indicators": {
            it: "Sono stati osservati più indicatori legati al fingerprinting"
        },
        "runtime-privacy-api-usage": {
            it: "È stato rilevato l'uso di API rilevanti per la privacy"
        },
        "privacy-data-incomplete": {
            it: "Alcuni input privacy non sono disponibili o sono incompleti"
        },
        "network-data-unavailable": {
            it: "I dati sull'attività di rete non sono disponibili o sono incompleti"
        },
        "third-party-network-activity": {
            it: "È stata osservata attività di rete third-party"
        }
    };

    const positiveSignalLabels = {
        "https-enabled": {
            en: "HTTPS",
            it: "HTTPS"
        },
        "hsts-present": {
            en: "HSTS",
            it: "HSTS"
        },
        "csp-present": {
            en: "CSP",
            it: "CSP"
        },
        "content-type-nosniff": {
            en: "XCTO nosniff",
            it: "XCTO nosniff"
        },
        "anti-framing-present": {
            en: "Anti-framing",
            it: "Anti-framing"
        },
        "no-mixed-content-observed": {
            en: "No mixed content",
            it: "Nessun contenuto misto"
        }
    };

    function t(language, key, replacements) {

        const dictionary = translations[language] || translations.en;
        const template = dictionary[key] || translations.en[key] || key;

        return Object.entries(replacements || {}).reduce(
            function (text, [name, value]) {
                return text.replace("{" + name + "}", value);
            },
            template
        );

    }

    function reason(language, assessmentReason) {

        const localized = reasonTranslations[assessmentReason.id];

        if (localized && localized[language]) {
            return localized[language];
        }

        return assessmentReason.message;

    }

    function positiveSignal(language, signal) {

        const localized = positiveSignalLabels[signal.id];

        if (localized && localized[language]) {
            return localized[language];
        }

        return signal.message;

    }

    globalThis.BrowserGuardI18n = {
        t: t,
        reason: reason,
        positiveSignal: positiveSignal
    };

}());
