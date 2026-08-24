# Personal AI OS

Personal AI OS is a real-world personal AI experiment and architecture project: use the specialist tools and data sources that already work, expose only the context needed, and let an AI reasoning layer combine that context into more useful everyday decisions.

The current product thesis is broader than a single dashboard or assistant. The project is testing an **independent Personal AI Systems Architect**: start from a person's goals, constraints, existing tools/devices, privacy preferences and tolerance for maintenance, then derive the smallest useful architecture that actually works.

> Your data. One context. Better decisions.

## Current status

This repository contains the public project website, concrete case studies, the public discovery pilot, and the server-side API used to persist consented pilot feedback. It is an evolving research/build-in-public project, not a finished or clinically validated product.

The public discovery pilot is active at `/pilot/`. It collects contact-free, consented discovery responses and should not be described as proven customer validation.

## Architecture principles

- **Keep specialist tools as systems of record.** Personal AI OS should not copy every underlying dataset into a new central database merely to exist.
- **Connect context, not everything.** Use read/write access only where it creates clear value and where the user deliberately permits the action.
- **Separate capture from durable structure.** Fast capture should stay fast; quality control can happen later.
- **Prefer evidence over confident guessing.** Source uncertainty and integration limitations should remain visible.
- **Do not optimize for more activity by default.** A useful decision may be to do less, defer an action, or leave a working tool alone.

## Raw Log → Journal architecture

The manual journal workflow is intentionally not a per-message Airtable write:

1. An iPhone Shortcut opens a persistent ChatGPT Raw Log conversation.
2. The Raw Log is the primary source of truth during capture.
3. Photos, voice notes and short observations can be logged with minimal friction; unresolved details may be enriched later when convenient.
4. A once-daily QC/reconciliation pass compares the raw event sequence with the Airtable Journal.
5. Missing records are added, clear duplicates/errors are corrected, timestamps are reconciled, and a second pass verifies the final state.

This keeps capture lightweight while preserving a curated long-term journal.

## Repository structure

- `index.html` / `styles.css` — public project website
- `case-study-10k.html` — longitudinal running case study
- `pilot/` — public discovery pilot and client assets
- `worker/` — Cloudflare Worker API used for `/api/*`
- `wrangler.jsonc` — current Cloudflare Worker/static-assets deployment configuration
- `netlify/` / `netlify.toml` — legacy/alternate Netlify implementation retained in the repository; do not assume it is the production path
- `assets/` — site assets

## Deployment

The current production architecture is Cloudflare-based. `wrangler.jsonc` serves the repository as static assets and routes `/api/*` through `worker/index.js` before falling back to static content.

The discovery API writes directly to the existing **Personal AI OS** Airtable base/table from the server-side Worker. Airtable credentials must remain server-side secrets (`AIRTABLE_API_KEY` or `AIRTABLE_TOKEN`). Never add API tokens or other secrets to client-side JavaScript, HTML, committed configuration, screenshots or documentation examples.

`netlify.toml` and `netlify/functions/` still exist, but they should be treated as legacy/alternate infrastructure unless a future change explicitly reactivates Netlify as production.

## Local checks

There is currently no comprehensive automated test suite in this repository. Before deployment, at minimum:

1. Inspect changed HTML/CSS/JS for broken paths and stale claims.
2. Load the homepage and `/pilot/` at desktop and phone widths.
3. Verify navigation anchors, keyboard focus, alt text and important contrast states.
4. Exercise the pilot form end-to-end against a non-destructive/test path before relying on it in production.
5. Confirm `/api/*` is handled server-side and no secrets appear in delivered client assets.
6. Search repository-wide for obsolete deployment instructions and architecture labels before publishing.

`package.json` still exposes `npm run dev` via `netlify dev`; that script reflects older tooling and should not be treated as proof of the production deployment architecture.

## Data / privacy note

The architecture is designed not to require a new central copy of every underlying personal dataset. Existing tools remain primary systems of record where practical, while connected services expose selected context when needed. Third-party tools and AI/connectors still process data under their respective architectures and terms; avoid absolute claims such as “data never leaves your tools.”

## Before publishing claims

- distinguish current ChatGPT connector capabilities from capabilities that may exist in an underlying API/MCP server;
- distinguish pilot/discovery signals from validated outcomes;
- do not publish private names or direct quotes without documented permission;
- preserve uncertainty and relevant safety limitations for health/training use cases.
