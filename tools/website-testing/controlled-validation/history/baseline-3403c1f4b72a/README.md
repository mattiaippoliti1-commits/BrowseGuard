# Controlled-validation baseline archive

This directory preserves the earlier controlled run against production
`3403c1f4b72a9d285c2dea014a53a1c106d02cf2c97784dd5640b4b050533811`.
The [original report](output/CONTROLLED_VALIDATION.md), captured synthetic
scenario inputs and outputs, statistics, and [integrity manifest](integrity.json)
remain unchanged. The run recorded 11 PASS and 7 SKIPPED scenarios; TLS-dependent
coverage was unavailable in that initial environment. These are historical
results, not the final validation outcome or the 1,000-site benchmark.

The [historical plan](PLAN.md) documents the original matrix and observation
limits. The later profile-only trust investigation and targeted fixes are
described in the [maintained suite documentation](../../README.md),
[targeted audit](../../TARGETED_AUDIT.md) and [final fixes](../../FINAL_FIXES.md).
Current commands must be run from the repository/framework root as documented
there, with a new output directory; do not rerun into this archive.

This companion documentation was added for the release to restore the archived
report's relative README/PLAN links without editing the hashed historical report.
