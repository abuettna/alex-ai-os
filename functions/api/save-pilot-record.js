/**
 * Cloudflare Pages Function: save-pilot-record
 * POST /api/save-pilot-record
 *
 * Persists pilot onboarding + recommendation to Airtable.
 * Airtable credentials remain strictly server-side.
 *
 * Security:
 * - Origin check (same-origin only)
 * - Payload size limit (32 KB)
 * - Strict schema validation + unknown field rejection
 * - IP-based rate limiting via Cloudflare KV (if KV namespace RATE_LIMIT bound)
 *   Falls back gracefully if KV is not configured.
 *
 * Required env vars (set in Cloudflare Pages → Settings → Environment variables):
 *   AIRTABLE_API_KEY   — Airtable personal access token
 *   AIRTABLE_BASE_ID   — Base ID (starts with "app...")
 *
 * Optional env vars:
 *   RATE_LIMIT_WINDOW_SECONDS  — window size in seconds (default: 3600)
 *   RATE_LIMIT_MAX_REQUESTS    — max requests per IP per window (default: 5)
 */

const AIRTABLE_TABLE = "Pilot Participants";
const MAX_PAYLOAD_BYTES = 32 * 1024; // 32 KB
const DEFAULT_RATE_WINDOW = 3600; // 1 hour
const DEFAULT_RATE_MAX = 5;

/** Allowed top-level request fields — reject anything else */
const ALLOWED_REQUEST_FIELDS = new Set([
  "participantId",
  "profile",
  "recommendation",
  "generationFailed",
  "failureReason"
]);

/** Allowed profile fields */
const ALLOWED_PROFILE_FIELDS = new Set([
  "name",
  "goals",
  "devices",
  "services",
  "painPoint",
  "frustration",
  "deviceModel",
  "otherGoal",
  "otherService",
  "noIntegrate",
  "technicalConfidence",
  "manualLogging",
  "automationDesire",
  "newAppsWillingness",
  "payWillingness",
  "privacyPreference"
]);

function rejectUnknownFields(obj, allowed) {
  if (!obj || typeof obj !== "object") return;
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) {
      throw new Error(`Unknown field: ${key}`);
    }
  }
}

function toArray(val) {
  if (Array.isArray(val)) return val;
  if (!val) return [];
  return [val];
}

async function checkRateLimit(env, ip) {
  if (!env.RATE_LIMIT) return { allowed: true };

  const window = parseInt(env.RATE_LIMIT_WINDOW_SECONDS || DEFAULT_RATE_WINDOW, 10);
  const max = parseInt(env.RATE_LIMIT_MAX_REQUESTS || DEFAULT_RATE_MAX, 10);
  const key = `rl:${ip}`;

  try {
    const raw = await env.RATE_LIMIT.get(key);
    const count = raw ? parseInt(raw, 10) : 0;
    if (count >= max) return { allowed: false };
    await env.RATE_LIMIT.put(key, String(count + 1), { expirationTtl: window });
    return { allowed: true };
  } catch (err) {
    console.warn("Rate limit KV error (allowing request):", err.message);
    return { allowed: true };
  }
}

