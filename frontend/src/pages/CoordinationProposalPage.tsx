import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { API_BASE, authHeaders } from "@/context/AuthContext";
import { TopNav } from "@/components/TopNav";
import { ProjectDetailsModal } from "@/components/ProjectDetailsModal";
import type { Project } from "@/context/ProjectsContext";
import { useAuth } from "@/context/AuthContext";
import "@/App.css";

export function CoordinationProposalPage() {
  const { proposalId } = useParams();
  const [data, setData] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [detailsProject, setDetailsProject] = useState<Project | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [comment, setComment] = useState("");
  const { user } = useAuth();
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
