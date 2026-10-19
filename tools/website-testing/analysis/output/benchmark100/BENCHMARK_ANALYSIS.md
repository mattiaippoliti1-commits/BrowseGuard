# BrowserGuard — Statistical Benchmark Analysis

## 1. Executive summary

Ricalcolati **100 tentativi**, **100 assessment acquisiti** e **77 visite classificate come riuscite (77.00%)** dai record originali. Rilevate 22 restrizioni, 1 errori di navigazione e 0 timeout. La durata media del singolo tentativo è 4.80 s, la mediana 4.14 s.

Le 34 segnalazioni originali e le 29 segnalazioni della revisione sono popolazioni distinte. I falsi positivi del validator documentati sono 5. Bug dell'estensione documentati nella revisione: 0; bug del framework documentati: 1. Questi ultimi sono annotazioni di revisione verificate nei file disponibili, non nuovi bug confermati dall'analisi statistica.

## 2. Dataset e popolazioni

Campione pubblico ragionato, non casuale e non rappresentativo di tutto il Web. Le categorie e le loro dimensioni sono riportate nella [tabella di affidabilità](tables/reliability_by_category.csv). Gli assessment acquisiti su blocchi o pagine d'errore non rendono valida la navigazione alla homepage prevista.

La popolazione principale di assessment, tracking e header comprende i record con stato `ok` o `partial`, senza errore di navigazione, restrizione rilevata o errore di estrazione. Include 2 risposte HTTP 202 nell'intero benchmark: il criterio del framework non garantisce la visualizzazione integrale della pagina prevista. Gli assessment parziali nell'intero dataset sono 1; i dati mancanti restano mancanti. I grafici di affidabilità e performance comprendono invece tutti i tentativi.

## 3. Metodologia statistica

Statistiche descrittive calcolate con Pandas: media, mediana, minimo, massimo, deviazione standard **campionaria** (`ddof=1`), quartili e percentili con interpolazione lineare. La deviazione standard non è stimata per meno di due valori. Percentuali calcolate sui denominatori dichiarati; un denominatore nullo produce un dato non valutabile, mai 0% automatico. I boxplot usano Q1–Q3, mediana e baffi a 1.5×IQR: gli outlier sono statistici, non etichette di bug.

Nessuna soglia di rischio, classificazione aggiuntiva, precision, recall, F1-score o accuracy dei detector: manca un ground truth indipendente. Non si calcolano inferenze di popolazione da questo campione di convenienza. Gli stessi input e le stesse versioni delle librerie producono gli stessi artefatti, senza timestamp dinamici nei grafici.

## 4. Affidabilità del benchmark

![Benchmark reliability](figures/benchmark_reliability.png)

| category | n | successful | restricted | navigation_error | other_failure | success_pct |
| --- | --- | --- | --- | --- | --- | --- |
| Banche e servizi finanziari | 10 | 9 | 1 | 0 | 0 | 90 |
| E-commerce | 15 | 7 | 8 | 0 | 0 | 46.67 |
| Informazione e giornali | 15 | 11 | 3 | 1 | 0 | 73.33 |
| Intrattenimento e streaming | 5 | 5 | 0 | 0 | 0 | 100 |
| Pubblica amministrazione | 10 | 8 | 2 | 0 | 0 | 80 |
| Siti tecnici di riferimento | 5 | 5 | 0 | 0 | 0 | 100 |
| Social network e community | 10 | 6 | 4 | 0 | 0 | 60 |
| Tecnologia e software | 15 | 14 | 1 | 0 | 0 | 93.33 |
| Università e istruzione | 10 | 9 | 1 | 0 | 0 | 90 |
| Viaggi e turismo | 5 | 3 | 2 | 0 | 0 | 60 |

La figura usa esiti mutuamente esclusivi: successo, errore di navigazione, restrizione, altro fallimento. I contatori di timeout, parzialità e messaggi d'errore possono sovrapporsi ad altri esiti; non vanno sommati come popolazioni disgiunte. [Tabella riepilogativa completa](tables/reliability_summary.csv).

## 5. Distribuzione degli assessment

![Assessment distribution](figures/assessment_distribution.png)

| dimension | Low | Moderate | High | Unavailable | Missing |
| --- | --- | --- | --- | --- | --- |
| security | 76 | 1 | 0 | 0 | 0 |
| privacy | 34 | 21 | 22 | 0 | 0 |
| network | 31 | 24 | 11 | 11 | 0 |