async function saveToAirtable(env, record) {
  const apiKey = env.AIRTABLE_API_KEY;
  const baseId = env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    throw new Error("Airtable not configured");
  }

  const url = `https://api.airtable.com/v0/${encodeURIComponent(baseId)}/${encodeURIComponent(AIRTABLE_TABLE)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ fields: record })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable error ${res.status}: ${text.slice(0, 200)}`);
  }

  return await res.json();
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // Same-origin check
  const allowedOrigin = new URL(request.url).origin;
  const origin = request.headers.get("Origin");
  if (origin && origin !== allowedOrigin) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }

  // IP-based rate limiting
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const rateCheck = await checkRateLimit(env, ip);
  if (!rateCheck.allowed) {
    return new Response(JSON.stringify({ error: "Too Many Requests" }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": "3600" }
    });
  }

  // Payload size limit
  const contentLength = parseInt(request.headers.get("Content-Length") || "0", 10);
  if (contentLength > MAX_PAYLOAD_BYTES) {
    return new Response(JSON.stringify({ error: "Payload too large" }), {
      status: 413,
      headers: { "Content-Type": "application/json" }
    });
  }

  let text;
  try {
    text = await request.text();
  } catch {
    return new Response(JSON.stringify({ error: "Failed to read request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (text.length > MAX_PAYLOAD_BYTES) {
    return new Response(JSON.stringify({ error: "Payload too large" }), {
      status: 413,
      headers: { "Content-Type": "application/json" }
    });
  }

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Reject unknown top-level fields
  try {
    rejectUnknownFields(body, ALLOWED_REQUEST_FIELDS);
  } catch (err) {
    return new Response(JSON.stringify({ error: `Invalid request: ${err.message}` }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const { profile, recommendation, participantId, generationFailed, failureReason } = body;

  if (!participantId || typeof participantId !== "string") {
    return new Response(JSON.stringify({ error: "participantId required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Validate generationFailed is boolean
  if (generationFailed !== undefined && typeof generationFailed !== "boolean") {
    return new Response(JSON.stringify({ error: "generationFailed must be boolean" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Reject unknown profile fields
  if (profile && typeof profile === "object") {
    try {
      rejectUnknownFields(profile, ALLOWED_PROFILE_FIELDS);
    } catch (err) {
      return new Response(JSON.stringify({ error: `Invalid profile: ${err.message}` }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  const record = {
    ParticipantID: String(participantId).slice(0, 50),
    OnboardingTimestamp: new Date().toISOString(),
    GenerationFailed: generationFailed === true
  };

  if (failureReason) record.FailureReason = String(failureReason).slice(0, 500);

  if (profile && typeof profile === "object") {
    if (profile.name) record.Name = String(profile.name).slice(0, 80);
    if (Array.isArray(profile.goals)) record.Goals = JSON.stringify(profile.goals);
    if (Array.isArray(profile.devices)) record.Devices = JSON.stringify(profile.devices);
    if (Array.isArray(profile.services)) record.Services = JSON.stringify(profile.services);
    if (profile.painPoint) record.PainPoint = String(profile.painPoint).slice(0, 800);
    if (profile.frustration) record.Frustration = String(profile.frustration).slice(0, 400);
    if (profile.noIntegrate) record.NoIntegrate = String(profile.noIntegrate).slice(0, 400);
    if (profile.privacyPreference) record.PrivacyPreference = String(profile.privacyPreference).slice(0, 30);
    if (typeof profile.technicalConfidence === "number") record.TechnicalConfidence = Math.min(5, Math.max(1, profile.technicalConfidence));
    if (typeof profile.manualLogging === "number") record.ManualLogging = Math.min(5, Math.max(1, profile.manualLogging));
    if (typeof profile.automationDesire === "number") record.AutomationDesire = Math.min(5, Math.max(1, profile.automationDesire));
    if (typeof profile.newAppsWillingness === "number") record.NewAppsWillingness = Math.min(5, Math.max(1, profile.newAppsWillingness));
    if (typeof profile.payWillingness === "number") record.PayWillingness = Math.min(5, Math.max(1, profile.payWillingness));
  }

  if (recommendation && typeof recommendation === "object") {
    if (recommendation.recommendationId) record.RecommendationID = String(recommendation.recommendationId).slice(0, 50);
    if (recommendation.evidenceLevel) record.EvidenceLevel = String(recommendation.evidenceLevel).slice(0, 30);
    if (recommendation.confidence) record.Confidence = String(recommendation.confidence).slice(0, 20);
    if (recommendation.architectureSummary) record.ArchitectureSummary = String(recommendation.architectureSummary).slice(0, 2000);
    if (recommendation.promptVersion) record.PromptVersion = String(recommendation.promptVersion).slice(0, 20);
    if (recommendation.registryVersion) record.RegistryVersion = String(recommendation.registryVersion).slice(0, 20);
    if (recommendation.modelId) record.ModelId = String(recommendation.modelId).slice(0, 50);
    record.RecommendationJSON = JSON.stringify(recommendation).slice(0, 100000);
  }

  try {
    await saveToAirtable(env, record);
    return new Response(JSON.stringify({ saved: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("Airtable save failed:", err.message);
    return new Response(
      JSON.stringify({ saved: false, warning: "Pilot-Datensatz konnte nicht gespeichert werden." }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
}
