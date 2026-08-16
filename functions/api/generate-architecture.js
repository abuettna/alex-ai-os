/**
 * Cloudflare Pages Function: generate-architecture
 * POST /api/generate-architecture
 *
 * Receives onboarding profile, calls OpenAI, returns structured recommendation.
 * All secrets remain server-side.
 */

import { components, REGISTRY_VERSION } from "../../lib/registry.js";
import { buildSystemPrompt, PROMPT_VERSION } from "../../lib/prompt.js";

const MODEL_DEFAULT = "gpt-4o-mini";

// Build an allowlist Set of known component names for registry enforcement
const REGISTRY_COMPONENT_NAMES = new Set(components.map((c) => c.name));
const REGISTRY_COMPONENT_IDS = new Set(components.map((c) => c.id));

function isKnownComponent(name) {
  if (!name || typeof name !== "string") return false;
  const n = name.trim().toLowerCase();
  for (const known of REGISTRY_COMPONENT_NAMES) {
    if (known.toLowerCase() === n) return true;
  }
  for (const id of REGISTRY_COMPONENT_IDS) {
    if (id.toLowerCase() === n) return true;
  }
  return false;
}

/** Validate and sanitize the incoming profile */
function validateProfile(body) {
  if (!body || typeof body !== "object") throw new Error("Invalid request body");

  const name = (body.name || "").toString().slice(0, 80).trim();
  const goals = Array.isArray(body.goals) ? body.goals.map((g) => String(g).slice(0, 100)) : [];
  const devices = Array.isArray(body.devices) ? body.devices.map((d) => String(d).slice(0, 100)) : [];
  const services = Array.isArray(body.services) ? body.services.map((s) => String(s).slice(0, 100)) : [];
  const painPoint = (body.painPoint || "").toString().slice(0, 800).trim();
  const frustration = (body.frustration || "").toString().slice(0, 400).trim();
  const deviceModel = (body.deviceModel || "").toString().slice(0, 100).trim();
  const otherGoal = (body.otherGoal || "").toString().slice(0, 200).trim();
  const otherService = (body.otherService || "").toString().slice(0, 200).trim();
  const noIntegrate = (body.noIntegrate || "").toString().slice(0, 400).trim();

  const technicalConfidence = Math.min(5, Math.max(1, Number(body.technicalConfidence) || 3));
  const manualLogging = Math.min(5, Math.max(1, Number(body.manualLogging) || 3));
  const automationDesire = Math.min(5, Math.max(1, Number(body.automationDesire) || 3));
  const newAppsWillingness = Math.min(5, Math.max(1, Number(body.newAppsWillingness) || 3));
  const payWillingness = Math.min(5, Math.max(1, Number(body.payWillingness) || 3));
  const privacyPreference = (body.privacyPreference || "neutral").toString().slice(0, 30);

  if (goals.length === 0 && otherGoal) goals.push(otherGoal);
  if (goals.length === 0) throw new Error("At least one goal required");

  return {
    name,
    goals,
    devices,
    services,
    painPoint,
    frustration,
    deviceModel,
    otherGoal,
    otherService,
    noIntegrate,
    technicalConfidence,
    manualLogging,
    automationDesire,
    newAppsWillingness,
    payWillingness,
    privacyPreference
  };
}

