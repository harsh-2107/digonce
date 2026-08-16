import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "@/context/AuthContext";
import { authHeaders } from "@/context/AuthContext";
import type { Project } from "@/context/ProjectsContext";
import { TopNav } from "@/components/TopNav";
import { ProjectDetailsModal } from "@/components/ProjectDetailsModal";
import { EditProjectModal } from "@/components/EditProjectModal";
import { useProjects } from "@/context/ProjectsContext";
import "@/App.css";

type Coordination = {
  risk_level: string;
  coordination_opportunity: string;
  projects: (Project & {
    analysis?: {
      coordination_score: { score: number; level: string };
      recommendation: string;
      reasons: string[];
      warnings: string[];
      hard_blockers: string[];
      gemini_explanation: string;
    };
  })[];
};

const stripMarkdown = (md: string) => {
  if (!md) return "";
  return md.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1");
};

export function ProjectDetailsPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { updateProject, deleteProject } = useProjects();
  const [project, setProject] = useState<Project | null>(null);
  const [coordination, setCoordination] = useState<Coordination | null>(null);
  const [internalGroups, setInternalGroups] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [detailsModalProject, setDetailsModalProject] =
    useState<Project | null>(null);
  const [proposalError, setProposalError] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

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
    ])
      .then(
        async ([projectResponse, coordinationResponse, internalResponse]) => {
          if (
            !projectResponse.ok ||
            !coordinationResponse.ok ||
            !internalResponse.ok
          )
            throw new Error("Unable to load project analysis");
          setProject(await projectResponse.json());
          setCoordination(await coordinationResponse.json());
          setInternalGroups((await internalResponse.json()).opportunities);
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
              {project.duration_days} days
            </p>
            <div className="project-actions">
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
                Delete project
              </button>
            </div>
            <div className="analysis-grid">
              <article>
                <small>Coordination opportunities</small>
                <strong>{coordination?.projects.length ?? 0}</strong>
              </article>
            </div>
            {proposalError && <p className="form-error">{proposalError}</p>}
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
            <h2 className="section-title">Cross-department coordination</h2>
            {coordination?.projects.length ? (
              <div className="project-list">
                {coordination.projects.filter((candidate) => candidate.department !== project.department).map((candidate) => (
                  <article className="project-card" key={candidate.project_id}>
                    <div className="project-body">
                      <h3>{candidate.project_name}</h3>
                      <p>
                        {candidate.department?.replace("-", " ")} ·{" "}
                        {candidate.start_date} → {candidate.end_date}
                      </p>
                      {candidate.analysis && (
                        <div className="coordination-analysis-summary">
                          <strong>
                            {candidate.analysis.coordination_score.score}/100 ·{" "}
                            {candidate.analysis.coordination_score.level.replaceAll(
                              "_",
                              " ",
                            )}
                          </strong>
                          <span>
                            {candidate.analysis.recommendation.replaceAll(
                              "_",
                              " ",
                            )}
                          </span>
                          {candidate.analysis.reasons
                            .slice(0, 2)
                            .map((reason) => (
                              <p key={reason}>• {reason}</p>
                            ))}
                          {candidate.analysis.hard_blockers.map((blocker) => (
                            <p className="analysis-blocker" key={blocker}>
                              Blocker: {blocker}
                            </p>
                          ))}
                          {candidate.analysis.warnings
                            .slice(0, 1)
                            .map((warning) => (
                              <p className="analysis-warning" key={warning}>
                                Review: {warning}
                              </p>
                            ))}
                          {candidate.analysis.gemini_explanation && (
                            <p className="gemini-explanation">
                              Gemini: {stripMarkdown(candidate.analysis.gemini_explanation)}
                            </p>
                          )}
                        </div>
                      )}
                      <div className="project-actions">
                        <button
                          className="secondary-button"
                          onClick={() => setDetailsModalProject(candidate)}
                        >
                          View details
                        </button>
                        {candidate.analysis?.recommendation !==
                          "DO_NOT_COORDINATE" && (
                          <button
                            className="primary-button"
                            onClick={() => void propose(candidate)}
                          >
                            Propose Coordination
                          </button>
                        )}
                      </div>
                    </div>
                    <span className="status-pill">{candidate.status}</span>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                No nearby active projects are currently available for
                coordination.
              </div>
            )}
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
