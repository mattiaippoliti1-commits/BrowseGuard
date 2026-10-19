# BrowserGuard — Benchmark su 100 siti pubblici

## 1. Obiettivi

Valutare acquisizione, affidabilità e consistenza delle osservazioni di BrowserGuard su 100 URL HTTPS pubbliche, senza modificare detector, soglie, UI o permessi. Campione ragionato per categorie, non rappresentativo dell'intero Web. Non misura la capacità di certificare la sicurezza dei siti.

## 2. Metodologia

Uno smoke test di 10 siti (uno per categoria), seguito da 90 URL disgiunte dopo il superamento del controllo preliminare. I risultati dello smoke sono riutilizzati senza nuove visite: 100 URL uniche, 100 record effettivi, nessuna sostituzione silenziosa dei siti limitati. Due esecuzioni del runner esistente; nessun login, click, modulo, acquisto o aggiramento di CAPTCHA/403/429. Nessuna chiamata AI o trasmissione dei risultati a servizi esterni.

Chromium carica l'estensione reale. Il popup acquisisce gli snapshot; una strumentazione nel solo popup cattura input e output effettivi dell'Assessment Engine. CDP osserva separatamente richieste e header selezionati. I record originali sono copiati senza modifiche nel report aggregato; [provenance.json](runs/benchmark100/provenance.json) registra fase e SHA-256 di ogni record. I manifest e checkpoint delle due fasi sono conservati nel [manifest aggregato](runs/benchmark100/manifest.json). Il resume è stato verificato sullo smoke: tutti i 10 hash sono rimasti invariati e non sono state ripetute visite.

## 3. Composizione del dataset

[Metadati JSON](datasets/benchmark100.json), [CSV con motivazioni](datasets/benchmark100.csv), [100 URL](datasets/benchmark100.txt) e [istruzioni delle due fasi](datasets/README.md). Verificate 100 URL HTTPS senza credenziali/query, 100 gruppi di dominio registrabile distinti e le quantità esatte delle categorie. L'effettiva raggiungibilità deriva dalle visite, non dalla selezione preventiva.

## 4. Ambiente e configurazione

- Sistema: darwin arm64; Node v25.2.1; Playwright 1.58.2; Chromium 145.0.7632.6.
- Concorrenza: 1; profili temporanei isolati, riciclati ogni 25 siti.
- Timeout navigazione: 25000 ms; setup/popup: 15000 ms. Osservazione aggiuntiva: 3000–10000 ms; pausa: 2000 ms.
- AI disabilitata: il runner e questo postprocessore non invocano il componente AI. L'eventuale ai-packet.json è soltanto un file locale non trasmesso.
- SHA-256 sorgenti estensione: `3403c1f4b72a9d285c2dea014a53a1c106d02cf2c97784dd5640b4b050533811`.
- SHA-256 harness: `a1fea1831ccf1dc3c10e04ec32859dbc41c4851e2815a2871e5ec211977a8896`.
- Inizio smoke: 2026-10-19T15:48:03.988Z; ultimo record della fase principale: 2026-10-19T16:00:21.995Z (UTC nei manifest).

## 5. Risultati aggregati

| Misura | Risultato |
| --- | ---: |
| URL elaborate | 100 |
| Assessment acquisiti | 100 |
| Navigazioni con risposta principale e senza errore goto | 99 |
| Analisi riuscite senza restrizioni (anche se parziali) | 77 (77%) |
| Siti classificati con restrizioni (anche tramite titolo) | 22 |
| Errori di navigazione | 1 |
| Siti con timeout di navigazione/estrazione | 0 |
| Siti con HTTP principale >=400 | 22 |
| Risposte HTTP >=400 nel flusso CDP, incluse risorse | 83 |
| Errori di raccolta/validazione del framework | 0 |
| Siti con messaggi console di errore dell'estensione | 1 |
| Assessment con fonti parziali | 1 |
| Tempo medio per tentativo | 4,8 s |
| Tempo mediano per tentativo | 4,14 s |
| Media richieste BrowserGuard (snapshot disponibili) | 83,39 |
| Media domini associati al tracking (snapshot disponibili) | 2,6 |
| Durata delle finestre di esecuzione | 688,83 s (11,48 min) |
| Intervallo complessivo incluso controllo tra le fasi | 738,01 s |
| Eventi anomali segnalati | 34 |
| Siti con almeno una segnalazione | 30 |
| Falsi positivi del validator verificati | 5 |
| Segnalazioni residue dopo revisione | 29 |
| Bug confermati BrowserGuard | 0 |
| Bug confermati del framework (corretto) | 1 |