Il denominatore principale è 77 visite riuscite per dimensione. `Unavailable` rappresenta il trattino mostrato dall'interfaccia; `Missing` indica un'etichetta assente. Un Network non valutabile può dipendere dalla copertura dell'attribuzione anche quando gli input sono completi. Low non certifica la sicurezza del sito. Le [frequenze e percentuali globali](tables/assessment_distribution.csv) e le [distribuzioni per categoria](tables/assessments_by_category.csv) includono separatamente anche tutti i tentativi.

## 6. Attività associata al tracking

![Tracking-associated activity](figures/tracking_activity.png)

| metric | n | missing | mean | median | min | max | std_sample | q1 | q3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tracker_domains | 77 | 0 | 3.22 | 2 | 0 | 33 | 4.64 | 0 | 5 |
| tracker_requests | 77 | 0 | 9.57 | 3 | 0 | 107 | 17.46 | 0 | 11 |

Solo visite riuscite; i contatori mancanti sono esclusi dalle statistiche, non sostituiti con zero. L'associazione di dominio al dataset non prova che ogni richiesta effettui tracking; lo zero non dimostra assenza di tracking. [Statistiche complete per categoria e popolazione](tables/tracking_statistics.csv).

## 7. Header di sicurezza

![Security headers](figures/security_headers.png)

| header | population_n | present | absent | not_evaluable | valid_denominator | presence_pct_valid |
| --- | --- | --- | --- | --- | --- | --- |
| Content-Security-Policy | 77 | 37 | 38 | 2 | 75 | 49.33 |
| Strict-Transport-Security | 77 | 59 | 16 | 2 | 75 | 78.67 |
| X-Content-Type-Options | 77 | 47 | 28 | 2 | 75 | 62.67 |
| Referrer-Policy | 77 | 29 | 46 | 2 | 75 | 38.67 |
| Permissions-Policy | 77 | 19 | 56 | 2 | 75 | 25.33 |

Un confronto richiede una risposta HTTP(S) finale del documento principale, con URL coincidente con quella osservata, header CDP registrati e presenza BrowserGuard espressa da un booleano. I valori ignoti restano non valutabili. La percentuale è **presenti / (presenti + assenti)**, non presenti / tutti i siti. CSP indica l'header enforced; una policy report-only non è un header CSP enforced. La figura esclude le visite limitate; la [tabella completa](tables/header_presence.csv) include separatamente tutti i tentativi. L'assenza di un header non dimostra automaticamente una vulnerabilità.

## 8. Consistenza delle osservazioni CDP

![Observed request comparison](figures/cdp_comparison.png)

| measurement | eligible | not_evaluable | agree | disagree | agreement_pct | unit |
| --- | --- | --- | --- | --- | --- | --- |
| protocol | 97 | 3 | 97 | 0 | 100 | document pairs |
| mixed_content | 97 | 3 | 97 | 0 | 100 | document pairs |
| header_presence | 485 | 15 | 485 | 0 | 100 | header pairs |

Il protocollo è ricalcolato dall'URL della **risposta CDP effettiva confrontabile**, non dal nome del campo `cdpUsesHTTPS` dell'arricchimento, che nel postprocessore precedente era derivato dall'URL finale Playwright. I denominatori sono distinti: header singoli, coppie di documenti per protocollo, coppie di contatori per mixed content. La concordanza non è una misura di accuratezza degli assessment. Nei documenti confrontabili, i casi con tentativi mixed content >0 sono 0 per CDP e 0 per BrowserGuard; una concordanza di zeri non verifica la sensibilità ai casi positivi. I documenti HTTPS osservati da CDP sono 97 su 97: il campione non verifica automaticamente il comportamento su HTTP.

| population | n | missing | mean | median | min | max | different_counts | mean_absolute_delta | max_absolute_delta |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| successful | 75 | 2 | 6.83 | 3 | -26 | 87 | 66 | 8.83 | 87 |
| all | 97 | 3 | 5.75 | 4 | -26 | 87 | 84 | 7.86 | 87 |

La differenza è BrowserGuard − CDP. Il grafico usa soltanto visite riuscite con richiesta finale del documento identificabile e due contatori disponibili; le finestre **non sono identiche**. La linea y=x è un riferimento geometrico, non un criterio di correttezza. I tre punti con maggiore differenza assoluta sono evidenziati per rango descrittivo, senza una soglia di bug. Redirect, cache, worker, iframe e differenze di visibilità possono spiegare gli scostamenti. [Concordanze](tables/cdp_agreement.csv) e [differenze richieste](tables/request_differences.csv).

## 9. Performance

