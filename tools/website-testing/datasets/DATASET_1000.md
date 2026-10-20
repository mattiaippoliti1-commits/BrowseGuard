# BrowserGuard: corpus pubblico HTTPS da 1.000 URL

Il corpus contiene **1.000 URL e 1.000 hostname distinti anche normalizzando
www/non-www**, con 100 voci per ciascuna delle dieci categorie richieste.
SHA-256 del file `benchmark1000.txt`:

`cbb10d594c6c351232490cb6cd65f9fcc5095e9e80596b70fda0bd5fb3d3349d`

File: [TXT](benchmark1000.txt), [JSON con provenienza](benchmark1000.json),
[CSV](benchmark1000.csv). Ogni ID è lo SHA-256 dell'URL. L'ordine round-robin
produce prefissi bilanciati: i primi 20 sono due per categoria e sono fissati prima
delle navigazioni. Nessun sito viene sostituito in base al risultato.

| Categoria | URL | Fonte |
|---|---:|---|
| Informazione e giornali | 100 | Wikidata P31=newspaper, P856 |
| E-commerce | 100 | Wikidata P31=online shop, P856 |
| Tecnologia e software | 100 | Curlie Computers/Software |
| Università e istruzione | 100 | Curlie Reference/Education/Colleges_and_Universities |
| Pubblica amministrazione | 100 | Curlie Government e suffisso istituzionale governativo |
| Banche e servizi finanziari | 100 | Curlie Business/Financial_Services/Banking_Services |
| Social network e community | 100 | Curlie Online_Communities, Message_Boards, Chats_and_Forums |
| Intrattenimento e streaming | 100 | Curlie stazioni TV/radio e risorse audio |
| Viaggi e turismo | 100 | Curlie Recreation/Travel |
| Siti tecnici e documentazione | 100 | Curlie risorse, linguaggi, documentazione e tutorial di programmazione |

Le categorie sono **tematiche**, derivate dalla tassonomia delle fonti, non una
verifica delle attività economiche dei titolari. Possono includere pagine collegate
alle università (anche sport universitario), associazioni finanziarie, risorse di
community o siti di conferenze tecniche: non sono dieci elenchi di sole homepage
istituzionali. Le categorie possono sovrapporsi semanticamente; un URL compare una
volta sola. Il campione è intenzionale e non rappresentativo del web.

## Provenienza e licenze verificate

I 200 URL Wikidata sono valori HTTPS realmente restituiti dalla proprietà P856;
non sono domini suggeriti da un modello. I dati strutturati sono CC0:
[accesso e licenza](https://www.wikidata.org/wiki/Help:Data_access),
[licensing](https://www.wikidata.org/wiki/Wikidata:Licensing).
Query, data di acquisizione e hash delle risposte sono nel JSON. Le query usano
istanze dirette P31, senza inferenze di categoria non documentate.

SPARQL ha applicato un limite temporaneo durante un outage (HTTP 429), persistente
anche adottando intervalli di almeno 65 secondi; l'API Action ha segnalato maxlag.
L'estrazione da quel servizio è stata fermata, senza aggiramenti. Il sottoinsieme
originale è preservato in `benchmark1000-wikidata-partial.json`.

Le altre 800 voci provengono dall'[export ufficiale Curlie](https://curlie.org/docs/en/rdf.html),
distribuito in [CC BY 3.0](https://www.curlie.org/docs/en/license.html).
Export: `curlie-rdf-all.tar.gz`, 177.289.960 byte; Last-Modified 2 febbraio 2026;
SHA-256 `696098a50485445886e763c70f330a32e9214036316b0d66e67dbd54a71b0e04`.
Download del 19 ottobre 2026; la data di download non è la data di aggiornamento
editoriale. Gli script leggono i TSV in streaming senza estrarre percorsi del tar.
Si conservano URL, titolo e categoria; le descrizioni editoriali non sono copiate
nel corpus. Ogni voce include percorso/ID della categoria e hash dell'archivio.

With content from [Curlie.org](https://curlie.org/) - the largest human-edited directory of the web. Contribute by submitting a website or becoming an editor.

Modifiche BrowserGuard: selezione del sottoinsieme, associazione delle categorie,
normalizzazione limitata di hostname/schema e deduplicazione. Nessun giudizio di
sicurezza viene ereditato dalle descrizioni delle fonti.

## Selezione e verifiche

Solo URL già HTTPS nelle fonti: nessun upgrade presunto da HTTP. Sono esclusi
userinfo, query, frammenti, porte non standard, indirizzi IP letterali, hostname
locali/riservati, percorsi di login/submit/pagamento, download binari e percorsi
oltre due segmenti. Non si verifica il contenuto o la disponibilità corrente con
richieste massive aggiuntive. L'inclusione in una fonte non prova disponibilità,
assenza di login o identità semantica della pagina che sarà restituita.

La deduplicazione considera URL, hostname senza www e alias di redirect già
osservati nel benchmark storico, senza modificarlo. I redirect nuovi saranno
registrati durante il benchmark e potranno ridurre il numero dei siti finali
effettivamente distinti: non si sostituiranno URL dopo aver visto gli esiti.

Le categorie meno numerose sono allocate per prime per ridurre collisioni; dentro
le categorie Wikidata si mantiene l'ordine deterministico degli ID di fonte, nelle
altre si ordinano gli URL Curlie. Questo introduce bias lessicografico e geografico.
Gli URL non sono una graduatoria di popolarità e le etichette non sono ground truth
per Security, Privacy, Network o tracking. Restrizioni, errori TLS/DNS, HTTP 4xx/5xx
e pagine diverse da quelle attese restano parte dei risultati operativi.

## Riproduzione

Dalla radice del repository, con l'export pubblico presente nella cache ignorata:

```sh
python3 tools/website-testing/benchmark1000/curlie_corpus.py
node -e 'console.log(require("./tools/website-testing/benchmark1000/core.cjs").loadCorpus().identity)'
```

Non rigenerare il corpus durante una raccolta: l'identità viene verificata prima
di ogni batch e il runner si arresta se corpus, produzione o configurazione cambiano.
Le cache delle fonti e i risultati grezzi sono esclusi da Git; il corpus selezionato
e i metadati di provenienza sono pubblicabili con le attribuzioni indicate.
