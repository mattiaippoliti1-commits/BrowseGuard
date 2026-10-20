# Release organization and verification

The extension's runtime layout is retained: `manifest.json`, `background/`,
`content/`, `modules/`, `popup/`, `assets/` and `data/`. No detector, permission,
Assessment Engine rule or classification threshold changes accompany this cleanup.

| Area | Location |
| --- | --- |
| Extension source and runtime dataset | Root manifest and runtime directories above |
| Automated tests and manual fixtures | `tests/`, `test-pages/` |
| Benchmark collection and offline tooling | `tools/website-testing/` |
| Public corpus and provenance | `tools/website-testing/datasets/` |
| Aggregate figures and statistics | `tools/website-testing/analysis/output/` |
| Portable benchmark publication | `tools/website-testing/publication/benchmark1000/` |
| Architecture and release documentation | `docs/` |
| University presentation source/PDF/assets | `presentation/` |
| Developer support scripts | `scripts/` |

There is no separate university dissertation/report in this repository. The
presentation is historical material; its source and final PDF are preserved.
Root design notes are kept in place to preserve references. The publication
bundle intentionally duplicates scripts, corpus and figures as frozen snapshots;
it is not a second maintained implementation. Its manifest verifies those bytes.

## Local-only files

Git ignores real-site `tools/website-testing/runs/`, source-download caches,
temporary Chromium profiles, dependencies, virtual environments, Python/editor
caches, diagnostic dumps and logs. LaTeX intermediate files and the presentation's
old test transcript are removed only from the Git index and remain on disk.
The `.tex`, PDF, logo and README stay versioned. No raw benchmark file is deleted.

Aggregate `analysis/output/`, public corpus metadata, framework source, configured
synthetic controlled-validation evidence and the reviewed publication bundle stay
versioned. The controlled scenario outputs describe test fixtures, not private
real-site sessions. No blanket rule ignores all `output/`, `analysis/` or `datasets/`.

Some historical benchmark reports link to local-only `runs/` evidence. Those
links work on the measurement machine but are unavailable in a fresh clone;
use the [portable publication bundle](../tools/website-testing/publication/benchmark1000/README.md)
for self-contained public results. Archived controlled-report companion
documentation restores two relative links without altering hashed results.

## Reproducibility and checks

The benchmark's expected production fingerprint remains:

`0f2c1f20712aa4e76cdd9eaa6f393aeb28f919abe1d1fa01d8f609942e9f1fbc`

Verify from the repository root:

```sh
node -e 'console.log(require("./tools/website-testing/benchmark1000/core.cjs").guardProduction().hash)'
git diff --check
```

The [main README](../README.md#development--tests) lists all seven offline suites
(239 tests in the validated environment), dependency installation and the separate
browser checks. Offline unit tests may write synthetic artifacts to temporary
directories; they do not revisit websites or regenerate the published benchmark.
Release preparation checks manifest assets, script/config references, Markdown
links, publication hashes, frozen corpus/harness identity, existing result-file
hashes, ignored-file policy and staged content. It does not invoke benchmark
collection, the finalizer, dataset updating or presentation compilation.

The completed benchmark remains 1,000 attempts, 999 acquired assessments and 787
legacy ok/partial visits; these are operational measurements, not accuracy or a
validated phishing-detection claim. See the [benchmark report](../tools/website-testing/BENCHMARK_1000.md)
and [third-party notices](../THIRD_PARTY_NOTICES.md) for limitations and licenses.

## Git procedure

Verify `main` and the configured `origin`, fetch and require no remote-only
commits before staging. Review added, modified and index-only removed files;
reject raw real-site data, secrets and diagnostics. Preserve local evidence and
its original hashes. Commit only after checks pass, using:

`chore: finalize repository structure and documentation`

Push normally to the corresponding remote branch, then fetch/compare the remote
commit and verify a clean working tree. Never force-push or rewrite history. If
remote-only changes appear or a check fails, stop before publishing.