La durata di esecuzione somma, per ciascuna fase, il tempo fra avvio del manifest e fine dell'ultimo record; include avvio browser e pause tra siti, esclude la pausa finale e la generazione del report. La media/mediana considera il singolo tentativo, senza pausa tra siti. Le categorie di errore possono sovrapporsi. Un errore console su una pagina di errore browser non dimostra un difetto dell'estensione. Gli assessment acquisiti su blocchi/errori non equivalgono ad analisi riuscite della pagina prevista. La percentuale di riuscita segue la classificazione del framework: nessun errore di navigazione/estrazione e nessuna restrizione rilevata dalla sua euristica. Sono incluse due risposte HTTP 202; un 2xx non garantisce che la homepage prevista sia stata mostrata integralmente. Le medie dei contatori includono soltanto gli snapshot disponibili, anche se relativi a risposte limitate.

Distribuzione HTTP principale: `{"200":75,"202":2,"401":1,"403":19,"429":1,"500":1,"not-recorded":1}`.

### Assessment: tutti i risultati e sole visite riuscite

| Dimensione | Tutti i tentativi | Solo analisi riuscite |
| --- | --- | --- |
| security | {"Low":98,"—":1,"Moderate":1} | {"Low":76,"Moderate":1} |
| privacy | {"High":22,"Low":55,"Moderate":23} | {"High":22,"Moderate":21,"Low":34} |
| network | {"High":15,"Moderate":33,"Low":39,"—":13} | {"High":11,"Moderate":24,"Low":31,"—":11} |

Privacy High: 22 risposte; Network High: 15 risposte. Sono livelli informativi esistenti, non nuovi punteggi o giudizi di pericolosità.

### Maggior numero di domini associati al tracking osservati

Ordinamento descrittivo dei contatori, senza introdurre una soglia aggiuntiva. Le righe possono includere risposte limitate; lo stato è esplicito.

| URL | Stato | Domini associati | Richieste associate | Richieste esterne confermate |
| --- | --- | ---: | ---: | ---: |
| https://www.amazon.com/ | ok | 33 | 64 | 53 |
| https://www.npr.org/ | ok | 12 | 25 | 108 |
| https://www.corriere.it/ | ok | 12 | 107 | 128 |
| https://www.target.com/ | ok | 11 | 78 | 109 |
| https://www.cnn.com/ | ok | 9 | 24 | 41 |
| https://www.repubblica.it/ | ok | 8 | 19 | 84 |
| https://www.wellsfargo.com/ | ok | 8 | 17 | 20 |
| https://www.ansa.it/ | ok | 8 | 47 | 122 |
| https://www.edx.org/ | ok | 7 | 14 | 19 |
| https://www.docker.com/ | ok | 7 | 14 | 36 |

Le risposte con header mancanti (67 snapshot con risposta principale HTTP <400 confrontabile e almeno uno dei cinque header controllati assente), i livelli elevati e le fonti mancanti sono elencati in [benchmark-statistics.json](runs/benchmark100/benchmark-statistics.json), sezione indicators. Un header assente non dimostra una vulnerabilità.

## 6. Risultati per categoria

| Categoria | URL | Assessment | Riuscite | Restrizioni | Timeout | Eventi anomali | Media s |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Informazione e giornali | 15 | 15 | 11 | 3 | 0 | 9 | 5,1 |
| E-commerce | 15 | 15 | 7 | 8 | 0 | 10 | 6,11 |
| Tecnologia e software | 15 | 15 | 14 | 1 | 0 | 1 | 4,5 |
| Università e istruzione | 10 | 10 | 9 | 1 | 0 | 1 | 4,38 |
| Pubblica amministrazione | 10 | 10 | 8 | 2 | 0 | 2 | 4,2 |
| Banche e servizi finanziari | 10 | 10 | 9 | 1 | 0 | 4 | 4,86 |
| Social network e community | 10 | 10 | 6 | 4 | 0 | 5 | 3,89 |
| Intrattenimento e streaming | 5 | 5 | 5 | 0 | 0 | 0 | 4,78 |
| Viaggi e turismo | 5 | 5 | 3 | 2 | 0 | 2 | 5,62 |
| Siti tecnici di riferimento | 5 | 5 | 5 | 0 | 0 | 0 | 3,84 |

