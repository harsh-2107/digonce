import type { Project } from "@/context/ProjectsContext";
import { MapContainer, Polyline, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "@/App.css";

type Props = { project: Project | null; onClose: () => void; onEdit?: (project: Project) => void; onDelete?: (project: Project) => void };

const value = (input: number | null | undefined, suffix = "") =>
  input === null || input === undefined ? "Not provided" : `${input.toLocaleString()}${suffix}`;

export function ProjectDetailsModal({ project, onClose, onEdit, onDelete }: Props) {
  if (!project) return null;
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <section className="modal-content project-details-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={`${project.project_name} details`}>
        <div className="modal-heading"><div><p className="eyebrow">PROJECT DETAILS</p><h2>{project.project_name}</h2></div><button className="text-button" onClick={onClose}>Close</button></div>
        <div className="detail-grid">
          <div><small>Project ID</small><strong>{project.project_id.slice(0, 8).toUpperCase()}</strong></div>
          <div><small>Department</small><strong>{project.department?.replace("-", " ") ?? "Not assigned"}</strong></div>
          <div><small>Status</small><strong>{project.status}</strong></div>
          <div><small>Project type</small><strong>{project.project_type}</strong></div>
          <div><small>Urgency</small><strong>{project.urgency}</strong></div>
          <div><small>Schedule</small><strong>{project.start_date} → {project.end_date}</strong></div>
          <div><small>Corridor length</small><strong>{value(project.corridor_length_m, " m")}</strong></div>
          <div><small>Excavation</small><strong>{value(project.excavation_width_m, " m wide")} · {value(project.excavation_depth_m, " m deep")}</strong></div>
          <div><small>Estimated cost</small><strong>₹{value(project.estimated_cost)}</strong></div>
          <div><small>Excavation / restoration</small><strong>₹{value(project.excavation_cost)} / ₹{value(project.restoration_cost)}</strong></div>
          <div><small>Risk</small><strong>{project.risk_level}</strong></div>
          <div><small>Coordination opportunity</small><strong>{project.coordination_opportunity}</strong></div>
        </div>
        {project.description && <div className="detail-description"><small>Work description</small><p>{project.description}</p></div>}
        {project.geometry?.coordinates?.length > 1 && <div className="project-corridor-map"><small>Marked work corridor</small><MapContainer center={[project.geometry.coordinates[0][1], project.geometry.coordinates[0][0]]} zoom={16} scrollWheelZoom={false}><TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/><Polyline positions={project.geometry.coordinates.map(([lng,lat]) => [lat,lng])} pathOptions={{ color: "#087e8b", weight: 7 }}/></MapContainer></div>}
        {(onEdit || onDelete) && <div className="modal-actions">{onEdit && <button className="secondary-button" onClick={() => onEdit(project)}>Update project</button>}{onDelete && <button className="danger-button" onClick={() => onDelete(project)}>Delete project</button>}</div>}
      </section>
    </div>
  );
}
