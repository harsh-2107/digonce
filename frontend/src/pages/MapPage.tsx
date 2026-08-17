import { useState } from "react";
import { Layers } from "lucide-react";
import { MapContainer, Polyline, Popup, TileLayer, useMapEvents } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import { API_BASE, authHeaders, useAuth } from "@/context/AuthContext";
import { useGis } from "@/context/GisContext";
import type { UtilityType } from "@/context/GisContext";
import { GeoJsonLayer } from "@/components/GeoJsonLayer";
import { TopNav } from "@/components/TopNav";
import "leaflet/dist/leaflet.css";
import "@/App.css";

const layers: { id: UtilityType; label: string; color: string }[] = [
  { id: "water", label: "Water supply", color: "#2383d5" },
  { id: "sewage", label: "Sewage", color: "#8257d3" },
  { id: "drainage", label: "Drainage", color: "#e09b16" },
  { id: "natural-gas", label: "Natural gas", color: "#e05d48" },
  { id: "fibre", label: "Fibre network", color: "#14a683" },
];
const allLayerIds = layers.map((layer) => layer.id);

const DEPT_NAMES: Record<string, string> = {
  water: "Water Supply Department",
  sewage: "Sewage Department",
  drainage: "Drainage Department",
  "natural-gas": "Natural Gas Department",
  fibre: "Fibre Network Department",
  "super-admin": "City Administration",
};

const DEPT_COLORS: Record<string, string> = {
  water: "#2383d5",
  sewage: "#8257d3",
  drainage: "#e09b16",
  "natural-gas": "#e05d48",
  fibre: "#14a683",
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

export function MapPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { layers: gisLayers, loading, error } = useGis();

  const [active, setActive] = useState<UtilityType[]>(() =>
    user?.department === "super-admin"
      ? allLayerIds
      : [(user?.department as UtilityType) ?? "water"],
  );

  const [nearbyResult, setNearbyResult] = useState<CompletedNearResponse | null>(null);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);

  if (!user) return null;

  const toggle = (id: UtilityType) =>
    setActive((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );

  const reset = () =>
    setActive(
      user.department === "super-admin"
        ? allLayerIds
        : [user.department as UtilityType],
    );

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

  return (
    <main className="map-page">
      <TopNav />
      <div className="map-layout">
        <aside className="layer-panel">
          <div className="panel-title">
            <Layers size={18} />
            <div>
              <b>Network layers</b>
              <small>Toggle department data</small>
            </div>
          </div>
          {layers.map((layer) => (
            <button
              className={`layer-toggle ${active.includes(layer.id) ? "enabled" : ""}`}
              onClick={() => toggle(layer.id)}
              key={layer.id}
            >
              <i style={{ background: layer.color }} />
              {layer.label}
              <span>
                {gisLayers[layer.id]
                  ? `${gisLayers[layer.id]?.features.length} loaded`
                  : loading
                    ? "Loading…"
                    : "No data"}
              </span>
            </button>
          ))}
        </aside>

        <section className="map-workspace">
          <div className="map-toolbar">
            <div>
              <b>Nagpur, Maharashtra</b>
              <span>
                {loading
                  ? "Loading network data…"
                  : (error ??
                    `${active.length} layer${active.length === 1 ? "" : "s"} visible · Click road for completed project history`)}
              </span>
            </div>
            <button onClick={reset}>Reset filters</button>
          </div>

          <MapContainer
            center={[21.1458, 79.0882]}
            zoom={14}
            className="leaflet-map"
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapClickHandler onClick={handleMapClick} />

            {/* Underground Network GIS Layers */}
            {layers
              .filter(
                (layer) => active.includes(layer.id) && gisLayers[layer.id],
              )
              .map((layer) => (
                <GeoJsonLayer
                  key={layer.id}
                  data={gisLayers[layer.id]!}
                  color={layer.color}
                  label={layer.label}
                />
              ))}

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

          {/* Location-based Completed Project History Result Panel overlay */}
          {(loadingNearby || nearbyResult || nearbyError) && (
            <div
              style={{
                position: "absolute",
                bottom: "20px",
                right: "20px",
                width: "360px",
                maxWidth: "calc(100% - 40px)",
                maxHeight: "340px",
                overflowY: "auto",
                backgroundColor: "rgba(255, 255, 255, 0.96)",
                padding: "14px 16px",
                borderRadius: "8px",
                boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
                border: "1px solid #cbd5e1",
                zIndex: 1000,
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
                  top: "10px",
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
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: "2px" }}>
                    LOCATION COMPLETED-PROJECT HISTORY
                  </div>
                  <h4 style={{ margin: "0 0 4px", fontSize: "15px", color: "#0f172a", fontWeight: 700 }}>
                    {nearbyResult.nearest_road.road_name ?? "No nearby road found."}
                  </h4>
                  <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "10px" }}>
                    Clicked location: {nearbyResult.clicked_location.lat.toFixed(4)}, {nearbyResult.clicked_location.lng.toFixed(4)}
                    {nearbyResult.nearest_road.distance_from_click !== null &&
                      ` · ${nearbyResult.nearest_road.distance_from_click}m from road`}
                  </div>

                  {nearbyResult.projects.length === 0 ? (
                    <div style={{ fontSize: "13px", color: "#64748b", fontStyle: "italic", padding: "6px 0" }}>
                      No completed projects found near this location.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>
                        Completed projects near location ({nearbyResult.projects.length})
                      </div>
                      {nearbyResult.projects.map((proj) => {
                        const dept = proj.department || proj.department_id || "";
                        const color = DEPT_COLORS[dept] || "#64748b";
                        return (
                          <div
                            key={proj.project_id}
                            style={{
                              padding: "8px 10px",
                              backgroundColor: "#ffffff",
                              borderRadius: "6px",
                              border: "1px solid #e2e8f0",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: color, display: "inline-block" }} />
                                <span style={{ fontSize: "11px", fontWeight: 700, color }}>
                                  {DEPT_NAMES[dept] || dept.replace("-", " ").toUpperCase()}
                                </span>
                              </div>
                              <b style={{ fontSize: "12px", color: "#0f172a", display: "block" }}>{proj.project_name}</b>
                              <div style={{ fontSize: "11px", color: "#64748b" }}>
                                {proj.project_type} · Completed: {proj.completion_date || proj.end_date || "N/A"}
                              </div>
                            </div>
                            <button
                              className="secondary-button"
                              style={{ fontSize: "11px", padding: "4px 8px", cursor: "pointer" }}
                              onClick={() => navigate(`/projects/${proj.project_id}`)}
                            >
                              Select →
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
      </div>
    </main>
  );
}
