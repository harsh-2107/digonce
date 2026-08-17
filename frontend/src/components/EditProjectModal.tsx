import { useState, useEffect } from "react";
import type { Project } from "@/context/ProjectsContext";
import "@/App.css";

type Props = {
  project: Project | null;
  onClose: () => void;
  onSave: (id: string, values: Record<string, unknown>) => Promise<void>;
};

const PREDEFINED_DURATIONS = [
  "1 - 2 days",
  "3 - 5 days",
  "5 - 7 days",
  "10 - 12 days",
  "1 - 2 weeks",
  "2 - 3 weeks",
  "1 - 2 months",
  "2 - 3 months",
];

function parseDurationState(durationStr: string | null | undefined) {
  if (!durationStr || PREDEFINED_DURATIONS.includes(durationStr)) {
    return {
      selectedDuration: durationStr || "10 - 12 days",
      customVal: "",
      customUnit: "Days",
    };
  }
  const match = durationStr.match(/\d+/);
  const val = match ? match[0] : "";
  const lower = durationStr.toLowerCase();
  let unit = "Days";
  if (lower.includes("week")) unit = "Weeks";
  else if (lower.includes("month")) unit = "Months";
  return { selectedDuration: "Custom", customVal: val, customUnit: unit };
}

const CREATOR_STATUS_OPTIONS = [
  "In Review",
  "Approved",
  "In Progress",
  "Restoration",
  "Verification",
  "Completed",
];

export function EditProjectModal({ project, onClose, onSave }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const [customVal, setCustomVal] = useState("");
  const [customUnit, setCustomUnit] = useState("Days");

  const isNocComplete = project
    ? Boolean(project.noc_summary?.all_cleared) || ["Approved", "Scheduled", "In Progress", "Ongoing", "Restoration", "Verification", "Completed"].includes(project.status)
    : false;

  useEffect(() => {
    if (project) {
      const { selectedDuration, customVal: initVal, customUnit: initUnit } =
        parseDurationState(project.duration);
      setCustomVal(initVal);
      setCustomUnit(initUnit);

      const nocDone = Boolean(project.noc_summary?.all_cleared) || ["Approved", "Scheduled", "In Progress", "Ongoing", "Restoration", "Verification", "Completed"].includes(project.status);
      const initialStatus = !nocDone ? "In Review" : project.status;

      setForm({
        project_name: project.project_name,
        description: project.description ?? "",
        project_type: project.project_type,
        urgency: project.urgency,
        status: initialStatus,
        start_date: project.start_date,
        duration: selectedDuration,
        excavation_width_m: String(project.excavation_width_m),
        excavation_depth_m: project.excavation_depth_m === null ? "" : String(project.excavation_depth_m),
        contractor_name: project.contractor_name ?? "",
      });
      setError(null);
    } else {
      setForm(null);
    }
  }, [project]);
  if (!project || !form) return null;
  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    if (form.status === "Approved" && !isNocComplete) {
      setSaving(false);
      return setError("Cannot manually set project status to Approved before all required department NOCs are given.");
    }
    if (form.status !== "In Review" && !isNocComplete) {
      setSaving(false);
      return setError("Project status remains In Review until all department NOCs are cleared and project is approved.");
    }
    let finalDuration = form.duration;
    if (form.duration === "Custom") {
      const num = Number(customVal);
      if (!customVal || isNaN(num) || num <= 0) {
        setSaving(false);
        return setError("Enter a valid custom duration greater than 0.");
      }
      finalDuration = `${customVal.trim()} ${customUnit.toLowerCase()}`;
    }
    try {
      const payload: Record<string, unknown> = {
        ...form,
        duration: finalDuration,
        excavation_width_m: Number(form.excavation_width_m),
        excavation_depth_m: form.excavation_depth_m
          ? Number(form.excavation_depth_m)
          : null,
        contractor_name: form.contractor_name || null,
      };
      if (form.status === project.status) {
        delete payload.status;
      }
      await onSave(project.project_id, payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update project");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <form
        className="modal-content edit-project-modal"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">UPDATE PROJECT</p>
            <h2>{project.project_name}</h2>
          </div>
          <button type="button" className="text-button" onClick={onClose}>
            Close
          </button>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="edit-grid">
          <label>
            Project status
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
              disabled={!isNocComplete}
            >
              {CREATOR_STATUS_OPTIONS.map((x) => {
                const disabled = x !== "In Review" && !isNocComplete;
                return (
                  <option key={x} value={x} disabled={disabled}>
                    {x}{disabled ? " (Awaiting NOCs)" : ""}
                  </option>
                );
              })}
            </select>
          </label>
          <label>
            Project name
            <input
              value={form.project_name}
              onChange={(e) => set("project_name", e.target.value)}
              required
            />
          </label>
          <label>
            Project type
            <select
              value={form.project_type}
              onChange={(e) => set("project_type", e.target.value)}
            >
              {[
                "New Installation",
                "Repair",
                "Replacement",
                "Maintenance",
                "Expansion / Extension",
                "Rehabilitation",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Urgency
            <select
              value={form.urgency}
              onChange={(e) => set("urgency", e.target.value)}
            >
              {["Planned", "Urgent", "Emergency"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Contractor
            <input
              value={form.contractor_name}
              onChange={(e) => set("contractor_name", e.target.value)}
            />
          </label>
          <label>
            Tentative start date
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => set("start_date", e.target.value)}
              required
            />
          </label>
          <label>
            Duration
            <select
              value={form.duration}
              onChange={(e) => set("duration", e.target.value)}
            >
              <option value="1 - 2 days">1 - 2 days</option>
              <option value="3 - 5 days">3 - 5 days</option>
              <option value="5 - 7 days">5 - 7 days</option>
              <option value="10 - 12 days">10 - 12 days</option>
              <option value="1 - 2 weeks">1 - 2 weeks</option>
              <option value="2 - 3 weeks">2 - 3 weeks</option>
              <option value="1 - 2 months">1 - 2 months</option>
              <option value="2 - 3 months">2 - 3 months</option>
              <option value="Custom">Custom</option>
            </select>
          </label>
          {form.duration === "Custom" && (
            <>
              <label>
                Custom duration
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 15"
                  value={customVal}
                  onChange={(e) => setCustomVal(e.target.value)}
                  required
                />
              </label>
              <label>
                Unit
                <select
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value)}
                >
                  <option value="Days">Days</option>
                  <option value="Weeks">Weeks</option>
                  <option value="Months">Months</option>
                </select>
              </label>
            </>
          )}
          <label>
            Excavation width (m)
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={form.excavation_width_m}
              onChange={(e) => set("excavation_width_m", e.target.value)}
              required
            />
          </label>
          <label>
            Excavation depth (m)
            <input
              type="number"
              min="0"
              step="0.1"
              value={form.excavation_depth_m}
              onChange={(e) => set("excavation_depth_m", e.target.value)}
            />
          </label>
          <label className="wide">
            Description
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              required
            />
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
