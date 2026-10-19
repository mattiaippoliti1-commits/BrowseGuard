BrowserGuard popup redesign v2 — 2026-10-16

Implemented on `feature/popup-redesign-v2`. The starting branch was `main` at
`0f159b1`. Existing uncommitted changes and untracked files were preserved before
editing. A complete workspace archive (excluding `.git` and `.DS_Store`), tracked
patch, status, original HEAD and protected-source checksums are stored in
`/tmp/browserguard-before-redesign-v2/`. That archive represents the version
immediately before this redesign, including the prior calibration work. No
existing work was stashed, discarded or committed by this task. Keep a durable
copy of the archive if it is needed beyond the lifetime of the temporary directory.

Files changed for this redesign:

- `popup/popup.html`: reorganized structure, quick insights, technical tab panels,
  semantic controls, full-hostname handling and supporting regions.
- `popup/popup.css`: replaced accumulated layout overrides with a consistent
  component stylesheet and dark/light tokens using the existing brand colors.
- `popup/popup.js`: tab selection/keyboard behavior, compact reason disclosures,
  structured supporting evidence, quick metrics and missing-data rendering.
- `popup/presentation.js`: dash labels and documented Network attribution coverage
  handling. Existing engine levels and Security/Privacy calculations are preserved.
- `popup/experience.js`: onboarding describes the neutral dash; storage keys and
  completion behavior remain unchanged.
- `tests/popup-experience.test.js`, `tests/assessment-calibration.test.js`: updated
  presentation expectations for structured evidence, truncation and Network dash.
  The historical fixture still asserts the unchanged Low Network engine level.
- `tests/popup-redesign.test.js`: status matrix and attribution boundary regressions.
- `scripts/check-popup-layout.js`: dependency-free local Chrome rendering and DOM
  interaction check using mocked Chrome APIs and the actual popup initialization.
- `README.md`, `POPUP_REDESIGN_V2.md`: usage, availability criteria and validation.

Visual components:

- Restrained header with the existing logo, product name, compact help and theme
  controls; no subtitle or overall verdict.
- Horizontal website identity with a truncated hostname, full hover title and
  explicit HTTPS/HTTP label and connection dot.
- Three equal-height assessment buttons, aligned horizontally. Existing mint,
  yellow, red and neutral colors distinguish Low, Moderate, High and dash, alongside
  text and accessible status names. Moderate uses a carefully fitted type size.
- One compact explanation region beneath the cards. Toggling another card closes
  the active region. Up to three actual contributing findings, or observations
  when no contributors exist, appear with access to all category evidence.
- Three quick insights in a divided row: total requests, tracking-associated
  domains and confirmed external requests.
- Collapsible technical details with Overview/Security/Privacy/Network tabs.
  Overview retains URL/page metrics, combined reasons and positive signals.
  Security retains headers, mixed content and iframe details. Privacy retains API
  categories, observed API names, tracker-associated domain/category/request data.
  Network retains first-party, cross-origin, same-entity, external and unknown
  counts, resource types and domain lists. Each category also exposes its engine
  reasons and structured supporting evidence. Nested values are preserved through
  readable row groups under native evidence disclosures; no raw JSON is rendered.

Network availability criteria:

1. No available network collection, or a supplied snapshot without a valid
   nonnegative total request count: display a dash and explain missing collection.
2. The engine has a Low Network level, at least 5 cross-origin requests are
   unresolved, and unresolved requests exceed 50% of cross-origin requests:
   display a dash because the ownership coverage is insufficient to make that Low
   result a useful overall exposure description.
3. Confirmed Moderate/High Network findings are retained even if unknown ownership
   exceeds those coverage limits. The explanation states that confirmed external
   exposure is a lower bound and actual exposure may be greater.
4. Fewer than 5 unresolved cross-origin requests, or ownership resolved for at least
   half of cross-origin requests, does not by itself suppress an otherwise
   available Low level. The explanation still discloses unresolved ownership.
5. The quick confirmed external metric displays a dash when collection/count data
   is missing, or when the confirmed count is zero and any unknown ownership
   remains. A positive confirmed count remains numeric, with uncertainty disclosed
   in accessible descriptions and details. A fully attributed zero remains zero.
6. Legacy cross-origin counts without ownership counters remain unresolved; they
   are not reclassified as either same-entity or confirmed external requests.

These are presentation coverage criteria, not revised risk thresholds. The
assessment engine file and its returned levels/reasons are unchanged. The
historical governo.it fixture therefore retains Low Security, Low Privacy and
Low confirmed-external Network engine levels, while the new interface shows
Low / Low / — because all 10 cross-origin requests have unknown ownership.
This does not invent external requests or replace the historical fixture with
claims about the live site. The thresholds of 5 requests and a majority unresolved
are explicit product heuristics, not an empirically validated accuracy guarantee.

Validation:

- `node --test tests/*.test.js`: 68 tests passed, zero failures. Includes 14 new
  redesign cases and existing engine, collector, runtime, tracker matching,
  entity resolution, freshness, manifest/assets and popup interaction checks.
- `node scripts/check-popup-layout.js /tmp/browserguard-redesign-v2-preview`:
  seven browser runs passed: five required status combinations, a light-theme
  preview, and an expanded Network details preview. Every run exercises the five
  combinations, both themes and widths of 400/432/440 px; verifies aligned/equal
  cards, fitting status labels, no horizontal overflow, exclusive card disclosures,
  technical tabs and Arrow/Home/End navigation, evidence-link focus, long hostname
  truncation, missing-data rendering, exact raw counters, unique IDs, help opening,
  and no raw JSON or global summary banner. Screenshots and DOM output are stored
  in that directory. Default, Moderate, light and technical previews were visually
  inspected during implementation.
- SHA-256 comparison with the pre-redesign snapshot confirms that the assessment
  engine, manifest, service worker, all content collectors, entity resolver and
  tracker matcher have not changed. No permissions, external requests, remote
  fonts, frameworks, analytics, dependencies or storage keys were added.
- `git diff --check` passes.

Known limitations:

- Chrome rendering uses local fixtures and mocked Chrome APIs, not a live installed
  MV3 extension. Live messaging, browser popup sizing, screen-reader output and
  touch behavior still require manual extension testing.
- Ownership coverage reflects the existing local dataset; it is not proof of
  organization ownership, tracking, maliciousness or website safety. Known
  positive external counts are lower bounds when unknown requests remain.
- The coverage heuristic intentionally retains Low for small unknown samples or
  minority unknown attribution; it cannot establish that those requests are benign.
- Supporting evidence arrays are shown as numbered observations when the collector
  supplies no more specific labels. No unobserved API values or domain names are
  invented.
- Temporary archives and screenshots are outside the repository and may eventually
  be removed by the system. The original Git commit and current feature branch
  remain available; the archive preserves the additional uncommitted baseline.
