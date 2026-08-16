/* global fetch */
"use strict";

// ─── Utils ──────────────────────────────────────────────────────────────────

function esc(str) {
  const d = document.createElement("div");
  d.textContent = String(str || "");
  return d.innerHTML;
}

function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function showStep(id) {
  document.querySelectorAll(".pilot-step").forEach((el) => {
    el.hidden = true;
    el.classList.remove("active");
  });
  const target = document.getElementById(id);
  if (target) {
    target.hidden = false;
    target.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

// ─── Analytics (fire-and-forget) ─────────────────────────────────────────────

function track(event) {
  try {
    if (typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon("/api/analytics", JSON.stringify({ event, ts: Date.now() }));
    }
  } catch (_) {
    // silently ignore — analytics must never break the flow
  }
}

// ─── Step transitions ────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", function () {
  track("pilot_page_view");

  // Welcome → Form
  const btnStart = document.getElementById("btn-start");
  if (btnStart) {
    btnStart.addEventListener("click", function () {
      showStep("step-form");
      track("onboarding_started");
    });
  }

  // Retry button
  const btnRetry = document.getElementById("btn-retry");
  if (btnRetry) {
    btnRetry.addEventListener("click", function () {
      showStep("step-form");
    });
  }

  initSliders();
  initConditionalFields();
  initProgress();
  initForm();
});

// ─── Sliders ──────────────────────────────────────────────────────────────────

function initSliders() {
  const pairs = [
    ["f-tech-confidence", "out-tech-confidence"],
    ["f-manual-logging", "out-manual-logging"],
    ["f-automation", "out-automation"],
    ["f-new-apps", "out-new-apps"],
    ["f-pay", "out-pay"]
  ];
  pairs.forEach(function ([inputId, outputId]) {
    const input = document.getElementById(inputId);
    const output = document.getElementById(outputId);
    if (!input || !output) return;
    input.addEventListener("input", function () {
      output.textContent = input.value;
    });
  });
}

// ─── Conditional fields ───────────────────────────────────────────────────────

