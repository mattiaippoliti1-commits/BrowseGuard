# Public 100-site benchmark corpus

`benchmark100.json` and `benchmark100.csv` record the URL, category, organization
name, and selection rationale. `benchmark100.txt` is the complete runner-compatible
URL list. Every entry is a public HTTPS homepage or representative public landing
page, with no credentials, query parameters, form submissions, or purchase path.
Selection does not claim current availability: only the browser measurements
establish the observed response. Public landing pages may redirect to region,
consent, authentication, or challenge pages; those responses must remain failures
or restrictions, not be bypassed.

| Category | URLs |
| --- | ---: |
| Informazione e giornali | 15 |
| E-commerce | 15 |
| Tecnologia e software | 15 |
| Università e istruzione | 10 |
| Pubblica amministrazione | 10 |
| Banche e servizi finanziari | 10 |
| Social network e community | 10 |
| Intrattenimento e streaming | 5 |
| Viaggi e turismo | 5 |
| Siti tecnici di riferimento | 5 |

The sample is purposive, not random or traffic-weighted. Distinct hostnames and
registrable-domain groups are checked; organizations may own different sites in
different categories. The Mozilla documentation hostname occurs only once, not
alongside an equivalent Mozilla root-domain entry.

`benchmark100-smoke.txt` contains one entry per category. After validating that
phase, `benchmark100-main90.txt` visits the other 90 entries. The two lists are
disjoint and their union is exactly the complete corpus. Reusing the smoke
records avoids revisiting restricted sites merely to fill the complete report.
The aggregation step copies records unchanged and preserves both phase manifests.

From `tools/website-testing`, using the existing runner commands:

```bash
node run.cjs --urls datasets/benchmark100-smoke.txt --limit 10 --concurrency 1 --output runs/benchmark100-smoke
# Validate the smoke results; use the same command with --resume if interrupted.
node run.cjs --urls datasets/benchmark100-main90.txt --limit 90 --concurrency 1 --output runs/benchmark100-main90
# Postprocess completed records locally; performs no navigation or network calls.
node analyze-benchmark100.cjs
# Optional regeneration of the framework's complete report, without new visits.
node report.cjs runs/benchmark100
```

Concurrence remains 1, AI is never invoked, and the default timeouts apply:
25 seconds for navigation, 15 seconds for popup/setup stages, 3–10 seconds
additional observation, and 2 seconds between attempts. Source, harness and
configuration checks in the runner govern resume. Resume each execution phase;
the combined reporting directory is an aggregate, not a third execution phase.