/** Build the user message from the profile */
function buildUserMessage(profile) {
  const scaleLabel = (v) => {
    if (v <= 1) return "sehr niedrig";
    if (v <= 2) return "niedrig";
    if (v <= 3) return "mittel";
    if (v <= 4) return "hoch";
    return "sehr hoch";
  };

  const lines = [
    `Name/Nickname: ${profile.name || "nicht angegeben"}`,
    `Ziele: ${profile.goals.join(", ")}${profile.otherGoal ? ` (sonstiges: ${profile.otherGoal})` : ""}`,
    `Geräte: ${profile.devices.length > 0 ? profile.devices.join(", ") : "keine Wearables"}${profile.deviceModel ? ` (Modell: ${profile.deviceModel})` : ""}`,
    `Dienste/Apps: ${profile.services.length > 0 ? profile.services.join(", ") : "keine"}${profile.otherService ? ` (sonstiges: ${profile.otherService})` : ""}`,
    `Technisches Vertrauen: ${scaleLabel(profile.technicalConfidence)} (${profile.technicalConfidence}/5)`,
    `Bereitschaft manuelles Logging: ${scaleLabel(profile.manualLogging)} (${profile.manualLogging}/5)`,
    `Gewünschter Automatisierungsgrad: ${scaleLabel(profile.automationDesire)} (${profile.automationDesire}/5)`,
    `Bereitschaft neue Apps: ${scaleLabel(profile.newAppsWillingness)} (${profile.newAppsWillingness}/5)`,
    `Bereitschaft zusätzliche Abos: ${scaleLabel(profile.payWillingness)} (${profile.payWillingness}/5)`,
    `Datenschutz-Präferenz: ${profile.privacyPreference}`,
    profile.noIntegrate ? `Nicht integrieren / explizit ausschließen: ${profile.noIntegrate}` : null,
    profile.painPoint ? `Wichtigste Anforderung / aktuelles Problem: ${profile.painPoint}` : null,
    profile.frustration ? `Was nervt am aktuellen Setup: ${profile.frustration}` : null
  ]
    .filter(Boolean)
    .join("\n");

  return `USER PROFILE:\n${lines}\n\nGenerate a structured architecture recommendation for this user.`;
}

/** Ensure a field is an array; if not, normalize or return empty array */
function toArray(val) {
  if (Array.isArray(val)) return val;
  if (val === null || val === undefined || val === "") return [];
  if (typeof val === "string") return [val];
  return [];
}

/** Filter component list to only known registry components; unknown go to unresolvedQuestions */
function enforceRegistry(compArray, unknownBucket) {
  const known = [];
  for (const comp of toArray(compArray)) {
    if (!comp || typeof comp !== "object") continue;
    if (isKnownComponent(comp.name)) {
      known.push(comp);
    } else {
      unknownBucket.push(
        `Unbekannte Komponente "${comp.name || "(leer)"}" wurde vom Modell vorgeschlagen, ist aber nicht im Registry und wurde entfernt.`
      );
    }
  }
  return known;
}

