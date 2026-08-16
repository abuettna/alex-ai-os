# Founding Pilot V0.1 — Configuration Guide

## Required Environment Variables

Set these in **Cloudflare Pages → Settings → Environment variables** (mark all as *Secret*).

| Variable | Description | Where to get it |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI API key | https://platform.openai.com/api-keys |
| `OPENAI_MODEL` | OpenAI model name (optional, defaults to `gpt-4o-mini`) | See [OpenAI model list](https://platform.openai.com/docs/models) |
| `AIRTABLE_API_KEY` | Airtable personal access token | https://airtable.com/create/tokens |
| `AIRTABLE_BASE_ID` | Your Airtable base ID (starts with `app...`) | Found in the base URL when viewing the base |

**All variables are server-side only. Never expose them client-side.**

### Optional: Rate Limiting via KV

To enable IP-based rate limiting on the `/api/save-pilot-record` endpoint:

1. Create a KV namespace in Cloudflare dashboard → Workers & Pages → KV
2. Bind it to the Pages project: **Pages → Settings → Functions → KV namespace bindings** → add binding named `RATE_LIMIT`
3. Optionally set these environment variables:
   - `RATE_LIMIT_WINDOW_SECONDS` (default: `3600`)
   - `RATE_LIMIT_MAX_REQUESTS` (default: `5`)

Without the KV binding, the endpoint still works but rate limiting is skipped (graceful fallback).

---

## Airtable Setup

Create a new base called **Personal AI OS Pilot** with the following tables:

### Table: `Pilot Participants`

Create these fields (all types as shown):

| Field Name | Type |
|---|---|
| ParticipantID | Single line text |
| Name | Single line text |
| Goals | Long text |
| Devices | Long text |
| Services | Long text |
| PainPoint | Long text |
| Frustration | Long text |
| NoIntegrate | Long text |
| TechnicalConfidence | Number |
| ManualLogging | Number |
| AutomationDesire | Number |
| NewAppsWillingness | Number |
| PayWillingness | Number |
| PrivacyPreference | Single line text |
| RecommendationID | Single line text |
| EvidenceLevel | Single line text |
| Confidence | Single line text |
| ArchitectureSummary | Long text |
| RecommendationJSON | Long text |
| OnboardingTimestamp | Date (include time) |
| PromptVersion | Single line text |
| RegistryVersion | Single line text |
| ModelId | Single line text |
| GenerationFailed | Checkbox |
| FailureReason | Long text |

### Future tables (add later for evidence collection)

- **Architecture Feedback** — D3/D10/D30 observations
- **Architecture Evidence** — aggregated evidence by recipe
- **Architecture Components** — component registry mirror

---

## Cloudflare Pages Deployment

### Connect via Dashboard (recommended)

1. Go to **Cloudflare Pages → Create a project → Connect to Git**
2. Select the `abuettna/alex-ai-os` repository
3. Configure:
   - **Build command:** *(leave empty — no build step required)*
   - **Build output directory:** `.` (root)
   - **Root directory:** `.` (root)
4. Add the environment variables listed above

### Or deploy via CLI

```bash
npx wrangler pages deploy . --project-name alex-ai-os
```

The pilot is accessible at: `https://alex-ai-os.pages.dev/pilot/` (or your custom domain).

---

## API Endpoints

Pages Functions are automatically routed from the `/functions` directory:

| File | Route |
|---|---|
| `functions/api/generate-architecture.js` | `POST /api/generate-architecture` |
| `functions/api/save-pilot-record.js` | `POST /api/save-pilot-record` |

No `netlify.toml` or redirect rules needed — Cloudflare Pages handles routing automatically.

---

## Launch Blockers

Before sending the URL to real users, verify:

- [ ] `OPENAI_API_KEY` set in Cloudflare Pages
- [ ] `AIRTABLE_API_KEY` and `AIRTABLE_BASE_ID` set in Cloudflare Pages
- [ ] Airtable base and `Pilot Participants` table created with correct field names
- [ ] `/pilot/` loads and the form works end-to-end in a clean browser
- [ ] Mobile test on iPhone Safari
- [ ] Impressum page exists at `/impressum` or is linked (legal requirement for German users)
- [ ] Datenschutzerklärung exists at `/datenschutz` (legal requirement)
- [ ] Failure states work: test with a bad API key → error screen shows
- [ ] Airtable save failure state works: error handled gracefully, retry button appears

---

## What is intentionally NOT built in V0.1

- User accounts / authentication
- Email delivery of results
- Payment / subscriptions
- Mobile app
- D3/D10/D30 follow-up automation (prepare fields, schedule manually for now)
- Admin dashboard
- OAuth connections to external services
- Automatic Garmin/Apple Health data import

---

## D3/D10/D30 Follow-up (future)

After V0.1 participants use the system for 3, 10, and 30 days, ask them manually (or via a simple separate form):

**Setup:** Did you attempt setup? Did it work? How long? Where did you get stuck? Did you need Alex's help?

**Usage:** Have you used the system?

**Value:** Did it help concretely? Would you keep using it? What would you miss if it were gone? Could you have built this without the recommendation?

Add responses to **Architecture Feedback** table in Airtable. This data drives upgrading `evidenceLevel` from `experimental` to `pilot-tested` and eventually `replicated` or `validated`.
