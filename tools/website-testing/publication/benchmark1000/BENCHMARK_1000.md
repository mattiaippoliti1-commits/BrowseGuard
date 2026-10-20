# BrowserGuard — benchmark su 1.000 siti

## Executive summary

Stato: **COMPLETATO: 1.000 tentativi e audit superato**. Corpus 1.000 URL; tentativi 1000; assessment acquisiti 999; stato ok/partial 787; restrizioni 132; errori di navigazione 80; timeout 30.

Questo esperimento misura affidabilità operativa e distribuzioni di segnali osservati. Non misura accuratezza, precision, recall, F1, percentuali di siti sicuri/malevoli o vulnerabilità confermate.

## Obiettivi e dataset

Raccolta reale del popup, DOM, runtime, network, header e assessment, con osservazioni CDP separate. Il [corpus e la sua provenienza](corpus/DATASET_1000.md) hanno 1.000 hostname distinti normalizzando www; gli alias noti dello storico sono deduplicati. Nessun errore o blocco osservato ha determinato sostituzioni.

SHA-256 TXT: `cbb10d594c6c351232490cb6cd65f9fcc5095e9e80596b70fda0bd5fb3d3349d`. Fonte: 200 URL Wikidata CC0, 800 Curlie CC BY 3.0; snapshot Curlie del 2 febbraio 2026, scaricato il 19 ottobre. Il disservizio/rate limit di Wikidata è stato rispettato, usando successivamente un export pubblico indipendente e autorizzato.

Le categorie sono tematiche, non una verifica dell’attività dei titolari: includono anche sport universitario, associazioni finanziarie e conferenze tecniche. Ordinamento deterministico e prevalenza delle categorie inglesi introducono bias; il campione non rappresenta statisticamente il web.

| Categoria | Previsti | Tentati | Assessment | Ok/partial | Restrizioni | Errori navigazione |
| --- | --- | --- | --- | --- | --- | --- |
| Informazione e giornali | 100 | 100 | 100 | 82 | 17 | 1 |
| E-commerce | 100 | 100 | 100 | 72 | 22 | 6 |
| Tecnologia e software | 100 | 100 | 100 | 85 | 9 | 6 |
| Università e istruzione | 100 | 100 | 100 | 81 | 10 | 9 |
| Pubblica amministrazione | 100 | 100 | 100 | 69 | 25 | 6 |
| Banche e servizi finanziari | 100 | 100 | 100 | 84 | 8 | 8 |
| Social network e community | 100 | 100 | 100 | 57 | 17 | 26 |
| Intrattenimento e streaming | 100 | 100 | 100 | 90 | 8 | 2 |
| Viaggi e turismo | 100 | 100 | 100 | 87 | 6 | 7 |
| Siti tecnici e documentazione | 100 | 100 | 99 | 80 | 10 | 9 |

## Ambiente e identità della versione

| Voce | Valore |
| --- | --- |
| Git | a5881c488dac62c4386b15b8b5fcb7ae581c0693 |
| Produzione SHA-256 | 0f2c1f20712aa4e76cdd9eaa6f393aeb28f919abe1d1fa01d8f609942e9f1fbc |
| Harness SHA-256 | 9be53e8513070079a0355b80484cd83128ad9e08ba133b91ee6815535a17c933 |
| Node | v25.2.1 |
| Playwright | 1.58.2 |
| Chromium | Google Chrome for Testing 145.0.7632.6 |
| Python | Python 3.13.2 |
| Sistema | darwin/arm64 26.6.2 |
| RAM fisica | 8 GiB |
| Worker | 1 |
| AI | disabilitata |

Le modifiche Git già presenti prima del benchmark sono preservate. Nessuna modifica di produzione è stata effettuata durante questa raccolta. Il fingerprint iniziale/finale è verificato nell’audit; soglie, permessi e Tracker Radar restano quelli della versione specificata.

## Metodologia

Un profilo Chromium isolato per worker, ricreato ogni 25 URL; nessun profilo personale. Si visita una volta ogni URL senza login, click, submit, pagamenti, exploit o aggiramenti. Le restrizioni non vengono ritentate. Normale verifica TLS, nessuna CA locale del controlled test caricata.

Timeout navigazione 25000 ms; popup 15000 ms; osservazione 3000–10000 ms; quiet interval 1000 ms; pausa 2000 ms; massimo 5000 dettagli per sito. La quiete riguarda l’avvio di richieste e non garantisce pagina completa/network idle.