/** Normalize and validate model recommendation arrays */
function normalizeRecommendation(rec, unknownBucket) {
  rec.primaryGoals = toArray(rec.primaryGoals).map(String);
  rec.dataFlow = toArray(rec.dataFlow).map(String);
  rec.expectedBenefits = toArray(rec.expectedBenefits).map(String);
  rec.limitations = toArray(rec.limitations).map(String);
  rec.unresolvedQuestions = toArray(rec.unresolvedQuestions).map(String);

  rec.setupSteps = toArray(rec.setupSteps).filter((s) => s && typeof s === "object").map((s) => ({
    order: Math.max(1, parseInt(s.order, 10) || 1),
    action: String(s.action || "").slice(0, 500),
    estimatedMinutes: Math.max(0, parseInt(s.estimatedMinutes, 10) || 0)
  }));

  rec.excludedComponents = toArray(rec.excludedComponents).filter(
    (c) => c && typeof c === "object"
  ).map((c) => ({
    name: String(c.name || "").slice(0, 100),
    reason: String(c.reason || "").slice(0, 500)
  }));

  rec.requiredComponents = enforceRegistry(rec.requiredComponents, unknownBucket);
  rec.optionalComponents = enforceRegistry(rec.optionalComponents, unknownBucket);

  if (unknownBucket.length > 0) {
    rec.unresolvedQuestions = [...rec.unresolvedQuestions, ...unknownBucket];
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const allowedOrigin = new URL(request.url).origin;
  const origin = request.headers.get("Origin");
  if (origin && origin !== allowedOrigin) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (!env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY not configured");
    return new Response(JSON.stringify({ error: "AI-Dienst nicht konfiguriert." }), {
      status: 503,
      headers: { "Content-Type": "application/json" }
    });
  }

  let body;
  try {
    const text = await request.text();
    if (text.length > 16384) {
      return new Response(JSON.stringify({ error: "Payload too large" }), {
        status: 413,
        headers: { "Content-Type": "application/json" }
      });
    }
    body = JSON.parse(text);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  let profile;
  try {
    profile = validateProfile(body);
  } catch (err) {
    return new Response(JSON.stringify({ error: `Ungültige Eingabe: ${err.message}` }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const MODEL = env.OPENAI_MODEL || MODEL_DEFAULT;
  const systemPrompt = buildSystemPrompt(components);
  const userMessage = buildUserMessage(profile);

  let rawResponse;
  try {
    const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + env.OPENAI_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 3000,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ]
      })
    });

    if (!oaiRes.ok) {
      const errText = await oaiRes.text();
      console.error("OpenAI API error:", oaiRes.status, errText.slice(0, 200));
      return new Response(
        JSON.stringify({
          error: "Die automatische Architektur konnte diesmal nicht zuverlässig erstellt werden.",
          retryable: true
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const oaiData = await oaiRes.json();
    rawResponse = oaiData.choices?.[0]?.message?.content;
  } catch (err) {
    console.error("OpenAI fetch error:", err.message);
    return new Response(
      JSON.stringify({
        error: "Die automatische Architektur konnte diesmal nicht zuverlässig erstellt werden.",
        retryable: true
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  let recommendation;
  try {
    recommendation = JSON.parse(rawResponse);
  } catch (err) {
    console.error("JSON parse error from model:", err.message, rawResponse?.slice(0, 200));
    return new Response(
      JSON.stringify({
        error: "Die automatische Architektur konnte diesmal nicht zuverlässig erstellt werden.",
        retryable: true
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  // Validate required response fields
  const requiredFields = [
    "recommendationId",
    "architectureSummary",
    "requiredComponents",
    "setupSteps",
    "evidenceLevel",
    "confidence"
  ];
  const missingFields = requiredFields.filter(
    (f) => recommendation[f] === undefined || recommendation[f] === null || recommendation[f] === ""
  );
  if (missingFields.length > 0) {
    console.error("Architecture response missing required fields:", missingFields, rawResponse?.slice(0, 400));
    return new Response(
      JSON.stringify({
        error: "Die automatische Architektur konnte diesmal nicht zuverlässig erstellt werden.",
        retryable: true
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  // Normalize all arrays and enforce registry allowlist
  const unknownComponents = [];
  normalizeRecommendation(recommendation, unknownComponents);

  // Re-check required arrays after normalization
  if (!Array.isArray(recommendation.requiredComponents) || !Array.isArray(recommendation.setupSteps)) {
    return new Response(
      JSON.stringify({
        error: "Die automatische Architektur konnte diesmal nicht zuverlässig erstellt werden.",
        retryable: true
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  // Enforce V0.1 evidence level restriction
  const allowedLevels = ["experimental", "founder-tested"];
  if (!allowedLevels.includes(recommendation.evidenceLevel)) {
    recommendation.evidenceLevel = "experimental";
    recommendation.evidenceExplanation =
      "V0.1 – Keine unabhängigen Belege verfügbar. Diese Empfehlung basiert auf allgemeinen Prinzipien.";
  }

  // Attach generation metadata
  recommendation.generatedAt = recommendation.generatedAt || new Date().toISOString();
  recommendation.promptVersion = PROMPT_VERSION;
  recommendation.registryVersion = REGISTRY_VERSION;
  recommendation.modelId = MODEL;

  return new Response(JSON.stringify({ recommendation, profile }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
