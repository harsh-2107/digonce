import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE, authHeaders } from "@/context/AuthContext";
import { TopNav } from "@/components/TopNav";
import "@/App.css";

type Proposal = {
  id: string;
  proposal_code: string;
  group_id: string;
  proposed_start: string;
  proposed_end: string;
  status: string;
  message: string | null;
};

export function CoordinationPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch(`${API_BASE}/coordination/proposals`, { headers: authHeaders() })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).detail);
        return r.json();
      })
      .then(setProposals)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <main className="app-page">
      <TopNav />
      <section className="page-content">
        <p className="eyebrow">CROSS-DEPARTMENT WORKFLOW</p>
        <h1>Coordination</h1>
        <p className="page-intro">
          Incoming requests, proposals and agreements remain linked while each
          project stays independent.
        </p>
        {error && <p className="form-error">{error}</p>}
        <div className="project-list">
          {proposals.length ? (
            proposals.map((p) => (
              <article className="project-card" key={p.id}>
                <div className="project-body">
                  <h3>{p.proposal_code}</h3>
                  <p>
                    {p.proposed_start} → {p.proposed_end}
                    {p.message ? ` · ${p.message}` : ""}
                  </p>
                  <Link
                    className="secondary-button"
                    to={`/coordination/proposals/${p.id}`}
                  >
                    Review proposal
                  </Link>
                </div>
                <span className="status-pill">
                  {p.status.replaceAll("_", " ")}
                </span>
              </article>
            ))
          ) : (
            <div className="empty-state">
              No coordination proposals involve your department yet.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
