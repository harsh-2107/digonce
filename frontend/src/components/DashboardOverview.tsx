import { useEffect, useState } from "react";
import { ChevronRight, MapPinned, ShieldCheck, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MapContainer, Polyline, Popup, TileLayer, useMapEvents } from "react-leaflet";
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
  department_id?: string;
  status: string;
  geometry: { type: string; coordinates: [number, number][] } | null;
  start_date?: string;
  end_date?: string;
  completion_date?: string;
  project_type?: string;
  distance_from_click_m?: number;
};

type CompletedNearResponse = {
  clicked_location: { lat: number; lng: number };
  search_radius_m: number;
  nearest_road: {
    road_id: string | null;
    road_name: string | null;
    distance_from_click: number | null;
  };
  projects: CompletedProject[];
};

function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function DashboardOverview() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [totalSavings, setTotalSavings] = useState(0);
  const [nearbyResult, setNearbyResult] = useState<CompletedNearResponse | null>(null);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    fetch(`${API_BASE}/coordination/proposals`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((proposals: any[]) => {
        const sum = proposals.reduce((acc, p) => acc + (Number(p.estimated_savings) || 0), 0);
        setTotalSavings(sum);
      })
      .catch(() => setTotalSavings(0));
  }, [user]);

  if (!user) return null;

  const isAdmin = user.department === "super-admin";

  const handleMapClick = (lat: number, lng: number) => {
    setLoadingNearby(true);
    setNearbyError(null);

    fetch(`${API_BASE}/projects/completed-near?lat=${lat}&lng=${lng}&radius=50`, {
      headers: authHeaders(),
    })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.detail ?? "Unable to lookup location history");
        }
        return r.json();
      })
      .then((data: CompletedNearResponse) => {
        setNearbyResult(data);
      })
      .catch((err) => {
        setNearbyError(err instanceof Error ? err.message : "Lookup failed");
      })
      .finally(() => {
        setLoadingNearby(false);
      });
  };

  const savingsText = totalSavings >= 100000 
    ? `₹${(totalSavings / 100000).toFixed(1)}L potential savings`
    : `₹${totalSavings.toLocaleString()} potential savings`;

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
          text="5 active network layers"
          sub="Infrastructure data updated today"
        />
        <Status
          type="amber"
          icon={<Zap size={18} />}
          text="Location-based history"
          sub="Click any road on map to inspect"
        />
        <Status
          type="green"
          icon={<ShieldCheck size={18} />}
          text={savingsText}
          sub="Across compatible planned works"
        />
      </section>
      <div className="content-grid">
        <section className="map-card">
          <div className="card-head">
            <div>
              <h3>City Infrastructure & Location History</h3>
              <p>Click any road on the map to search completed project history from all departments</p>
            </div>
            <button onClick={() => navigate("/ongoing-projects")}>
              View full map <ChevronRight size={16} />
            </button>
          </div>

          <div style={{ height: "320px", borderRadius: "8px", overflow: "hidden", position: "relative" }}>
            <MapContainer
              center={[21.1458, 79.0882]}
              zoom={13}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <MapClickHandler onClick={handleMapClick} />

              {/* Highlight returned completed projects for current click */}
              {nearbyResult &&
                nearbyResult.projects.map((project) => {
                  if (
                    !project.geometry ||
                    project.geometry.type !== "LineString" ||
                    !Array.isArray(project.geometry.coordinates) ||
                    project.geometry.coordinates.length < 2
                  ) {
                    return null;
                  }
                  const positions = project.geometry.coordinates.map(
                    ([lng, lat]) => [lat, lng] as [number, number]
                  );
                  const dept = project.department || project.department_id || "";

                  return (
                    <g key={`highlight-${project.project_id}`}>
                      {/* Outer glowing halo */}
                      <Polyline
                        positions={positions}
                        pathOptions={{ color: "#f59e0b", weight: 14, opacity: 0.5 }}
                      />
                      {/* Inner distinct corridor line */}
                      <Polyline
                        positions={positions}
                        pathOptions={{ color: "#d97706", weight: 7, opacity: 1.0 }}
                      >
                        <Popup>
                          <div style={{ minWidth: "170px" }}>
                            <b style={{ fontSize: "13px", display: "block", marginBottom: "3px" }}>
                              {project.project_name}
                            </b>
                            <div style={{ fontSize: "12px", color: "#475569", marginBottom: "2px" }}>
                              <b>Dept:</b> {DEPT_NAMES[dept] || dept.replaceAll("-", " ")}
                            </div>
                            <div style={{ fontSize: "12px", color: "#475569", marginBottom: "6px" }}>
                              <b>Completed:</b> {project.completion_date || project.end_date || "N/A"}
                            </div>
                            <button
                              onClick={() => navigate(`/projects/${project.project_id}`)}
                              className="primary-button"
                              style={{ width: "100%", padding: "4px 8px", fontSize: "12px", cursor: "pointer" }}
                            >
                              Select Project →
                            </button>
                          </div>
                        </Popup>
                      </Polyline>
                    </g>
                  );
                })}
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
            <span style={{ display: "flex", alignItems: "center", gap: "5px", color: "#d97706", fontWeight: 600 }}>
              <span style={{ width: "18px", height: "4px", background: "#f59e0b", borderRadius: "2px", display: "inline-block" }} />
              Clicked Completed History
            </span>
          </div>

          {/* Location-based Completed Project History Result Panel */}
          {(loadingNearby || nearbyResult || nearbyError) && (
            <div
              style={{
                marginTop: "14px",
                padding: "16px",
                backgroundColor: "#f8fafc",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                position: "relative",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setNearbyResult(null);
                  setNearbyError(null);
                }}
                style={{
                  position: "absolute",
                  top: "12px",
                  right: "12px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748b",
                  fontSize: "16px",
                  fontWeight: 700,
                }}
                title="Close"
              >
                ✕
              </button>

              {loadingNearby ? (
                <div style={{ color: "#475569", fontSize: "13px", fontWeight: 500 }}>
                  Identifying nearest road & querying completed projects nearby…
                </div>
              ) : nearbyError ? (
                <div style={{ color: "#ef4444", fontSize: "13px", fontWeight: 500 }}>{nearbyError}</div>
              ) : nearbyResult ? (
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: "2px", letterSpacing: "0.05em" }}>
                    LOCATION COMPLETED-PROJECT HISTORY
                  </div>
                  <h4 style={{ margin: "0 0 4px", fontSize: "15px", color: "#0f172a", fontWeight: 700 }}>
                    {nearbyResult.nearest_road.road_name ?? "No nearby road found."}
                  </h4>
                  <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "12px" }}>
                    Clicked location: {nearbyResult.clicked_location.lat.toFixed(4)}, {nearbyResult.clicked_location.lng.toFixed(4)}
                    {nearbyResult.nearest_road.distance_from_click !== null &&
                      ` · ${nearbyResult.nearest_road.distance_from_click}m from road`}
                  </div>

                  {nearbyResult.projects.length === 0 ? (
                    <div style={{ fontSize: "13px", color: "#64748b", fontStyle: "italic", padding: "8px 0" }}>
                      No completed projects found near this location.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>
                        Completed projects near this location ({nearbyResult.projects.length})
                      </div>
                      {nearbyResult.projects.map((proj) => {
                        const dept = proj.department || proj.department_id || "";
                        const color = DEPT_COLORS[dept] || "#64748b";
                        return (
                          <div
                            key={proj.project_id}
                            style={{
                              padding: "10px 14px",
                              backgroundColor: "#ffffff",
                              borderRadius: "6px",
                              border: "1px solid #e2e8f0",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                                <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: color, display: "inline-block" }} />
                                <span style={{ fontSize: "12px", fontWeight: 700, color }}>
                                  {DEPT_NAMES[dept] || dept.replace("-", " ").toUpperCase()}
                                </span>
                              </div>
                              <b style={{ fontSize: "13px", color: "#0f172a", display: "block" }}>{proj.project_name}</b>
                              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                                {proj.project_type} · Completed: {proj.completion_date || proj.end_date || "N/A"}
                              </div>
                            </div>
                            <button
                              className="secondary-button"
                              style={{ fontSize: "12px", padding: "6px 12px", cursor: "pointer" }}
                              onClick={() => navigate(`/projects/${proj.project_id}`)}
                            >
                              Select project →
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </section>

        <section className="alerts-card">
          <div className="card-head">
            <div>
              <h3>Completed project history</h3>
              <p>Click any road on the map to query PostGIS completed projects</p>
            </div>
            <Link to="/projects" style={{ textDecoration: "none" }}>
              <button>See all</button>
            </Link>
          </div>
          {nearbyResult && nearbyResult.projects.length > 0 ? (
            <div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "8px" }}>
                Results near {nearbyResult.nearest_road.road_name ?? "selected point"}
              </div>
              {nearbyResult.projects.map((proj) => (
                <CompletedAlert key={proj.project_id} project={proj} />
              ))}
            </div>
          ) : (
            <div style={{ padding: "1rem", color: "#94a3b8", fontSize: "13px" }}>
              Click any road on the dashboard map to inspect its location-based completed project history.
            </div>
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
          {project.end_date || project.completion_date ? ` · Ended ${project.completion_date || project.end_date}` : ""}
        </p>
        <Link to={`/projects/${project.project_id}`} style={{ fontSize: "12px", color: "#2383d5", display: "inline-flex", alignItems: "center", gap: "3px" }}>
          View project <ChevronRight size={12} />
        </Link>
      </div>
    </div>
  );
}
