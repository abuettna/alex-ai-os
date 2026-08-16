/**
 * Netlify Function: generate-architecture
 * POST /api/generate-architecture
 *
 * Receives onboarding profile, calls OpenAI, returns structured recommendation.
 * All secrets remain server-side.
 */

const OpenAI = require("openai");
const { components, REGISTRY_VERSION } = require("../../lib/registry");
const { buildSystemPrompt, PROMPT_VERSION } = require("../../lib/prompt");

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

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

  const technicalConfidence = Number(body.technicalConfidence) || 3;
  const manualLogging = Number(body.manualLogging) || 3;
  const automationDesire = Number(body.automationDesire) || 3;
  const newAppsWillingness = Number(body.newAppsWillingness) || 3;
  const payWillingness = Number(body.payWillingness) || 3;
  const privacyPreference = (body.privacyPreference || "neutral").toString().slice(0, 30);

  // Accept otherGoal as a goal when no checkboxes are checked
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

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY not configured");
    return {
      statusCode: 503,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "AI-Dienst nicht konfiguriert." })
    };
  }

  let profile;
  try {
    const body = JSON.parse(event.body || "{}");
    profile = validateProfile(body);
  } catch (err) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: `Ungültige Eingabe: ${err.message}` })
    };
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const systemPrompt = buildSystemPrompt(components);
  const userMessage = buildUserMessage(profile);

  let rawResponse;
  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 3000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ]
    });
    rawResponse = completion.choices[0].message.content;
  } catch (err) {
    console.error("OpenAI API error:", err.message);
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Die automatische Architektur konnte diesmal nicht zuverlässig erstellt werden.",
        retryable: true
      })
    };
  }

  let recommendation;
  try {
    recommendation = JSON.parse(rawResponse);
  } catch (err) {
    console.error("JSON parse error from model:", err.message, rawResponse?.slice(0, 200));
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Die automatische Architektur konnte diesmal nicht zuverlässig erstellt werden.",
        retryable: true
      })
    };
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
  if (
    missingFields.length > 0 ||
    !Array.isArray(recommendation.requiredComponents) ||
    !Array.isArray(recommendation.setupSteps)
  ) {
    console.error("Architecture response missing required fields:", missingFields, rawResponse?.slice(0, 400));
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Die automatische Architektur konnte diesmal nicht zuverlässig erstellt werden.",
        retryable: true
      })
    };
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

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recommendation, profile })
  };
};
