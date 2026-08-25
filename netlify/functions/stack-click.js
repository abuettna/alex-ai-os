const { randomUUID } = require("crypto");

const AIRTABLE_BASE_ID = "app6xAdVA6xYBLwde";
const AIRTABLE_TABLE_ID = "tblLNBm2dH0h3gnRV";

const RESPONSE_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};

function response(statusCode, body) {
  return { statusCode, headers: RESPONSE_HEADERS, body: JSON.stringify(body) };
}

function clean(value, maxLength) {
  return String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}

function originAllowed(origin) {
  if (!origin) return true;
  const normalized = String(origin).replace(/\/$/, "");
  return ["https://personal-ai-os.com", process.env.URL, process.env.DEPLOY_PRIME_URL]
    .filter(Boolean)
    .map((value) => String(value).replace(/\/$/, ""))
    .includes(normalized);
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return response(405, { error: "Method Not Allowed" });
  if (!originAllowed(event.headers && (event.headers.origin || event.headers.Origin))) {
    return response(403, { error: "Origin not allowed" });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return response(400, { error: "Invalid JSON" });
  }

  const product = clean(payload.product, 120);
  const category = clean(payload.category, 80);
  const destination = clean(payload.destination, 500);
  const source = clean(payload.source, 80) || "direct";
  const page = clean(payload.page, 120) || "/stack/";

  if (!product || !category || !/^https:\/\//i.test(destination)) {
    return response(400, { error: "Invalid event" });
  }

  const token = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_TOKEN;
  if (!token) return response(503, { saved: false });

  const timestamp = new Date().toISOString();
  const clickId = "STACK-" + timestamp.slice(0, 10).replace(/-/g, "") + "-" + randomUUID().slice(0, 8).toUpperCase();
  const fields = {
    "Click ID": clickId,
    "Timestamp": timestamp,
    "Product": product,
    "Category": category,
    "Destination": destination,
    "Source": source,
    "Page": page
  };

  try {
    const r = await fetch("https://api.airtable.com/v0/" + AIRTABLE_BASE_ID + "/" + AIRTABLE_TABLE_ID, {
      method: "POST",
      headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ fields, typecast: false })
    });
    if (!r.ok) throw new Error("Airtable write failed: " + r.status);
    return response(200, { saved: true });
  } catch (error) {
    console.error("Stack click save failed", error.message);
    return response(502, { saved: false });
  }
};