![Benchmark performance](figures/benchmark_performance.png)

| category | n | missing | mean | median | std_sample | p90 | p95 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| All categories | 100 | 0 | 4.80 | 4.14 | 2.27 | 6.31 | 7.35 |
| Banche e servizi finanziari | 10 | 0 | 4.86 | 4.84 | 1.11 | 5.83 | 6.58 |
| E-commerce | 15 | 0 | 6.11 | 4.09 | 5.04 | 8.56 | 13.96 |
| Informazione e giornali | 15 | 0 | 5.10 | 4.36 | 1.89 | 6.51 | 7.81 |
| Intrattenimento e streaming | 5 | 0 | 4.78 | 4.78 | 0.45 | 5.23 | 5.35 |
| Pubblica amministrazione | 10 | 0 | 4.20 | 4.01 | 0.63 | 5.13 | 5.27 |
| Siti tecnici di riferimento | 5 | 0 | 3.84 | 3.89 | 0.21 | 4.04 | 4.06 |
| Social network e community | 10 | 0 | 3.89 | 3.78 | 0.34 | 4.28 | 4.34 |
| Tecnologia e software | 15 | 0 | 4.50 | 4.21 | 0.77 | 5.56 | 5.81 |
| Università e istruzione | 10 | 0 | 4.38 | 3.92 | 1.22 | 4.92 | 6.33 |
| Viaggi e turismo | 5 | 0 | 5.62 | 5.11 | 2.06 | 7.81 | 8.37 |

I tempi includono navigazione, attesa di osservazione ed estrazione dal popup: **non sono latenza esclusiva dell'estensione**. La somma dei tempi dei singoli tentativi è 480.18 s. Le finestre di esecuzione ricostruibili dai manifest totalizzano 688.83 s; l'intervallo con la revisione tra fasi è 738.01 s. Se il manifest non espone queste finestre, il totale rimane non valutabile, anziché essere inventato dalla somma dei tentativi. [Statistiche complete](tables/performance_statistics.csv).

## 10. Anomalie e limitazioni

| code | original_events | reviewed_events | verified_false_positives |
| --- | --- | --- | --- |
| access_restriction | 22 | 22 | 0 |
| active_tab_mismatch | 1 | 1 | 0 |
| document_identity_mismatch | 3 | 3 | 0 |
| extension_console_errors | 1 | 1 | 0 |
| missing_sources | 1 | 1 | 0 |
| navigation_failure | 1 | 1 | 0 |
| privacy_rule_contract | 5 | 0 | 5 |

Le restrizioni di accesso e i problemi ambientali restano separati dalle incoerenze deterministiche. Le annotazioni di revisione vengono lette senza riscrivere o cancellare le segnalazioni originali. Nessuna anomalia residua è automaticamente confermata come bug. I record raw, le evidenze per sito e le annotazioni complete sono disponibili **soltanto localmente** nell'input del benchmark e non sono necessari per leggere questo report su GitHub.

- Nessuna anomalia strutturale aggiuntiva rilevata dal caricamento.

La raccolta riguarda una sola visita per sito; geografia, consenso, protezioni anti-bot, distribuzione delle categorie e stato del profilo influenzano i risultati. Il matching dei documenti usa le URL salvate: query e frammenti erano già stati rimossi in raccolta, quindi non è una verifica completa di identità del documento. Le statistiche non misurano la copertura completa delle attività e non sono accompagnate da una misura di picco RAM. Il materiale pubblicabile contiene solo aggregati: nessuna URL individuale, identificatore di sito, policy completa, log o profilo Chromium.

## 11. Conclusioni e preparazione a 1.000 siti

I dati misurano l'affidabilità della raccolta nelle condizioni osservate e la coerenza di alcune osservazioni, non la sicurezza dei siti né l'accuratezza complessiva dei detector. Prima di 1.000 siti: conservare la correzione documentata del validator, verificare nuovamente resume e schemi su un piccolo campione, revisionare un corpus distinto più ampio, mantenere concorrenza 1 sul Mac da 8 GB e monitorare memoria e disco. Nessun benchmark aggiuntivo è stato eseguito da questo modulo.

Le versioni delle librerie usate sono registrate in [analysis_environment.csv](tables/analysis_environment.csv); i digest delle sorgenti locali in [source_integrity.csv](tables/source_integrity.csv). Le immagini PNG sono a 300 DPI; accanto a ogni PNG è disponibile l'SVG omonimo. Tutti i collegamenti necessari al report sono relativi ad artefatti pubblicabili, senza dipendenze da `runs/`.