[Statistiche complete per categoria e distribuzioni](runs/benchmark100/benchmark-statistics.json) e [CSV per categoria](runs/benchmark100/categories.csv).

## 7. Anomalie ed evidenze riproducibili

Codici e frequenze: `{"access_restriction":22,"document_identity_mismatch":3,"navigation_failure":1,"extension_console_errors":1,"missing_sources":1,"active_tab_mismatch":1,"privacy_rule_contract":5}`. Le restrizioni e i fallimenti ambientali restano inclusi; non sono tutti bug potenziali del detector. Il conteggio non somma ogni differenza CDP come una nuova anomalia. Fra le segnalazioni originali, 5 sono falsi positivi verificati del controllo Privacy; restano 29 segnalazioni su 25 siti. [Revisione](runs/benchmark100/reviewed-anomalies.json) e [falsi positivi con evidenze](runs/benchmark100/validator-false-positives.json) mantengono la distinzione senza alterare i record originali.

| URL | Codici | Evidenza |
| --- | --- | --- |
| https://stackoverflow.com/ | access_restriction | [Record JSON](runs/benchmark100/records/1800197746466231fe507fe02431db83181e344a2367ba832ad09de708a736a1.json) |
| https://opencv.org/ | access_restriction | [Record JSON](runs/benchmark100/records/73ca67ac980510b451d006b96352397b03ad997431f9b9681c68804bacbac8d8.json) |
| https://www.unicreditgroup.eu/ | access_restriction | [Record JSON](runs/benchmark100/records/045c9c2dd869b985ebba3c3ab2b73d947636d64f9695bad1a4fb8f18777b0fb9.json) |
| https://www.nytimes.com/ | access_restriction | [Record JSON](runs/benchmark100/records/10b6b18f32d34529f830e2e70839c4b13297ed2f6515beb809dd7a3708250295.json) |
| https://www.leroymerlin.it/ | access_restriction | [Record JSON](runs/benchmark100/records/133195fbe686ca00813b0758bcccbc0575d1f6af22e29acec3157f3214d54f7c.json) |
| https://www.esteri.it/ | access_restriction | [Record JSON](runs/benchmark100/records/1387a1ef0f858b0978137e2f15919e561888e98371203f134ec16115b6e1beca.json) |
| https://www.dw.com/ | document_identity_mismatch | [Record JSON](runs/benchmark100/records/16b0bf7eef5c95ba9a1cbb8e2e6b7686ff1e6469ecc1bc0fe52f4ff04f6153a8.json) |
| https://www.quora.com/ | access_restriction | [Record JSON](runs/benchmark100/records/1a78e55d6617c7d284366c040d5d78c63e2c2150bef5c77505394cbfe75d4f59.json) |
| https://medium.com/ | access_restriction | [Record JSON](runs/benchmark100/records/206cc24ad041a6acd8fb5a12e42a8c7b3a29e0d4a98cb89287b44f8311487eaa.json) |
| https://www.washingtonpost.com/ | navigation_failure, extension_console_errors, missing_sources, document_identity_mismatch, active_tab_mismatch | [Record JSON](runs/benchmark100/records/28a45ad2234d9ba6f8324062c5077bdd1b0ae0d0e2cc6f53e27be2c9e9702717.json) |
| https://www.ebay.com/ | access_restriction | [Record JSON](runs/benchmark100/records/4f0783365fcc0c95d96e5d4969cb7103d88605e25b80d9155f86b9f816006004.json) |
| https://apnews.com/ | access_restriction | [Record JSON](runs/benchmark100/records/5f5348c331296c87994add3cd0d531b8862ad7ce2c7795ddda0fbd473229c2da.json) |
| https://www.decathlon.it/ | access_restriction | [Record JSON](runs/benchmark100/records/6892d7499a7239b648c3fe566fd285f982de94da7827486e0fce7066b17e5699.json) |
| https://www.tripadvisor.com/ | access_restriction | [Record JSON](runs/benchmark100/records/788e2443feaabe7d86e476204aefaba2b23db7c9097111185df1f5ee85f31a09.json) |
| https://www.bankofamerica.com/ | privacy_rule_contract | [Record JSON](runs/benchmark100/records/7b775fa206d076318c830a2c5c3219eb628462625d4dcdf2c0a51c3a23d1231c.json) |
| https://www.reuters.com/ | access_restriction | [Record JSON](runs/benchmark100/records/938754f9bd588c147a5340d9dcb42d0eb7ef56c16064a788e05fa99ade9f92c6.json) |
| https://www.bestbuy.com/ | privacy_rule_contract | [Record JSON](runs/benchmark100/records/98024e21f1f95892a4893270129a9184833a409f7c5ceab7eefdb8e8b1fcb105.json) |
| https://mastodon.social/ | document_identity_mismatch | [Record JSON](runs/benchmark100/records/98aacac2e7f5a597a52814da81cf231da1331fa49e6cd435551f32c6190342bd.json) |
| https://www.expedia.com/ | access_restriction | [Record JSON](runs/benchmark100/records/9a934ee910a5b2dc01ac59f6f16ed05c5808c04858269d79e15b752f14a5e592.json) |
| https://www.adidas.com/ | access_restriction | [Record JSON](runs/benchmark100/records/9d8cde422ba874b40b8791cae9ed6e4aaf0c0a2d53bfd64edd7c33e6a890d4bc.json) |
| https://www.hm.com/ | access_restriction | [Record JSON](runs/benchmark100/records/a38dbaccfd071cdc7ee686b165e0788d18054da364223ac709863030f6def8ff.json) |
| https://www.zalando.it/ | access_restriction | [Record JSON](runs/benchmark100/records/aa558aa6f15f5d57984e04216374344ab1c5a2ec470bcab24017b8db374045c6.json) |
| https://www.uniqlo.com/ | access_restriction | [Record JSON](runs/benchmark100/records/aea576a85fb973955cdc406ddbef50c5ad0fee43074ea7a43f9dfa6d2ab2a2d7.json) |
| https://www.etsy.com/ | access_restriction | [Record JSON](runs/benchmark100/records/bfc328c769d020b3b0aec8066f7f8cbf3d328c9ea4e67733094d4e3fcc45df9f.json) |
| https://lemmy.world/ | access_restriction | [Record JSON](runs/benchmark100/records/ca60c080192d10e86103570a577aa4cad3ea277c77e6076e05962c69ac68315c.json) |
| https://www.agid.gov.it/ | access_restriction | [Record JSON](runs/benchmark100/records/cb594bcd0c8ec3dcf31fe44f63e1bb566972ef74b52d19d783a9a078aedb1494.json) |
| https://www.chase.com/ | privacy_rule_contract | [Record JSON](runs/benchmark100/records/dc71eae379335a9950c34aa0ae03dc90a0bf41e9bc716ed560a01317ab56d246.json) |
| https://www.citigroup.com/ | privacy_rule_contract | [Record JSON](runs/benchmark100/records/dde8de87278ba9fc32c7204555708e41bf89f1330530f715d1014f10487f8f67.json) |
| https://www.walmart.com/ | privacy_rule_contract | [Record JSON](runs/benchmark100/records/f1cee2e3108d23754f824388e180fd3646004321a4ec462f39142c37d2428aa3.json) |
| https://www.ox.ac.uk/ | access_restriction | [Record JSON](runs/benchmark100/records/fadf3f0b6c913df4790ce18abf506ac2357c8104d370fc857485d9f81e41a02a.json) |

