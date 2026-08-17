import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { API_BASE, authHeaders, useAuth } from "@/context/AuthContext";
import type { Project } from "@/context/ProjectsContext";
import { TopNav } from "@/components/TopNav";
import { ProjectDetailsModal } from "@/components/ProjectDetailsModal";
import { EditProjectModal } from "@/components/EditProjectModal";
import { useProjects } from "@/context/ProjectsContext";
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

  function loadNoc() {
    const token = sessionStorage.getItem("dig-once-token");
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`${API_BASE}/projects/${projectId}/noc`, { headers })
      .then((r) => r.json())
      .then((data) => setNocStatus(data))
      .catch(() => {});
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

  async function propose(candidate: Project) {
    if (!project) return;
    setProposalError(null);
    try {
      const headers = { "Content-Type": "application/json", ...authHeaders() };
      const groupResponse = await fetch(`${API_BASE}/coordination/groups`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          project_ids: [project.project_id, candidate.project_id],
        }),
      });
      if (!groupResponse.ok)
        throw new Error((await groupResponse.json()).detail);
      const group = await groupResponse.json();
      const proposalResponse = await fetch(
        `${API_BASE}/coordination/groups/${group.group.id}/proposals`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            proposed_start: group.group.recommended_start,
            proposed_end: group.group.recommended_end,
            message: `Coordinate ${project.project_name} with ${candidate.project_name}.`,
          }),
        },
      );
      if (!proposalResponse.ok)
        throw new Error((await proposalResponse.json()).detail);
      const proposal = await proposalResponse.json();
      window.location.assign(`/coordination/proposals/${proposal.proposal_id}`);
    } catch (err) {
      setProposalError(
        err instanceof Error ? err.message : "Unable to send proposal",
      );
    }
  }

  async function requestCoordination() {
    if (!project) return;
    setProposalError(null);
    try {
      const headers = { "Content-Type": "application/json", ...authHeaders() };
      const groupResponse = await fetch(`${API_BASE}/coordination/groups`, {
        method: "POST", headers, body: JSON.stringify({ project_ids: [project.project_id] }),
      });
      const groupPayload = await groupResponse.json().catch(() => ({}));
      if (!groupResponse.ok) throw new Error(groupPayload.detail ?? "Unable to open coordination request");
      const group = groupPayload.group;
      const proposalResponse = await fetch(`${API_BASE}/coordination/groups/${group.id}/proposals`, {
        method: "POST", headers,
        body: JSON.stringify({ proposed_start: project.start_date, proposed_end: project.end_date, message: `Coordination requested for ${project.project_name}.` }),
      });
      const proposal = await proposalResponse.json().catch(() => ({}));
      if (!proposalResponse.ok) throw new Error(proposal.detail ?? "Unable to send coordination request");
      window.location.assign(`/coordination/proposals/${proposal.proposal_id}`);
    } catch (err) {
      setProposalError(err instanceof Error ? err.message : "Unable to send coordination request");
    }
  }

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
          .catch(() => {});
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
  const ownRequest = coordination?.coordination_requests.find((request) => request.requesting_department === user?.department);

  // NOC helpers
  const myNocRecord = nocStatus?.departments.find(
    (d) => d.department === user?.department
  );
  const myNocNotRequired = myNocRecord?.status === "NOT_REQUIRED";

  return (
    <main className="app-page">
      <TopNav />
      <section className="page-content">
        <Link className="back-link" to="/projects">
          ← Projects
        </Link>
        {error && <p className="form-error">{error}</p>}
        {!project ? (
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

            {/* ── NOC Section ── */}
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

            {/* ── Non-owner: three-state NOC action area ── */}
            {!ownsProject && !myNocNotRequired && (
              <div className="noc-actions-panel">
                <div className="noc-coord-actions">
                  {ownRequest ? (
                    <>
                      <strong>Your coordination request</strong>
                      <span className="status-pill">{(ownRequest.proposal_status ?? ownRequest.status).replaceAll("_", " ")}</span>
                    </>
                  ) : (
                    <button className="secondary-button" onClick={() => void requestCoordination()}>
                      Request Coordination
                    </button>
                  )}
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
                        className="primary-button"
                        onClick={() => void giveNoc()}
                        disabled={nocLoading}
                      >
                        {nocLoading ? "Submitting…" : "Give No Objection Again"}
                      </button>
                    </>
                  ) : (
                    <button
                      className="primary-button"
                      onClick={() => void giveNoc()}
                      disabled={nocLoading}
                    >
                      {nocLoading ? "Submitting…" : "Give No Objection"}
                    </button>
                  )}
                </div>
                {nocError && <p className="form-error">{nocError}</p>}
              </div>
            )}

            <h2 className="section-title">Coordination requests</h2>
            {coordination?.coordination_requests?.length ? <div className="project-list">{coordination.coordination_requests.map((request) => <article className="project-card" key={request.id}><div className="project-body"><h3>{request.proposal_code ?? request.group_code}</h3><p>{request.requesting_department ? `${request.requesting_department.replaceAll("-", " ")} requested coordination` : "Coordination relationship"}</p><p>Departments: {request.departments.map((department) => department.replaceAll("-", " ")).join(", ")}</p>{canManageProject && request.is_incoming && request.proposal_id && request.proposal_status === "PENDING" && <Link className="primary-button" to={`/coordination/proposals/${request.proposal_id}`}>Review request</Link>}</div><span className="status-pill">{(request.proposal_status ?? request.status).replaceAll("_", " ")}</span></article>)}</div> : <div className="empty-state">No coordination requests are linked to this project.</div>}
            {proposalError && <p className="form-error">{proposalError}</p>}
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
            <h2 className="section-title">Related / Coordinatable Projects</h2>
            <p className="page-intro">Potential project matches ranked by the existing Coordination Score.</p>
            {coordination?.projects.length ? (
              <div className="project-list">
                {coordination.projects.map((candidate) => (
                  <article className="project-card" key={candidate.project_id}>
                    <div className="project-body">
                      <h3>{candidate.project_name}</h3>
                      <p>{candidate.department?.replaceAll("-", " ")} · Tentative Start: {candidate.start_date}{candidate.duration ? ` · Duration: ${candidate.duration}` : candidate.end_date ? ` → ${candidate.end_date}` : ""}</p>
                      {candidate.analysis && <div className="coordination-analysis-summary"><strong>{candidate.analysis.coordination_score.score}/100 · {candidate.analysis.coordination_score.level.replaceAll("_", " ")}</strong><span>{candidate.analysis.recommendation.replaceAll("_", " ")}</span></div>}
                      <div className="project-actions"><button className="secondary-button" onClick={() => setDetailsModalProject(candidate)}>View details</button>{canManageProject && project.status !== "DISCARDED" && candidate.analysis?.recommendation !== "DO_NOT_COORDINATE" && <button className="primary-button" onClick={() => void propose(candidate)}>Propose Coordination</button>}</div>
                    </div>
                    <span className="status-pill">{candidate.status}</span>
                  </article>
                ))}
              </div>
            ) : <div className="empty-state">No related active projects currently meet the existing coordination match rules.</div>}
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
    </main>
  );
}
