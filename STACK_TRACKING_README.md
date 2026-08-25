# Stack click tracking

Outbound links on `/stack/` send a privacy-minimal first-party click event to `/.netlify/functions/stack-click`.

Stored in Airtable table `Stack Clicks`:
- Click ID
- Timestamp
- Product
- Category
- Destination
- Source (`?src=` query parameter or `direct`)
- Page

The function intentionally does not store IP address, user agent, name, email, or health data. Tracking failure never blocks the outbound product link.

Current product links are direct, non-affiliate links. Any future affiliate or paid relationship should remain clearly disclosed on the page.