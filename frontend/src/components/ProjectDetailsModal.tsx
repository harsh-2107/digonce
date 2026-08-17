import { useEffect, useState } from "react";
import { API_BASE, authHeaders, useAuth } from "@/context/AuthContext";
import type { Project } from "@/context/ProjectsContext";
import { MapContainer, Polyline, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "@/App.css";

type Props = { project: Project | null; onClose: () => void; onEdit?: (project: Project) => void; onDelete?: (project: Project) => void; onDiscard?: (project: Project) => void };

type CoordinationRequest = {
  id: string;
  group_code: string;
  status: string;
  proposal_status: string | null;
  requesting_department: string | null;
  is_incoming: boolean;
};

const value = (input: number | null | undefined, suffix = "") =>
  input === null || input === undefined ? "Not provided" : `${input.toLocaleString()}${suffix}`;

export function ProjectDetailsModal({ project, onClose, onEdit, onDelete, onDiscard }: Props) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<CoordinationRequest[]>([]);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const projectId = project?.project_id;

  useEffect(() => {
    if (!projectId) {
      setRequests([]);
      setRequestError(null);
      return;
    }
    let cancelled = false;
    setRequestError(null);
    fetch(`${API_BASE}/projects/${projectId}/coordination`, { headers: authHeaders() })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load coordination requests");
        return response.json();
      })
      .then((data) => {
        if (!cancelled) setRequests(data.coordination_requests ?? []);
      })
      .catch((error) => {
        if (!cancelled) setRequestError(error instanceof Error ? error.message : "Unable to load coordination requests");
      });
    return () => { cancelled = true; };
  }, [projectId]);

  if (!project) return null;
  const currentProject = project;
  const isDiscarded = project.status === "DISCARDED";
  const ownsProject = project.department === user?.department;
  const ownRequest = requests.find((request) => request.requesting_department === user?.department);

  async function requestCoordination() {
    setRequesting(true);
    setRequestError(null);
    try {
      const headers = { "Content-Type": "application/json", ...authHeaders() };
      const groupResponse = await fetch(`${API_BASE}/coordination/groups`, {
        method: "POST", headers, body: JSON.stringify({ project_ids: [currentProject.project_id] }),
      });
      const groupPayload = await groupResponse.json().catch(() => ({}));
      if (!groupResponse.ok) throw new Error(groupPayload.detail ?? "Unable to open coordination request");
      const proposalResponse = await fetch(`${API_BASE}/coordination/groups/${groupPayload.group.id}/proposals`, {
        method: "POST", headers,
        body: JSON.stringify({ proposed_start: currentProject.start_date, proposed_end: currentProject.end_date, message: `Coordination requested for ${currentProject.project_name}.` }),
      });
      const proposalPayload = await proposalResponse.json().catch(() => ({}));
      if (!proposalResponse.ok) throw new Error(proposalPayload.detail ?? "Unable to send coordination request");
      setRequests((current) => [...current, {
        id: groupPayload.group.id,
        group_code: groupPayload.group.group_code ?? "Coordination request",
        status: "PENDING",
        proposal_status: proposalPayload.status ?? "PENDING",
        requesting_department: user?.department ?? null,
        is_incoming: false,
      }]);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Unable to send coordination request");
    } finally {
      setRequesting(false);
    }
  }

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
          <div><small>Schedule</small><strong>Tentative Start: {project.start_date}{project.duration ? ` · Duration: ${project.duration}` : project.end_date ? ` → ${project.end_date}` : ""}</strong></div>
          <div><small>Corridor length</small><strong>{value(project.corridor_length_m, " m")}</strong></div>
          <div><small>Excavation</small><strong>{value(project.excavation_width_m, " m wide")} · {value(project.excavation_depth_m, " m deep")}</strong></div>
          <div><small>Estimated cost</small><strong>₹{value(project.estimated_cost)}</strong></div>
          {project.contractor_name && <div><small>Contractor</small><strong>{project.contractor_name}</strong></div>}
          {(project.excavation_cost !== null || project.restoration_cost !== null) && <div><small>Excavation / restoration</small><strong>₹{value(project.excavation_cost)} / ₹{value(project.restoration_cost)}</strong></div>}
          <div><small>Risk</small><strong>{project.risk_level}</strong></div>
        </div>
        {project.description && <div className="detail-description"><small>Work description</small><p>{project.description}</p></div>}
        {project.geometry?.coordinates?.length > 1 && <div className="project-corridor-map"><small>Marked work corridor</small><MapContainer center={[project.geometry.coordinates[0][1], project.geometry.coordinates[0][0]]} zoom={16} scrollWheelZoom={false}><TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/><Polyline positions={project.geometry.coordinates.map(([lng,lat]) => [lat,lng])} pathOptions={{ color: "#087e8b", weight: 7 }}/></MapContainer></div>}
        {!isDiscarded && !ownsProject && <div className="request-coordination-panel">{ownRequest ? <><strong>Your coordination request</strong><span className="status-pill">{(ownRequest.proposal_status ?? ownRequest.status).replaceAll("_", " ")}</span></> : <><div><strong>Need to coordinate?</strong><p>Send a request to the owning department at any time.</p></div><button className="primary-button" disabled={requesting} onClick={() => void requestCoordination()}>{requesting ? "Requesting…" : "Request Coordination"}</button></>}</div>}
        {ownsProject && requests.filter((request) => request.is_incoming).length > 0 && <div className="detail-description"><small>Incoming coordination requests</small>{requests.filter((request) => request.is_incoming).map((request) => <p key={request.id}>{request.requesting_department?.replaceAll("-", " ") ?? "Another department"} · {request.group_code} · {(request.proposal_status ?? request.status).replaceAll("_", " ")}</p>)}</div>}
        {project.noc_summary && (
          <div className="detail-description">
            <small>Department NOC / Approval clearance</small>
            <p>
              {project.noc_summary.all_cleared ? (
                <span style={{ color: "var(--color-success, #22c55e)", fontWeight: 600 }}>All required department NOCs cleared ✅</span>
              ) : (
                <span>NOC status: {project.noc_summary.given} / {project.noc_summary.total} departments cleared</span>
              )}
            </p>
          </div>
        )}
        {requestError && <p className="form-error">{requestError}</p>}
        <div className="modal-actions">
          {!isDiscarded && onEdit && <button className="secondary-button" onClick={() => onEdit(project)}>Update project</button>}
          {!isDiscarded && onDiscard && <button className="secondary-button" onClick={() => onDiscard(project)}>Discard project</button>}
          {!isDiscarded && onDelete && <button className="danger-button" onClick={() => onDelete(project)}>Delete permanently</button>}
        </div>
      </section>
    </div>
  );
}
