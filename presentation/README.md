# Presentazione BrowserGuard

Presentazione Beamer in italiano: **10 slide, formato 16:9**, design minimalista su fondo bianco, palette BrowserGuard e logo originale del repository. Durata prevista: circa **14 minuti**, inclusa una breve dimostrazione. Le note `\note{...}` nel sorgente contengono la traccia orale, precisazioni sulle regole e tempi indicativi; sono nascoste nel PDF destinato alla proiezione.

## File

- `browserguard_presentation.tex`: sorgente completo, diagrammi TikZ e note per l'esposizione.
- `browserguard_presentation.pdf`: PDF compilato e controllato visivamente.
- `assets/browserguard-logo.png`: copia del logo già presente in `assets/icons/Logo.png`.
- `test-results.txt`: esito dell'esecuzione della suite esistente.
- `verification/compilation.log`: log dell'ultima compilazione, senza overfull/underfull box.

## Compilazione

Da questa directory, con una distribuzione LaTeX standard (verificata con TeX Live 2025):

```sh
pdflatex -no-shell-escape -interaction=nonstopmode -halt-on-error browserguard_presentation.tex
pdflatex -no-shell-escape -interaction=nonstopmode -halt-on-error browserguard_presentation.tex
```

Pacchetti utilizzati: Beamer, fontenc/inputenc, babel italiano, TeX Gyre Heros, graphicx e TikZ. Nessun font di sistema, download o shell escape necessario. Il canvas misura 18 × 10,125 cm e mantiene il rapporto 16:9. Il titolo non mostra la numerazione; le altre slide riportano il numero sul totale di 10.

## Dimostrazione

Il redesign riserva spazi per grafici personalizzati, senza diagrammi complessi o popup simulati. Il comando riutilizzabile `\graphicplaceholder[altezza]{descrizione}` crea un'area chiara con bordo tratteggiato; `\graphicasset[altezza]{file}{descrizione}` la sostituisce automaticamente se il file esiste. Il contenitore mantiene altezza e larghezza anche quando si aggiunge l'immagine, con proporzioni conservate. I commenti accanto alle slide indicano i file da inserire:

| Slide | Asset facoltativo | Altezza |
| --- | --- | --- |
| 2 | `assets/illustrazione.png` | 3,3 cm |
| 4 | `assets/architettura.png` | 4,75 cm |
| 5 | `assets/flusso-dati.png` | 4,2 cm |
| 6 | `assets/assessment.png` | 4,25 cm |
| 8 | `assets/popup-screenshot.png` | 5,1 cm |
| 9 | `assets/test-risultati.png` | 3,75 cm |

Le immagini non sono necessarie per compilare. Inserirle nei percorsi indicati e ricompilare due volte. Lo screenshot deve essere una cattura reale; il grafico dei test deve usare solo risultati verificati. Il diagramma architetturale deve rispettare i flussi descritti nelle note (motore nel popup, DOM su richiesta, rete/runtime nel worker). I dettagli tecnici e le soglie sono stati conservati nelle note, riducendo il testo proiettato.

Per usare le pagine di prova, dalla radice del repository:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Aprire `http://127.0.0.1:8000/test-pages/runtime-privacy-test.html` oppure `dom-analysis-test.html` in Chrome con l'estensione caricata. Ricaricare dopo l'attivazione dell'estensione per installare il monitor a `document_start`. Il popup richiede gli snapshot all'apertura: riaprirlo per una nuova raccolta. Il server locale HTTP non dimostra l'hardening HTTPS; `web-security-test.html` richiede un server HTTPS con header appropriati per quella parte della demo. L'HTML da solo non configura gli header di risposta. Eventuali richieste mixed content dipendono anche dai blocchi/aggiornamenti effettuati da Chrome.

## Tracciabilità tecnica

Contenuto riferito allo stato del repository analizzato il **14 ottobre 2026**, HEAD `0f159b1`. Non sono stati modificati file dell'applicazione.