function initConditionalFields() {
  const deviceCheckboxes = document.querySelectorAll('input[name="devices"]');
  const garminModelField = document.getElementById("garmin-model-field");

  function updateGarminField() {
    const garminChecked = Array.from(deviceCheckboxes).some(
      (cb) => cb.value === "Garmin" && cb.checked
    );
    if (garminModelField) {
      garminModelField.hidden = !garminChecked;
    }
  }

  deviceCheckboxes.forEach(function (cb) {
    cb.addEventListener("change", updateGarminField);
  });

  // Consent email row visibility
  const emailField = document.getElementById("f-email");
  const consentEmailRow = document.getElementById("consent-email-row");
  if (emailField && consentEmailRow) {
    emailField.addEventListener("input", function () {
      consentEmailRow.hidden = emailField.value.trim() === "";
    });
  }
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function initProgress() {
  const form = document.getElementById("pilot-form");
  const bar = document.getElementById("progress-bar");
  const progressEl = document.querySelector(".form-progress");
  if (!form || !bar) return;

  function updateProgress() {
    const groups = form.querySelectorAll(".form-group");
    let filled = 0;
    groups.forEach(function (group) {
      const checkboxes = group.querySelectorAll('input[type="checkbox"]:not([name="consentData"]):not([name="consentEmail"])');
      const texts = group.querySelectorAll('input[type="text"], input[type="email"], textarea');
      const selects = group.querySelectorAll("select");
      const anyChecked = Array.from(checkboxes).some((cb) => cb.checked);
      const anyText = Array.from(texts).some((t) => t.value.trim().length > 0);
      const anySelect = Array.from(selects).length > 0; // always "filled" since there's a default
      if (anyChecked || anyText || anySelect) filled++;
    });
    const pct = Math.round((filled / groups.length) * 100);
    bar.style.width = pct + "%";
    if (progressEl) progressEl.setAttribute("aria-valuenow", pct);
  }

  form.addEventListener("change", updateProgress);
  form.addEventListener("input", updateProgress);
  updateProgress();
}

// ─── Form submission ──────────────────────────────────────────────────────────

function initForm() {
  const form = document.getElementById("pilot-form");
  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    if (!validateForm(form)) return;

    const profile = collectProfile(form);
    const participantId = generateId();

    showStep("step-generating");
    track("architecture_generation_started");

    let recommendation = null;
    let generationFailed = false;
    let failureReason = "";

    try {
      const res = await fetch("/api/generate-architecture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile)
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        generationFailed = true;
        failureReason = data.error || "HTTP " + res.status;
        track("architecture_generation_failed");
      } else {
        recommendation = data.recommendation;
        track("architecture_generation_success");
      }
    } catch (err) {
      generationFailed = true;
      failureReason = "Network error: " + (err.message || "unknown");
      track("architecture_generation_failed");
    }

    // Persist pilot record regardless of generation success/failure
    try {
      await fetch("/api/save-pilot-record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, recommendation, participantId, generationFailed, failureReason })
      });
    } catch (_) {
      // Non-fatal — record save failure must not block the user
    }

    if (generationFailed || !recommendation) {
      const msgEl = document.getElementById("error-message");
      if (msgEl && failureReason) {
        msgEl.textContent =
          "Die automatische Architektur konnte diesmal nicht zuverlässig erstellt werden.";
      }
      showStep("step-error");
      return;
    }

    renderResult(recommendation, profile, participantId);
    showStep("step-result");
    track("result_viewed");
  });
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateForm(form) {
  let valid = true;

  // Goals required
  const goalChecked = Array.from(form.querySelectorAll('input[name="goals"]')).some((cb) => cb.checked);
  const otherGoal = form.querySelector('input[name="otherGoal"]');
  const goalsError = document.getElementById("goals-error");
  if (!goalChecked && (!otherGoal || !otherGoal.value.trim())) {
    if (goalsError) goalsError.hidden = false;
    valid = false;
  } else {
    if (goalsError) goalsError.hidden = true;
  }

  // Pain point required
  const painPoint = form.querySelector('textarea[name="painPoint"]');
  const painError = document.getElementById("pain-error");
  if (!painPoint || !painPoint.value.trim()) {
    if (painError) painError.hidden = false;
    valid = false;
  } else {
    if (painError) painError.hidden = true;
  }

  // Consent required
  const consentData = document.getElementById("f-consent-data");
  const consentError = document.getElementById("consent-error");
  if (!consentData || !consentData.checked) {
    if (consentError) consentError.hidden = false;
    valid = false;
  } else {
    if (consentError) consentError.hidden = true;
  }

  if (!valid) {
    // Scroll to first error
    const firstError = form.querySelector(".field-error:not([hidden])");
    if (firstError) firstError.scrollIntoView({ behavior: "smooth", block: "center" });
    track("onboarding_validation_failed");
  } else {
    track("onboarding_completed");
  }

  return valid;
}

// ─── Collect profile ──────────────────────────────────────────────────────────

function collectProfile(form) {
  const data = new FormData(form);

  return {
    name: data.get("name") || "",
    email: data.get("email") || "",
    goals: data.getAll("goals"),
    devices: data.getAll("devices"),
    services: data.getAll("services"),
    painPoint: data.get("painPoint") || "",
    frustration: data.get("frustration") || "",
    deviceModel: data.get("deviceModel") || "",
    otherGoal: data.get("otherGoal") || "",
    otherService: data.get("otherService") || "",
    noIntegrate: data.get("noIntegrate") || "",
    technicalConfidence: parseInt(data.get("technicalConfidence") || "3", 10),
    manualLogging: parseInt(data.get("manualLogging") || "3", 10),
    automationDesire: parseInt(data.get("automationDesire") || "3", 10),
    newAppsWillingness: parseInt(data.get("newAppsWillingness") || "3", 10),
    payWillingness: parseInt(data.get("payWillingness") || "3", 10),
    privacyPreference: data.get("privacyPreference") || "neutral"
  };
}

