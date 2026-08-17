import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { MapContainer, Polyline, TileLayer, useMap } from "react-leaflet";
import { latLngBounds } from "leaflet";
import { API_BASE, authHeaders, useAuth } from "@/context/AuthContext";
import type { Project } from "@/context/ProjectsContext";
import { TopNav } from "@/components/TopNav";
import { ProjectDetailsModal } from "@/components/ProjectDetailsModal";
import { EditProjectModal } from "@/components/EditProjectModal";
import { useProjects } from "@/context/ProjectsContext";
import "leaflet/dist/leaflet.css";
import "@/App.css";


type Coordination = {
  coordination_requests: { id: string; group_code: string; status: string; proposal_id: string | null; proposal_code: string | null; proposal_status: string | null; requesting_department: string | null; departments: string[]; is_incoming: boolean }[];
  projects: (Project & {
    analysis?: {
      coordination_score: { score: number; level: string };
      recommendation: string;
    };
  })[];
};

type NocDeptStatus = {
  department: string;
  status: "NOT_REQUIRED" | "NOC_GIVEN" | "PENDING" | "NOC_WITHDRAWN";
  given_by: string | null;
  given_at: string | null;
  withdrawn_at?: string | null;
  comment: string | null;
};

type NocStatus = {
  project_id: string;
  owner_department: string;
  given: number;
  total: number;
  all_cleared: boolean;
  departments: NocDeptStatus[];
};

type ObjectionCandidate = {
  project_id: string;
  project_name: string;
  department: string;
  project_type: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  corridor_length_m: number | null;
  distance_m: number;
  spatial_overlap_m: number;
  temporal_overlap_days: number;
  schedule_gap_days: number;
  compatibility?: string;
  coordination_eligible?: boolean;
  reasons?: string[];
};

/** Inner component: auto-fits the Leaflet map to the project corridor */
function ProjectMapFit({ coordinates }: { coordinates: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (!coordinates.length) return;
    const bounds = latLngBounds(coordinates.map(([lat, lng]) => [lat, lng]));
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
  }, [coordinates, map]);
  return null;
}

