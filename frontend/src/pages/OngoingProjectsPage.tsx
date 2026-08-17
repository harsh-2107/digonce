import { useEffect, useMemo, useState } from "react";
import { Activity, ExternalLink, Filter, Layers, X } from "lucide-react";
import { Link } from "react-router-dom";
import { MapContainer, Polyline, Popup, TileLayer } from "react-leaflet";
import { API_BASE, authHeaders, useAuth } from "@/context/AuthContext";
import { useGis } from "@/context/GisContext";
import type { UtilityType } from "@/context/GisContext";
import { useProjects } from "@/context/ProjectsContext";
import type { Project } from "@/context/ProjectsContext";
import { GeoJsonLayer } from "@/components/GeoJsonLayer";
import { TopNav } from "@/components/TopNav";
import "leaflet/dist/leaflet.css";
import "@/App.css";

const DEPARTMENTS = [
  { id: "water", name: "Water Supply", color: "#2383d5" },
  { id: "sewage", name: "Sewerage", color: "#8257d3" },
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
  sewage: "Sewerage Department",
  drainage: "Drainage Department",
  "natural-gas": "Natural Gas Department",
  fibre: "Fibre Network Department",
  "super-admin": "City Administration",
};

const gisNetworkLayers: { id: UtilityType; label: string; color: string }[] = [
  { id: "water", label: "Water supply", color: "#2383d5" },
  { id: "sewage", label: "Sewage", color: "#8257d3" },
  { id: "drainage", label: "Drainage", color: "#e09b16" },
  { id: "natural-gas", label: "Natural gas", color: "#e05d48" },
  { id: "fibre", label: "Fibre network", color: "#14a683" },
];
const allGisLayerIds = gisNetworkLayers.map((l) => l.id);

const EXCLUDED_STATUSES = ["Draft", "Completed", "Cancelled", "Rejected", "DISCARDED"];

