// Mirrors the supported creation values in the API.  Both creation and filters
// import this module so a label/value cannot drift within the UI.
export const PROJECT_TYPES = [
  "New Installation", "Repair", "Replacement", "Maintenance",
  "Expansion / Extension", "Rehabilitation",
] as const;

export const PROJECT_PRIORITIES = ["Planned", "Urgent", "Emergency"] as const;

export const PROJECT_STATUSES = [
  "Draft", "Submitted", "In Review", "Under Review", "Coordination Required", "Approved",
  "Scheduled", "In Progress", "Restoration", "Verification", "Completed",
  "DISCARDED",
] as const;