// ─── Result rendering ─────────────────────────────────────────────────────────

function renderResult(rec, profile, participantId) {
  const el = document.getElementById("result-content");
  if (!el) return;

  const evidenceClass =
    rec.evidenceLevel === "founder-tested" ? "evidence-founder-tested" : "evidence-experimental";
  const evidenceLabel =
    rec.evidenceLevel === "founder-tested" ? "🏷 Founder-tested" : "🧪 Experimental";

  const confidenceClass = "confidence-" + (rec.confidence || "low");
  const confidenceLabel =
    rec.confidence === "high" ? "Hoch" : rec.confidence === "medium" ? "Mittel" : "Niedrig";

  const primaryName = profile.name ? esc(profile.name) : "dir";

  el.innerHTML = /* html */ `
<div class="result-wrapper">
  <div class="result-header">
    <div class="pilot-badge">DEINE ARCHITEKTUR · ${esc(participantId)}</div>
    <h1>Deine persönliche KI-Architektur</h1>
    <p class="result-profile-summary">${esc(rec.profileSummary || "")}</p>
  </div>

  <div class="result-section">
    <h2>Dein Ziel</h2>
    <ul>
      ${(rec.primaryGoals || []).map((g) => `<li>${esc(g)}</li>`).join("")}
    </ul>
  </div>

  <div class="result-section">
    <h2>Deine empfohlene Architektur</h2>
    <p>${esc(rec.architectureSummary || "")}</p>
    ${renderDataFlow(rec.dataFlow || [])}
  </div>

  ${
    (rec.requiredComponents || []).length > 0
      ? `<div class="result-section">
    <h2>Was du bereits hast / benötigst</h2>
    <ul class="component-list">
      ${renderComponents(rec.requiredComponents)}
    </ul>
  </div>`
      : ""
  }

  ${
    (rec.optionalComponents || []).length > 0
      ? `<div class="result-section">
    <h2>Optionale Erweiterungen</h2>
    <ul class="component-list">
      ${renderComponents(rec.optionalComponents)}
    </ul>
  </div>`
      : ""
  }

  ${
    (rec.excludedComponents || []).length > 0
      ? `<div class="result-section">
    <h2>Bewusst nicht empfohlen</h2>
    <ul class="excluded-list">
      ${(rec.excludedComponents || [])
        .map(
          (c) => `<li class="excluded-item">
        <span class="excluded-name">✗ ${esc(c.name)}</span>
        <span class="excluded-reason">${esc(c.reason)}</span>
      </li>`
        )
        .join("")}
    </ul>
  </div>`
      : ""
  }

  <div class="result-section">
    <h2>Setup</h2>
    <ol class="setup-steps">
      ${(rec.setupSteps || [])
        .map(
          (s) => `<li class="setup-step">
        <span class="setup-step-num">${s.order}</span>
        <div>
          <div class="setup-step-text">${esc(s.action)}</div>
          ${s.estimatedMinutes ? `<div class="setup-step-time">ca. ${s.estimatedMinutes} Min.</div>` : ""}
        </div>
      </li>`
        )
        .join("")}
    </ol>
  </div>

  <div class="result-section">
    <h2>Aufwand &amp; Kosten</h2>
    <div class="effort-grid">
      <div class="effort-item">
        <span class="effort-label">Ersteinrichtung</span>
        <span class="effort-value">${esc(rec.estimatedSetupMinutes ? rec.estimatedSetupMinutes + " Min." : "—")}</span>
      </div>
      <div class="effort-item">
        <span class="effort-label">Laufender Aufwand</span>
        <span class="effort-value">${esc(rec.estimatedOngoingEffort || "—")}</span>
      </div>
      <div class="effort-item">
        <span class="effort-label">Kosten/Monat</span>
        <span class="effort-value">${esc(rec.estimatedMonthlyCost || "—")}</span>
      </div>
    </div>
  </div>

  ${
    (rec.expectedBenefits || []).length > 0
      ? `<div class="result-section">
    <h2>Was du davon hast</h2>
    <ul>
      ${(rec.expectedBenefits || []).map((b) => `<li>${esc(b)}</li>`).join("")}
    </ul>
  </div>`
      : ""
  }

  <div class="result-section">
    <h2>Evidence Level</h2>
    <div class="evidence-badge ${evidenceClass}">${evidenceLabel}</div>
    <p>${esc(rec.evidenceExplanation || "")}</p>
  </div>

  <div class="result-section">
    <h2>Confidence</h2>
    <div class="confidence-badge ${confidenceClass}">${confidenceLabel}</div>
    <p>${esc(rec.confidenceExplanation || "")}</p>
  </div>

  ${
    (rec.limitations || []).length > 0
      ? `<div class="result-section">
    <h2>Grenzen &amp; Einschränkungen</h2>
    <ul>
      ${(rec.limitations || []).map((l) => `<li>${esc(l)}</li>`).join("")}
    </ul>
  </div>`
      : ""
  }

  ${
    (rec.unresolvedQuestions || []).length > 0
      ? `<div class="result-section">
    <h2>Offene Fragen</h2>
    <ul>
      ${(rec.unresolvedQuestions || []).map((q) => `<li>${esc(q)}</li>`).join("")}
    </ul>
  </div>`
      : ""
  }

  <div class="result-section" style="background:var(--panel-strong)">
    <h2>Über diese Empfehlung</h2>
    <p style="font-size:0.84rem;color:var(--muted)">
      Diese Empfehlung wurde automatisiert mit KI erstellt. Sie kann Fehler enthalten.
      Produkte und Integrationen können sich ändern. Das Evidence-Level zeigt dir explizit
      den Stand der Belege an.<br><br>
      Modell: ${esc(rec.modelId || "—")} · Prompt: ${esc(rec.promptVersion || "—")} ·
      Registry: ${esc(rec.registryVersion || "—")} · ID: ${esc(rec.recommendationId || "—")}
    </p>
  </div>

  <div class="result-actions">
    <button class="button button-primary" id="btn-print-result">Als PDF speichern</button>
    <a href="/" class="button button-secondary">Zurück zur Startseite</a>
  </div>
</div>
  `.trim();

  const btnPrint = document.getElementById("btn-print-result");
  if (btnPrint) {
    btnPrint.addEventListener("click", function () {
      window.print();
    });
  }
}