Il popup reale è aperto in una scheda di estensione in background mantenendo attiva la pagina. Si cattura l’invocazione originale dell’engine senza sintetizzare input/output. CDP inizia prima della navigazione e termina dopo il popup; l’estensione aggrega finestre e target diversi. Cache e stato possono persistere all’interno dei 25 URL.

Lo smoke separato ha usato due URL per categoria fissati in anticipo. SIGTERM dopo cinque record, checkpoint e resume reale: hash e mtime dei primi record sono rimasti invariati. Il main non contiene una somma dello smoke, ma tutti i 1.000 URL del corpus. Guard di versione/corpus/config, monitoraggio risorse e checkpoint periodici sono aggiunte rispetto al vecchio benchmark e introducono overhead.

## Affidabilità operativa

Alla verifica di ripresa esistevano già 1000 record e il processo originale era terminato: non è stato lanciato un resume né un altro browser. Rispetto all’ultimo aggiornamento documentato (529 record), il processo originale aveva acquisito altri 471 record. Nuovi record da un resume effettivo: 0. Checkpoint finale 1.000; nessun record oltre checkpoint da recuperare, record corrotto o ID mancante. Hash e mtime dei record, manifest e checkpoint originali sono verificati nell’audit.

| Misura | Conteggio |
| --- | --- |
| Assessment acquisiti | 999 |
| Navigazioni con risposta e senza errore goto | 920 |
| Visite senza restrizione né HTTP >=400 | 762 |
| Stato legacy ok/partial (criterio storico) | 787 |
| Restrizioni, anche euristica titolo | 132 |
| HTTP 401 | 1 |
| HTTP 403 | 129 |
| HTTP 429 | 1 |
| HTTP 5xx | 6 |
| Timeout | 30 |
| Errori TLS | 9 |
| Errori DNS | 8 |
| Errori navigazione totali | 80 |
| Errori raccolta | 1 |
| Assessment parziali | 75 |
| Assessment assenti | 1 |

Le categorie di errore possono sovrapporsi. Un assessment acquisito o una risposta 2xx non verifica semanticamente che sia stata mostrata la pagina prevista. Il controllo delle restrizioni dal titolo è euristico: può avere falsi positivi/negativi. Il denominatore principale è il numero di tentativi; i confronti valutabili hanno denominatori specifici.

## Distribuzioni degli assessment

Tutti i tentativi (n=1000), incluse risposte di blocco/errore:

| Dimensione | Low | Moderate | High | Unavailable | Missing |
| --- | --- | --- | --- | --- | --- |
| security | 910 | 13 | 1 | 75 | 1 |
| privacy | 443 | 238 | 318 | 0 | 1 |
| network | 326 | 88 | 110 | 475 | 1 |

Visite ok/partial (n=787), popolazione principale dei grafici Python secondo gli stessi criteri dello storico:

| Dimensione | Low | Moderate | High | Unavailable | Missing |
| --- | --- | --- | --- | --- | --- |
| security | 773 | 13 | 1 | 0 | 0 |
| privacy | 236 | 233 | 318 | 0 | 0 |
| network | 177 | 69 | 107 | 434 | 0 |

Queste etichette descrivono segnali, non classificazioni di sicurezza dei siti. Network Unavailable include attribuzioni di entità irrisolte anche con snapshot completi; non equivale a zero richieste.

## Attività associata al tracking e header

Media richieste BrowserGuard su snapshot disponibili: 83.95. Media domini associati al tracking: 3.82. Le tabelle Python includono numerosità, valori mancanti, mediana, quartili e deviazione standard, distinguendo visite riuscite e tutti i tentativi. Associazione al dataset non prova tracking di ogni richiesta né completezza del rilevamento.

Presenza degli header: [tabelle aggregate](tables/header_presence.csv) e [figura](figures/security_headers.png). Header assenti restano osservazioni di configurazione; dati indisponibili non sono trattati come assenza. I nomi effettivi dei file pubblicati sono elencati nel report Python.

## Confronti CDP

| Confronto | Concordanti | Coppie valutabili |
| --- | --- | --- |
| Header (presenza) | 4600 | 4600 |
| Protocollo da risposta CDP finale | 920 | 920 |
| Conteggio tentativi mixed content | 913 | 920 |

Confronti non valutabili rispetto ai 1.000 tentativi: header 80 siti (cinque header ciascuno), protocollo 80, mixed content 80. Conteggi richieste: 157/920 uguali, 763 diversi; delta medio estensione meno CDP 7.26. Non si richiedono conteggi identici su finestre differenti.

Casi positivi mixed content: CDP 7; estensione 0. Non interpretare coppie 0/0 come sensibilità del detector. I tentativi bloccati possono non raggiungere webRequest, come dimostrato nella controlled validation. Differenze di conteggi/domìni non sono automaticamente bug; le etichette tracker/entità derivate da CDP riusano lo stesso dataset e non sono un oracolo indipendente.