/** Objection modal — shown when a non-owner clicks Objection */
function ObjectionModal({
  candidates,
  selectedIds,
  onToggle,
  onContinue,
  onCancel,
  loading,
  error,
  comment,
  onCommentChange,
}: {
  candidates: ObjectionCandidate[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onContinue: () => void;
  onCancel: () => void;
  loading: boolean;
  error: string | null;
  comment: string;
  onCommentChange: (v: string) => void;
}) {
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Objection — Select projects for coordination"
    >
      <div className="modal-content" style={{ maxWidth: "560px", width: "100%" }}>
        <div className="modal-heading">
          <div>
            <p className="eyebrow">RAISE OBJECTION</p>
            <h2>Select Projects for Coordination</h2>
          </div>
          <button className="text-button" onClick={onCancel}>Close</button>
        </div>

        {candidates.length > 0 ? (
          <>
            <p className="page-intro" style={{ margin: "16px 0 14px" }}>
              The following projects from your department may overlap with this proposed excavation.
              Select any you want to coordinate together. Selection is optional — you can continue without selecting any.
            </p>
            <div className="project-list" style={{ marginBottom: "1rem" }}>
              {candidates.map((c) => (
                <label
                  key={c.project_id}
                  htmlFor={`obj-candidate-${c.project_id}`}
                  style={{
                    display: "flex",
                    gap: "12px",
                    alignItems: "flex-start",
                    padding: "0.875rem 1rem",
                    borderRadius: "8px",
                    border: `1.5px solid ${selectedIds.has(c.project_id) ? "#087e8b" : "#d7e0e7"}`,
                    background: selectedIds.has(c.project_id) ? "#f0f8f9" : "#f8fbfc",
                    cursor: "pointer",
                    transition: "border-color 0.15s, background 0.15s",
                    marginBottom: "0.5rem",
                  }}
                >
                  <input
                    id={`obj-candidate-${c.project_id}`}
                    type="checkbox"
                    checked={selectedIds.has(c.project_id)}
                    onChange={() => onToggle(c.project_id)}
                    style={{ marginTop: "3px", flexShrink: 0, accentColor: "#087e8b" }}
                  />
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: "14px", display: "block", color: "#20364a", marginBottom: "2px" }}>{c.project_name}</strong>
                    <span style={{ fontSize: "12px", color: "#718096" }}>
                      {c.start_date} – {c.end_date}
                      {c.project_type && ` · ${c.project_type}`}
                    </span>
                    <div style={{ fontSize: "12px", color: "#40576a", marginTop: "4px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                      {c.spatial_overlap_m > 0 && (
                        <span>✓ Shared corridor: <strong>{c.spatial_overlap_m.toFixed(0)} m</strong></span>
                      )}
                      {c.spatial_overlap_m === 0 && (
                        <span>✓ Distance: <strong>{c.distance_m.toFixed(0)} m</strong></span>
                      )}
                      {c.temporal_overlap_days > 0 && (
                        <span>✓ Schedule overlap: <strong>{c.temporal_overlap_days} day{c.temporal_overlap_days !== 1 ? "s" : ""}</strong></span>
                      )}
                      {c.temporal_overlap_days === 0 && c.schedule_gap_days <= 14 && (
                        <span>✓ Schedule gap: <strong>{c.schedule_gap_days} day{c.schedule_gap_days !== 1 ? "s" : ""}</strong></span>
                      )}
                      <span>✓ Compatible for coordinated execution</span>
                    </div>
                    <span
                      className="status-pill"
                      style={{ marginTop: "6px", display: "inline-block" }}
                    >
                      {c.status}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </>
        ) : (
          <p className="page-intro" style={{ margin: "16px 0 14px" }}>
            No projects from your department currently overlap with this excavation.
            You can still raise an objection — use the comment below to describe your concern.
          </p>
        )}

        <div style={{ margin: "1rem 0" }}>
          <label
            htmlFor="objection-comment"
            style={{ display: "block", fontSize: "12px", fontWeight: 650, marginBottom: "6px", color: "#496174" }}
          >
            Comment / Reason <span style={{ fontWeight: 400, color: "#718096" }}>(optional)</span>
          </label>
          <textarea
            id="objection-comment"
            placeholder="Describe your concern or coordination requirements…"
            value={comment}
            onChange={(e) => onCommentChange(e.target.value)}
            rows={3}
            style={{
              width: "100%",
              boxSizing: "border-box",
              resize: "vertical",
              font: '13px "Geist Variable", sans-serif',
              border: "1px solid #d7e0e7",
              borderRadius: "7px",
              padding: "9px 10px",
              background: "#fff",
            }}
          />
        </div>

        {candidates.length > 0 && (
          <p style={{ fontSize: "12px", color: "#718096", margin: "0 0 1rem" }}>
            {selectedIds.size === 0
              ? "No projects selected — objection will proceed without project coordination."
              : `${selectedIds.size} project${selectedIds.size !== 1 ? "s" : ""} selected for coordination.`}
          </p>
        )}

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button className="secondary-button" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button
            id="objection-continue-btn"
            className="primary-button"
            onClick={onContinue}
            disabled={loading}
          >
            {loading ? "Submitting…" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProjectDetailsPage() {

  const { projectId } = useParams();
  const navigate = useNavigate();
  const { updateProject, deleteProject, discardProject } = useProjects();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [coordination, setCoordination] = useState<Coordination | null>(null);
  const [internalGroups, setInternalGroups] = useState<any[]>([]);
  const [nocStatus, setNocStatus] = useState<NocStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailsModalProject, setDetailsModalProject] =
    useState<Project | null>(null);
  const [proposalError, setProposalError] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [nocLoading, setNocLoading] = useState(false);
  const [nocError, setNocError] = useState<string | null>(null);
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  // --- Objection state ---
  const [objectionCandidates, setObjectionCandidates] = useState<ObjectionCandidate[] | null>(null);
  const [showObjectionModal, setShowObjectionModal] = useState(false);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());
  const [objectionComment, setObjectionComment] = useState("");
  const [objectionLoading, setObjectionLoading] = useState(false);
  const [objectionFetchLoading, setObjectionFetchLoading] = useState(false);
  const [objectionError, setObjectionError] = useState<string | null>(null);

  function loadNoc() {
    const token = sessionStorage.getItem("dig-once-token");
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`${API_BASE}/projects/${projectId}/noc`, { headers })
      .then((r) => r.json())
      .then((data) => setNocStatus(data))
      .catch(() => { });
  }

  useEffect(() => {
    const token = sessionStorage.getItem("dig-once-token");
    const headers: Record<string, string> = token
      ? { Authorization: `Bearer ${token}` }
      : {};
    Promise.all([
      fetch(`${API_BASE}/projects/${projectId}`, { headers }),
      fetch(
        `${API_BASE}/projects/${projectId}/coordination?include_explanation=true`,
        { headers },
      ),
      fetch(
        `${API_BASE}/projects/${projectId}/internal-grouping-opportunities`,
        { headers },
      ),
      fetch(`${API_BASE}/projects/${projectId}/noc`, { headers }),
    ])
      .then(
        async ([projectResponse, coordinationResponse, internalResponse, nocResponse]) => {
          if (projectResponse.status === 404) {
            throw new Error("Project not found");
          }
          if (
            !projectResponse.ok ||
            !coordinationResponse.ok ||
            !internalResponse.ok
          )
            throw new Error("Unable to load project analysis");
          setProject(await projectResponse.json());
          setCoordination(await coordinationResponse.json());
          setInternalGroups((await internalResponse.json()).opportunities);
          if (nocResponse.ok) setNocStatus(await nocResponse.json());
        },
      )
      .catch((error) => setError(error.message));
  }, [projectId]);



  async function giveNoc() {
    if (!project) return;
    setNocError(null);
    setNocLoading(true);
    try {
      const response = await fetch(`${API_BASE}/projects/${project.project_id}/noc`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({}),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNocError(typeof payload.detail === "string" ? payload.detail : "Unable to give No Objection");
      } else {
        loadNoc();
        fetch(`${API_BASE}/projects/${project.project_id}`, { headers: authHeaders() })
          .then((r) => r.ok && r.json())
          .then((p) => p && setProject(p))
          .catch(() => { });
      }
    } catch (err) {
      setNocError(err instanceof Error ? err.message : "Unable to give No Objection");
    } finally {
      setNocLoading(false);
    }
  }

  async function withdrawNoc() {
    if (!project) return;
    if (!window.confirm("Are you sure you want to withdraw your No Objection? The project owner will be notified and approval will be blocked.")) return;
    setNocError(null);
    setWithdrawLoading(true);
    try {
      const response = await fetch(`${API_BASE}/projects/${project.project_id}/noc`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNocError(typeof payload.detail === "string" ? payload.detail : "Unable to withdraw No Objection");
      } else {
        loadNoc();
      }
    } catch (err) {
      setNocError(err instanceof Error ? err.message : "Unable to withdraw No Objection");
    } finally {
      setWithdrawLoading(false);
    }
  }

  /** Open objection flow: fetch candidates first.
   * If candidates exist → show selection modal.
   * If no candidates → submit objection immediately (no project coordination needed).
   */
  async function handleObjectionClick() {
    if (!project) return;
    setObjectionError(null);
    setObjectionFetchLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/projects/${project.project_id}/objection-candidates`,
        { headers: authHeaders() },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setObjectionError(typeof data.detail === "string" ? data.detail : "Unable to check for related projects");
        return;
      }
      const candidates: ObjectionCandidate[] = data.candidates ?? [];
      setObjectionCandidates(candidates);
      setObjectionComment("");

      if (candidates.length === 0) {
        // No candidates — submit objection directly without the modal
        setObjectionFetchLoading(false);
        await submitObjectionWith([], "");
        return;
      }

      // Candidates exist — pre-select all, show modal for the user to review
      setSelectedCandidateIds(new Set(candidates.map((c) => c.project_id)));
      setShowObjectionModal(true);
    } catch (err) {
      setObjectionError(err instanceof Error ? err.message : "Unable to check for related projects");
    } finally {
      setObjectionFetchLoading(false);
    }
  }

  function toggleCandidate(id: string) {
    setSelectedCandidateIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Core submission — called from the modal Continue button or directly when there are no candidates. */
  async function submitObjectionWith(projectIds: string[], comment: string) {
    if (!project) return;
    setObjectionError(null);
    setObjectionLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/projects/${project.project_id}/objection`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            selected_project_ids: projectIds,
            comment: comment.trim() || null,
          }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setObjectionError(
          typeof data.detail === "string" ? data.detail : "Unable to submit objection",
        );
        return;
      }
      window.location.assign(`/coordination/proposals/${data.proposal_id}`);
    } catch (err) {
      setObjectionError(err instanceof Error ? err.message : "Unable to submit objection");
    } finally {
      setObjectionLoading(false);
    }
  }

  async function submitObjection() {
    await submitObjectionWith(Array.from(selectedCandidateIds), objectionComment);
  }

  async function group(candidate: any) {
    if (!project) return;
    setProposalError(null);
    try {
      const response = await fetch(`${API_BASE}/project-groups`, {
        method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ project_ids: [project.project_id, candidate.project_id] }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setProposalError(typeof payload.detail === "string" ? payload.detail : payload.detail?.message ?? "Unable to create internal group");
        return;
      }
      window.location.assign(`/project-groups/${payload.group.id}`);
    } catch (error) {
      setProposalError(error instanceof Error ? error.message : "Unable to create internal group");
    }
  }

  async function removeProject() {
    if (
      !project ||
      !window.confirm(`Permanently delete ${project.project_name}?`)
    )
      return;
    try {
      await deleteProject(project.project_id);
      navigate("/projects");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete project");
    }
  }

  async function discardProjectRecord() {
    if (!project || !window.confirm(`Discard ${project.project_name}? It will remain visible with its history.`)) return;
    const reason = window.prompt("Why discard this project? (optional)");
    if (reason === null) return;
    try {
      const discarded = await discardProject(project.project_id, reason || undefined);
      setProject(discarded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to discard project");
    }
  }

  // Request access is strictly department-based. Administrative management
  // privileges must not make a non-owning department look like the owner.
  const ownsProject = !!project && project.department === user?.department;
  const canManageProject = ownsProject || user?.role === "Super Admin";

  // NOC helpers
  const myNocRecord = nocStatus?.departments.find(
    (d) => d.department === user?.department
  );
  const myNocNotRequired = myNocRecord?.status === "NOT_REQUIRED";

  // Show the objection/NOC action panel when:
  // - the user does NOT own the project
  // - their NOC is required (not NOT_REQUIRED)
  // - and the project is not discarded
  const showNocActionsPanel = !ownsProject && !myNocNotRequired && project?.status !== "DISCARDED";

  return (
    <main className="app-page">
      <TopNav />
      <section className="page-content">
        <Link className="back-link" to="/projects">
          ← Projects
        </Link>
        {error ? (
          <div className="empty-state">{error}</div>
        ) : !project ? (
          <div className="empty-state">Loading project analysis…</div>
        ) : (
          <>
            <p className="eyebrow">SUBMITTED PROJECT</p>
            <h1>{project.project_name}</h1>
            <p className="page-intro">
              {project.status} · {project.project_type} ·{" "}
              {project.duration || (project.duration_days ? `${project.duration_days} days` : "")}
            </p>
            <p className="page-intro">Owning department: {project.department?.replaceAll("-", " ") ?? "Not assigned"}</p>

            {/* ── Project Location Map ── */}
            <section className="project-location-section">
              <h2 className="section-title">Project Location</h2>
              {project.geometry?.type === "LineString" && project.geometry.coordinates?.length >= 2 ? (() => {
                const coords = project.geometry.coordinates.map(
                  (pt) => [pt[1], pt[0]] as [number, number]
                );
                // Compute a center for initial render before fitBounds fires
                const midIdx = Math.floor(coords.length / 2);
                const center = coords[midIdx] ?? [21.1458, 79.0882];
                return (
                  <div className="project-map-wrapper" style={{ height: "320px", borderRadius: "10px", overflow: "hidden", border: "1px solid #cbd5e1" }}>
                    <MapContainer center={center} zoom={14} style={{ height: "100%", width: "100%" }}>
                      <TileLayer
                        attribution="&copy; OpenStreetMap contributors"
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <ProjectMapFit coordinates={coords} />
                      <Polyline
                        positions={coords}
                        pathOptions={{ color: "#2563eb", weight: 6, opacity: 0.95 }}
                      />
                    </MapContainer>
                  </div>
                );
              })() : (
                <div className="empty-state" style={{ minHeight: "120px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  No project location available.
                </div>
              )}
            </section>

            {/* ── Project Description ── */}
            <section style={{ marginBottom: "1.5rem" }}>
              <h2 className="section-title">Project Description</h2>
              {project.description ? (
                <p style={{ color: "#334155", lineHeight: 1.7, marginTop: "0.5rem" }}>{project.description}</p>
              ) : (
                <p style={{ color: "#94a3b8", fontStyle: "italic" }}>No description provided.</p>
              )}

              {project.status !== "DISCARDED" && canManageProject && <div className="project-actions">
              <button
                className="secondary-button"
                onClick={() => setEditingProject(project)}
              >
                Update project
              </button>
              <button
                className="danger-button"
                onClick={() => void removeProject()}
              >
                Delete permanently
              </button>
              <button className="secondary-button" onClick={() => void discardProjectRecord()}>Discard project</button>
            </div>}
            </section>

            {/* ── NOC Section (owner view) ── */}

            {ownsProject && nocStatus && (
              <section className="noc-panel">
                <h2 className="section-title">NOC Progress</h2>
                <p className="noc-progress">
                  {nocStatus.all_cleared
                    ? <span className="noc-all-clear">✅ All departments cleared — Eligible for Approval</span>
                    : <span><strong>NOC Progress: {nocStatus.given} / {nocStatus.total} departments</strong></span>
                  }
                </p>
                <div className="noc-dept-list">
                  {nocStatus.departments.map((dept) => (
                    dept.status !== "NOT_REQUIRED" && (
                      <div key={dept.department} className="noc-dept-row">
                        <span className="noc-dept-name">{dept.department.replaceAll("-", " ")}</span>
                        {dept.status === "NOC_GIVEN"
                          ? <span className="status-pill noc-given">No Objection ✓</span>
                          : dept.status === "NOC_WITHDRAWN"
                            ? <span className="status-pill noc-withdrawn">Withdrawn</span>
                            : <span className="status-pill noc-pending">Pending</span>
                        }
                      </div>
                    )
                  ))}
                </div>
              </section>
            )}

            {/* ── Non-owner: No Objection / Objection action area ── */}
            {showNocActionsPanel && (
              <div className="noc-actions-panel">
                <div className="noc-coord-actions">
                  {myNocRecord?.status === "NOC_GIVEN" ? (
                    <>
                      <span className="status-pill noc-given">No Objection Given ✓</span>
                      <button
                        className="danger-button"
                        onClick={() => void withdrawNoc()}
                        disabled={withdrawLoading}
                      >
                        {withdrawLoading ? "Withdrawing…" : "Withdraw NOC"}
                      </button>
                    </>
                  ) : myNocRecord?.status === "NOC_WITHDRAWN" ? (
                    <>
                      <span className="status-pill noc-withdrawn">NOC Withdrawn</span>
                      <button
                        id="give-noc-btn"
                        className="primary-button"
                        onClick={() => void giveNoc()}
                        disabled={nocLoading}
                      >
                        {nocLoading ? "Submitting…" : "No Objection"}
                      </button>
                      <button
                        id="raise-objection-btn"
                        className="danger-button"
                        onClick={() => void handleObjectionClick()}
                        disabled={nocLoading || objectionFetchLoading}
                      >
                        {objectionFetchLoading ? "Checking…" : "Objection"}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        id="give-noc-btn"
                        className="primary-button"
                        onClick={() => void giveNoc()}
                        disabled={nocLoading || objectionFetchLoading}
                      >
                        {nocLoading ? "Submitting…" : "No Objection"}
                      </button>
                      <button
                        id="raise-objection-btn"
                        className="danger-button"
                        onClick={() => void handleObjectionClick()}
                        disabled={nocLoading || objectionFetchLoading}
                      >
                        {objectionFetchLoading ? "Checking…" : "Objection"}
                      </button>
                    </>
                  )}
                </div>
                {nocError && <p className="form-error">{nocError}</p>}
                {objectionError && !showObjectionModal && <p className="form-error">{objectionError}</p>}
              </div>
            )}

            <h2 className="section-title">Coordination requests</h2>
            {coordination?.coordination_requests?.length ? <div className="project-list">{coordination.coordination_requests.map((request) => <article className="project-card" key={request.id}><div className="project-body"><h3>{request.proposal_code ?? request.group_code}</h3><p>{request.requesting_department ? `${request.requesting_department.replaceAll("-", " ")} requested coordination` : "Coordination relationship"}</p><p>Departments: {request.departments.map((department) => department.replaceAll("-", " ")).join(", ")}</p>{canManageProject && request.is_incoming && request.proposal_id && request.proposal_status === "PENDING" && <Link className="primary-button" to={`/coordination/proposals/${request.proposal_id}`}>Review request</Link>}</div><span className="status-pill">{(request.proposal_status ?? request.status).replaceAll("_", " ")}</span></article>)}</div> : <div className="empty-state">No coordination requests are linked to this project.</div>}
            {proposalError && <p className="form-error">{proposalError}</p>}
            {/* $hi$ */}
            {project.status !== "DISCARDED" && canManageProject && <>
              <h2 className="section-title">Internal project grouping</h2>
              <p className="page-intro">
                Projects from your department can be consolidated directly—no
                proposal or inter-department response is needed.
              </p>
              {internalGroups.length ? (
                <div className="project-list">
                  {internalGroups.map((item) => (
                    <article className="project-card" key={item.project_id}>
                      <div className="project-body">
                        <h3>{item.project.project_name}</h3>
                        <p>
                          Shared corridor: {item.shared_corridor_m}m · Common
                          window:{" "}
                          {item.common_window_feasible
                            ? "Available"
                            : "Unavailable"}
                        </p>
                        <p>
                          Grouping score: {item.grouping_score}/100 ·{" "}
                          {item.recommendation.replaceAll("_", " ")}
                        </p>
                        <div className="project-actions">
                          <button
                            className="secondary-button"
                            onClick={() => setDetailsModalProject(item.project)}
                          >
                            View details
                          </button>
                          <button
                            className="primary-button"
                            onClick={() => void group(item)}
                          >
                            Group projects
                          </button>
                        </div>
                      </div>
                      <span className="status-pill">
                        {item.grouping_level.replaceAll("_", " ")}
                      </span>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  No same-department grouping candidates are currently feasible.
                </div>
              )}
            </>}
          </>
        )}
      </section>

      <ProjectDetailsModal
        project={detailsModalProject}
        onClose={() => setDetailsModalProject(null)}
      />
      <EditProjectModal
        project={editingProject}
        onClose={() => setEditingProject(null)}
        onSave={async (id, values) => {
          const updated = await updateProject(id, values);
          setProject(updated);
        }}
      />

      {/* ── Objection Selection Modal ── */}
      {showObjectionModal && objectionCandidates !== null && (
        <ObjectionModal
          candidates={objectionCandidates}
          selectedIds={selectedCandidateIds}
          onToggle={toggleCandidate}
          onContinue={() => void submitObjection()}
          onCancel={() => {
            setShowObjectionModal(false);
            setObjectionError(null);
          }}
          loading={objectionLoading}
          error={objectionError}
          comment={objectionComment}
          onCommentChange={setObjectionComment}
        />
      )}
    </main>
  );
}
