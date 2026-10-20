"""GitHub-readable report containing aggregate data only and portable relative links."""
from pathlib import Path
import pandas as pd


def fmt(value):
    if value is None or pd.isna(value):
        return '—'
    if isinstance(value, (int, float)):
        return str(int(value)) if float(value).is_integer() else f'{value:.2f}'
    return str(value).replace('|', '\\|').replace('\n',' ')


def markdown_table(table):
    columns = list(table.columns)
    return '\n'.join(['| '+' | '.join(columns)+' |','| '+' | '.join(['---']*len(columns))+' |',
                      *['| '+' | '.join(fmt(v) for v in row)+' |' for row in table.itertuples(index=False,name=None)]])


def write_report(benchmark, tables, output):
    output=Path(output)
    summary=tables['reliability_summary'].set_index('metric')
    value=lambda key: summary.loc[key,'value'] if key in summary.index else None
    success=tables['assessment_distribution']; success=success[success.population=='successful']
    headers=tables['header_presence']; headers=headers[headers.population=='successful']
    tracking=tables['tracking_statistics']; tracking=tracking[(tracking.population=='successful')&(tracking.category=='All categories')]
    performance=tables['performance_statistics']; overall=performance[performance.category=='All categories'].iloc[0]
    agreement=tables['cdp_agreement']; all_agreement=agreement[agreement.population=='all']
    mixed=all_agreement[all_agreement.measurement=='mixed_content'].iloc[0]
    protocol=all_agreement[all_agreement.measurement=='protocol'].iloc[0]
    differences=tables['request_differences']
    n=int(value('total_urls')); succeeded=int(value('successful')); rate=100*succeeded/n
    distribution=success.pivot(index='dimension',columns='level',values='count').reindex(index=['security','privacy','network'],columns=['Low','Moderate','High','Unavailable','Missing']).reset_index()
    notes='\n'.join('- '+note for note in benchmark.notices) or '- Nessuna anomalia strutturale aggiuntiva rilevata dal caricamento.'
    report=f'''# BrowserGuard — Statistical Benchmark Analysis

## 1. Executive summary

Ricalcolati **{n} tentativi**, **{fmt(value('assessments_captured'))} assessment acquisiti** e **{succeeded} visite classificate come riuscite ({rate:.2f}%)** dai record originali. Rilevate {fmt(value('restricted'))} restrizioni, {fmt(value('navigation_errors'))} errori di navigazione e {fmt(value('timeouts'))} timeout. La durata media del singolo tentativo è {fmt(overall['mean'])} s, la mediana {fmt(overall['median'])} s.

Le {fmt(value('anomaly_events_original'))} segnalazioni originali e le {fmt(value('reviewed_anomaly_events'))} segnalazioni della revisione sono popolazioni distinte. I falsi positivi del validator documentati sono {fmt(value('verified_validator_false_positives'))}. Bug dell'estensione documentati nella revisione: {fmt(value('documented_extension_bugs'))}; bug del framework documentati: {fmt(value('documented_framework_bugs'))}. Questi ultimi sono annotazioni di revisione verificate nei file disponibili, non nuovi bug confermati dall'analisi statistica.

## 2. Dataset e popolazioni

Campione pubblico ragionato, non casuale e non rappresentativo di tutto il Web. Le categorie e le loro dimensioni sono riportate nella [tabella di affidabilità](tables/reliability_by_category.csv). Gli assessment acquisiti su blocchi o pagine d'errore non rendono valida la navigazione alla homepage prevista.

La popolazione principale di assessment, tracking e header comprende i record con stato `ok` o `partial`, senza errore di navigazione, restrizione rilevata o errore di estrazione. Include {fmt(value('http_202_sites'))} risposte HTTP 202 nell'intero benchmark: il criterio del framework non garantisce la visualizzazione integrale della pagina prevista. Gli assessment parziali nell'intero dataset sono {fmt(value('partial_assessments'))}; i dati mancanti restano mancanti. I grafici di affidabilità e performance comprendono invece tutti i tentativi.

## 3. Metodologia statistica

Statistiche descrittive calcolate con Pandas: media, mediana, minimo, massimo, deviazione standard **campionaria** (`ddof=1`), quartili e percentili con interpolazione lineare. La deviazione standard non è stimata per meno di due valori. Percentuali calcolate sui denominatori dichiarati; un denominatore nullo produce un dato non valutabile, mai 0% automatico. I boxplot usano Q1–Q3, mediana e baffi a 1.5×IQR: gli outlier sono statistici, non etichette di bug.

Nessuna soglia di rischio, classificazione aggiuntiva, precision, recall, F1-score o accuracy dei detector: manca un ground truth indipendente. Non si calcolano inferenze di popolazione da questo campione di convenienza. Gli stessi input e le stesse versioni delle librerie producono gli stessi artefatti, senza timestamp dinamici nei grafici.

## 4. Affidabilità del benchmark

![Benchmark reliability](figures/benchmark_reliability.png)

{markdown_table(tables['reliability_by_category'][['category','n','successful','restricted','navigation_error','other_failure','success_pct']])}

La figura usa esiti mutuamente esclusivi: successo, errore di navigazione, restrizione, altro fallimento. I contatori di timeout, parzialità e messaggi d'errore possono sovrapporsi ad altri esiti; non vanno sommati come popolazioni disgiunte. [Tabella riepilogativa completa](tables/reliability_summary.csv).

## 5. Distribuzione degli assessment

![Assessment distribution](figures/assessment_distribution.png)

{markdown_table(distribution)}

Il denominatore principale è {succeeded} visite riuscite per dimensione. `Unavailable` rappresenta il trattino mostrato dall'interfaccia; `Missing` indica un'etichetta assente. Un Network non valutabile può dipendere dalla copertura dell'attribuzione anche quando gli input sono completi. Low non certifica la sicurezza del sito. Le [frequenze e percentuali globali](tables/assessment_distribution.csv) e le [distribuzioni per categoria](tables/assessments_by_category.csv) includono separatamente anche tutti i tentativi.

## 6. Attività associata al tracking

![Tracking-associated activity](figures/tracking_activity.png)

{markdown_table(tracking[['metric','n','missing','mean','median','min','max','std_sample','q1','q3']])}

Solo visite riuscite; i contatori mancanti sono esclusi dalle statistiche, non sostituiti con zero. L'associazione di dominio al dataset non prova che ogni richiesta effettui tracking; lo zero non dimostra assenza di tracking. [Statistiche complete per categoria e popolazione](tables/tracking_statistics.csv).

## 7. Header di sicurezza

![Security headers](figures/security_headers.png)

{markdown_table(headers[['header','population_n','present','absent','not_evaluable','valid_denominator','presence_pct_valid']])}

Un confronto richiede una risposta HTTP(S) finale del documento principale, con URL coincidente con quella osservata, header CDP registrati e presenza BrowserGuard espressa da un booleano. I valori ignoti restano non valutabili. La percentuale è **presenti / (presenti + assenti)**, non presenti / tutti i siti. CSP indica l'header enforced; una policy report-only non è un header CSP enforced. La figura esclude le visite limitate; la [tabella completa](tables/header_presence.csv) include separatamente tutti i tentativi. L'assenza di un header non dimostra automaticamente una vulnerabilità.

## 8. Consistenza delle osservazioni CDP

![Observed request comparison](figures/cdp_comparison.png)

{markdown_table(all_agreement[['measurement','eligible','not_evaluable','agree','disagree','agreement_pct','unit']])}

Il protocollo è ricalcolato dall'URL della **risposta CDP effettiva confrontabile**, non dal nome del campo `cdpUsesHTTPS` dell'arricchimento, che nel postprocessore precedente era derivato dall'URL finale Playwright. I denominatori sono distinti: header singoli, coppie di documenti per protocollo, coppie di contatori per mixed content. La concordanza non è una misura di accuratezza degli assessment. Nei documenti confrontabili, i casi con tentativi mixed content >0 sono {fmt(mixed['positive_cdp'])} per CDP e {fmt(mixed['positive_extension'])} per BrowserGuard; una concordanza di zeri non verifica la sensibilità ai casi positivi. I documenti HTTPS osservati da CDP sono {fmt(protocol['positive_cdp'])} su {fmt(protocol['eligible'])}: il campione non verifica automaticamente il comportamento su HTTP.

{markdown_table(differences[['population','n','missing','mean','median','min','max','different_counts','mean_absolute_delta','max_absolute_delta']])}

La differenza è BrowserGuard − CDP. Il grafico usa soltanto visite riuscite con richiesta finale del documento identificabile e due contatori disponibili; le finestre **non sono identiche**. La linea y=x è un riferimento geometrico, non un criterio di correttezza. I tre punti con maggiore differenza assoluta sono evidenziati per rango descrittivo, senza una soglia di bug. Redirect, cache, worker, iframe e differenze di visibilità possono spiegare gli scostamenti. [Concordanze](tables/cdp_agreement.csv) e [differenze richieste](tables/request_differences.csv).

## 9. Performance

![Benchmark performance](figures/benchmark_performance.png)

{markdown_table(performance[['category','n','missing','mean','median','std_sample','p90','p95']])}

I tempi includono navigazione, attesa di osservazione ed estrazione dal popup: **non sono latenza esclusiva dell'estensione**. La somma dei tempi dei singoli tentativi è {fmt(value('sum_attempt_duration_s'))} s. Le finestre di esecuzione ricostruibili dai manifest totalizzano {fmt(value('execution_windows_s'))} s; l'intervallo con la revisione tra fasi è {fmt(value('elapsed_including_phase_review_s'))} s. Se il manifest non espone queste finestre, il totale rimane non valutabile, anziché essere inventato dalla somma dei tentativi. [Statistiche complete](tables/performance_statistics.csv).

## 10. Anomalie e limitazioni

{markdown_table(tables['anomaly_summary'])}

Le restrizioni di accesso e i problemi ambientali restano separati dalle incoerenze deterministiche. Le annotazioni di revisione vengono lette senza riscrivere o cancellare le segnalazioni originali. Nessuna anomalia residua è automaticamente confermata come bug. I record raw, le evidenze per sito e le annotazioni complete sono disponibili **soltanto localmente** nell'input del benchmark e non sono necessari per leggere questo report su GitHub.

{notes}

La raccolta riguarda una sola visita per sito; geografia, consenso, protezioni anti-bot, distribuzione delle categorie e stato del profilo influenzano i risultati. Il matching dei documenti usa le URL salvate: query e frammenti erano già stati rimossi in raccolta, quindi non è una verifica completa di identità del documento. Le statistiche non misurano la copertura completa delle attività e non sono accompagnate da una misura di picco RAM. Il materiale pubblicabile contiene solo aggregati: nessuna URL individuale, identificatore di sito, policy completa, log o profilo Chromium.

## 11. Conclusioni e preparazione a 1.000 siti

I dati misurano l'affidabilità della raccolta nelle condizioni osservate e la coerenza di alcune osservazioni, non la sicurezza dei siti né l'accuratezza complessiva dei detector. Prima di 1.000 siti: conservare la correzione documentata del validator, verificare nuovamente resume e schemi su un piccolo campione, revisionare un corpus distinto più ampio, mantenere concorrenza 1 sul Mac da 8 GB e monitorare memoria e disco. Nessun benchmark aggiuntivo è stato eseguito da questo modulo.

Le versioni delle librerie usate sono registrate in [analysis_environment.csv](tables/analysis_environment.csv); i digest delle sorgenti locali in [source_integrity.csv](tables/source_integrity.csv). Le immagini PNG sono a 300 DPI; accanto a ogni PNG è disponibile l'SVG omonimo. Tutti i collegamenti necessari al report sono relativi ad artefatti pubblicabili, senza dipendenze da `runs/`.
'''
    (output/'BENCHMARK_ANALYSIS.md').write_text(report,encoding='utf8')