Hostname distinti delle risposte finali confrontabili: 914, su 921 risposte. Sono separati dai 1.000 hostname iniziali e non provano identità semantica o organizzativa.

## Performance e risorse

| Misura | Valore |
| --- | --- |
| Tempo medio per tentativo | 6.90 s |
| Tempo mediano per tentativo | 4.83 s |
| Durata wall delle sessioni di raccolta | 8996.62 s |
| Finestra legacy: manifest → ultimo record | 8993.83 s |
| Campioni risorse | 601 |
| Picco RSS Node | 182.20 MiB |
| Picco RSS Chromium attribuibile | 2131.09 MiB |
| Picco RSS sommata attribuibile | 2217.95 MiB |
| Massimo processi Chromium attribuibili | 17 |

RSS non è memoria virtuale e la somma può contare più volte pagine condivise: non rappresenta tutta la RAM fisica del sistema. CPU non normalizzata a un singolo core; picchi fra campioni di 15 s non osservati. La finestra monitorata è la raccolta; plotting e postprocessing sono separati. Spazio degli output, disco libero e cause di arresto sono nell’audit e nei CSV locali.

P95 durata tentativo: 12.34 s, interpolazione lineare (n−1)×0,95 come pandas. Pressione memoria macOS: 510 campioni normali (1), 91 warning (2), 0 critici (4); disco disponibile minimo 523.24 GiB. La durata wall include pause, reset profili e monitoraggio; media/mediana/P95 descrivono solo i tentativi.

Il timeout di navigazione limita goto, non la durata complessiva del tentativo: il framework riutilizzato non ha un watchdog globale per title, chiamate di protocollo e cleanup. Il tentativo kb.mk ha registrato un timeout da 25 s e una durata totale di circa 129 s. È una limitazione della raccolta, non una prova di difetto del detector; nessuna impostazione è stata cambiata a seguito di questo caso.

## Anomalie e limitazioni

Eventi di anomalia: 515; siti con almeno una segnalazione: 218. Non vengono trasformati automaticamente in bug confermati. L’elenco locale include evidenze e priorità; nessuna correzione del detector viene applicata durante il benchmark.

| Segnalazione | Componente | Eventi | Su visite con errore navigazione | Su visite ristrette |
| --- | --- | --- | --- | --- |
| navigation_failure | navigation/environment | 80 | 80 | 0 |
| extension_console_errors | popup/resource loading | 72 | 71 | 0 |
| missing_sources | extension observation availability | 75 | 75 | 0 |
| document_identity_mismatch | worker/document synchronization | 79 | 75 | 0 |
| active_tab_mismatch | popup/target attribution | 75 | 75 | 0 |
| access_restriction | site access policy | 132 | 0 | 132 |
| collection_failure | popup acquisition | 1 | 0 | 0 |
| missing_analysis | popup acquisition | 1 | 0 | 0 |

| Categoria | navigation_failure | extension_console_errors | missing_sources | document_identity_mismatch | active_tab_mismatch | access_restriction | collection_failure | missing_analysis |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| news | 1 | 1 | 1 | 1 | 1 | 17 | 0 | 0 |
| ecommerce | 6 | 6 | 6 | 7 | 6 | 22 | 0 | 0 |
| technology | 6 | 6 | 6 | 8 | 6 | 9 | 0 | 0 |
| education | 9 | 8 | 8 | 8 | 8 | 10 | 0 | 0 |
| government | 6 | 6 | 6 | 6 | 6 | 25 | 0 | 0 |
| finance | 8 | 7 | 6 | 8 | 8 | 8 | 0 | 0 |
| social | 26 | 20 | 24 | 22 | 22 | 17 | 0 | 0 |
| entertainment | 2 | 2 | 2 | 2 | 2 | 8 | 0 | 0 |
| travel | 7 | 7 | 7 | 7 | 7 | 6 | 0 | 0 |
| technical | 9 | 9 | 9 | 10 | 9 | 10 | 1 | 1 |

Ulteriori confronti CDP da esaminare: 7 siti con almeno una discordanza valutabile di header, protocollo o mixed content. Questi confronti hanno evidenze e finestre nel file locale anomaly-review.json, restano distinti dal conteggio delle anomalie originali e non confermano bug. Le sovrapposizioni con errori di navigazione sono correlazioni descrittive, non attribuzioni causali.

