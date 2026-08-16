/**
 * Netlify Function: save-pilot-record
 * POST /api/save-pilot-record
 *
 * Persists pilot onboarding + recommendation to Airtable.
 * Airtable credentials remain strictly server-side.
 *
 * Required env vars:
 *   AIRTABLE_API_KEY   — Airtable personal access token
 *   AIRTABLE_BASE_ID   — Base ID (starts with "app...")
 *
 * Airtable table: "Pilot Participants"
 * Fields (create these manually in Airtable):
 *   ParticipantID       (Single line text)
 *   Name                (Single line text)
 *   Email               (Email)
 *   Goals               (Long text / JSON)
 *   Devices             (Long text / JSON)
 *   Services            (Long text / JSON)
 *   PainPoint           (Long text)
 *   Frustration         (Long text)
 *   NoIntegrate         (Long text)
 *   TechnicalConfidence (Number)
 *   ManualLogging       (Number)
 *   AutomationDesire    (Number)
 *   NewAppsWillingness  (Number)
 *   PayWillingness      (Number)
 *   PrivacyPreference   (Single line text)
 *   RecommendationID    (Single line text)
 *   EvidenceLevel       (Single line text)
 *   Confidence          (Single line text)
 *   ArchitectureSummary (Long text)
 *   RecommendationJSON  (Long text — full JSON)
 *   OnboardingTimestamp (Date)
 *   PromptVersion       (Single line text)
 *   RegistryVersion     (Single line text)
 *   ModelId             (Single line text)
 *   GenerationFailed    (Checkbox)
 *   FailureReason       (Long text)
 *   -- Future fields (add later) --
 *   SetupAttempted      (Checkbox)
 *   SetupSuccessful     (Checkbox)
 *   SetupDurationMinutes (Number)
 *   FrictionPoints      (Long text)
 *   FounderInterventionRequired (Checkbox)
 *   D3FeedbackReceived  (Checkbox)
 *   D10FeedbackReceived (Checkbox)
 *   D30FeedbackReceived (Checkbox)
 *   PerceivedUsefulness (Number)
 *   WouldKeepUsing      (Checkbox)
 *   CouldBuildWithoutGuidance (Checkbox)
 *   FreeTextFeedback    (Long text)
 */

const AIRTABLE_TABLE = "Pilot Participants";

async function saveToAirtable(record) {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

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

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid JSON" })
    };
  }

  const { profile, recommendation, participantId, generationFailed, failureReason } = body;

  if (!participantId) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "participantId required" })
    };
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
    if (typeof profile.technicalConfidence === "number") record.TechnicalConfidence = profile.technicalConfidence;
    if (typeof profile.manualLogging === "number") record.ManualLogging = profile.manualLogging;
    if (typeof profile.automationDesire === "number") record.AutomationDesire = profile.automationDesire;
    if (typeof profile.newAppsWillingness === "number") record.NewAppsWillingness = profile.newAppsWillingness;
    if (typeof profile.payWillingness === "number") record.PayWillingness = profile.payWillingness;
  }

  if (recommendation && typeof recommendation === "object") {
    if (recommendation.recommendationId) record.RecommendationID = String(recommendation.recommendationId).slice(0, 50);
    if (recommendation.evidenceLevel) record.EvidenceLevel = String(recommendation.evidenceLevel).slice(0, 30);
    if (recommendation.confidence) record.Confidence = String(recommendation.confidence).slice(0, 20);
    if (recommendation.architectureSummary) record.ArchitectureSummary = String(recommendation.architectureSummary).slice(0, 2000);
    if (recommendation.promptVersion) record.PromptVersion = String(recommendation.promptVersion).slice(0, 20);
    if (recommendation.registryVersion) record.RegistryVersion = String(recommendation.registryVersion).slice(0, 20);
    if (recommendation.modelId) record.ModelId = String(recommendation.modelId).slice(0, 50);
    // Store full recommendation JSON for later analysis
    record.RecommendationJSON = JSON.stringify(recommendation).slice(0, 100000);
  }

  try {
    await saveToAirtable(record);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saved: true })
    };
  } catch (err) {
    // Non-fatal: log and return soft failure — pilot result is still shown to user
    console.error("Airtable save failed:", err.message);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saved: false, warning: "Pilot-Datensatz konnte nicht gespeichert werden." })
    };
  }
};