function renderComponents(components) {
  return components
    .map(
      (c) => `<li class="component-item">
      <div class="component-item-name">
        ${esc(c.name)}
        <span class="${c.existingOrNew === "existing" ? "component-item-existing" : "component-item-new"}">
          ${c.existingOrNew === "existing" ? "✓ Vorhanden" : "+ Neu"}
        </span>
      </div>
      <div class="component-item-purpose">${esc(c.purpose)}</div>
      <div class="component-item-reason">${esc(c.reason)}</div>
    </li>`
    )
    .join("");
}

function renderDataFlow(steps) {
  if (!steps || steps.length === 0) return "";
  // Each step may contain " → " already from the LLM; we render them as pills
  const parts = steps.flatMap((s, i) => {
    const items = s.split("→").map((p) => p.trim()).filter(Boolean);
    const result = [];
    items.forEach((item, j) => {
      result.push(`<li class="dataflow-step">${esc(item)}</li>`);
      if (j < items.length - 1) {
        result.push(`<li class="dataflow-arrow" aria-hidden="true">→</li>`);
      }
    });
    if (i < steps.length - 1) {
      result.push(`<li class="dataflow-arrow" aria-hidden="true">→</li>`);
    }
    return result;
  });

  return `<ul class="dataflow" aria-label="Datenfluss">${parts.join("")}</ul>`;
}
