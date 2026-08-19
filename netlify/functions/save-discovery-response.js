/**
 * Netlify Function: save-discovery-response
 * POST /api/save-discovery-response
 *
 * Stores a deliberately minimal, contact-free pilot discovery response.
 * No name, email address, wearable export, IP address, or user agent is
 * written to Airtable by this function.
 */

const { randomUUID } = require("crypto");

const AIRTABLE_BASE_ID = "apptpoj0htosZOAJ7";
const AIRTABLE_TABLE_ID = "tblitBRp9TRhvMVf0";
const SURVEY_VERSION = "discovery-v1";
const CONSENT_VERSION = "pilot-discovery-v1";

const ALLOWED = {
  primarySetup: [
    "Garmin",
    "Polar",
    "Apple Watch / Health",
    "Other tracker / app",
    "No tracking"
  ],
  primaryNeed: [
    "Training decision",
    "Training nutrition",
    "Energy / recovery",
    "Routine / time",
    "Habit change",
    "Weight / body composition",
    "Long-term patterns",
    "Other"
  ],
  currentContext: [
    "Poor sleep",
    "Hard session",
    "Time pressure",
    "Social / travel",
    "Stress / mood",
    "Feeling unwell / pain",
    "Feeling good",
    "Other"
  ],
  existingTools: [
    "Garmin",
    "Polar",
    "Apple Watch / Apple Health",
    "Fitbit / Health Connect",
    "Oura / Whoop",
    "Strava / TrainingPeaks",
    "Strength / training app",
    "Nutrition / weight app",
    "Calendar",
    "Notes / spreadsheets",
    "None",
    "Other"
  ],
  mainFriction: [
    "Data scattered",
    "Metrics without decision",
    "Manual logging too much",
    "Life context missing",
    "Unsure what matters",
    "Privacy concerns",
    "No current problem",
    "Other"
  ],
  desiredHelp: [
    "Answer on demand",
    "Daily recommendation",
    "Weekly review",
    "Proactive reminder / warning",
    "Automatic logging",
    "Adapt plans",
    "Connect existing apps",
    "Show sources and uncertainty",
    "Coach-ready summary"
  ],
  pilotInterest: ["Yes, 7 days", "Maybe", "No"],
  setupWillingness: [
    "Immediate / no setup",
    "Up to 10 minutes",
    "Up to 30 minutes",
    "More if value is clear"
  ],
  privacyBoundary: [
    "Manual input only",
    "Selected sources read-only",
    "Cloud with transparency and deletion",
    "Broad context if value is clear",
    "Unsure"
  ],
  mainConcern: [
    "Privacy",
    "Accuracy",
    "Setup effort",
    "Cost",
    "Too many apps",
    "Would not use consistently",
    "None",
    "Other"
  ],
  clientType: ["Mobile", "Desktop"]
};

const RESPONSE_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: RESPONSE_HEADERS,
    body: JSON.stringify(body)
  };
}

function cleanText(value, maxLength) {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}

function requireChoice(payload, field) {
  const value = cleanText(payload[field], 100);
  if (!ALLOWED[field].includes(value)) {
    throw new Error(field + " is invalid");
  }
  return value;
}

function requireChoices(payload, field, min, max) {
  if (!Array.isArray(payload[field])) {
    throw new Error(field + " must be an array");
  }
  const values = [...new Set(payload[field].map((value) => cleanText(value, 100)))];
  if (values.length < min || values.length > max) {
    throw new Error(field + " must contain " + min + "-" + max + " choices");
  }
  if (values.some((value) => !ALLOWED[field].includes(value))) {
    throw new Error(field + " contains an invalid choice");
  }
  if (field === "existingTools" && values.includes("None") && values.length > 1) {
    throw new Error("None cannot be combined with other existing tools");
  }
  return values;
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Invalid request body");
  }
  if (payload.website) {
    throw new Error("Spam check failed");
  }
  if (payload.consent !== true || payload.consentVersion !== CONSENT_VERSION) {
    throw new Error("Explicit consent is required");
  }
  if (payload.surveyVersion !== SURVEY_VERSION) {
    throw new Error("Unsupported survey version");
  }

  const tomorrowQuestion = cleanText(payload.tomorrowQuestion, 500);
  if (tomorrowQuestion.length < 6) {
    throw new Error("tomorrowQuestion is too short");
  }

  const completionSeconds = Math.round(Number(payload.completionSeconds));
  if (!Number.isFinite(completionSeconds) || completionSeconds < 5 || completionSeconds > 3600) {
    throw new Error("completionSeconds is invalid");
  }

  return {
    surveyVersion: SURVEY_VERSION,
    consentVersion: CONSENT_VERSION,
    source: cleanText(payload.source, 40).replace(/[^a-zA-Z0-9_-]/g, "") || "direct",
    primarySetup: requireChoice(payload, "primarySetup"),
    primaryNeed: requireChoice(payload, "primaryNeed"),
    currentContext: requireChoice(payload, "currentContext"),
    existingTools: requireChoices(payload, "existingTools", 1, 12),
    mainFriction: requireChoice(payload, "mainFriction"),
    desiredHelp: requireChoices(payload, "desiredHelp", 1, 3),
    tomorrowQuestion,
    pilotInterest: requireChoice(payload, "pilotInterest"),
    setupWillingness: requireChoice(payload, "setupWillingness"),
    privacyBoundary: requireChoice(payload, "privacyBoundary"),
    mainConcern: requireChoice(payload, "mainConcern"),
    optionalComment: cleanText(payload.optionalComment, 500),
    completionSeconds,
    clientType: requireChoice(payload, "clientType")
  };
}

