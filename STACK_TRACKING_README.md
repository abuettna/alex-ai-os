# Stack click tracking

Outbound links on `/stack/` send a privacy-minimal first-party click event to the canonical Cloudflare Worker endpoint `/api/stack-click`.

The Worker temporarily also accepts the legacy `/.netlify/functions/stack-click` path for compatibility with older or cached clients. New frontend code and documentation should use `/api/stack-click`.

Stored in the canonical Airtable table `Stack Clicks` in the **Personal AI OS** base:
- Click ID
- Timestamp
- Product
- Category
- Destination
- Source (`?src=` query parameter or `direct`)
- Page

The tracking flow intentionally does not store IP address, user agent, name, email, health data, or other directly identifying information in the application payload. Tracking failure never blocks the outbound product link.

The older `Stack Clicks (Legacy)` table in the Alex Data Lake is not a production destination and should remain unused.

Current product links are direct, non-affiliate links. Any future affiliate or paid relationship should remain clearly disclosed on the page.
