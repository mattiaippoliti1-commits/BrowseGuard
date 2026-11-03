# BrowserGuard — presentazione universitaria

12 slide Beamer in italiano, formato 16:9, per circa 14–15 minuti. Sorgenti e PDF riguardano il codice presente nel repository e il benchmark pubblico da 1.000 URL; non modificano l'estensione né rigenerano gli esperimenti storici.

- `browserguard.pdf`: versione da proiettare, senza note.
- `browserguard.tex`: sorgente principale, tema personalizzato, architettura TikZ.
- `charts/`: grafici PGFPlots modificabili, senza immagini raster dei grafici.
- `images/`: logo originale, screenshot del popup reale e provenienza della cattura.
- `notes/01.tex` … `12.tex`: note Beamer nascoste, con messaggio, discorso, precisazioni e durata indicativa per ogni slide.
- `discorso.md`: copia leggibile delle note per preparare l'esposizione.
- `VERIFICA.md`: controlli di compilazione, leggibilità e dati.
- `FONTI.md`: mappa delle evidenze, denominatori e informazioni non verificabili.
- `tools/capture-popup.cjs`: acquisizione riproducibile dello screenshot.

## Ricompilare

Serve una distribuzione TeX con pdfLaTeX, Beamer, Babel italiano, Latin Modern, TikZ/PGFPlots, graphicx e booktabs (per esempio TeX Live/MacTeX). Non servono shell escape, font esterni o accesso alla rete.

Dalla radice del repository:

```sh
cd presentation
latexmk -pdf -interaction=nonstopmode -halt-on-error browserguard.tex
```

In alternativa:

```sh
pdflatex -interaction=nonstopmode -halt-on-error browserguard.tex
pdflatex -interaction=nonstopmode -halt-on-error browserguard.tex
```

Per ottenere anche le pagine delle note Beamer, usando un nome distinto per non sovrascrivere il PDF da proiettare:

```sh
pdflatex -interaction=nonstopmode -halt-on-error -jobname=browserguard-con-note '\def\shownotes{1}\input{browserguard.tex}'
pdflatex -interaction=nonstopmode -halt-on-error -jobname=browserguard-con-note '\def\shownotes{1}\input{browserguard.tex}'
```

Le note più lunghe possono occupare più pagine. `discorso.md` è la versione da usare per leggere l'intero discorso senza i limiti di spazio delle note Beamer.

## Struttura

1. Titolo e scopo.
2. Problema e motivazione.
3. Evoluzione e scelte progettuali.
4. Architettura implementata.
5. Interfaccia e uso.
6. Security, Privacy e Network, con esempi di regole.
7. Metodologia del benchmark.
8. Affidabilità operativa e tempi.
9. Distribuzione delle valutazioni su 787 visite.
10. Concordanza dei segnali con CDP.
11. Limiti e miglioramenti.
12. Conclusioni.

## Screenshot

La cattura usa Chromium con l'estensione originale caricata in un profilo temporaneo e la fixture HTTP `test-pages/dom-analysis-test.html` servita solo su loopback. Non inietta snapshot e non simula le API Chrome. Imposta soltanto tema chiaro e onboarding completato nel profilo temporaneo. Il popup viene aperto in una scheda di estensione, con la pagina della fixture mantenuta attiva, come nel collector del benchmark. Non rappresenta un sito pubblico né un dato sperimentale del corpus. Il server usa una porta assegnata dal sistema; il profilo viene eliminato al termine. Non viene modificato lo storage del browser personale.

Per rigenerarlo, con le dipendenze Playwright del framework già installate e Chromium disponibile:

```sh
PLAYWRIGHT_BROWSERS_PATH=/tmp/browserguard-playwright-browsers node presentation/tools/capture-popup.cjs
```

Il comando va eseguito dalla radice e richiede la possibilità di avviare un server locale e Chromium. Non è necessario per compilare il PDF: la cattura è già inclusa.

## Identità e limiti

Nome studente: Mattia Ippoliti, ricavato da `LICENSE`. Università non indicata nei materiali verificati: omessa, senza attribuzioni ipotetiche. Evoluzione dal phishing: contesto fornito dal richiedente, non cronologia dimostrata dal codice. Le etichette inglesi sono quelle dell'app; il testo della presentazione è italiano.

Il benchmark è un esperimento storico con identità di produzione congelata, non una nuova esecuzione del codice attuale. I confronti con CDP riguardano segnali specifici, non accuratezza degli assessment o capacità di rilevare phishing. Vedere `FONTI.md` per le differenze di definizione delle durate.