function originAllowed(origin) {
  if (!origin) return true;
  const normalized = String(origin).replace(/\/$/, "");
  const allowed = [
    "https://personal-ai-os.com",
    process.env.URL,
    process.env.DEPLOY_PRIME_URL
  ]
    .filter(Boolean)
    .map((value) => String(value).replace(/\/$/, ""));
  return allowed.includes(normalized);
}

async function saveToAirtable(data) {
  const apiKey = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_TOKEN;
  if (!apiKey) {
    const error = new Error("Airtable is not configured");
    error.statusCode = 503;
    throw error;
  }

  const submittedAt = new Date().toISOString();
  const responseId =
    "DISC-" +
    submittedAt.slice(0, 10).replace(/-/g, "") +
    "-" +
    randomUUID().slice(0, 8).toUpperCase();

  const storedResponse = {
    responseId,
    submittedAt,
    ...data
  };

  const fields = {
    "Response ID": responseId,
    "Submitted At": submittedAt,
    "Survey Version": data.surveyVersion,
    "Source": data.source,
    "Primary Setup": data.primarySetup,
    "Primary Need": data.primaryNeed,
    "Current Context": data.currentContext,
    "Existing Tools": data.existingTools,
    "Main Friction": data.mainFriction,
    "Desired Help": data.desiredHelp,
    "Tomorrow Question": data.tomorrowQuestion,
    "Pilot Interest": data.pilotInterest,
    "Setup Willingness": data.setupWillingness,
    "Privacy Boundary": data.privacyBoundary,
    "Main Concern": data.mainConcern,
    "Completion Seconds": data.completionSeconds,
    "Client Type": data.clientType,
    "Consent Version": data.consentVersion,
    "Full Response JSON": JSON.stringify(storedResponse)
  };

  if (data.optionalComment) {
    fields["Optional Comment"] = data.optionalComment;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  let airtableResponse;

  try {
    airtableResponse = await fetch(
      "https://api.airtable.com/v0/" + AIRTABLE_BASE_ID + "/" + AIRTABLE_TABLE_ID,
      {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ fields, typecast: false }),
        signal: controller.signal
      }
    );
  } finally {
    clearTimeout(timer);
  }

  if (!airtableResponse.ok) {
    const errorText = await airtableResponse.text();
    console.error(
      "Airtable write failed",
      airtableResponse.status,
      errorText.slice(0, 240)
    );
    const error = new Error("Airtable write failed");
    error.statusCode = 502;
    throw error;
  }

  return responseId;
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return response(405, { error: "Method Not Allowed" });
  }

  if (!originAllowed(event.headers && (event.headers.origin || event.headers.Origin))) {
    return response(403, { error: "Origin not allowed" });
  }

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64").toString("utf8")
    : event.body || "";

  if (Buffer.byteLength(rawBody, "utf8") > 25000) {
    return response(413, { error: "Request too large" });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return response(400, { error: "Invalid JSON" });
  }

  let data;
  try {
    data = validatePayload(payload);
  } catch (error) {
    return response(400, { error: error.message });
  }

  try {
    const responseId = await saveToAirtable(data);
    return response(200, { saved: true, responseId });
  } catch (error) {
    console.error("Discovery response save failed:", error.message);
    return response(error.statusCode || 502, {
      saved: false,
      error: "Die Antwort konnte gerade nicht gespeichert werden. Bitte versuche es erneut."
    });
  }
};

exports.validatePayload = validatePayload;
exports.constants = { SURVEY_VERSION, CONSENT_VERSION };

