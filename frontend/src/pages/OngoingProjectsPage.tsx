import { useEffect, useMemo, useState } from "react";
import { Activity, ExternalLink, X } from "lucide-react";
import { Link } from "react-router-dom";
import { MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { latLngBounds } from "leaflet";
import { API_BASE, authHeaders, useAuth } from "@/context/AuthContext";
import type { Project } from "@/context/ProjectsContext";
import { TopNav } from "@/components/TopNav";
import "leaflet/dist/leaflet.css";
import "@/App.css";

const DEPARTMENTS = [
  { id: "water", name: "Water Supply", color: "#2383d5" },
  { id: "sewage", name: "Sewage", color: "#8257d3" },
  { id: "drainage", name: "Drainage", color: "#e09b16" },
  { id: "natural-gas", name: "Natural Gas", color: "#e05d48" },
  { id: "fibre", name: "Fibre Network", color: "#14a683" },
] as const;

const DEPT_COLORS: Record<string, string> = {
  water: "#2383d5",
  sewage: "#8257d3",
  drainage: "#e09b16",
  "natural-gas": "#e05d48",
  fibre: "#14a683",
};

const DEPT_NAMES: Record<string, string> = {
  water: "Water Supply Department",
  sewage: "Sewage Department",
  drainage: "Drainage Department",
  "natural-gas": "Natural Gas Department",
  fibre: "Fibre Network Department",
  "super-admin": "City Administration",
};

/** Inner component: automatically fits the Leaflet map bounds to visible project corridors */
function MapFitController({ projects }: { projects: Project[] }) {
  const map = useMap();

  useEffect(() => {
    if (!projects || projects.length === 0) return;

    const coordinates: [number, number][] = [];
    projects.forEach((p) => {
      if (
        p.geometry &&
        p.geometry.type === "LineString" &&
        Array.isArray(p.geometry.coordinates)
      ) {
        p.geometry.coordinates.forEach(([lng, lat]) => {
          if (typeof lat === "number" && typeof lng === "number") {
            coordinates.push([lat, lng]);
          }
        });
      }
    });

    if (coordinates.length > 0) {
      const bounds = latLngBounds(coordinates);
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      }
    }
  }, [projects, map]);

  return null;
}