| Slide | Argomento | Fonti locali principali |
| --- | --- | --- |
| 1–3 | Contesto, motivazione, obiettivi e significato delle dimensioni | `manifest.json`, `README.md`, assessment engine |
| 4 | Flussi reali: worker, content script, storage e motore nel popup | `background/service-worker.js`, `content/*.js`, `popup/popup.js`, `popup/popup.html` |
| 5 | Raccolta e classificazione dei segnali | page analysis, runtime monitor/bridge, matcher, entity resolver, web security analyzer |
| 6 | Soglie e gestione delle sorgenti mancanti | `modules/assessment/assessment-engine.js` |
| 7 | Permessi, minimizzazione e dataset | `manifest.json`, `PRIVACY.md`, `THIRD_PARTY_NOTICES.md`, metadata del dataset |
| 8–9 | Demo, verifiche e limiti | `test-pages/*.html`, `tests/*.test.js`, risultato allegato |
| 10 | Contributi e proposte future | Sintesi dell'implementazione; proposte esplicitamente non implementate |

### Regole della slide 6

Il motore è puro, deterministico e indipendente da Chrome/DOM. Le regole sono euristiche, senza validazione probabilistica:

- **Security**: `attention` con almeno un segnale forte o due moderati. Un segnale moderato, uno debole o dati parziali producono almeno `observations`; più segnali deboli da soli non producono `attention`. Iframe nascosti e third-party senza sandbox sono informativi.
- **Privacy / tracking**: moderato con almeno 2 domini tracker o 10 richieste; elevato con almeno 5 domini o almeno 30 richieste distribuite su almeno 2 domini. Le categorie Analytics/Advertising/Social non hanno pesi differenti.
- **Privacy / runtime multiplo**: almeno 3 categorie rilevate, oppure accesso WebGL a vendor/renderer unmasked insieme a Canvas o navigator. Runtime multiplo da solo dà attività moderata; insieme al tracking moderato dà attività elevata. Tracking limitato insieme a runtime limitato dà attività moderata, mentre i soli indicatori deboli device/screen non attivano tale combinazione.
- **Network**: `E` è il numero di richieste esterne più ignote; `T` il totale; `r=E/T`; `D_e` il numero di hostname esterni/ignoti distinti. Si applica prima il livello alto: `(r≥0,50 e E≥10)` oppure `(D_e≥15 e (E≥15 oppure T≥30))` oppure `(E≥75 e r≥0,25)`. Altrimenti il livello è moderato se `r≥0,25` oppure `D_e≥5` oppure `E≥20`. Il motore usa i contatori entity-aware se presenti; ha un fallback ai contatori third-party grezzi. Le soglie sono nelle note; la slide usa la regola Security pagina HTTP → attention come esempio.
- **Dati mancanti**: `null`, assenza o `available:false` producono `partial` e `missingSources`. `complete` indica che le cinque sorgenti sono disponibili, non che tutta l'attività del sito sia stata osservata. Mancanze nelle sorgenti privacy sono rese visibili come evidenza informativa.

### Risultati e limiti della verifica

Eseguito `node --test tests/*.test.js` con Node v25.2.1: **15 file passati, 0 fallimenti, 0 saltati**. Il runner conta i file perché i test usano assert a livello di modulo; questo numero non rappresenta i singoli scenari/assert né suite dichiarate. Non vengono presentati tempi di esecuzione come benchmark.

I test di worker/DOM/wrapper usano ambienti simulati; i controlli di popup, asset e accessibilità sono statici. Non è stata eseguita una demo interattiva in Chrome né una validazione end-to-end. Nessuna misura di accuratezza, copertura del codice o prestazioni è rivendicata. Le valutazioni restano soggette a falsi positivi e negativi, copertura del dataset e dei frame/API, stima incompleta del dominio registrabile e osservazione parziale dei redirect.

Attribuzione del dataset incorporato: **Duck Duck Go, Inc. / DuckDuckGo Tracker Radar**, derivato con licenza **CC BY-NC-SA 4.0**, senza endorsement. Metadata locali: generazione 28 settembre 2026, regione US, riferimento upstream `main`, 948 domini tracker e 38.370 associazioni dominio–entità. Questi conteggi descrivono il dataset incorporato, non l'upstream attuale. Lo script di aggiornamento dello sviluppatore comunica con GitHub; il runtime di analisi dell'estensione non invia i segnali osservati a servizi esterni.