| URL iniziale | Tentativi HTTP CDP | Conteggio BrowserGuard | Tentativi con failure mixed-content |
| --- | --- | --- | --- |
| https://bluidkiti.com/ | 6 | 0 | 6 |
| https://publicdomain4u.com/ | 1 | 0 | 1 |
| https://maprocessing.com/ | 1 | 0 | 1 |
| https://hauntedasheville.com/ | 1 | 0 | 1 |
| https://allboutjolla.blogspot.com/ | 1 | 0 | 1 |
| https://albertus.libguides.com/ | 1 | 0 | 1 |
| https://hosteljobs.net/ | 1 | 0 | 1 |

Le failure CDP forniscono evidenza del blocco dei tentativi HTTP: coerente con il limite di osservabilità già documentato nella controlled validation, senza provare completezza o accuratezza del detector.

| Candidato per indagine separata | Esito | Evidenza |
| --- | --- | --- |
| https://bitbucket.org/inferno-os/inferno-os/ | ok | document_identity_mismatch: {"workerUrl":"https://bitbucket.org/inferno-os/inferno-os/","finalUrl":"https://bitbucket.org/inferno-os/inferno-os/src/master/"} |
| https://cbna.com/ | ok | extension_console_errors: {"messages":["Failed to load resource: net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin"]} |
| https://appgallery.huawei.com/ | ok | document_identity_mismatch: {"workerUrl":"https://appgallery.huawei.com/","finalUrl":"https://appgallery.huawei.com/Featured"} |
| https://code.google.com/p/amop/ | ok | document_identity_mismatch: {"workerUrl":"https://code.google.com/archive/p/amop","finalUrl":"https://code.google.com/archive/p/amop/"} |
| https://discord.com/store/ | ok | document_identity_mismatch: {"workerUrl":"https://discord.com/store/","finalUrl":"https://discord.com/login"} |
| https://feeds.feedburner.com/phpclasses-xml | collection-error | page.waitForFunction: Timeout 15000ms exceeded. |

Priorità: riprodurre separatamente il timeout popup su FeedBurner (15 s, HTTP 200; tipo di documento non accertato dalle sole evidenze selezionate), poi le differenze di URL senza errore goto. Il percorso Discord /store/ è arrivato a /login pur con stato legacy ok: esempio concreto del limite della verifica euristica del titolo. Le altre differenze coinvolgono percorsi dinamici o slash finali; nessun effetto sugli assessment è dimostrato. L’errore console residuo su cbna.com indica ERR_BLOCKED_BY_RESPONSE.NotSameOrigin e richiede attribuzione della risorsa. Nessuno di questi candidati è stato ritentato o confermato come bug dell’estensione.

Indagare prima mismatch di engine/presentazione/identità, contatori impossibili e discordanze di header con risposte realmente abbinate. Missing sources, pagine di errore, restrizioni e differenze di finestra richiedono attribuzione separata. Runtime top-frame, eventi MAIN-world falsificabili, frame/worker non completamente osservati, visibilità API e limiti di retention impediscono una pretesa di completezza.

Nessuna incoerenza riproducibile o bug dell’estensione è confermato da questo benchmark. I controlli deterministici non hanno segnalato mismatch del replay engine/presentazione o violazioni dei contratti delle regole. I casi sopra restano candidati per investigazioni successive; questo non dimostra assenza di difetti.

## Confronto e conclusioni

Vedere [COMPARISON.md](COMPARISON.md). Le versioni e i campioni differiscono: il confronto è descrittivo e non un A/B. Le differenze non dimostrano effetti delle due correzioni né miglioramenti dell’accuratezza. Il risultato operativo è limitato a queste visite, configurazione, geografia, stato dei siti e finestra temporale.

## Audit finale

Audit superato: 1000 ID unici; checkpoint 1000/1000; 239 test automatici PASS; nessun processo/profilo residuo, campo vietato o URL con credenziali/query conservate. File storici verificati per hash, invariati. Output locali 224.14 MiB; analisi 3.12 MiB; cache della fonte 169.57 MiB (ignorata da Git).

Il controllo strutturale non dimostra assenza di ogni possibile identificatore generato dai siti nei path URL: i record grezzi restano locali. Nessun commit o push effettuato.

## Riproduzione e pubblicazione

[Comandi e limiti](METHODS.md); [analisi Python con sei PNG/SVG](ANALYSIS.md); [corpus](corpus/DATASET_1000.md). I risultati grezzi restano in runs/benchmark1000, esclusi da Git; la selezione pubblicabile non copia automaticamente record, profili o policy grezze.

With content from [Curlie.org](https://curlie.org/) - the largest human-edited directory of the web. Contribute by submitting a website or becoming an editor.
