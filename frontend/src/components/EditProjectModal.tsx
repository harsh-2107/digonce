import { useState, useEffect } from "react";
import type { Project } from "@/context/ProjectsContext";
import "@/App.css";

type Props = {
  project: Project | null;
  onClose: () => void;
  onSave: (id: string, values: Record<string, unknown>) => Promise<void>;
};
export function EditProjectModal({ project, onClose, onSave }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    if (project) {
      setForm({
        project_name: project.project_name,
        description: project.description ?? "",
        project_type: project.project_type,
        urgency: project.urgency,
        start_date: project.start_date,
        end_date: project.end_date,
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
    try {
      await onSave(project.project_id, {
        ...form,
        excavation_width_m: Number(form.excavation_width_m),
        excavation_depth_m: form.excavation_depth_m
          ? Number(form.excavation_depth_m)
          : null,
        contractor_name: form.contractor_name || null,
      });
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
            Start date
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => set("start_date", e.target.value)}
              required
            />
          </label>
          <label>
            End date
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => set("end_date", e.target.value)}
              required
            />
          </label>
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
