# Benchmark 100 vs 1000 — confronto descrittivo

| Indicatore | Benchmark 100 | Benchmark 1000 |
| --- | --- | --- |
| URL tentati | 100 | 1000 |
| Assessment acquisiti | 100 | 999 |
| Visite ok/partial senza restrizione (criterio legacy) | 77 | 787 |
| Restrizioni | 22 | 132 |
| Errori navigazione | 1 | 80 |
| Timeout | 0 | 30 |
| Mediana tentativo (s) | 4.14 | 4.83 |
| Visite ok/partial / tentativi (%) | 77 | 78.70 |
| Media tentativo (s) | 4.80 | 6.90 |
| Media richieste osservate (snapshot disponibili) | 83.39 | 83.95 |
| Media domini tracking-associated (snapshot disponibili) | 2.60 | 3.82 |
| security Low | 98 | 910 |
| security Moderate | 1 | 13 |
| security High | 0 | 1 |
| privacy Low | 55 | 443 |
| privacy Moderate | 23 | 238 |
| privacy High | 22 | 318 |
| network Low | 39 | 326 |
| network Moderate | 33 | 88 |
| network High | 15 | 110 |
| Network Unavailable | 13 | 475 |
| CDP header concordanti/valutabili | 485/485 | 4600/4600 |
| CDP protocollo concordante/valutabile | 97/97 | 920/920 |
| CDP mixed content conteggi concordanti/valutabili | 97/97 | 913/920 |

Header presenti / siti valutabili, su tutti i tentativi; i mancanti non sono assenze:

| Header | Benchmark 100 | Benchmark 1000 |
| --- | --- | --- |
| Content-Security-Policy | 47/97 | 291/920 |
| Strict-Transport-Security | 69/97 | 465/920 |
| X-Content-Type-Options | 57/97 | 457/920 |
| Referrer-Policy | 37/97 | 294/920 |
| Permissions-Policy | 27/97 | 149/920 |

Distribuzioni: tutti i tentativi, inclusi blocchi/errori, conteggi assoluti con denominatori diversi. Popolazioni ok/partial e confronti valutabili sono separati nei report Python. La concordanza storica è derivata in memoria dalle evidenze immutate usando gli stessi denominatori del nuovo confronto; per il protocollo si usa la risposta CDP finale effettivamente abbinata. I conteggi di coppie non sono conteggi di siti.

Produzione benchmark 100: `3403c1f4b72a9d285c2dea014a53a1c106d02cf2c97784dd5640b4b050533811`. Produzione benchmark 1000: `0f2c1f20712aa4e76cdd9eaa6f393aeb28f919abe1d1fa01d8f609942e9f1fbc`.

Campioni, fonti, distribuzione dei siti, snapshot, condizioni di rete, politiche anti-bot e orari differiscono. La nuova raccolta aggiunge guard e monitoraggio. Non attribuire le differenze alla modifica del codice; non è un esperimento controllato A/B e non misura accuratezza o sicurezza reale dei siti.

I risultati storici sono stati letti, non ricalcolati o riscritti. [Report 100](BENCHMARK_100.md), [report 1000](BENCHMARK_1000.md).

With content from [Curlie.org](https://curlie.org/) - the largest human-edited directory of the web. Contribute by submitting a website or becoming an editor.
