# Personal AI OS

Personal AI OS is a prospective real-world research project studying whether a conversational AI-centered system can integrate heterogeneous longitudinal self-tracking data, preserve provenance and uncertainty, and produce traceable cross-source context under ordinary living conditions.

The primary objective is now **peer-reviewed publication and rigorous study execution**, not commercial productization. The public website, Instagram presence, case studies and discovery pilot are secondary documentation and collaboration surfaces.

> Longitudinal data. Traceable context. Real-world evidence.

## Scientific framing

The project is being maintained as a prospective longitudinal single-participant observational feasibility and methods study. It is not a randomized N-of-1 trial and does not claim clinical efficacy.

Core principles:

- normal life continues independently of the study;
- historical data are descriptive or hypothesis-generating, not prospective confirmation;
- frozen hypotheses are not rewritten after seeing results;
- missingness, connector failures, device/API changes and duplicate observations remain visible as study results;
- measured, vendor-derived, algorithmically calculated and AI-estimated values remain distinguishable;
- mirrored records are not treated as independent evidence merely because they appear in multiple services;
- negative, no-added-value and wrong/unsupported system outputs remain admissible outcomes.

A living manuscript and versioned governance layer are maintained separately from the public website. Publication readiness is evidence-gated rather than result-gated.

## Current research questions

The frozen primary system questions ask whether ordinary low-friction use yields sufficiently dense multimodal data for longitudinal reconstruction, and whether cross-source synthesis can add context unavailable from a single upstream source.

A later prospective value addendum evaluates a higher-order question: among eligible substantive interactions, when does the Personal AI OS provide incremental value beyond the best plausible single-source tool or simple self-tracking summary, and when does it add no value or create burden/error?

The system must therefore retain a defensible denominator rather than preserving only memorable successes.

## Architecture principles

- **Keep specialist tools as systems of record.** The AI layer should not copy every source merely to centralize it.
- **Preserve provenance.** A fluent answer is not enough; source lineage, timestamps, transformations and uncertainty matter.
- **Separate capture from durable structure.** Fast capture should remain low-friction; reconciliation and quality control can happen later.
- **Treat infrastructure evolution as data.** Connector failures, source additions, device changes and endpoint transitions are part of real-world feasibility.
- **Do not optimize for engagement.** A useful result may be rest, no action, deferral or recognition that one source was already sufficient.

## Raw Log → Journal architecture

The manual journal workflow is intentionally not a per-message Airtable write:

1. An iPhone Shortcut opens a persistent ChatGPT Raw Log conversation.
2. The Raw Log is the primary source of truth during capture.
3. Photos, voice notes and short observations can be logged with minimal friction; unresolved details may be enriched later when convenient.
4. A once-daily QC/reconciliation pass compares the raw event sequence with the Airtable Journal.
5. Missing records are added, clear duplicates/errors are corrected, timestamps are reconciled, and a second pass verifies the final state.

Irrecoverable information — especially event time, quantities, actually consumed fraction, image-dependent product identity, symptoms and subjective context — should be materialized before the original chat/image context becomes unavailable.

## Public website

The homepage is now research-first. It foregrounds:

- study design and publication status;
- frozen questions and the prospective incremental-value framing;
- provenance, missingness and failure modes;
- selected workflow cases as illustrations rather than efficacy claims;
- the current research architecture;
- limitations, privacy and release gates.

The public discovery pilot, My Stack page and Prompt & Perform Instagram account remain available but do not drive study design or publication claims.

## Repository structure

- `index.html` / `styles.css` — public research/project website
- `case-study-10k.html` — longitudinal running case study
- `case-study-push-workout.html` — documented workout-review workflow case
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
4. confirm public copy does not promote preliminary evidence into efficacy or validation claims;
5. confirm `/api/*` remains server-side and no secrets appear in delivered client assets;
6. search repository-wide for stale commercial/product positioning and obsolete deployment instructions.

`package.json` still exposes `npm run dev` via `netlify dev`; that script reflects older tooling and is not evidence of the current production architecture.

## Data / privacy note

Existing specialist tools remain important systems of record. Third-party tools and AI/connectors process data under their own architectures and terms. Public reproducibility should prioritize protocol, operational definitions, analysis code, schemas, change logs and synthetic/strongly deidentified examples rather than unnecessary release of sensitive raw personal data.

## Before publishing claims

- distinguish source measurement from vendor-derived or AI-estimated values;
- distinguish prospective evidence from retrospective reconstruction;
- distinguish illustrative workflow cases from denominator-based study results;
- distinguish connector status from endpoint-level data availability;
- do not treat mirrored platform records as independent evidence;
- retain failures, no-added-value cases and uncertainty;
- resolve the required ethics/privacy publication determination before submission;
- do not publish private names, family information or direct quotes without appropriate justification and permission.