export function OngoingProjectsPage() {
  const { user } = useAuth();
  const { layers: gisLayers, loading: gisLoading, error: gisError } = useGis();
  const { projects, loading: projectsLoading, error: projectsError } = useProjects();

  const [selectedDept, setSelectedDept] = useState<string>("all");
  const [activeGisLayers, setActiveGisLayers] = useState<UtilityType[]>(allGisLayerIds);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [coordinatingDepts, setCoordinatingDepts] = useState<string[]>([]);
  const [fetchingCoordinating, setFetchingCoordinating] = useState<boolean>(false);

  if (!user) return null;

  const toggleGisLayer = (id: UtilityType) => {
    setActiveGisLayers((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  // Filter projects that are considered "Ongoing"
  const ongoingProjects = useMemo(() => {
    return projects.filter((p) => {
      if (!p.status || EXCLUDED_STATUSES.includes(p.status)) return false;
      if (!p.geometry || p.geometry.type !== "LineString" || !p.geometry.coordinates || p.geometry.coordinates.length < 2) {
        return false;
      }
      if (selectedDept !== "all" && p.department !== selectedDept) return false;
      return true;
    });
  }, [projects, selectedDept]);

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

  const isLoading = gisLoading || projectsLoading;
  const combinedError = gisError || projectsError;

  return (
    <main className="map-page">
      <TopNav />
      <div className="map-layout">
        <aside className="layer-panel">
          <div className="panel-title">
            <Filter size={18} />
            <div>
              <b>Ongoing Projects</b>
              <small>Filter by department</small>
            </div>
          </div>

          <div style={{ padding: "12px 14px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px", color: "#475569" }}>
              Department Filter
            </label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "13px",
                backgroundColor: "#fff",
                fontWeight: 500,
              }}
            >
              <option value="all">All Departments</option>
              {DEPARTMENTS.map((d) => (
                <option value={d.id} key={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ padding: "0 14px 14px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: "8px" }}>
              Project Style Legend
            </div>
            {DEPARTMENTS.map((d) => (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", marginBottom: "6px", color: "#334155" }}>
                <span
                  style={{
                    width: "20px",
                    height: "4px",
                    backgroundColor: d.color,
                    borderRadius: "2px",
                    display: "inline-block",
                  }}
                />
                <span>{d.name} Corridor</span>
              </div>
            ))}
          </div>

          <div className="panel-title" style={{ marginTop: "10px", borderTop: "1px solid #e2e8f0", paddingTop: "12px" }}>
            <Layers size={18} />
            <div>
              <b>Underground Network</b>
              <small>Infrastructure GIS layers</small>
            </div>
          </div>

          {gisNetworkLayers.map((layer) => (
            <button
              className={`layer-toggle ${activeGisLayers.includes(layer.id) ? "enabled" : ""}`}
              onClick={() => toggleGisLayer(layer.id)}
              key={layer.id}
            >
              <i style={{ background: layer.color }} />
              {layer.label}
              <span>
                {gisLayers[layer.id]
                  ? `${gisLayers[layer.id]?.features.length} loaded`
                  : gisLoading
                    ? "Loading…"
                    : "No data"}
              </span>
            </button>
          ))}
        </aside>

        <section className="map-workspace">
          <div className="map-toolbar">
            <div>
              <b>Nagpur Ongoing Infrastructure Work</b>
              <span>
                {isLoading
                  ? "Loading ongoing projects & GIS data…"
                  : (combinedError ??
                    `${ongoingProjects.length} ongoing project corridor${ongoingProjects.length === 1 ? "" : "s"} visible`)}
              </span>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setSelectedDept("all")}>Reset Dept Filter</button>
            </div>
          </div>

          <MapContainer center={[21.1458, 79.0882]} zoom={14} className="leaflet-map">
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* 1. Underground Network GIS Layers */}
            {gisNetworkLayers
              .filter((layer) => activeGisLayers.includes(layer.id) && gisLayers[layer.id])
              .map((layer) => (
                <GeoJsonLayer
                  key={layer.id}
                  data={gisLayers[layer.id]!}
                  color={layer.color}
                  label={layer.label}
                />
              ))}

            {/* 2. Ongoing Project Corridors (Rendered on top as dashed lines) */}
            {ongoingProjects.map((project) => {
              const positions = project.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
              const color = DEPT_COLORS[project.department || ""] || "#2563eb";

              return (
                <g key={`proj-group-${project.project_id}`}>
                  {/* Invisible thick polyline for easy click hit-testing */}
                  <Polyline
                    key={`hitbox-${project.project_id}`}
                    positions={positions}
                    pathOptions={{ color: "transparent", weight: 20, opacity: 0 }}
                    eventHandlers={{
                      click: () => setSelectedProject(project),
                    }}
                  />
                  {/* Visible dashed polyline representing ongoing corridor */}
                  <Polyline
                    key={`line-${project.project_id}`}
                    positions={positions}
                    pathOptions={{
                      color,
                      weight: 6,
                      dashArray: "10, 10",
                      opacity: 0.95,
                    }}
                    eventHandlers={{
                      click: () => setSelectedProject(project),
                    }}
                  >
                    <Popup>
                      <div style={{ minWidth: "180px" }}>
                        <b style={{ fontSize: "14px", display: "block", marginBottom: "4px" }}>{project.project_name}</b>
                        <div style={{ fontSize: "12px", color: "#475569", marginBottom: "2px" }}>
                          <b>Status:</b> {project.status}
                        </div>
                        <div style={{ fontSize: "12px", color: "#475569", marginBottom: "6px" }}>
                          <b>Created by:</b> {DEPT_NAMES[project.department || ""] || project.department}
                        </div>
                        <button
                          type="button"
                          className="primary-button"
                          style={{ width: "100%", padding: "4px 8px", fontSize: "12px", cursor: "pointer" }}
                          onClick={() => setSelectedProject(project)}
                        >
                          View Ongoing Details
                        </button>
                      </div>
                    </Popup>
                  </Polyline>
                </g>
              );
            })}
          </MapContainer>

          {/* Empty State Banner overlay if no ongoing projects exist for current filter */}
          {!isLoading && ongoingProjects.length === 0 && (
            <div
              style={{
                position: "absolute",
                top: "70px",
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 1000,
                background: "rgba(255, 255, 255, 0.95)",
                padding: "10px 20px",
                borderRadius: "8px",
                boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
                border: "1px solid #cbd5e1",
                fontSize: "14px",
                fontWeight: 600,
                color: "#334155",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Activity size={18} color="#e05d48" />
              {selectedDept === "all"
                ? "No ongoing projects available."
                : `No ongoing projects for ${DEPT_NAMES[selectedDept] || selectedDept}.`}
            </div>
          )}
        </section>
      </div>

      {/* Selected Project Details Popup/Modal */}
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
