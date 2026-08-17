import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { API_BASE, authHeaders } from "@/context/AuthContext";
import { TopNav } from "@/components/TopNav";
import { ProjectDetailsModal } from "@/components/ProjectDetailsModal";
import type { Project } from "@/context/ProjectsContext";
import { useAuth } from "@/context/AuthContext";
import "@/App.css";

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

export function CoordinationProposalPage() {
  const { proposalId } = useParams();
  const [data, setData] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [detailsProject, setDetailsProject] = useState<Project | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [comment, setComment] = useState("");
  const { user } = useAuth();

  // NOC state per project_id
  const [nocMap, setNocMap] = useState<Record<string, NocStatus>>({});
  const [nocLoading, setNocLoading] = useState<Record<string, boolean>>({});
  const [nocError, setNocError] = useState<string | null>(null);

  const load = () =>
    fetch(`${API_BASE}/coordination/proposals/${proposalId}`, {
      headers: authHeaders(),
    })
      .then((r) => r.json())
      .then(setData)
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, [proposalId]);

  useEffect(() => {
    if (!data?.group?.id) return;
    fetch(`${API_BASE}/coordination/groups/${data.group.id}/comments`, { headers: authHeaders() })
      .then((response) => response.ok ? response.json() : [])
      .then(setComments);
  }, [data?.group?.id]);

  // Load NOC status for each participating project when group is accepted
  useEffect(() => {
    const groupStatus = data?.group?.status;
    const projects: Project[] = data?.projects ?? [];
    if (!groupStatus || !["APPROVED", "CONFIRMED", "SCHEDULED", "COMPLETED"].includes(groupStatus)) return;
    if (!projects.length) return;

    projects.forEach((p: Project) => {
      fetch(`${API_BASE}/projects/${p.project_id}/noc`, { headers: authHeaders() })
        .then((r) => r.ok ? r.json() : null)
        .then((noc) => {
          if (noc) setNocMap((prev) => ({ ...prev, [p.project_id]: noc }));
        })
        .catch(() => {});
    });
  }, [data?.group?.status, data?.projects]);

  async function giveNoc(projectId: string) {
    setNocError(null);
    setNocLoading((prev) => ({ ...prev, [projectId]: true }));
    try {
      const r = await fetch(`${API_BASE}/projects/${projectId}/noc`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({}),
      });
      const payload = await r.json().catch(() => ({}));
      if (!r.ok) {
        setNocError(typeof payload.detail === "string" ? payload.detail : "Unable to give No Objection");
      } else {
        // Refresh NOC status for this project
        const nocR = await fetch(`${API_BASE}/projects/${projectId}/noc`, { headers: authHeaders() });
        if (nocR.ok) {
          const noc = await nocR.json();
          setNocMap((prev) => ({ ...prev, [projectId]: noc }));
        }
      }
    } catch (err) {
      setNocError(err instanceof Error ? err.message : "Unable to give No Objection");
    } finally {
      setNocLoading((prev) => ({ ...prev, [projectId]: false }));
    }
  }

  async function withdrawNoc(projectId: string) {
    if (!window.confirm("Are you sure you want to withdraw your No Objection? The project owner will be notified and approval will be blocked.")) return;
    setNocError(null);
    setNocLoading((prev) => ({ ...prev, [projectId]: true }));
    try {
      const r = await fetch(`${API_BASE}/projects/${projectId}/noc`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const payload = await r.json().catch(() => ({}));
      if (!r.ok) {
        setNocError(typeof payload.detail === "string" ? payload.detail : "Unable to withdraw No Objection");
      } else {
        const nocR = await fetch(`${API_BASE}/projects/${projectId}/noc`, { headers: authHeaders() });
        if (nocR.ok) {
          const noc = await nocR.json();
          setNocMap((prev) => ({ ...prev, [projectId]: noc }));
        }
      }
    } catch (err) {
      setNocError(err instanceof Error ? err.message : "Unable to withdraw No Objection");
    } finally {
      setNocLoading((prev) => ({ ...prev, [projectId]: false }));
    }
  }

  const respond = async (action: "accept" | "reject") => {
    setError(null);
    const r = await fetch(
      `${API_BASE}/coordination/proposals/${proposalId}/${action}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          message,
        }),
      },
    );
    if (!r.ok) {
      setError((await r.json()).detail);
      return;
    }
    setData(await r.json());
  };

  const postComment = async () => {
    if (!comment.trim() || !data) return;
    const response = await fetch(`${API_BASE}/coordination/groups/${data.group.id}/comments`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ message: comment }) });
    if (!response.ok) { setError((await response.json()).detail); return; }
    const createdComment = await response.json();
    setComments((current) => [...current, createdComment]);
    setComment("");
  };

  const groupAction = async (path: string) => {
    if (!data) return;
    const response = await fetch(`${API_BASE}/coordination/groups/${data.group.id}${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: path === "/revoke" ? JSON.stringify({ message: "Coordination revoked for review." }) : undefined });
    if (!response.ok) { setError((await response.json()).detail); return; }
    load();
  };

  if (!data)
    return (
      <main className="app-page">
        <TopNav />
        <section className="page-content">Loading proposal…</section>
      </main>
    );

  const p = data.proposal;
  const userResponded = data.responses?.some((r: any) => r.department === user?.department);
  const groupStatus: string = data.group.status;
  const nocGroupActive = ["APPROVED", "CONFIRMED", "SCHEDULED", "COMPLETED"].includes(groupStatus);

  return (
    <main className="app-page">
      <TopNav />
      <section className="page-content">
        <Link className="back-link" to="/coordination">
          ← Coordination
        </Link>
        <p className="eyebrow">COORDINATION PROPOSAL</p>
        <h1>{p.proposal_code}</h1>
        <p className="page-intro">
          Version {p.version ?? 1} · Proposed window: {p.proposed_start} to {p.proposed_end}
        </p>
        {error && <p className="form-error">{error}</p>}
        <div className="analysis-grid">
          <article>
            <small>Coordination score</small>
            <strong>{data.group.coordination_score}/100</strong>
          </article>
          <article>
            <small>Current status</small>
            <strong>{data.group.status.replaceAll("_", " ")}</strong>
          </article>
          <article>
            <small>Projects</small>
            <strong>{data.projects.length}</strong>
          </article>
        </div>
        <h2 className="section-title">Participating projects</h2>
        <div className="project-list">
          {data.projects.map((project: Project) => (
            <article className="project-card" key={project.project_id}>
              <div className="project-body">
                <h3>{project.project_name}</h3>
                <p>
                  {project.department} · {project.start_date} →{" "}
                  {project.end_date}
                </p>
                <div className="project-actions"><button className="secondary-button" onClick={() => setDetailsProject(project)}>View details</button></div>
              </div>
              <span className="status-pill">{project.status}</span>
            </article>
          ))}
        </div>

        {/* ── NOC Section for accepted coordination group ── */}
        {nocGroupActive && (
          <section className="noc-panel" style={{ marginTop: "2rem" }}>
            <h2 className="section-title">No Objection Certificates (NOC)</h2>
            <p className="page-intro">
              Coordination is separate from NOC. Each participating department must still give formal No Objection for projects they do not own.
            </p>
            {nocError && <p className="form-error">{nocError}</p>}
            {data.projects.map((project: Project) => {
              const noc = nocMap[project.project_id];
              const ownerDept = project.department;
              const isOwner = user?.department === ownerDept;
              const myNocRecord = noc?.departments.find((d) => d.department === user?.department);
              const myNocNotRequired = myNocRecord?.status === "NOT_REQUIRED";
              const loading = nocLoading[project.project_id] ?? false;

              return (
                <div key={`noc-${project.project_id}`} style={{ marginBottom: "1.5rem", padding: "1rem 1.25rem", background: "var(--card-bg, #f8fafc)", border: "1px solid var(--border, #e2e8f0)", borderRadius: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "0.75rem" }}>
                    <div>
                      <strong>{project.project_name}</strong>
                      <span style={{ marginLeft: "8px", fontSize: "12px", color: "#64748b" }}>
                        Owned by: {ownerDept?.replaceAll("-", " ")}
                      </span>
                    </div>
                    {noc && (
                      <span style={{ fontSize: "12px", color: "#475569" }}>
                        NOC: {noc.given}/{noc.total} departments cleared
                        {noc.all_cleared && <span className="status-pill noc-given" style={{ marginLeft: "8px" }}>All Cleared ✅</span>}
                      </span>
                    )}
                  </div>

                  {/* Owner view — NOC progress tracker */}
                  {isOwner && noc && (
                    <div className="noc-dept-list">
                      {noc.departments.map((dept) =>
                        dept.status !== "NOT_REQUIRED" ? (
                          <div key={dept.department} className="noc-dept-row">
                            <span className="noc-dept-name">{dept.department.replaceAll("-", " ")}</span>
                            {dept.status === "NOC_GIVEN"
                              ? <span className="status-pill noc-given">No Objection ✓</span>
                              : dept.status === "NOC_WITHDRAWN"
                              ? <span className="status-pill noc-withdrawn">Withdrawn</span>
                              : <span className="status-pill noc-pending">Pending</span>
                            }
                          </div>
                        ) : null
                      )}
                    </div>
                  )}

                  {/* Non-owner three-state NOC action */}
                  {!isOwner && !myNocNotRequired && (
                    <div className="noc-coord-actions">
                      {myNocRecord?.status === "NOC_GIVEN" ? (
                        <>
                          <span className="status-pill noc-given">No Objection Given ✓</span>
                          <button
                            className="danger-button"
                            onClick={() => void withdrawNoc(project.project_id)}
                            disabled={loading}
                          >
                            {loading ? "Withdrawing…" : "Withdraw NOC"}
                          </button>
                        </>
                      ) : myNocRecord?.status === "NOC_WITHDRAWN" ? (
                        <>
                          <span className="status-pill noc-withdrawn">NOC Withdrawn</span>
                          <button
                            className="primary-button"
                            onClick={() => void giveNoc(project.project_id)}
                            disabled={loading}
                          >
                            {loading ? "Submitting…" : "Give No Objection Again"}
                          </button>
                        </>
                      ) : (
                        <button
                          className="primary-button"
                          onClick={() => void giveNoc(project.project_id)}
                          disabled={loading}
                        >
                          {loading ? "Submitting…" : "Give No Objection"}
                        </button>
                      )}
                    </div>
                  )}

                  {!isOwner && myNocNotRequired && (
                    <p style={{ color: "#64748b", fontSize: "13px", margin: 0 }}>NOC not required from your department for this project.</p>
                  )}

                  {!noc && (
                    <p style={{ color: "#94a3b8", fontSize: "13px", margin: 0 }}>Loading NOC status…</p>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {p.status === "PENDING" && !userResponded && (
          <div className="response-panel">
            <h2>Respond to proposal</h2>
            <textarea
              placeholder="Reason or response"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <div className="project-actions">
              <button
                className="secondary-button"
                onClick={() => respond("accept")}
              >
                Accept proposal
              </button>
              <button className="text-button" onClick={() => respond("reject")}>
                Reject
              </button>
            </div>
          </div>
        )}
        {p.status === "PENDING" && userResponded && (
          <div className="response-panel">
            <h2>Your response is submitted</h2>
            <p>Waiting for all other participating departments to accept the proposal.</p>
          </div>
        )}
        {data.group.status === "AWAITING_CONFIRMATION" && <div className="response-panel"><h2>Explicit coordination confirmation</h2><p>Every participating department must confirm the current plan after discussion and proposal acceptance.</p><div className="project-actions"><button className="primary-button" onClick={() => void groupAction("/confirm")}>Confirm coordination</button></div></div>}
        {data.group.status === "CONFIRMED" && <div className="response-panel"><h2>Coordination confirmed</h2><p>All departments explicitly confirmed the plan. City Admin can now schedule the joint execution window.</p>{user?.department === "super-admin" && <button className="primary-button" onClick={() => void groupAction("/schedule")}>Schedule joint plan</button>}</div>}
        {data.group.status !== "SCHEDULED" && data.group.status !== "BROKEN" && <button className="text-button" onClick={() => void groupAction("/revoke")}>Revoke coordination for review</button>}
        <h2 className="section-title">Confirmation tracker</h2><div className="project-list">{data.projects.map((project: Project) => <article className="project-card" key={`confirm-${project.project_id}`}><div className="project-body"><h3>{project.department}</h3><p>{data.confirmations?.some((item:any) => item.department === project.department) ? "Explicitly confirmed" : "Awaiting confirmation"}</p></div></article>)}</div>
        <h2 className="section-title">Response history</h2>
        <div className="project-list">
          {data.responses.map((r: any) => (
            <article className="project-card" key={r.id}>
              <div className="project-body">
                <h3>{r.department}</h3>
                <p>{r.message || "No additional message"}</p>
                {r.requested_start && r.requested_end && <p className="response-window">Requested window: <strong>{r.requested_start} → {r.requested_end}</strong></p>}
              </div>
              <span className="status-pill">
                {r.response.replaceAll("_", " ")}
              </span>
            </article>
          ))}
        </div>
        <h2 className="section-title">Department discussion</h2>
        <p className="page-intro">All participating departments can discuss this group before confirming a proposal.</p>
        <div className="comment-thread">
          {comments.length ? comments.map((item: any) => <article className="comment" key={item.id}><div><strong>{item.author_name}</strong><span>{item.department.replaceAll("-", " ")} · {new Date(item.created_at).toLocaleString()}</span></div><p>{item.message}</p></article>) : <div className="empty-state">No discussion messages yet.</div>}
          <div className="comment-compose"><textarea placeholder="Add a message for participating departments…" value={comment} onChange={(event) => setComment(event.target.value)} /><button className="primary-button" onClick={() => void postComment()}>Post comment</button></div>
        </div>
        <ProjectDetailsModal
          project={detailsProject}
          onClose={() => setDetailsProject(null)}
        />
      </section>
    </main>
  );
}