export function OngoingProjectsPage() {
  const { user } = useAuth();

  // Initialize selected departments: defaults only to logged-in user's department
  const [selectedDepts, setSelectedDepts] = useState<string[]>(() => {
    if (user?.department && DEPARTMENTS.some((d) => d.id === user.department)) {
      return [user.department];
    }
    return ["water"];
  });

  const [allOngoingProjects, setAllOngoingProjects] = useState<Project[]>([]);
  const [displayProjects, setDisplayProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [coordinatingDepts, setCoordinatingDepts] = useState<string[]>([]);
  const [fetchingCoordinating, setFetchingCoordinating] = useState<boolean>(false);

  // Fetch all ongoing projects once to derive counts for each department button
  useEffect(() => {
    if (!user) return;

    fetch(`${API_BASE}/projects?ongoing=true`, { headers: authHeaders() })
      .then((r) => {
        if (!r.ok) throw new Error("Unable to fetch ongoing projects");
        return r.json();
      })
      .then((data: Project[]) => {
        setAllOngoingProjects(data);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Unable to fetch ongoing projects");
      });
  }, [user]);

  // Fetch filtered ongoing projects from backend whenever selectedDepts changes
  useEffect(() => {
    if (!user) return;

    if (selectedDepts.length === 0) {
      setDisplayProjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const deptsParam = selectedDepts.join(",");
    fetch(`${API_BASE}/projects?departments=${deptsParam}&ongoing=true`, {
      headers: authHeaders(),
    })
      .then((r) => {
        if (!r.ok) throw new Error("Unable to fetch department ongoing projects");
        return r.json();
      })
      .then((data: Project[]) => {
        setDisplayProjects(data);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Unable to fetch ongoing projects");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedDepts, user]);

  // Fetch coordinating departments when a project is selected
  useEffect(() => {
    if (!selectedProject) {
      setCoordinatingDepts([]);
      setFetchingCoordinating(false);
      return;
    }

    let isMounted = true;
    setFetchingCoordinating(true);

    const deptsFromNoc = (selectedProject.noc_summary?.departments ?? [])
      .filter((d) => d.status === "NOC_GIVEN")
      .map((d) => d.department);

    fetch(`${API_BASE}/projects/${selectedProject.project_id}/coordination`, {
      headers: authHeaders(),
    })
      .then(async (r) => {
        if (!r.ok) return { coordination_requests: [] };
        return r.json();
      })
      .then((data) => {
        if (!isMounted) return;
        const reqDepts = (data.coordination_requests ?? [])
          .map((req: any) => req.requesting_department)
          .filter(Boolean);
        const combined = Array.from(new Set([...deptsFromNoc, ...reqDepts])).filter(
          (d) => d !== selectedProject.department,
        );
        setCoordinatingDepts(combined);
      })
      .catch(() => {
        if (!isMounted) return;
        const combined = Array.from(new Set(deptsFromNoc)).filter(
          (d) => d !== selectedProject.department,
        );
        setCoordinatingDepts(combined);
      })
      .finally(() => {
        if (isMounted) setFetchingCoordinating(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedProject]);

  // Calculate department button project counts
  const deptCounts = useMemo(() => {
    const counts: Record<string, number> = {
      water: 0,
      sewage: 0,
      drainage: 0,
      "natural-gas": 0,
      fibre: 0,
    };
    allOngoingProjects.forEach((p) => {
      if (p.department && p.department in counts) {
        counts[p.department]++;
      }
    });
    return counts;
  }, [allOngoingProjects]);

  const toggleDept = (deptId: string) => {
    setSelectedDepts((current) =>
      current.includes(deptId)
        ? current.filter((id) => id !== deptId)
        : [...current, deptId]
    );
  };

  if (!user) return null;

  return (
    <main className="map-page">
      <TopNav />
      <div className="map-layout">
        <aside className="layer-panel">
          <div className="panel-title">
            <Activity size={18} />
            <div>
              <b>Ongoing Project Corridors</b>
              <small>Filter active works</small>
            </div>
          </div>

          <div style={{ padding: "12px 14px" }}>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "#64748b",
                textTransform: "uppercase",
                marginBottom: "10px",
                letterSpacing: "0.05em",
              }}
            >
              DEPARTMENTS
            </div>

            {DEPARTMENTS.map((d) => {
              const isSelected = selectedDepts.includes(d.id);
              const count = deptCounts[d.id] ?? 0;
              return (
                <button
                  key={d.id}
                  type="button"
                  className={`layer-toggle ${isSelected ? "enabled" : ""}`}
                  onClick={() => toggleDept(d.id)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "6px",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <i style={{ background: d.color }} />
                    <span style={{ fontWeight: 600, fontSize: "13px" }}>{d.name}</span>
                  </div>
                  <span
                    style={{
                      fontSize: "11px",
                      color: isSelected ? "#0f172a" : "#64748b",
                      fontWeight: 600,
                      backgroundColor: isSelected ? "rgba(255,255,255,0.7)" : "#f1f5f9",
                      padding: "2px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    {count} {count === 1 ? "project" : "projects"}
                  </span>
                </button>
              );
            })}
          </div>

        </aside>

        <section className="map-workspace">
          <div className="map-toolbar">
            <div>
              <b>Nagpur Ongoing Infrastructure Work</b>
              <span>
                {loading
                  ? "Loading ongoing projects…"
                  : error
                  ? error
                  : `${displayProjects.length} ongoing project corridor${displayProjects.length === 1 ? "" : "s"} visible`}
              </span>
            </div>
          </div>

          <MapContainer center={[21.1458, 79.0882]} zoom={14} className="leaflet-map">
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapFitController projects={displayProjects} />

            {/* Render ongoing project corridors as solid lines */}
            {displayProjects.map((project) => {
              if (
                !project.geometry ||
                project.geometry.type !== "LineString" ||
                !project.geometry.coordinates ||
                project.geometry.coordinates.length < 2
              ) {
                return null;
              }
              const positions = project.geometry.coordinates.map(
                ([lng, lat]) => [lat, lng] as [number, number]
              );
              const color = DEPT_COLORS[project.department || ""] || "#2563eb";

              return (
                <Polyline
                  key={project.project_id}
                  positions={positions}
                  pathOptions={{
                    color,
                    weight: 6,
                    opacity: 0.95,
                  }}
                  eventHandlers={{
                    click: () => setSelectedProject(project),
                  }}
                >
                  <Popup>
                    <div style={{ minWidth: "180px" }}>
                      <b style={{ fontSize: "14px", display: "block", marginBottom: "4px" }}>
                        {project.project_name}
                      </b>
                      <div style={{ fontSize: "12px", color: "#475569", marginBottom: "2px" }}>
                        <b>Status:</b> {project.status}
                      </div>
                      <div style={{ fontSize: "12px", color: "#475569", marginBottom: "6px" }}>
                        <b>Department:</b>{" "}
                        {DEPT_NAMES[project.department || ""] || project.department}
                      </div>
                      <button
                        type="button"
                        className="primary-button"
                        style={{
                          width: "100%",
                          padding: "4px 8px",
                          fontSize: "12px",
                          cursor: "pointer",
                        }}
                        onClick={() => setSelectedProject(project)}
                      >
                        View Ongoing Details
                      </button>
                    </div>
                  </Popup>
                </Polyline>
              );
            })}
          </MapContainer>

          {/* Empty State Banner overlay if no ongoing projects exist for current filter */}
          {!loading && displayProjects.length === 0 && (
            <div
              style={{
                position: "absolute",
                top: "70px",
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 1000,
                background: "rgba(255, 255, 255, 0.95)",
                padding: "12px 22px",
                borderRadius: "8px",
                boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
                border: "1px solid #cbd5e1",
                fontSize: "14px",
                fontWeight: 600,
                color: "#334155",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <Activity size={18} color="#e05d48" />
              No ongoing projects available for the selected departments.
            </div>
          )}
        </section>
      </div>

      {/* Selected Project Details Modal */}
      {selectedProject && (
        <div className="modal-backdrop" onClick={() => setSelectedProject(null)} role="presentation">
          <section
            className="modal-content project-details-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedProject.project_name} details`}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">ONGOING PROJECT</p>
                <h2>{selectedProject.project_name}</h2>
              </div>
              <button type="button" className="text-button" onClick={() => setSelectedProject(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="detail-grid">
              <div>
                <small>Project ID</small>
                <strong>{selectedProject.project_id.slice(0, 8).toUpperCase()}</strong>
              </div>
              <div>
                <small>Status</small>
                <strong>{selectedProject.status}</strong>
              </div>
              <div>
                <small>Project type</small>
                <strong>{selectedProject.project_type}</strong>
              </div>
              <div>
                <small>Schedule</small>
                <strong>
                  Tentative Start: {selectedProject.start_date}
                  {selectedProject.duration ? ` · Duration: ${selectedProject.duration}` : ""}
                </strong>
              </div>
            </div>

            <div className="detail-description" style={{ marginTop: "1rem" }}>
              <small>Created By / Initiating Department</small>
              <strong style={{ fontSize: "1.05rem", color: "#0f172a", display: "block", marginTop: "2px" }}>
                {DEPT_NAMES[selectedProject.department || ""] || selectedProject.department || "Unassigned"}
              </strong>
            </div>

            <div className="detail-description" style={{ marginTop: "1rem" }}>
              <small>Coordinating Departments</small>
              {fetchingCoordinating ? (
                <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "13px" }}>Loading coordination info…</p>
              ) : coordinatingDepts.length > 0 ? (
                <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                  {coordinatingDepts.map((d) => (
                    <li key={d} style={{ fontWeight: 600, color: "#1e293b", marginBottom: "2px" }}>
                      {DEPT_NAMES[d] || d.replaceAll("-", " ")}
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: "4px 0 0", color: "#64748b", fontWeight: 500 }}>None yet</p>
              )}
            </div>

            {selectedProject.description && (
              <div className="detail-description" style={{ marginTop: "1rem" }}>
                <small>Work description</small>
                <p>{selectedProject.description}</p>
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: "1.5rem", justifyContent: "space-between" }}>
              <Link
                to={`/projects/${selectedProject.project_id}`}
                className="primary-button"
                style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                View Project Details <ExternalLink size={14} />
              </Link>
              <button type="button" className="secondary-button" onClick={() => setSelectedProject(null)}>
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