Ogni record contiene messaggi, URL osservate, assessment, fonti e finestre temporali; [anomalies.json](runs/benchmark100/anomalies.json) mantiene l'evidenza di ogni evento. Per riprodurre una segnalazione, usare sorgenti/hash e configurazione registrati, mettere la URL originale in un file e seguire la procedura di riproduzione del [framework](README.md). Per 403/429/CAPTCHA consultare soltanto i record: non tentare aggiramenti o retry per ottenere accesso.

### Confronto con CDP

- Siti con totali richieste differenti: 85; non imposta un'asserzione di uguaglianza.
- Siti con richiesta di navigazione finale identificabile: 97; con differenze negli insiemi di domini esterni/tracker: 28.
- Siti con risposta principale finale confrontabile per gli header: 97; differenze di presenza: 0.
- Differenze HTTP/HTTPS confrontabili: 0.
- Siti confrontabili per tentativi mixed content: 97; differenze di conteggio: 0.
- Siti con dettagli richieste troncati dal limite: 0.

[cdp-comparisons.json](runs/benchmark100/cdp-comparisons.json) conserva insiemi di hostname/domini, differenze, header e timestamp per sito. L'arricchimento dei dati CDP riusa lo stesso dataset locale e la medesima euristica di dominio: è indipendente la raccolta, non la verità della classificazione. Nessun dato mancante è sostituito con zero.

