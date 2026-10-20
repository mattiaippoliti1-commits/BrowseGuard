# BrowserGuard: 1,000-site benchmark publication

Final audit passed; 1000 unique records; production `0f2c1f20712aa4e76cdd9eaa6f393aeb28f919abe1d1fa01d8f609942e9f1fbc`. This bundle contains reviewed public corpus metadata and aggregates, not raw browsing records.

- [Full benchmark report](BENCHMARK_1000.md)
- [100 vs 1000 comparison](COMPARISON.md)
- [Corpus and source licenses](corpus/DATASET_1000.md)
- [Statistical report with six PNG/SVG figures](ANALYSIS.md)
- [Aggregate statistics](aggregate-statistics.json)
- [Reproducibility identifiers](reproducibility.json)
- [Methodology and commands](METHODS.md)

The script-snapshots directory preserves testing source for review. The recorded Git commit had dirty production changes, so production-source.patch records the exact three-file delta; apply it to a fresh copy of that commit and verify the recorded fingerprint. Shared harness snapshots belong under tools/website-testing, benchmark snapshots under its benchmark1000 subdirectory. Execute the original scripts from tools/website-testing/benchmark1000 in the full repository with the recorded production version and pinned dependencies; these snapshots are not a standalone extension distribution.

No raw request URLs/policies, browser profiles, full source dump, credentials, record logs or AI packets are automatically copied here. Raw per-site evidence remains under the ignored runs directory. Summed RSS can double-count shared pages and is not system physical RAM. CDP agreement is observation agreement, not detector accuracy or confirmed website safety.

The source sample is purposive, not representative. Categories are directory topics and include related university/community/technical pages. The old and new versions/samples differ; the comparison is descriptive, not an A/B accuracy experiment.

With content from [Curlie.org](https://curlie.org/) - the largest human-edited directory of the web. Contribute by submitting a website or becoming an editor.

Python script snapshots belong under tools/website-testing/analysis. The only shared plotting change separates overlapping small-segment annotations; historical figures and statistics were not regenerated.
