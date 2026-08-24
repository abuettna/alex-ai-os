# Public Discovery Pilot — Current Setup

This file documents the **current** pilot implementation. The older Founding Pilot V0.1 / Netlify architecture is obsolete and must not be used as the production setup guide.

## What the pilot is today

`/pilot/` is a public, contact-free discovery survey for Personal AI OS. It collects voluntary, consented structured feedback about users' current tools, friction, desired help, privacy boundaries, concerns and pilot interest.

It is a discovery instrument, not a production onboarding system and not proof of product validation.

Current constants in `worker/index.js`:

- Survey version: `discovery-v1`
- Consent version: `pilot-discovery-v1`
- Destination: existing **Personal AI OS** Airtable base → **Pilot Discovery Responses** table

Do **not** create a separate `Personal AI OS Pilot` base or a `Pilot Participants` table for the current implementation.

## Production deployment

Production is currently Cloudflare-based.

`wrangler.jsonc` configures:

- `worker/index.js` as the Cloudflare Worker entry point;
- the repository root as the static asset directory;
- `/api/*` to run through the Worker before static assets.

The Worker validates the survey payload and writes accepted responses to Airtable server-side.

### Required server-side secret

Configure one of these in the Cloudflare Worker environment:

- `AIRTABLE_API_KEY`, or
- `AIRTABLE_TOKEN`

The Worker contains the current Airtable base/table identifiers, but the credential itself must remain a Cloudflare secret. Never expose it in `pilot.js`, HTML, committed configuration, logs intended for users, or screenshots.

No OpenAI API key is required for the current discovery survey submission flow.

## Airtable destination

The current table is **Pilot Discovery Responses** in the existing **Personal AI OS** base.

The Worker writes structured fields including:

- Response ID / Submitted At
- Survey Version / Source
- Primary Setup / Primary Need / Current Context
- Existing Tools / Main Friction / Desired Help
- Tomorrow Question
- Pilot Interest / Setup Willingness / Privacy Boundary / Main Concern
- Optional Comment
- Completion Seconds / Client Type
- Consent Version
- Full Response JSON

A QC-only field named **Response Type** is used in Airtable to distinguish real participant submissions from internal automated QA/test submissions. Analysis must exclude `QA / Test` records unless the test population is explicitly being audited.

The public form remains deliberately contact-free: do not silently add names, email addresses, wearable reads, authentication or additional tracking to this table.

## Pre-deployment / regression checks

Before publishing a change to `/pilot/`:

- [ ] `/pilot/` loads in a clean browser and on iPhone-sized screens.
- [ ] Consent is explicit and the displayed wording matches the version expected by the Worker.
- [ ] The form refuses malformed/invalid payloads.
- [ ] The honeypot/spam field still rejects automated junk submissions.
- [ ] The completion-time guard still behaves as intended.
- [ ] A QA submission reaches Airtable end-to-end.
- [ ] The QA record is marked `Response Type = QA / Test` before participant analysis.
- [ ] No name, email or automatically retrieved wearable data is added to the payload.
- [ ] Airtable credentials remain server-side only.
- [ ] Failure states do not expose secrets or raw Airtable errors.
- [ ] Relevant Impressum / privacy links remain reachable from the public experience.

## Interpreting pilot data

Treat this table as **discovery evidence**. Report participant `n` separately from QA/test submissions.

Do not turn small-sample responses into claims such as “users want X” without the appropriate qualifier. Prefer wording like “3 early participant responses currently show…” and preserve contradictory feedback, concerns and uncertainty.

Direct quotes and identifiable external feedback should not be published unless publication/quote permission is documented elsewhere.

## Legacy Netlify files

`netlify.toml`, `netlify/functions/`, and the `npm run dev` script using `netlify dev` are still present in the repository. They reflect an older/alternate implementation and are **not the current production deployment path**.

Do not delete them solely as part of documentation cleanup; first determine whether they are still useful for local development, rollback or reference. If the project fully standardizes on Cloudflare, remove or replace them in a dedicated cleanup change with regression testing.

## Not part of the current discovery pilot

The old Founding Pilot V0.1 design included named participants, email, AI-generated architecture recommendations, OpenAI API generation and D3/D10/D30 follow-up tables. Those concepts are not part of the current public discovery submission flow unless reintroduced deliberately in a future version.
