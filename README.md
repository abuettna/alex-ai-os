# Personal AI OS

Personal AI OS is a real-world personal AI project connecting specialist tools, longitudinal personal data and conversational AI into usable context. The project is documented publicly through architecture notes and case studies, while a structured Research Log preserves questions, analyses, failures and publication candidates for possible later peer-reviewed work.

The primary internal strategic objective is **rigorous research with the option to publish**, rather than building a commercial product on a fixed timeline. The public website, Instagram presence and discovery pilot are documentation, collaboration and optional inbound surfaces.

> Your data. One context. Better decisions.

## Research governance

The active research workbench is **Alex Data Lake → Personal AI OS Research Log**. It stores research questions, analyses, case studies, negative results, data limitations and publication ideas without forcing the project into a premature paper narrative.

The former **Living Study** table is archive-only and retained for provenance. The earlier **Value Events** table was never operationalized and remains an inactive empty historical ledger; it must not be selectively backfilled or interpreted as evidence that zero value events occurred.

If and when a concrete publication/submission is chosen, a frozen Study/Manuscript state should be derived from reviewed Research Log items plus source data. Any prospective denominator-based hypothesis must be defined and frozen before new prospective capture begins.

Research principles:

- ordinary life and routine system use should not be distorted merely to manufacture evidence;
- retrospective analyses are labelled as such;
- missingness, connector failures, device/API changes and duplicate observations remain visible;
- measured, vendor-derived, algorithmically calculated and AI-estimated values remain distinguishable;
- mirrored records are not treated as independent evidence merely because they appear in multiple services;
- negative and wrong/unsupported outputs are useful research data;
- connector status is not treated as proof of metric-level freshness;
- relations such as chronology require evidence rather than inference from connector return order.

## Architecture principles

- **Keep specialist tools as systems of record.** The AI layer should not copy every source merely to centralize it.
- **Use minimum sufficient context.** Some decisions need several sources; others need only one specialist tool plus relevant personal context.
- **Preserve provenance and freshness.** A fluent answer is not enough; source lineage, timestamps, transformations, recency and uncertainty matter.
- **Separate capture from durable structure.** Fast capture should remain low-friction; reconciliation and quality control can happen later.
- **Treat infrastructure evolution as data.** Connector failures, source additions, device changes and endpoint transitions are part of the real system.
- **Do not optimize for engagement.** A useful result may be rest, no action, deferral or recognition that one source was already sufficient.

## Raw Log → Journal architecture

The manual journal workflow is intentionally not a per-message Airtable write:

1. An iPhone Shortcut opens a persistent ChatGPT Raw Log conversation.
2. The Raw Log is the primary source of truth during capture.
3. Photos, voice notes and short observations can be logged with minimal friction; unresolved details may be enriched later when convenient.
4. A once-daily QC/reconciliation pass compares the raw event sequence with the Airtable Journal.
5. Missing records are added, clear duplicates/errors are corrected, timestamps are reconciled, and a second pass verifies the final state.
6. Weekly summaries are durable derived synthesis records; they are not independent raw observations and must not be double-counted with the events they summarize.

Irrecoverable information — especially event time, quantities, actually consumed fraction, image-dependent product identity, symptoms and subjective context — should be materialized before the original chat/image context becomes unavailable.

## Current quantitative access layer

freddy is the main quantitative health/training access layer used by the conversational system. As of 2026-09-21 it has Garmin Connect, Apple Health, Intervals.icu and Runalyze connected.

Freshness must be checked per source/metric rather than inferred from a green connector state. On 2026-09-21, Garmin and Apple Health were current through the same day; Runalyze exposed 89 metrics with major activity/recovery families through 2026-09-20 while still reporting a sync in progress; Intervals.icu remained connected but its provider coverage ended 2026-09-12.

## Strength-training integration

LiftTrack is the canonical strength-training layer for templates, exercise catalogue and exercise-level history. The currently exposed ChatGPT integration supports reads plus user-approved workout create/update actions. Historical cases must preserve the capability that existed at the time; current write capability must not be retroactively attributed to older planning episodes.

The experimental Airtable **Garmin Workout Queue** remains empty and is now an inactive historical fallback rather than a current architecture path.

## Public website

The public website is primarily a practical reference and case-study hub for the real Personal AI OS. It documents:

- the architecture and important integrations;
- clickable real-world workflow cases;
- useful failure cases and limitations;
- freddy's role as the central quantitative access layer;
- the real hardware/software stack;
- collaboration opportunities and build-in-public context.

Research/publication is secondary public context rather than the homepage's main CTA. The public discovery pilot remains available but does not drive the current project strategy.

## Repository structure

- `index.html` / `styles.css` — public project/case-study website
- `case-study-10k.html` — longitudinal running case study
- `case-study-push-workout.html` — documented workout-review workflow case
- `case-study-lifttrack-copilot.html` — minimum-sufficient-context LiftTrack case
- `case-study-temporal-inference.html` — interpretation-layer failure case
- `pilot/` — secondary public discovery pilot and client assets
- `stack/` — documented real-world hardware/software stack
- `worker/` — Cloudflare Worker API used for `/api/*`
- `wrangler.jsonc` — current Cloudflare Worker/static-assets deployment configuration
- `netlify/` / `netlify.toml` — legacy/alternate Netlify implementation retained for now
- `assets/` — site assets

## Deployment

The current production architecture is Cloudflare-based. `wrangler.jsonc` serves the repository as static assets and routes `/api/*` through `worker/index.js` before falling back to static content.

The discovery API and privacy-minimal Stack telemetry write to the existing **Personal AI OS** Airtable base from the server-side Worker. Airtable credentials must remain server-side secrets (`AIRTABLE_API_KEY` or `AIRTABLE_TOKEN`). Never add API tokens or other secrets to client-side JavaScript, HTML, committed configuration, screenshots or documentation examples.

`netlify.toml` and `netlify/functions/` still exist but should be treated as legacy/alternate infrastructure unless deliberately reactivated.

## Local checks

There is currently no comprehensive automated test suite in this repository. Before deployment, at minimum:

1. inspect changed HTML/CSS/JS for broken paths and stale claims;
2. load the homepage, `/stack/`, and relevant case-study pages at desktop and phone widths;
3. verify navigation anchors, keyboard focus, alt text and important contrast states;
4. confirm public copy does not promote illustrative evidence into efficacy or validation claims;
5. confirm `/api/*` remains server-side and no secrets appear in delivered client assets;
6. search repository-wide for stale commercial/product positioning and obsolete deployment instructions;
7. verify dated connector snapshots against current source-level and metric-level freshness before publishing them.

`package.json` still exposes `npm run dev` via `netlify dev`; that script reflects older tooling and is not evidence of the current production architecture.

## Data / privacy note

Existing specialist tools remain important systems of record. Third-party tools and AI/connectors process data under their own architectures and terms. Public reproducibility should prioritize operational definitions, analysis code, schemas, change logs and synthetic/strongly deidentified examples rather than unnecessary release of sensitive raw personal data.

## Before publishing claims

- distinguish source measurement from vendor-derived or AI-estimated values;
- distinguish prospective evidence from retrospective reconstruction;
- distinguish illustrative workflow cases from denominator-based study results;
- distinguish connector status from endpoint-level data availability;
- do not treat mirrored platform records or weekly derived summaries as independent evidence;
- retain failures and uncertainty;
- freeze any future prospective protocol/denominator before collection rather than reconstructing it selectively;
- resolve the required ethics/privacy publication determination before submission;
- do not publish private names, family information or direct quotes without appropriate justification and permission.
