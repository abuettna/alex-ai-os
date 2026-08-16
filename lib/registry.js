/**
 * Component Registry V0.1
 * Only components we reasonably understand for the first pilot.
 * Do NOT add components without reviewing their capabilities.
 */

const REGISTRY_VERSION = "2025-08-16";

/** @type {import('./types').ComponentDefinition[]} */
const components = [
  {
    id: "chatgpt",
    name: "ChatGPT",
    category: "AI Assistant",
    supportedPlatforms: ["iOS", "Android", "Web", "macOS"],
    capabilities: [
      "conversational AI",
      "context-aware Q&A",
      "structured output via Custom GPT",
      "document/file analysis",
      "daily check-in workflows",
      "decision support"
    ],
    knownIntegrations: ["garmin-connect", "airtable", "apple-health", "iphone-shortcuts"],
    costNotes: "Free tier available; GPT-4 requires Plus (~$20/mo)",
    setupComplexity: "low",
    strengths: [
      "Low barrier to start",
      "Flexible for many use cases",
      "Custom GPT allows persistent context",
      "Available on iPhone"
    ],
    limitations: [
      "Context window limits large datasets",
      "No automatic data ingestion — user must provide context",
      "Quality depends on context quality"
    ],
    founderExperience: "workflow-tested",
    lastReviewed: REGISTRY_VERSION
  },
  {
    id: "garmin-connect",
    name: "Garmin Connect",
    category: "Health & Fitness Platform",
    supportedPlatforms: ["iOS", "Android", "Web"],
    capabilities: [
      "activity tracking",
      "HRV / Body Battery",
      "sleep analysis",
      "workout history",
      "GPS route data",
      "health snapshots"
    ],
    knownIntegrations: ["apple-health", "strava", "lifttrack"],
    costNotes: "Free with Garmin device",
    setupComplexity: "low",
    strengths: [
      "Automatic data from Garmin wearables",
      "Rich recovery metrics (Body Battery, HRV status)",
      "Exports to other services"
    ],
    limitations: [
      "Requires Garmin device",
      "API access for automation is non-trivial",
      "No direct ChatGPT integration — data must be manually copied or exported"
    ],
    founderExperience: "workflow-tested",
    lastReviewed: REGISTRY_VERSION
  },
  {
    id: "apple-health",
    name: "Apple Health",
    category: "Health Platform",
    supportedPlatforms: ["iOS"],
    capabilities: [
      "central health data aggregation",
      "steps / activity",
      "heart rate",
      "sleep",
      "nutrition (if logged)",
      "health export"
    ],
    knownIntegrations: ["garmin-connect", "strava", "lifttrack"],
    costNotes: "Free (iOS only)",
    setupComplexity: "low",
    strengths: [
      "Aggregates data from many iOS apps",
      "Privacy-focused (on-device)",
      "Useful as passive data store"
    ],
    limitations: [
      "iOS only",
      "Data is siloed — accessing it programmatically requires shortcuts or export",
      "Not useful without integrating apps"
    ],
    founderExperience: "component-tested",
    lastReviewed: REGISTRY_VERSION
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    category: "Calendar & Scheduling",
    supportedPlatforms: ["iOS", "Android", "Web"],
    capabilities: [
      "event scheduling",
      "reminders",
      "shared calendars",
      "ICS export"
    ],
    knownIntegrations: ["iphone-shortcuts", "airtable", "chatgpt"],
    costNotes: "Free",
    setupComplexity: "low",
    strengths: [
      "Cross-platform",
      "Easy to share/export",
      "Many integrations available"
    ],
    limitations: [
      "No native AI integration",
      "Requires manual context copy to ChatGPT for AI use"
    ],
    founderExperience: "component-tested",
    lastReviewed: REGISTRY_VERSION
  },
  {
    id: "apple-calendar",
    name: "Apple Calendar",
    category: "Calendar & Scheduling",
    supportedPlatforms: ["iOS", "macOS"],
    capabilities: [
      "event scheduling",
      "reminders",
      "ICS export",
      "Siri integration"
    ],
    knownIntegrations: ["iphone-shortcuts"],
    costNotes: "Free (Apple ecosystem)",
    setupComplexity: "low",
    strengths: ["Tightly integrated in Apple ecosystem", "Offline capable"],
    limitations: [
      "Limited cross-platform support",
      "Fewer third-party integrations vs Google Calendar"
    ],
    founderExperience: "component-tested",
    lastReviewed: REGISTRY_VERSION
  },
  {
    id: "airtable",
    name: "Airtable",
    category: "Structured Data & Logging",
    supportedPlatforms: ["iOS", "Android", "Web"],
    capabilities: [
      "structured manual logging",
      "custom fields and views",
      "forms for data entry",
      "automations",
      "API access",
      "relational data"
    ],
    knownIntegrations: ["iphone-shortcuts", "chatgpt"],
    costNotes: "Free tier available (1000 rows/base); paid for automations",
    setupComplexity: "medium",
    strengths: [
      "Flexible schema for personal data",
      "Good mobile app for quick logging",
      "API enables integration with ChatGPT context"
    ],
    limitations: [
      "Requires manual data entry discipline",
      "Some learning curve for setup",
      "Row limits on free tier"
    ],
    founderExperience: "workflow-tested",
    lastReviewed: REGISTRY_VERSION
  },
  {
    id: "lifttrack",
    name: "LiftTrack",
    category: "Strength Training Log",
    supportedPlatforms: ["iOS"],
    capabilities: [
      "strength training logging",
      "workout history",
      "progress tracking",
      "Garmin Connect export"
    ],
    knownIntegrations: ["garmin-connect", "apple-health"],
    costNotes: "Free tier; Pro subscription available",
    setupComplexity: "low",
    strengths: [
      "Focused strength training log",
      "Integrates with Garmin and Apple Health",
      "Simple and reliable"
    ],
    limitations: ["iOS only", "Limited AI integration"],
    founderExperience: "workflow-tested",
    lastReviewed: REGISTRY_VERSION
  },
  {
    id: "freddy",
    name: "freddy",
    category: "AI Health Context Layer",
    supportedPlatforms: ["iOS (Shortcut/webhook)"],
    capabilities: [
      "structured health context aggregation",
      "daily morning briefing",
      "recovery-aware training recommendation",
      "integration with Garmin, Airtable, ChatGPT"
    ],
    knownIntegrations: ["garmin-connect", "airtable", "chatgpt"],
    costNotes: "Founder-built; not publicly available as product",
    setupComplexity: "high",
    strengths: [
      "Highly personalized",
      "Evidence-based founder-tested workflow",
      "Combines multiple data sources into one context"
    ],
    limitations: [
      "Not a published product — requires founder assistance to set up",
      "Setup complexity is high",
      "Only relevant for users with Garmin + Airtable + specific workflow"
    ],
    founderExperience: "workflow-tested",
    lastReviewed: REGISTRY_VERSION
  },
  {
    id: "strava",
    name: "Strava",
    category: "Endurance Training Log",
    supportedPlatforms: ["iOS", "Android", "Web"],
    capabilities: [
      "activity logging (run, bike, swim)",
      "route analysis",
      "social features",
      "fitness trends",
      "Garmin Connect sync"
    ],
    knownIntegrations: ["garmin-connect", "apple-health"],
    costNotes: "Free tier; Strava Summit ~$6/mo for analytics",
    setupComplexity: "low",
    strengths: ["Automatic sync from Garmin", "Good activity history"],
    limitations: [
      "No AI integration",
      "Not useful for strength training context",
      "Social features may not be needed"
    ],
    founderExperience: "component-tested",
    lastReviewed: REGISTRY_VERSION
  },
  {
    id: "iphone-shortcuts",
    name: "iPhone Shortcuts",
    category: "Automation",
    supportedPlatforms: ["iOS", "macOS"],
    capabilities: [
      "automated workflows",
      "API calls (webhooks, REST)",
      "data transformation",
      "daily automations",
      "notifications"
    ],
    knownIntegrations: ["airtable", "chatgpt", "apple-health", "apple-calendar"],
    costNotes: "Free (built into iOS)",
    setupComplexity: "medium",
    strengths: [
      "Powerful on-device automation",
      "Can connect many services without code",
      "Runs on iPhone"
    ],
    limitations: [
      "iOS/macOS only",
      "Requires setup per workflow",
      "Debugging can be difficult"
    ],
    founderExperience: "workflow-tested",
    lastReviewed: REGISTRY_VERSION
  }
];

module.exports = { components, REGISTRY_VERSION };
