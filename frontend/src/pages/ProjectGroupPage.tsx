import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { API_BASE, authHeaders } from "@/context/AuthContext";
import { TopNav } from "@/components/TopNav";
import "@/App.css";

export function ProjectGroupPage() {
  const { groupId } = useParams();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () =>
    fetch(`${API_BASE}/project-groups/${groupId}`, { headers: authHeaders() })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).detail);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, [groupId]);
  const action = async (path: string, method = "POST", body?: any) => {
    const r = await fetch(`${API_BASE}/project-groups/${groupId}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) {
      const resp = await r.json();
      setError(resp.detail?.message ?? resp.detail);
      return;
    }
    await load();
  };
  if (!data)
    return (
      <main className="app-page">
        <TopNav />
        <section className="page-content">
          Loading consolidated project…
        </section>
      </main>
    );
  const g = data.group;
  return (
    <main className="app-page">
      <TopNav />
      <section className="page-content">
        <Link className="back-link" to="/projects">
          ← Projects
        </Link>
        <p className="eyebrow">INTERNAL PROJECT GROUP</p>
        <h1>{g.name}</h1>
        <p className="page-intro">
          {g.group_code} · {g.status} · Analysis: {g.analysis_status}
        </p>
        {error && (
          <p className="form-error">
            {typeof error === "string" ? error : JSON.stringify(error)}
          </p>
        )}
        <div className="analysis-grid">
          <article>
            <small>Grouping score</small>
            <strong>{g.grouping_score}/100</strong>
          </article>
          <article>
            <small>Execution window</small>
            <strong>
              {g.final_start} → {g.final_end}
            </strong>
          </article>
          <article>
            <small>Openings avoided</small>
            <strong>{g.estimated_disruption_reduction}</strong>
          </article>
        </div>
        <h2 className="section-title">Source projects</h2>
        <div className="project-list">
          {data.source_projects.map((p: any) => (
            <article className="project-card" key={p.project_id}>
              <div className="project-body">
                <h3>{p.project_name}</h3>
                <p>
                  {p.start_date} → {p.end_date}
                </p>
              </div>
              <Link
                className="secondary-button"
                to={`/projects/${p.project_id}/analysis`}
              >
                View project
              </Link>
            </article>
          ))}
        </div>
        <h2 className="section-title">Consolidated details</h2>
        <div className="project-form">
          <label>
            Project name
            <input
              value={g.name}
              onChange={(e) =>
                setData({ ...data, group: { ...g, name: e.target.value } })
              }
            />
          </label>
          <label>
            Description
            <textarea
              value={g.description ?? ""}
              onChange={(e) =>
                setData({
                  ...data,
                  group: { ...g, description: e.target.value },
                })
              }
            />
          </label>
          <div className="date-pair">
            <label>
              Execution start
              <input
                type="date"
                value={g.final_start ?? ""}
                onChange={(e) =>
                  setData({
                    ...data,
                    group: { ...g, final_start: e.target.value },
                  })
                }
              />
            </label>
            <label>
              Execution end
              <input
                type="date"
                value={g.final_end ?? ""}
                onChange={(e) =>
                  setData({
                    ...data,
                    group: { ...g, final_end: e.target.value },
                  })
                }
              />
            </label>
          </div>
          <div className="project-actions">
            <button
              className="primary-button"
              onClick={() =>
                void action("", "PATCH", {
                  name: g.name,
                  description: g.description,
                  final_start: g.final_start || null,
                  final_end: g.final_end || null,
                })
              }
            >
              Save details
            </button>
            <button
              className="secondary-button"
              onClick={() =>
                void action("", "PATCH", {
                  name: g.name,
                  description: g.description,
                  final_start: g.final_start || null,
                  final_end: g.final_end || null,
                })
              }
            >
              Update details
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