## 8. Limitazioni metodologiche

Le osservazioni CDP includono una finestra diversa da quella degli snapshot sequenziali dell'estensione. Per i confronti derivati si parte dalla richiesta finale del documento quando identificabile, senza pretendere equivalenza completa. Redirect, cambi URL tramite History API, cache, iframe in altri processi e worker possono spiegare differenze. Le URL salvate non contengono query o frammenti. Le protezioni anti-bot, le pagine regionali e il mancato consenso condizionano il campione. Nessun login o interazione di consenso è stato effettuato. L'assenza di tentativi mixed content osservati non prova l'assenza di contenuti insicuri.

Lo stato del browser può persistere tra siti del medesimo blocco di 25; il popup viene aperto come tab di estensione in background, non come flyout. Non sono misurati picco RAM, consumo energetico o correttezza completa dei tracker. Il replay dell'engine condivide il codice di produzione e verifica integrazione/determinismo, non costituisce un oracolo totalmente indipendente.

## 9. Bug confermati

Nessun bug confermato nei detector, nell'Assessment Engine o nella UI di BrowserGuard. Confermato e corretto **un bug del validator del framework**: il controllo indipendente Privacy confrontava nomi nudi con dettagli nel formato API:dettaglio. Ciò ignorava superfici sensibili e generava falsi positivi di violazione regola. Il test aggiunto benchmark100-regression.test.cjs falliva prima della correzione e passa dopo. La correzione minima riguarda solo il confronto dei token runtime in validate.cjs, senza modificare soglie o assessment.

La correzione è stata applicata soltanto dopo la conclusione delle visite, mantenendo stabile il fingerprint durante entrambe le fasi. Le evidenze originali e il validator precedente sono preservati in [review-evidence](runs/benchmark100/review-evidence/). La revisione offline non ha richiesto nuove visite. I manifest continuano a descrivere l'harness effettivamente usato; un eventuale nuovo run deve avere una nuova directory, perché il resume rifiuta correttamente un harness diverso.

Dopo la revisione restano 0 eventi nelle verifiche deterministiche principali. Messaggi di errore o differenze di URL non sono da soli una dimostrazione causale di un difetto.

## 10. Raccomandazioni

1. Distinguere sistematicamente assessment acquisiti, pagine limitate e analisi riuscite: mantenere entrambe le distribuzioni nei confronti futuri.
2. Analizzare i cambi di identità del documento e le pagine di errore prima di attribuire URL discordanti o fonti mancanti ai detector.
3. Valutare in futuro un identificatore di documento e timestamp per ogni snapshot, per rendere più forte il confronto tra le fonti. Nessuna modifica applicativa è stata introdotta qui.
4. Conservare dataset, manifest e record; investigare prima le anomalie deterministiche o di estrazione, poi i confronti fra finestre differenti.
5. Non interpretare Low come certificazione di sicurezza, High Privacy come prova di tracking effettivo, o High Network come prova di attività malevola.

## 11. Fattibilità di 1.000 siti

Procedere con un benchmark su 1.000 siti a concorrenza 1, conservando checkpoint e separando esplicitamente le risposte limitate dalle analisi valide.

Alla velocità osservata, 1.000 siti richiederebbero circa 1,91 ore per le sole finestre di esecuzione, assumendo distribuzione simile di pagine e timeout. È una proiezione, non un benchmark eseguito. RAM e disco vanno controllati durante il run; non è disponibile una misura del picco RAM. Per un Mac da 8 GB mantenere concorrenza 1. Il corpus andrebbe ampliato e revisionato, senza riutilizzare 100 siti come se fossero 1.000 distinti.

## Artefatti e modifiche

[Report HTML navigabile](runs/benchmark100/benchmark.html), [report completo del framework](runs/benchmark100/report.html), [dataset JSON](runs/benchmark100/dataset.json), [CSV](runs/benchmark100/summary.csv), [fallimenti](runs/benchmark100/failed-tests.json). Gli artefatti raw restano locali nella directory runs ignorata da Git.

Aggiunti soltanto corpus, metadati, documentazione e postprocessore offline specifico del benchmark; il README del framework collega la nuova procedura. Unica modifica a un modulo preesistente del framework: confronto dei token runtime in validate.cjs, necessario per eliminare falsi positivi dimostrati dal benchmark. Aggiunto un test di regressione; nessuna modifica a runner, collector, report generator, test esistenti o codice di produzione. Nessun servizio esterno di analisi e nessun commit.
