import { useEffect, useState } from "react";
import { ChevronRight, MapPinned, ShieldCheck, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Polyline, Popup } from "react-leaflet";
import { useAuth, API_BASE, authHeaders } from "@/context/AuthContext";
import "leaflet/dist/leaflet.css";

const DEPT_COLORS: Record<string, string> = {
  water: "#2383d5",
  sewage: "#8257d3",
  drainage: "#e09b16",
  "natural-gas": "#e05d48",
  fibre: "#14a683",
};

const DEPT_NAMES: Record<string, string> = {
  water: "Water Supply",
  sewage: "Sewerage",
  drainage: "Drainage",
  "natural-gas": "Natural Gas",
  fibre: "Fibre Network",
  "super-admin": "City Administration",
};

type CompletedProject = {
  project_id: string;
  project_name: string;
  department: string;
  department_id: string;
  status: string;
  geometry: { type: string; coordinates: [number, number][] } | null;
  start_date?: string;
  end_date?: string;
  project_type?: string;
};

export function DashboardOverview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [completedProjects, setCompletedProjects] = useState<CompletedProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoadingProjects(true);
    fetch(`${API_BASE}/projects?status=Completed`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((projects: CompletedProject[]) => {
        // Only include projects with valid LineString geometry
        const withGeom = projects.filter(
          (p) =>
            p.geometry &&
            p.geometry.type === "LineString" &&
            Array.isArray(p.geometry.coordinates) &&
            p.geometry.coordinates.length >= 2,
        );
        setCompletedProjects(withGeom);
      })
      .catch(() => setCompletedProjects([]))
      .finally(() => setLoadingProjects(false));
  }, [user]);

  if (!user) return null;

  const isAdmin = user.department === "super-admin";

  // Status strip counts
  const uniqueDepts = new Set(completedProjects.map((p) => p.department || p.department_id)).size;
  const displayLayers = isAdmin ? uniqueDepts || 5 : 1;

  return (
    <main className="dashboard-main">
      <header>
        <div>
          <p className="eyebrow">
            {isAdmin
              ? "CITY-WIDE OVERVIEW"
              : `${user.department.replace("-", " ").toUpperCase()} DEPARTMENT`}
          </p>
          <h1>Good morning, {user.name.split(" ")[0]}.</h1>
        </div>
        <Link to="/projects/new" className="new-work">
          <span>+</span> Add planned work
        </Link>
      </header>
      <section className="status-strip">
        <Status
          type="blue"
          icon={<MapPinned size={18} />}
          text={`${displayLayers} active network layer${displayLayers === 1 ? "" : "s"}`}
          sub="Infrastructure data updated today"
        />
        <Status
          type="amber"
          icon={<Zap size={18} />}
          text={`${completedProjects.length} completed project${completedProjects.length === 1 ? "" : "s"}`}
          sub="Visible on city map below"
        />
        <Status
          type="green"
          icon={<ShieldCheck size={18} />}
          text="₹18.6L potential savings"
          sub="Across compatible planned works"
        />
      </section>
      <div className="content-grid">
        <section className="map-card">
          <div className="card-head">
            <div>
              <h3>Completed projects</h3>
              <p>
                {loadingProjects
                  ? "Loading completed projects…"
                  : isAdmin
                  ? `${completedProjects.length} project corridor${completedProjects.length === 1 ? "" : "s"} — all departments`
                  : `Your department's completed corridors`}
              </p>
            </div>
            <button onClick={() => navigate("/ongoing-projects")}>
              View full map <ChevronRight size={16} />
            </button>
          </div>
          <div style={{ height: "300px", borderRadius: "8px", overflow: "hidden", position: "relative" }}>
            <MapContainer
              center={[21.1458, 79.0882]}
              zoom={13}
              style={{ height: "100%", width: "100%" }}
              scrollWheelZoom={false}
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {completedProjects.map((project) => {
                const positions = project.geometry!.coordinates.map(
                  ([lng, lat]) => [lat, lng] as [number, number],
                );
                const dept = project.department || project.department_id || "";
                const color = DEPT_COLORS[dept] || "#6b7280";
                return (
                  <Polyline
                    key={project.project_id}
                    positions={positions}
                    pathOptions={{ color, weight: 5, opacity: 0.85 }}
                  >
                    <Popup>
                      <div style={{ minWidth: "160px" }}>
                        <b style={{ fontSize: "13px", display: "block", marginBottom: "4px" }}>
                          {project.project_name}
                        </b>
                        <div style={{ fontSize: "12px", color: "#475569", marginBottom: "2px" }}>
                          <b>Dept:</b> {DEPT_NAMES[dept] || dept.replaceAll("-", " ")}
                        </div>
                        {project.end_date && (
                          <div style={{ fontSize: "12px", color: "#475569", marginBottom: "6px" }}>
                            <b>Completed:</b> {project.end_date}
                          </div>
                        )}
                        <Link
                          to={`/projects/${project.project_id}`}
                          className="primary-button"
                          style={{
                            display: "inline-block",
                            width: "100%",
                            textAlign: "center",
                            padding: "4px 8px",
                            fontSize: "12px",
                            textDecoration: "none",
                            boxSizing: "border-box",
                          }}
                        >
                          View Details
                        </Link>
                      </div>
                    </Popup>
                  </Polyline>
                );
              })}
              {!loadingProjects && completedProjects.length === 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    zIndex: 1000,
                    background: "rgba(255,255,255,0.9)",
                    padding: "10px 18px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    color: "#64748b",
                    fontWeight: 600,
                    pointerEvents: "none",
                  }}
                >
                  No completed projects yet
                </div>
              )}
            </MapContainer>
          </div>
          {/* Legend */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", padding: "10px 0 0", fontSize: "12px" }}>
            {Object.entries(DEPT_COLORS).map(([dept, color]) => (
              <span key={dept} style={{ display: "flex", alignItems: "center", gap: "5px", color: "#475569" }}>
                <span style={{ width: "18px", height: "3px", background: color, borderRadius: "2px", display: "inline-block" }} />
                {DEPT_NAMES[dept] || dept}
              </span>
            ))}
          </div>
        </section>
        <section className="alerts-card">
          <div className="card-head">
            <div>
              <h3>Recently completed</h3>
              <p>Finished projects from the database</p>
            </div>
            <Link to="/projects" style={{ textDecoration: "none" }}>
              <button>See all</button>
            </Link>
          </div>
          {loadingProjects ? (
            <div style={{ padding: "1rem", color: "#64748b", fontSize: "13px" }}>Loading…</div>
          ) : completedProjects.length === 0 ? (
            <div style={{ padding: "1rem", color: "#94a3b8", fontSize: "13px" }}>No completed projects found.</div>
          ) : (
            completedProjects.slice(0, 5).map((project) => (
              <CompletedAlert key={project.project_id} project={project} />
            ))
          )}
        </section>
      </div>
    </main>
  );
}

function Status({
  type,
  icon,
  text,
  sub,
}: {
  type: string;
  icon: ReactNode;
  text: string;
  sub: string;
}) {
  return (
    <div>
      <span className={`status-icon ${type}`}>{icon}</span>
      <p>
        <b>{text}</b>
        <small>{sub}</small>
      </p>
    </div>
  );
}

function CompletedAlert({ project }: { project: CompletedProject }) {
  const dept = project.department || project.department_id || "";
  const color = DEPT_COLORS[dept] || "#6b7280";
  return (
    <div className="alert">
      <span style={{ background: color, color: "#fff", borderRadius: "50%", width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, flexShrink: 0 }}>
        ✓
      </span>
      <div>
        <b>{project.project_name}</b>
        <p style={{ margin: "2px 0 4px", fontSize: "12px", color: "#64748b" }}>
          {DEPT_NAMES[dept] || dept.replaceAll("-", " ")}
          {project.end_date ? ` · Ended ${project.end_date}` : ""}
        </p>
        <Link to={`/projects/${project.project_id}`} style={{ fontSize: "12px", color: "#2383d5", display: "inline-flex", alignItems: "center", gap: "3px" }}>
          View project <ChevronRight size={12} />
        </Link>
      </div>
    </div>
  );
}
